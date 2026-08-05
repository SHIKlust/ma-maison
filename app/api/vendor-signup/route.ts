// /app/api/vendor-signup/route.ts
//
// Handles new vendor registration for a single category. A vendor adding
// a 2nd/3rd category later hits /api/vendor-signup/add-category instead
// (sketched at the bottom of this file) — company-level identity/KVK is
// NOT re-collected.
//
// Flow:
//   1. Create User (role=PARTNER) + PartnerProfile (company-level: KVK,
//      VAT, market) + PartnerIdentity (person-level: ID/passport)
//   2. Create PartnerCategory (status=DRAFT) for the chosen category
//   3. Vendor uploads documents client-side (separate upload endpoint,
//      not shown — writes VendorDocument rows scoped to partnerCategoryId
//      or null for company-level docs)
//   4. Vendor calls /api/vendor-signup/submit once done — server
//      re-validates every REQUIRED CategoryRequirement has a matching
//      VendorDocument before allowing status to advance past DRAFT.
//      This is the enforcement point: an incomplete application
//      physically cannot reach admin's queue.

import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const {
      email,
      password,
      companyName,
      kvkNumber,
      vatNumber,
      marketId,
      categoryId,
      identity, // { fullName, idType, idDocumentUrl }
    } = await request.json();

    if (!email || !password || !companyName || !kvkNumber || !vatNumber || !marketId || !categoryId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, passwordHash, role: 'PARTNER' },
      });

      const partner = await tx.partnerProfile.create({
        data: {
          userId: user.id,
          marketId,
          companyName,
          kvkNumber,
          vatNumber,
        },
      });

      if (identity) {
        await tx.partnerIdentity.create({
          data: {
            partnerId: partner.id,
            fullName: identity.fullName,
            idType: identity.idType,
            idDocumentUrl: identity.idDocumentUrl,
          },
        });
      }

      const partnerCategory = await tx.partnerCategory.create({
        data: {
          partnerId: partner.id,
          categoryId,
          status: 'DRAFT',
        },
      });

      await tx.vendorApplication.create({
        data: {
          partnerCategoryId: partnerCategory.id,
          status: 'DRAFT',
        },
      });

      return { partner, partnerCategory };
    });

    return NextResponse.json(
      {
        message: 'Vendor profile created. Upload required documents to proceed.',
        partnerId: result.partner.id,
        partnerCategoryId: result.partnerCategory.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ------------------------------------------------------------
// /app/api/vendor-signup/submit/route.ts
//
// Server-side gate: cannot move DRAFT -> SUBMITTED unless every
// isRequired CategoryRequirement for this market+category has a
// matching, non-expired VendorDocument. This is what makes "the
// application should not hit us unless all evidence is uploaded"
// actually enforced, not just a UI convention.
// ------------------------------------------------------------

export async function submitVendorApplication(partnerCategoryId: string) {
  const partnerCategory = await prisma.partnerCategory.findUniqueOrThrow({
    where: { id: partnerCategoryId },
    include: { partner: true },
  });

  const requirements = await prisma.categoryRequirement.findMany({
    where: {
      marketId: partnerCategory.partner.marketId,
      categoryId: partnerCategory.categoryId,
      isRequired: true,
    },
  });

  const uploadedDocs = await prisma.vendorDocument.findMany({
    where: {
      partnerId: partnerCategory.partnerId,
      OR: [
        { partnerCategoryId: partnerCategory.id }, // category-specific docs
        { partnerCategoryId: null },                // company-level docs (KVK, ID)
      ],
    },
  });

  const missing = requirements.filter(
    (req) =>
      !uploadedDocs.some(
        (doc) =>
          doc.documentType === req.documentType &&
          doc.status !== 'REJECTED' &&
          (doc.expiresAt === null || doc.expiresAt > new Date())
      )
  );

  if (missing.length > 0) {
    return {
      ok: false,
      missingDocuments: missing.map((m) => m.documentType),
    };
  }

  const updated = await prisma.$transaction([
    prisma.partnerCategory.update({
      where: { id: partnerCategoryId },
      data: { status: 'SUBMITTED' },
    }),
    prisma.vendorApplication.update({
      where: { partnerCategoryId },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
    }),
  ]);

  return { ok: true, application: updated[1] };
}

// ------------------------------------------------------------
// /app/api/vendor-signup/add-category/route.ts (sketch)
//
// For an EXISTING approved vendor adding a new service line.
// Reuses PartnerProfile (KVK/VAT/identity untouched) — only creates
// a new PartnerCategory + VendorApplication scoped to the new category.
// ------------------------------------------------------------

export async function addVendorCategory(partnerId: string, categoryId: string) {
  const existing = await prisma.partnerCategory.findUnique({
    where: { partnerId_categoryId: { partnerId, categoryId } },
  });
  if (existing) {
    return { ok: false, error: 'Vendor already has this category' };
  }

  const partnerCategory = await prisma.partnerCategory.create({
    data: { partnerId, categoryId, status: 'DRAFT' },
  });

  await prisma.vendorApplication.create({
    data: { partnerCategoryId: partnerCategory.id, status: 'DRAFT' },
  });

  return { ok: true, partnerCategoryId: partnerCategory.id };
}