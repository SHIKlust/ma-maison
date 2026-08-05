// /lib/turnstile.ts
//
// Cloudflare Turnstile — CAPTCHA alternative, invisible in most cases.
// Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
//
// Frontend: render the Turnstile widget on the signup form, which produces
// a token. That token is sent alongside the signup payload and verified
// server-side before any database writes happen — this is what actually
// stops bot submissions, not the widget's presence alone.

export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<boolean> {
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: token,
      remoteip: remoteIp,
    }),
  });

  const data = await response.json();
  return data.success === true;
}

// ------------------------------------------------------------
// Usage inside /app/api/vendor-signup/route.ts — add near the top,
// before any prisma writes:
// ------------------------------------------------------------
//
// const { turnstileToken, ...rest } = await request.json();
// const ip = request.headers.get('x-forwarded-for') ?? undefined;
// const isHuman = await verifyTurnstileToken(turnstileToken, ip);
// if (!isHuman) {
//   return NextResponse.json({ error: 'Bot verification failed' }, { status: 403 });
// }