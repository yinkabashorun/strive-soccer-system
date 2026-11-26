// Email confirmation (migration 093, Nov 26 2026, Coach Yinka: "we must
// confirm email"). A new account gets a 6 digit code by email and types it
// in, in the iPhone app or on the website. No link to tap, nobody leaves
// the app.
//
// Pure, shared with the phone ("@shared/email-confirm"): the code's shape,
// how long it lasts, how many tries and new codes are allowed, who is
// asked, and every sentence a player reads. The server
// (lib/elite/email-confirm-server.ts) stores only a hash of the code and
// decides every answer; the phone only checks the shape as they type.
//
// Built like the photo and @username step (lib/elite/account-profile.ts):
// until 093 is applied, or while no email sender is set up, NOBODY is asked
// and nothing is refused, and a profile row that cannot be read opens the
// app anyway.

export const CODE_LENGTH = 6;
// the website's page for it (app/confirm-email); the phone's screen is
// mobile/app/confirm-email.tsx
export const CONFIRM_EMAIL_PATH = "/confirm-email";
// how long one code works
export const CODE_MINUTES = 15;
// wrong tries on one code before it stops working
export const MAX_TRIES = 5;
// a new code at most once a minute, and at most this many an hour
export const RESEND_SECONDS = 60;
export const SENDS_PER_HOUR = 5;
const HOUR_MS = 60 * 60_000;

// What the person typed, as a code: digits only (spaces and dashes a mail
// app or a paste may carry are dropped), or null when it is not 6 digits.
export function cleanCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const digits = input.replace(/[\s-]/g, "");
  return new RegExp(`^\\d{${CODE_LENGTH}}$`).test(digits) ? digits : null;
}

// The same email rule sign-up uses (lib/elite/tracker.ts joinProblem;
// tests/email-confirm.test.ts holds the two to one pattern).
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function cleanEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const email = input.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

export function expiresAt(sentAt: Date): Date {
  return new Date(sentAt.getTime() + CODE_MINUTES * 60_000);
}

export function isExpired(expires: string | Date, now: Date): boolean {
  return new Date(expires).getTime() <= now.getTime();
}

// The stored state of the last code, as the server reads it.
export type CodeState = {
  sentAt: string | null;
  windowStartedAt: string | null;
  sends: number;
};

// May a new code be sent now? `windowReset` says the hour has passed, so
// the count starts again with this send.
export type SendDecision =
  | { ok: true; windowReset: boolean }
  | { ok: false; reason: "wait" | "hour"; waitSeconds: number };

export function sendDecision(state: CodeState | null, now: Date): SendDecision {
  if (!state || !state.sentAt) return { ok: true, windowReset: true };
  const since = now.getTime() - new Date(state.sentAt).getTime();
  if (since < RESEND_SECONDS * 1000) {
    return { ok: false, reason: "wait", waitSeconds: Math.ceil((RESEND_SECONDS * 1000 - since) / 1000) };
  }
  const windowStart = state.windowStartedAt ? new Date(state.windowStartedAt).getTime() : 0;
  if (now.getTime() - windowStart >= HOUR_MS) return { ok: true, windowReset: true };
  if (state.sends >= SENDS_PER_HOUR) {
    return { ok: false, reason: "hour", waitSeconds: Math.ceil((windowStart + HOUR_MS - now.getTime()) / 1000) };
  }
  return { ok: true, windowReset: false };
}

// Whether a typed code may still be checked against the stored one.
export type CheckDecision = "check" | "expired" | "too_many" | "none";
export function checkDecision(
  row: { expiresAt: string; tries: number; email: string } | null,
  currentEmail: string,
  now: Date
): CheckDecision {
  if (!row) return "none";
  // a code sent to an email that is no longer the account's never counts
  if (row.email.toLowerCase() !== currentEmail.toLowerCase()) return "none";
  if (row.tries >= MAX_TRIES) return "too_many";
  if (isExpired(row.expiresAt, now)) return "expired";
  return "check";
}

// Who is asked. `ready`: the sender is set up AND 093's column was on the
// profile row as it was read. Coaches (and the admin) are never asked; the
// example tour never has `ready` (its viewer is not read from the
// database).
export function emailConfirmDue(input: { ready: boolean; confirmedAt: string | null | undefined; role: string | null | undefined }): boolean {
  if (!input.ready) return false;
  if (input.role !== "player") return false;
  return !input.confirmedAt;
}

// From the profile row as it was read (select *): the column is a key on it
// once 093 is applied, null or not. A row that was not read asks nothing.
export function emailDueFromRow(
  row: Record<string, unknown> | null | undefined,
  senderOn: boolean,
  role: string | null | undefined
): boolean {
  if (!row || !("email_confirmed_at" in row)) return false;
  const at = row.email_confirmed_at;
  return emailConfirmDue({ ready: senderOn, confirmedAt: typeof at === "string" ? at : null, role });
}

// "in 40 seconds" / "in 12 minutes", for when a new code can be sent.
export function waitWords(seconds: number): string {
  const s = Math.max(1, Math.ceil(seconds));
  if (s < 60) return `${s} ${s === 1 ? "second" : "seconds"}`;
  const m = Math.ceil(s / 60);
  return `${m} ${m === 1 ? "minute" : "minutes"}`;
}

// Every sentence a player reads, on the phone and the website.
export const CONFIRM_COPY = {
  eyebrow: "Your account",
  title: "Check your email",
  body: (email: string) => `We sent a 6 digit code to ${email}. Type the code here.`,
  field: "Code from your email",
  confirm: "Confirm",
  resend: "Send a new code",
  resent: "Sent. Check your email.",
  resendWait: (seconds: number) => `You can get a new code in ${waitWords(seconds)}.`,
  changeLink: "Wrong email? Change it",
  changeTitle: "Change your email",
  changeBody: "Type the email you want to use. We send a new code there.",
  changeField: "Your email",
  changeButton: "Send the code",
  changeBack: "Keep my email",
  wrong: "That code does not match. Check the email and try again.",
  expired: "That code ran out. We sent you a new one.",
  tooMany: "Too many tries. Wait a minute, then tap Send a new code.",
  badCode: "Type the 6 digit code from your email.",
  badEmail: "That email doesn't look right. Check it and try again.",
  taken: "Another account already uses that email.",
  sendFailed: "We could not send the email just now. Tap Send a new code to try again.",
  saveFailed: "We could not save that just now. Try again in a minute.",
  changeFailed: "We could not change your email just now. Try again in a minute.",
  done: "Your email is confirmed.",
  signOut: "Sign out",
  deleteAccount: "Delete my account",
} as const;

// The email itself.
export const CODE_EMAIL = {
  subject: "Your Strive Elite code",
  body: (code: string) =>
    `Your Strive Elite code is ${code}. It works for ${CODE_MINUTES} minutes.\n\nIf you did not make a Strive Elite account, ignore this email.`,
} as const;

// What the routes and server actions answer.
export type ConfirmReason = "wrong" | "expired" | "too_many" | "bad_code" | "bad_email" | "taken" | "wait" | "send_failed" | "off";
export type ConfirmAnswer =
  | { ok: true; email?: string }
  | { ok: false; reason: ConfirmReason; error: string; waitSeconds?: number; email?: string };
