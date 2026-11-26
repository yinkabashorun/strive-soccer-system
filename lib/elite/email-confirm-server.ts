// Email confirmation on the server (migration 093): send a code, check a
// code, change the email. Every answer is decided here; the rules and the
// words are lib/elite/email-confirm.ts.
//
// The code is made with crypto.randomInt, sent once by email, and never
// stored, returned or written to a log: only a SHA-256 hash of it, with the
// profile id mixed in, is kept (elite_email_codes.code_hash), and a typed
// code is compared to it in constant time.
//
// NOT READY = NOBODY ASKED. While RESEND_API_KEY is not set, or 093 is not
// applied, emailConfirmReady() is false: the gate never shows (session.ts
// reads the same two things off the profile row) and every function here
// answers "off" without touching anything.
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { createServiceClient } from "./supabase/server";
import { isEmailConfigured, sendDirectEmail } from "./email";
import {
  CODE_EMAIL,
  CODE_LENGTH,
  CONFIRM_COPY,
  MAX_TRIES,
  checkDecision,
  cleanCode,
  cleanEmail,
  expiresAt,
  sendDecision,
  type ConfirmAnswer,
} from "./email-confirm";

type Admin = NonNullable<ReturnType<typeof createServiceClient>>;

type CodeRow = {
  profile_id: string;
  code_hash: string;
  email: string;
  sent_at: string;
  window_started_at: string;
  expires_at: string;
  tries: number;
  sends: number;
};

const OFF: ConfirmAnswer = { ok: false, reason: "off", error: CONFIRM_COPY.sendFailed };

// Postgres "column/relation does not exist", or PostgREST's unknown column.
function missing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return ["42703", "42P01", "PGRST204", "PGRST205"].includes(error.code ?? "") || /does not exist|Could not find the/i.test(error.message ?? "");
}

export function hashCode(profileId: string, code: string): string {
  return createHash("sha256").update(`${profileId}:${code}`).digest("hex");
}

function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

