// prisma/seed.ts
//
// Seeds: Market (NL), VendorCategory, CategoryRequirement, CategoryVatRate.
//
// SOURCES (all official .gov / government-recognized bodies, checked Aug 2026):
// - HACCP / food safety plan requirement: business.gov.nl, kvk.nl
// - NVWA food business registration: business.gov.nl
// - VOG (background check): business.gov.nl, justis.nl
// - Taxi/passenger transport operator licence + VOG: business.gov.nl (Kiwa Register)
// - VAT rates: belastingdienst.nl, business.gov.nl, government.nl
//
// IMPORTANT: VAT rates below are only seeded where the classification is
// unambiguous per official sources. Categories where classification is
// genuinely unclear (e.g. whether a DJ/live-performance service qualifies
// for the reduced "cultural admission" rate or falls under standard rate)
// are deliberately left UNSEEDED with a TODO — do not guess a number that
// will end up on a real invoice. Confirm with an accountant before adding.

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  DocumentType,
  VatRateType,
  VatAppliesTo,
} from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // ------------------------------------------------------------
  // MARKET
  // ------------------------------------------------------------
  const nl = await prisma.market.upsert({
    where: { countryCode: 'NL' },
    update: {},
    create: {
      countryCode: 'NL',
      name: 'Netherlands',
      currency: 'EUR',
      language: 'nl',
      legalTermsVersion: 'v1.0-draft',
      isActive: true,
    },
  });

  // ------------------------------------------------------------
  // VENDOR CATEGORIES
  // ------------------------------------------------------------
  const categoryDefs = [
    { name: 'CATERER', slug: 'caterer' },
    { name: 'BARTENDER', slug: 'bartender' },
    { name: 'DJ', slug: 'dj' },
    { name: 'MUSICIAN_BAND', slug: 'musician-band' },
    { name: 'PHOTOGRAPHER', slug: 'photographer' },
    { name: 'VIDEOGRAPHER', slug: 'videographer' },
    { name: 'VENUE', slug: 'venue' },
    { name: 'DECORATOR', slug: 'decorator' },
    { name: 'KIDS_ENTERTAINER', slug: 'kids-entertainer' },
    { name: 'OFFICIANT', slug: 'officiant' },
    { name: 'PLANNER_COORDINATOR', slug: 'planner-coordinator' },
    { name: 'TRANSPORT', slug: 'transport' },
    { name: 'OTHER', slug: 'other' }, // catch-all; flags to admin for manual classification
  ];

  const categories: Record<string, { id: string }> = {};
  for (const def of categoryDefs) {
    categories[def.name] = await prisma.vendorCategory.upsert({
      where: { name: def.name },
      update: {},
      create: def,
    });
  }

  // ------------------------------------------------------------
  // CATEGORY REQUIREMENTS (per NL market)
  //
  // Baseline required for EVERY category, added in the loop below:
  //   - ID_PASSPORT (company-level, verified once — PartnerIdentity)
  //   - BUSINESS_REGISTRATION (KVK — company-level, verified once)
  //   - LIABILITY_INSURANCE (category-level unless admin confirms reuse)
  //
  // Category-specific additions are listed explicitly per category.
  // ------------------------------------------------------------

  const baseline: DocumentType[] = ['ID_PASSPORT', 'BUSINESS_REGISTRATION', 'LIABILITY_INSURANCE'];

  const categorySpecific: Record<string, { type: DocumentType; required: boolean; notes?: string }[]> = {
    CATERER: [
      { type: 'FOOD_SAFETY_PLAN', required: true, notes: 'HACCP plan or approved hygiene code (e.g. Horeca Nederland)' },
      { type: 'FOOD_AUTHORITY_REGISTRATION', required: true, notes: 'NVWA registration — mandatory for anyone preparing/selling food' },
      { type: 'REFERENCE_LETTER', required: false },
      { type: 'PORTFOLIO_MEDIA', required: true },
    ],
    BARTENDER: [
      { type: 'FOOD_SAFETY_PLAN', required: true, notes: 'HACCP applies to drink prep/handling as well as food' },
      { type: 'FOOD_AUTHORITY_REGISTRATION', required: false, notes: 'Required only if preparing/selling food alongside drinks — confirm per applicant' },
      { type: 'PORTFOLIO_MEDIA', required: false },
    ],
    DJ: [
      { type: 'PORTFOLIO_MEDIA', required: true, notes: 'Audio samples / mix reels' },
      { type: 'REFERENCE_LETTER', required: false },
    ],
    MUSICIAN_BAND: [
      { type: 'PORTFOLIO_MEDIA', required: true },
      { type: 'REFERENCE_LETTER', required: false },
    ],
    PHOTOGRAPHER: [
      { type: 'PORTFOLIO_MEDIA', required: true },
    ],
    VIDEOGRAPHER: [
      { type: 'PORTFOLIO_MEDIA', required: true },
    ],
    VENUE: [
      { type: 'OPERATING_LICENSE', required: false, notes: 'Horecavergunning / alcohol licence — required only if venue serves alcohol on-site' },
      { type: 'PORTFOLIO_MEDIA', required: true },
    ],
    DECORATOR: [
      { type: 'PORTFOLIO_MEDIA', required: true },
    ],
    KIDS_ENTERTAINER: [
      { type: 'BACKGROUND_CHECK', required: true, notes: 'VOG — required for anyone working directly with children, platform policy regardless of legal minimum' },
      { type: 'PORTFOLIO_MEDIA', required: true },
      { type: 'REFERENCE_LETTER', required: true },
    ],
    OFFICIANT: [
      { type: 'REFERENCE_LETTER', required: true },
      { type: 'PORTFOLIO_MEDIA', required: false },
    ],
    PLANNER_COORDINATOR: [
      { type: 'REFERENCE_LETTER', required: true },
    ],
    TRANSPORT: [
      { type: 'OPERATING_LICENSE', required: true, notes: 'Taxi/passenger transport operator licence (ondernemersvergunning voor taxivervoer) via Kiwa Register' },
      { type: 'BACKGROUND_CHECK', required: true, notes: 'VOG mandatory for taxi/passenger transport operators and drivers, employed or freelance' },
    ],
    OTHER: [
      // Deliberately minimal — admin reviews and manually assigns real requirements
      // once the category is properly classified.
    ],
  };

  for (const [categoryName, category] of Object.entries(categories)) {
    // Baseline docs
    for (const docType of baseline) {
      await prisma.categoryRequirement.upsert({
        where: {
          marketId_categoryId_documentType: {
            marketId: nl.id,
            categoryId: category.id,
            documentType: docType,
          },
        },
        update: {},
        create: {
          marketId: nl.id,
          categoryId: category.id,
          documentType: docType,
          isRequired: true,
        },
      });
    }

    // Category-specific docs
    const specifics = categorySpecific[categoryName] ?? [];
    for (const spec of specifics) {
      await prisma.categoryRequirement.upsert({
        where: {
          marketId_categoryId_documentType: {
            marketId: nl.id,
            categoryId: category.id,
            documentType: spec.type,
          },
        },
        update: {},
        create: {
          marketId: nl.id,
          categoryId: category.id,
          documentType: spec.type,
          isRequired: spec.required,
          notes: spec.notes,
        },
      });
    }
  }

  // ------------------------------------------------------------
  // CATEGORY VAT RATES (NL) — only where classification is unambiguous
  // per official sources. See file header for what's deliberately omitted.
  // ------------------------------------------------------------

  const vatSeed: {
    category: string;
    rateType: VatRateType;
    ratePercent: number;
    appliesTo: VatAppliesTo;
    sourceUrl: string;
    notes?: string;
  }[] = [
    {
      category: 'CATERER',
      rateType: 'REDUCED',
      ratePercent: 9,
      appliesTo: 'BOTH',
      sourceUrl: 'https://business.gov.nl/finance-and-taxes/vat/vat-rates-and-exemptions/',
      notes: 'Food/drink products fall under the 9% reduced rate per Belastingdienst guidance. Does not cover on-site hospitality service elements, which may differ — confirm with accountant for full-service catering vs food supply only.',
    },
    {
      category: 'VENUE',
      rateType: 'STANDARD',
      ratePercent: 21,
      appliesTo: 'BOTH',
      sourceUrl: 'https://business.gov.nl/amendments/vat-overnight-accommodation-goes-up/',
      notes: 'Short-stay accommodation moved from 9% to 21% as of 1 Jan 2026. Applies to venues offering overnight stays; day-use-only venue hire should be reassessed separately.',
    },
    {
      category: 'PHOTOGRAPHER',
      rateType: 'STANDARD',
      ratePercent: 21,
      appliesTo: 'BOTH',
      sourceUrl: 'https://business.gov.nl/finance-and-taxes/vat/vat-rates-and-exemptions/',
      notes: 'General service, no reduced-rate category applies.',
    },
    {
      category: 'VIDEOGRAPHER',
      rateType: 'STANDARD',
      ratePercent: 21,
      appliesTo: 'BOTH',
      sourceUrl: 'https://business.gov.nl/finance-and-taxes/vat/vat-rates-and-exemptions/',
    },
    {
      category: 'DECORATOR',
      rateType: 'STANDARD',
      ratePercent: 21,
      appliesTo: 'BOTH',
      sourceUrl: 'https://business.gov.nl/finance-and-taxes/vat/vat-rates-and-exemptions/',
    },
    {
      category: 'TRANSPORT',
      rateType: 'STANDARD',
      ratePercent: 21,
      appliesTo: 'BOTH',
      sourceUrl: 'https://business.gov.nl/finance-and-taxes/vat/vat-rates-and-exemptions/',
      notes: 'Domestic passenger transport (scheduled/public) can qualify for reduced rate, but private/chartered event transport is not confirmed as eligible — treat as standard rate until confirmed.',
    },
  ];

  // TODO — needs explicit accountant confirmation before seeding:
  //   DJ, MUSICIAN_BAND, KIDS_ENTERTAINER, OFFICIANT, PLANNER_COORDINATOR,
  //   BARTENDER, OTHER
  // Reason: "admission to cultural events" and "services by writers and
  // composers" qualify for the 9% reduced rate, but it is unclear whether
  // a hired performance/entertainment SERVICE at a private event qualifies
  // the same way admission to a public cultural event does. Do not guess.

  for (const entry of vatSeed) {
    const category = categories[entry.category];
    await prisma.categoryVatRate.upsert({
      where: {
        marketId_categoryId_appliesTo: {
          marketId: nl.id,
          categoryId: category.id,
          appliesTo: entry.appliesTo,
        },
      },
      update: {},
      create: {
        marketId: nl.id,
        categoryId: category.id,
        rateType: entry.rateType,
        ratePercent: entry.ratePercent,
        appliesTo: entry.appliesTo,
        sourceUrl: entry.sourceUrl,
        lastVerifiedAt: new Date(),
        verifiedBy: 'seed-script-initial-research',
        notes: entry.notes,
      },
    });
  }

  console.log('Seed complete:', {
    market: nl.countryCode,
    categories: Object.keys(categories).length,
    vatRatesSeeded: vatSeed.length,
    vatRatesPendingConfirmation: 7,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });