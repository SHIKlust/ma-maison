// /app/api/vendor-documents/upload-url/route.ts
//
// Cloudflare R2 is S3-compatible, so this uses the standard AWS SDK S3
// client pointed at R2's endpoint — no separate SDK needed.
// Docs: https://developers.cloudflare.com/r2/api/s3/api/
//
// Flow:
//   1. Frontend calls this route with { documentType, partnerCategoryId? }
//   2. Server generates a presigned PUT URL (R2 never sees your app's
//      credentials; the browser uploads directly to R2)
//   3. Frontend PUTs the file directly to the returned URL
//   4. Frontend calls /api/vendor-documents/confirm with the resulting
//      object key to create the VendorDocument row (status: PENDING_REVIEW)

import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { prisma } from '@/lib/prisma';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: Request) {
  const { partnerId, partnerCategoryId, documentType, fileName, contentType } = await request.json();

  if (!partnerId || !documentType || !fileName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Namespaced key so files are never guessable/enumerable across vendors
  const objectKey = `vendor-documents/${partnerId}/${documentType}/${Date.now()}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: objectKey,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 300 }); // 5 min to complete upload

  return NextResponse.json({ uploadUrl, objectKey });
}

// ------------------------------------------------------------
// /app/api/vendor-documents/confirm/route.ts
//
// Called after the browser successfully PUTs the file to R2. Creates the
// actual VendorDocument row. Kept as a separate step (not done in the
// presign call) so a document is never recorded as "uploaded" until it
// genuinely exists in R2.
// ------------------------------------------------------------

export async function confirmVendorDocument(input: {
  partnerId: string;
  partnerCategoryId?: string;
  documentType: string;
  objectKey: string;
  expiresAt?: Date; // e.g. VOG/insurance renewal date, captured from vendor at upload time
}) {
  // R2 public/private access is typically served via a Worker or signed
  // GET URL rather than a public bucket — store the key, resolve the
  // viewable URL at read-time, not here.
  const fileUrl = `r2://${process.env.R2_BUCKET_NAME}/${input.objectKey}`;

  return prisma.vendorDocument.create({
    data: {
      partnerId: input.partnerId,
      partnerCategoryId: input.partnerCategoryId,
      documentType: input.documentType as any,
      fileUrl,
      expiresAt: input.expiresAt,
      status: 'PENDING_REVIEW',
    },
  });
}