function newCode(): string {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

type Profile = { id: string; email: string; full_name: string | null; role: string | null; confirmed: string | null };

// The account as the server needs it, or null when the sender is off, 093
// is not applied, or the row cannot be read.
async function readProfile(admin: Admin, profileId: string): Promise<Profile | null> {
  if (!isEmailConfigured()) return null;
  const { data, error } = await admin.from("elite_profiles").select("*").eq("id", profileId).maybeSingle();
  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  if (!("email_confirmed_at" in row)) return null;
  return {
    id: profileId,
    email: typeof row.email === "string" ? row.email : "",
    full_name: typeof row.full_name === "string" ? row.full_name : null,
    role: typeof row.role === "string" ? row.role : null,
    confirmed: typeof row.email_confirmed_at === "string" ? row.email_confirmed_at : null,
  };
}

// The sender is set up and 093 is applied.
export async function emailConfirmReady(): Promise<boolean> {
  if (!isEmailConfigured()) return false;
  const admin = createServiceClient();
  if (!admin) return false;
  const { error } = await admin.from("elite_profiles").select("email_confirmed_at").limit(1);
  return !missing(error) && !error;
}

async function readCode(admin: Admin, profileId: string): Promise<CodeRow | null> {
  const { data } = await admin.from("elite_email_codes").select("*").eq("profile_id", profileId).maybeSingle();
  return (data as CodeRow | null) ?? null;
}

function waitAnswer(waitSeconds: number, email: string): ConfirmAnswer {
  return { ok: false, reason: "wait", error: CONFIRM_COPY.resendWait(waitSeconds), waitSeconds, email };
}

// Send a new code to the account's email. Held to one a minute and five an
// hour. A send that fails puts the last code back as it was, so a failed
// email never uses up one of the five.
async function sendTo(admin: Admin, profile: Profile, now: Date): Promise<ConfirmAnswer> {
  if (!profile.email) return { ok: false, reason: "bad_email", error: CONFIRM_COPY.badEmail };
  const before = await readCode(admin, profile.id);
  const decision = sendDecision(
    before ? { sentAt: before.sent_at, windowStartedAt: before.window_started_at, sends: before.sends } : null,
    now
  );
  if (!decision.ok) return waitAnswer(decision.waitSeconds, profile.email);

  const code = newCode();
  const row: CodeRow = {
    profile_id: profile.id,
    code_hash: hashCode(profile.id, code),
    email: profile.email.toLowerCase(),
    sent_at: now.toISOString(),
    window_started_at: decision.windowReset || !before ? now.toISOString() : before.window_started_at,
    expires_at: expiresAt(now).toISOString(),
    tries: 0,
    sends: decision.windowReset || !before ? 1 : before.sends + 1,
  };
  const stored = await admin.from("elite_email_codes").upsert(row, { onConflict: "profile_id" });
  if (stored.error) return { ok: false, reason: "send_failed", error: CONFIRM_COPY.sendFailed, email: profile.email };

  const sent = await sendDirectEmail(
    { name: profile.full_name ?? "", email: profile.email },
    { subject: CODE_EMAIL.subject, body: CODE_EMAIL.body(code) }
  ).catch(() => false);
  if (!sent) {
    if (before) await admin.from("elite_email_codes").upsert(before, { onConflict: "profile_id" }).then(() => undefined, () => undefined);
    else await admin.from("elite_email_codes").delete().eq("profile_id", profile.id).then(() => undefined, () => undefined);
    return { ok: false, reason: "send_failed", error: CONFIRM_COPY.sendFailed, email: profile.email };
  }
  return { ok: true, email: profile.email };
}

// "Send a new code".
export async function sendCode(profileId: string, now = new Date()): Promise<ConfirmAnswer> {
  const admin = createServiceClient();
  if (!admin) return OFF;
  const profile = await readProfile(admin, profileId);
  if (!profile) return OFF;
  if (profile.role !== "player" || profile.confirmed) return { ok: true, email: profile.email };
  return sendTo(admin, profile, now);
}

// The first code, right after an account is made (the sign-up routes).
// Best effort: a failed send never fails the sign-up, and "Send a new
// code" on the screen covers it.
export async function sendFirstCode(profileId: string): Promise<void> {
  await sendCode(profileId).catch(() => undefined);
}

// "Confirm": the typed code against the stored hash.
export async function confirmCode(profileId: string, input: unknown, now = new Date()): Promise<ConfirmAnswer> {
  const code = cleanCode(input);
  if (!code) return { ok: false, reason: "bad_code", error: CONFIRM_COPY.badCode };
  const admin = createServiceClient();
  if (!admin) return OFF;
  const profile = await readProfile(admin, profileId);
  if (!profile) return OFF;
  if (profile.role !== "player" || profile.confirmed) return { ok: true, email: profile.email };

  const row = await readCode(admin, profileId);
  const decision = checkDecision(
    row ? { expiresAt: row.expires_at, tries: row.tries, email: row.email } : null,
    profile.email,
    now
  );
  if (decision === "too_many") return { ok: false, reason: "too_many", error: CONFIRM_COPY.tooMany, email: profile.email };
  if (decision === "expired" || decision === "none") {
    // the code ran out (or was sent to an email no longer the account's):
    // a new one goes out, within the same limits
    const sent = await sendTo(admin, profile, now);
    if (!sent.ok) return sent;
    return { ok: false, reason: "expired", error: CONFIRM_COPY.expired, email: profile.email };
  }

  if (!row || !sameHash(hashCode(profileId, code), row.code_hash)) {
    const tries = (row?.tries ?? 0) + 1;
    await admin.from("elite_email_codes").update({ tries }).eq("profile_id", profileId).then(() => undefined, () => undefined);
    return tries >= MAX_TRIES
      ? { ok: false, reason: "too_many", error: CONFIRM_COPY.tooMany, email: profile.email }
      : { ok: false, reason: "wrong", error: CONFIRM_COPY.wrong, email: profile.email };
  }

  const { error } = await admin.from("elite_profiles").update({ email_confirmed_at: now.toISOString() }).eq("id", profileId);
  if (error) return { ok: false, reason: "send_failed", error: CONFIRM_COPY.saveFailed, email: profile.email };
  await admin.from("elite_email_codes").delete().eq("profile_id", profileId).then(() => undefined, () => undefined);
  return { ok: true, email: profile.email };
}

// "Wrong email? Change it": a new address, checked with sign-up's rule,
// refused when another account has it, then a new code sent there. Held to
// the same send limits, checked BEFORE anything changes.
export async function changeEmail(profileId: string, input: unknown, now = new Date()): Promise<ConfirmAnswer> {
  const email = cleanEmail(input);
  if (!email) return { ok: false, reason: "bad_email", error: CONFIRM_COPY.badEmail };
  const admin = createServiceClient();
  if (!admin) return OFF;
  const profile = await readProfile(admin, profileId);
  if (!profile) return OFF;
  if (profile.role !== "player" || profile.confirmed) return { ok: true, email: profile.email };
  if (email === profile.email.toLowerCase()) return sendTo(admin, profile, now);

  const before = await readCode(admin, profileId);
  const decision = sendDecision(
    before ? { sentAt: before.sent_at, windowStartedAt: before.window_started_at, sends: before.sends } : null,
    now
  );
  if (!decision.ok) return waitAnswer(decision.waitSeconds, profile.email);

  const { data: others } = await admin.from("elite_profiles").select("id").eq("email", email).neq("id", profileId).limit(1);
  if ((others?.length ?? 0) > 0) return { ok: false, reason: "taken", error: CONFIRM_COPY.taken, email: profile.email };

  const { error: authError } = await admin.auth.admin.updateUserById(profileId, { email, email_confirm: true });
  if (authError) {
    const taken = /already|registered|exists/i.test(authError.message ?? "");
    return taken
      ? { ok: false, reason: "taken", error: CONFIRM_COPY.taken, email: profile.email }
      : { ok: false, reason: "send_failed", error: CONFIRM_COPY.changeFailed, email: profile.email };
  }
  await admin.from("elite_profiles").update({ email }).eq("id", profileId);
  return sendTo(admin, { ...profile, email }, now);
}
