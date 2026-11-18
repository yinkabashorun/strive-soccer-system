// Signing in, on the server. Pure rules; the actions that use them are in
// auth-actions.ts.
//
// Why the server (App Store punch list A18): a session cookie written by
// script in the browser is capped at 7 days by WebKit, so a member who
// skipped a week was signed out of the iPhone app. A cookie the server
// sets in its response is not capped. So the password never signs anyone
// in from the browser any more: the form posts to a server action, the
// server client signs in, and the session arrives by Set-Cookie. There is
// one path, held by tests/sign-in.test.ts.
import { safeNext } from "./auth-links";
import { PASSWORD_MIN } from "./account";

// Where a person lands after signing in. Coaches and the owner go to the
// coach side, a player to their home screen. A `next` address is honoured
// only when it is a path on our own site.
export function signInLanding(input: { role: string | null | undefined; next?: string | null }): string {
  const staff = input.role === "coach" || input.role === "admin";
  return safeNext(input.next, staff ? "/coach" : "/dashboard");
}

export type SignInProblem =
  | "missing"
  | "wrong"
  | "unconfirmed"
  | "too_many"
  | "unreachable"
  | "not_configured"
  | "unknown";

// One plain line for every way signing in can fail. Never the service's
// own wording, never a blank screen.
export const SIGN_IN_MESSAGES: Record<SignInProblem, string> = {
  missing: "Enter your email and your password.",
  wrong:
    "That email and password do not match. Check them and try again, or tap Forgot your password.",
  unconfirmed:
    "This email has not been confirmed yet. Open the confirmation email we sent, then sign in.",
  too_many: "Too many tries in a row. Wait a few minutes, then try again.",
  unreachable:
    "We could not reach the sign-in service. Check your connection and try again in a minute.",
  not_configured: "Sign-in isn't configured yet. Try a demo account below.",
  unknown: "Something stopped the sign-in. Try again in a minute.",
};

type AuthErrorLike = {
  message?: string | null;
  status?: number | null;
  code?: string | null;
  name?: string | null;
} | null | undefined;

// Reads the sign-in service's error (or a thrown one) into one of ours.
export function signInProblem(error: AuthErrorLike | unknown): SignInProblem {
  const e = (error ?? {}) as NonNullable<AuthErrorLike>;
  const message = String(e.message ?? "").toLowerCase();
  const code = String(e.code ?? "").toLowerCase();
  const name = String(e.name ?? "").toLowerCase();
  const status = typeof e.status === "number" ? e.status : null;

  if (code === "invalid_credentials" || message.includes("invalid login credentials")) return "wrong";
  if (code === "email_not_confirmed" || message.includes("not confirmed")) return "unconfirmed";
  if (status === 429 || code.includes("rate_limit") || message.includes("rate limit")) return "too_many";
  if (
    name.includes("retryablefetch") ||
    name === "typeerror" ||
    message.includes("fetch failed") ||
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("timeout") ||
    status === 0 ||
    (status !== null && status >= 500)
  ) {
    return "unreachable";
  }
  if (status === 400 || status === 401 || status === 403) return "wrong";
  return "unknown";
}

// Setting a new password from the reset link.
export function newPasswordProblem(input: { password: string; confirm: string }): string | null {
  if (input.password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (input.password !== input.confirm) return "Those passwords don't match.";
  return null;
}

export const NEW_PASSWORD_FAILED =
  "Couldn't update the password. Request a fresh link and try again.";
export const NEW_PASSWORD_UNREACHABLE =
  "We could not reach the server, so the password was not changed. Try again in a minute.";
export const NEW_PASSWORD_NO_SESSION =
  "That link has expired. Request a fresh one from Forgot your password.";
