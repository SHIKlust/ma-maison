// /app/api/vendor-requirements/route.ts
//
// GET /api/vendor-requirements?marketId=xxx&categoryId=yyy
//
// Returns the list of documents a vendor must upload for a given
// category in a given market. The signup form renders purely off
// this response — no category-specific logic lives in the frontend.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const marketId = searchParams.get('marketId');
  const categoryId = searchParams.get('categoryId');

  if (!marketId || !categoryId) {
    return NextResponse.json(
      { error: 'marketId and categoryId are required' },
      { status: 400 }
    );
  }

  const requirements = await prisma.categoryRequirement.findMany({
    where: { marketId, categoryId },
    orderBy: { isRequired: 'desc' }, // required docs surface first in the UI
  });

  if (requirements.length === 0) {
    // Either an unconfigured category (shouldn't happen for seeded ones)
    // or the OTHER catch-all — flag rather than silently render nothing.
    return NextResponse.json({
      requirements: [],
      note: 'No configured requirements found. If this is the OTHER category, admin will define requirements manually after review.',
    });
  }

  return NextResponse.json({
    requirements: requirements.map((r) => ({
      documentType: r.documentType,
      isRequired: r.isRequired,
      notes: r.notes,
    })),
  });
}

// GET /api/vendor-requirements/categories?marketId=xxx
// (separate handler pattern, shown here as reference — in practice this
// would live at /app/api/vendor-categories/route.ts)
//
// export async function GET_CATEGORIES(marketId: string) {
//   return prisma.vendorCategory.findMany();
// }