// Where an auth email link may land, and what to do with it. Pure.
//
// Oct 19 2026, Bryan: he asked for a password reset on thestriveapp.com,
// Supabase rewrote the link's redirect to the project's Site URL (still
// the old strive-soccer-system.vercel.app) because thestriveapp.com was
// not on the auth redirect allow list, Gmail opened it in its own
// browser, and the one-time code landed on the wrong domain's front door
// with nothing to exchange it. He was locked out for the rest of the
// night with a live week waiting. Two independent guards, so one
// misstep can never strand a family again:
//
// 1. authCodeLanding: a PKCE `code` that lands on the ROOT of the app
//    (where a Site-URL-rewritten link arrives) is handed to the callback
//    with next=/reset instead of being dropped. Same-domain only by
//    nature (the PKCE verifier cookie lives on the originating domain),
//    which is why guard 2 exists.
// 2. confirmTarget: the token_hash flow (/auth/confirm). A link of the
//    form /auth/confirm?token_hash=...&type=recovery&next=/reset is
//    verified server-side and needs no browser cookie, so it works when
//    the family opens the email in Gmail, Outlook or any other app. It
//    goes live the moment the Supabase "Reset password" email template
//    points at it.

export const AUTH_OTP_TYPES = [
  "recovery",
  "signup",
  "invite",
  "magiclink",
  "email_change",
  "email",
] as const;
export type AuthOtpType = (typeof AUTH_OTP_TYPES)[number];

// Only same-site relative paths are ever used as a destination, so a
// crafted link cannot bounce a family to another site after sign-in.
export function safeNext(next: string | null | undefined, fallback: string): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}

export function authCodeLanding(params: {
  code: string | null;
  next?: string | null;
}): string | null {
  const code = params.code?.trim();
  if (!code) return null;
  const next = safeNext(params.next, "/reset");
  return `/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`;
}

export type ConfirmTarget = {
  tokenHash: string;
  type: AuthOtpType;
  next: string;
};

export function confirmTarget(params: {
  token_hash: string | null;
  type: string | null;
  next?: string | null;
}): ConfirmTarget | null {
  const tokenHash = params.token_hash?.trim();
  const type = params.type?.trim() as AuthOtpType | undefined;
  if (!tokenHash || !type || !AUTH_OTP_TYPES.includes(type)) return null;
  const fallback = type === "recovery" ? "/reset" : "/dashboard";
  return { tokenHash, type, next: safeNext(params.next, fallback) };
}
