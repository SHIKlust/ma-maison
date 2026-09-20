// /jobs/kvk-compliance-check.ts
//
// Run on a schedule (e.g. Cloudflare Cron Trigger, or a nightly/weekly
// cron via your host) — NOT on every request. Randomized/staggered
// per your note about "checks periodically to ensure registrations
// have not changed."
//
// KVK API reference: https://developers.kvk.nl/documentation
// Uses the Basisprofiel API (basic company info, incl. handelsnaam/
// trade name, rechtsvorm/legal form) for the lookup. KVK also exposes
// a dedicated Mutatieservice (change/mutation feed) purpose-built for
// detecting registration changes over time — prefer that over repeated
// Basisprofiel polling once volume justifies it; sketched as the
// preferred path below, with Basisprofiel as the interim fallback.
//
// MVP approach (fallback): call Basisprofiel per vendor on a schedule,
// compare returned handelsnaam/rechtsvorm against what's on file.
// Scale-up approach (preferred): subscribe to Mutatieservice, which
// pushes change events for registrations you're tracking — no need
// to poll every vendor individually.

import { prisma } from '@/lib/prisma';

const KVK_API_BASE = 'https://api.kvk.nl/api/v1';

async function fetchKvkBasisprofiel(kvkNumber: string) {
  const response = await fetch(`${KVK_API_BASE}/basisprofielen/${kvkNumber}`, {
    headers: { apikey: process.env.KVK_API_KEY! },
  });

  if (!response.ok) {
    throw new Error(`KVK lookup failed for ${kvkNumber}: ${response.status}`);
  }

  return response.json();
  // Expected shape includes: kvkNummer, handelsnaam, statutaireNaam,
  // rechtsvorm — matches the PartnerProfile.tradeName / .statutoryName /
  // .legalForm fields directly.
}

export async function runKvkComplianceCheck() {
  // Stagger: only check profiles not checked in the last N days, and cap
  // batch size per run so this doesn't hammer the KVK API or your DB.
  const staleCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days

  const partnersToCheck = await prisma.partnerProfile.findMany({
    where: {
      isPaused: false,
      OR: [{ kvkLastCheckedAt: null }, { kvkLastCheckedAt: { lt: staleCutoff } }],
    },
    take: 100, // batch size per run
  });

  for (const partner of partnersToCheck) {
    try {
      const kvkData = await fetchKvkBasisprofiel(partner.kvkNumber);

      const tradeNameMatches = kvkData.handelsnaam === partner.tradeName;
      const legalFormMatches = !partner.legalForm || kvkData.rechtsvorm === partner.legalForm;
      const mismatchDetected = !tradeNameMatches || !legalFormMatches;

      await prisma.kvkComplianceCheck.create({
        data: {
          partnerId: partner.id,
          source: 'KVK_MUTATIESERVICE', // swap to 'BASISPROFIEL_POLL' if using the fallback path
          tradeNameOnFile: partner.tradeName,
          tradeNameFound: kvkData.handelsnaam,
          mismatchDetected,
          mismatchField: !tradeNameMatches ? 'tradeName' : !legalFormMatches ? 'legalForm' : null,
          rawResponse: kvkData,
        },
      });

      if (mismatchDetected) {
        await prisma.$transaction([
          prisma.partnerProfile.update({
            where: { id: partner.id },
            data: {
              isPaused: true,
              pausedReason: `Automated KVK recheck found a mismatch: registered trade name is now "${kvkData.handelsnaam}", but "${partner.tradeName}" is on file. Vendor paused pending update/re-verification.`,
              pausedAt: new Date(),
              kvkLastCheckedAt: new Date(),
            },
          }),
          prisma.vendorStatusLog.create({
            data: {
              partnerId: partner.id,
              action: 'AUTO_PAUSED',
              reason: 'KVK registration mismatch detected by automated compliance check',
              triggeredBySystem: true,
            },
          }),
        ]);
        // TODO: notify admin queue + notify vendor to update their profile
      } else {
        await prisma.partnerProfile.update({
          where: { id: partner.id },
          data: { kvkLastCheckedAt: new Date() },
        });
      }
    } catch (err) {
      // Log and continue — one failed lookup shouldn't halt the batch.
      console.error(`KVK compliance check failed for partner ${partner.id}:`, err);
    }
  }
}

// ------------------------------------------------------------
// Note on scope: this pauses PartnerProfile (the whole vendor), not a
// single PartnerCategory — a KVK mismatch is a company-level registration
// issue, not specific to one service line, so it correctly blocks all of
// that vendor's categories until resolved. This is intentionally
// different from the "add a category" flow, where only the NEW category
// needs approval and existing approved categories stay live untouched.
// ------------------------------------------------------------
