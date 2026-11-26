import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CODE_EMAIL,
  CODE_MINUTES,
  CONFIRM_COPY,
  EMAIL_PATTERN,
  MAX_TRIES,
  RESEND_SECONDS,
  SENDS_PER_HOUR,
  checkDecision,
  cleanCode,
  cleanEmail,
  emailConfirmDue,
  emailDueFromRow,
  expiresAt,
  isExpired,
  sendDecision,
} from "@/lib/elite/email-confirm";
import { accessAllowed } from "@/lib/elite/app-api";

// Email confirmation (093, Nov 26 2026: "we must confirm email"). What is
// held here: the code's shape and lifetime, the tries and the send limits,
// who is asked (never a coach, nobody while the sender or 093 is missing),
// that the server stores only a hash and never logs the code, that the
// migration confirms every account that already exists, and the words.

const read = (p: string) => readFileSync(p, "utf8");
const t0 = new Date("2026-11-26T15:00:00Z");
const at = (ms: number) => new Date(t0.getTime() + ms);

describe("the code", () => {
  it("is 6 digits; spaces and dashes from a paste are dropped", () => {
    expect(cleanCode("123456")).toBe("123456");
    expect(cleanCode(" 123 456 ")).toBe("123456");
    expect(cleanCode("123-456")).toBe("123456");
    expect(cleanCode("12345")).toBeNull();
    expect(cleanCode("1234567")).toBeNull();
    expect(cleanCode("12345a")).toBeNull();
    expect(cleanCode(123456)).toBeNull();
    expect(cleanCode(null)).toBeNull();
  });

  it("works for 15 minutes", () => {
    expect(CODE_MINUTES).toBe(15);
    const exp = expiresAt(t0);
    expect(isExpired(exp, at(14 * 60_000))).toBe(false);
    expect(isExpired(exp, at(15 * 60_000))).toBe(true);
  });

  it("allows 5 wrong tries, for the email it was sent to only", () => {
    expect(MAX_TRIES).toBe(5);
    const row = { expiresAt: expiresAt(t0).toISOString(), tries: 0, email: "m@example.com" };
    expect(checkDecision(row, "M@example.com", at(1000))).toBe("check");
    expect(checkDecision({ ...row, tries: 4 }, "m@example.com", at(1000))).toBe("check");
    expect(checkDecision({ ...row, tries: 5 }, "m@example.com", at(1000))).toBe("too_many");
    expect(checkDecision(row, "m@example.com", at(16 * 60_000))).toBe("expired");
    expect(checkDecision(row, "new@example.com", at(1000))).toBe("none");
    expect(checkDecision(null, "m@example.com", at(1000))).toBe("none");
  });
});

describe("a new code", () => {
  it("at most once a minute", () => {
    expect(RESEND_SECONDS).toBe(60);
    const state = { sentAt: t0.toISOString(), windowStartedAt: t0.toISOString(), sends: 1 };
    const early = sendDecision(state, at(20_000));
    expect(early).toEqual({ ok: false, reason: "wait", waitSeconds: 40 });
    expect(sendDecision(state, at(60_000))).toEqual({ ok: true, windowReset: false });
    expect(sendDecision(null, t0)).toEqual({ ok: true, windowReset: true });
  });

  it("at most 5 an hour, then the hour starts again", () => {
    expect(SENDS_PER_HOUR).toBe(5);
    const state = { sentAt: at(10 * 60_000).toISOString(), windowStartedAt: t0.toISOString(), sends: 5 };
    const held = sendDecision(state, at(20 * 60_000));
    expect(held.ok).toBe(false);
    if (!held.ok) {
      expect(held.reason).toBe("hour");
      expect(held.waitSeconds).toBe(40 * 60);
    }
    expect(sendDecision(state, at(60 * 60_000))).toEqual({ ok: true, windowReset: true });
  });
});

describe("who is asked", () => {
  it("a new player account, once the sender and 093 are both in", () => {
    expect(emailConfirmDue({ ready: true, confirmedAt: null, role: "player" })).toBe(true);
    expect(emailConfirmDue({ ready: true, confirmedAt: "2026-11-26T15:00:00Z", role: "player" })).toBe(false);
  });

  it("never a coach or the admin", () => {
    expect(emailConfirmDue({ ready: true, confirmedAt: null, role: "coach" })).toBe(false);
    expect(emailConfirmDue({ ready: true, confirmedAt: null, role: "admin" })).toBe(false);
  });

  it("NOBODY while it is not ready: no sender, 093 not applied, or a row that was not read", () => {
    expect(emailConfirmDue({ ready: false, confirmedAt: null, role: "player" })).toBe(false);
    expect(emailDueFromRow({ email_confirmed_at: null }, false, "player")).toBe(false);
    expect(emailDueFromRow({ email: "m@example.com" }, true, "player")).toBe(false); // no column yet
    expect(emailDueFromRow(null, true, "player")).toBe(false);
    expect(emailDueFromRow({ email_confirmed_at: null }, true, "player")).toBe(true);
    expect(emailDueFromRow({ email_confirmed_at: "2026-11-26T15:00:00Z" }, true, "player")).toBe(false);
  });

  it("the viewer reads it from the same profile row, and the example tour never is", () => {
    const session = read("lib/elite/session.ts");
    expect(session).toContain("emailDue: emailDueFromRow(profile as Record<string, unknown> | null, isEmailConfigured(), role)");
    expect(session.match(/emailDue: false/g)!.length).toBe(2); // both example viewers
  });

  it("while it is owed, the iPhone app's API answers only the account routes", () => {
    const ok = { kind: "ok" as const };
    expect(accessAllowed("account", ok, false, true)).toBe(true);
    for (const level of ["player", "member", "person", "free", "free_only", "free_app"] as const) {
      expect(accessAllowed(level, ok, false, true)).toBe(false);
      expect(accessAllowed(level, { kind: "free", stage: "ready" }, false, true)).toBe(false);
    }
    expect(accessAllowed("member", ok, false, false)).toBe(true);
    expect(read("lib/elite/app-api.ts")).toContain("profileSetupDue(viewer.setup), viewer.emailDue)");
  });

  it("every shell on the website sends a new account to the page, before anything else", () => {
    for (const file of ["app/(player)/layout.tsx", "app/(free)/layout.tsx", "app/onboarding/page.tsx"]) {
      const src = read(file);
      const at = src.indexOf("if (viewer.emailDue) redirect(CONFIRM_EMAIL_PATH)");
      expect(at, file).toBeGreaterThan(0);
      // before the agreement and the photo, where the shell asks for them
      const later = ["consentDue(", "profileSetupDue("].map((s) => src.indexOf(s, src.indexOf("export default"))).filter((i) => i > 0);
      for (const i of later) expect(at, file).toBeLessThan(i);
    }
    expect(read("app/account/page.tsx")).toContain("!viewer.emailDue");
    expect(read("middleware.ts")).toContain('"/confirm-email"');
    expect(read("lib/elite/app-review.ts")).toContain('path: "/confirm-email"');
  });

  it("the phone puts it first, and a coach is never sent there", () => {
    const nav = read("mobile/src/navigation.ts");
    expect(nav).toContain('if (emailConfirm && state.kind !== "coach") return "confirm-email";');
    expect(read("mobile/app/_layout.tsx")).toContain("me.data?.emailConfirm");
    expect(read("lib/elite/app-data.ts")).toContain("emailConfirm: viewer.emailDue ? { email: viewer.profile.email } : null");
  });
});

describe("the server", () => {
  const server = read("lib/elite/email-confirm-server.ts");

  it("makes the code with crypto.randomInt and stores only its hash, with the profile id mixed in", () => {
    expect(server).toContain("randomInt(0, 10 ** CODE_LENGTH)");
    expect(server).toContain('createHash("sha256").update(`${profileId}:${code}`)');
    expect(server).toContain("code_hash: hashCode(profile.id, code)");
    expect(server).toContain("timingSafeEqual");
    // the code is never a column, never returned, never logged
    expect(server).not.toMatch(/console\./);
    expect(server).not.toMatch(/\bcode:\s*code\b/);
    expect(server).not.toMatch(/return\s*\{[^}]*\bcode\b[^}]*\}/);
  });

  it("goes out through Resend only, never a GHL workflow", () => {
    expect(server).toContain("sendDirectEmail(");
    const email = read("lib/elite/email.ts");
    expect(email).toMatch(/export async function sendDirectEmail[\s\S]{0,200}dispatchResend\(\[to\], mail\)/);
  });

  it("says nothing and changes nothing while it is not ready", () => {
    expect(server).toMatch(/async function readProfile[\s\S]{0,120}if \(!isEmailConfigured\(\)\) return null;/);
    expect(server).toContain('if (!("email_confirmed_at" in row)) return null;');
  });

  it("a failed send puts the last code back, so it never uses up a try or a send", () => {
    expect(server).toMatch(/if \(!sent\) \{[\s\S]{0,300}upsert\(before[\s\S]{0,300}delete\(\)/);
  });

  it("checks the send limits before an email is changed, and refuses one another account has", () => {
    const change = server.slice(server.indexOf("export async function changeEmail"));
    expect(change.indexOf("sendDecision(")).toBeLessThan(change.indexOf("updateUserById"));
    expect(change).toContain(".neq(\"id\", profileId)");
    expect(change).toContain("email_confirm: true");
  });

  it("every sign-up sends the first code, and a failed send never fails the sign-up", () => {
    for (const file of ["app/api/elite/auth/join/route.ts", "app/api/elite/pro/signup/route.ts", "app/api/elite/auth/redeem/route.ts"]) {
      expect(read(file), file).toContain("await sendFirstCode(userId);");
    }
    expect(server).toMatch(/export async function sendFirstCode[\s\S]{0,120}\.catch\(\(\) => undefined\)/);
  });
});

describe("the migration", () => {
  const sql = read("supabase/migrations/093_email_confirmation.sql");

  it("is additive and safe to run twice", () => {
    expect(sql).not.toMatch(/\bdrop\b/i);
    expect(sql).toContain("set lock_timeout = '8s';");
    expect(sql).toContain("add column if not exists email_confirmed_at timestamptz");
    expect(sql).toContain("create table if not exists public.elite_email_codes");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("for select using (public.elite_is_coach())");
    expect(sql).not.toMatch(/create policy[\s\S]*for (insert|update|delete|all)/i);
  });

  it("stores a hash, never a code", () => {
    expect(sql).toContain("code_hash text not null");
    expect(sql).not.toMatch(/\bcode text\b/);
  });

  it("marks every account that already exists confirmed, so only new ones are asked", () => {
    expect(sql).toMatch(/update public\.elite_profiles\s+set email_confirmed_at = now\(\)\s+where email_confirmed_at is null;/);
  });
});

describe("the words", () => {
  const all = [
    ...Object.values(CONFIRM_COPY).map((v) => (typeof v === "function" ? (v as (x: never) => string)("m@example.com" as never) : v)),
    CONFIRM_COPY.resendWait(40),
    CODE_EMAIL.subject,
    CODE_EMAIL.body("123456"),
  ];

  it("no em dashes, nothing a player should never read", () => {
    for (const line of all) {
      expect(line).not.toMatch(/—/);
      expect(line).not.toMatch(/\b(AI|automated|automatically|algorithm)\b/i);
    }
  });

  it("the email says the code, how long it works, and what to do if it was not you", () => {
    const body = CODE_EMAIL.body("123456");
    expect(body).toContain("123456");
    expect(body).toContain("It works for 15 minutes.");
    expect(body).toContain("If you did not make a Strive Elite account, ignore this email.");
  });

  it("says when the next code can be sent", () => {
    expect(CONFIRM_COPY.resendWait(40)).toBe("You can get a new code in 40 seconds.");
    expect(CONFIRM_COPY.resendWait(30 * 60)).toBe("You can get a new code in 30 minutes.");
  });

  it("checks an email with sign-up's own rule", () => {
    expect(read("lib/elite/tracker.ts")).toContain(EMAIL_PATTERN.source);
    expect(cleanEmail(" New@Example.com ")).toBe("new@example.com");
    expect(cleanEmail("not an email")).toBeNull();
  });

  it("the phone and the website use these words, never their own", () => {
    const phone = read("mobile/app/confirm-email.tsx");
    const web = read("components/elite/ConfirmEmailScreen.tsx");
    for (const src of [phone, web]) {
      expect(src).toContain("CONFIRM_COPY.title");
      expect(src).toContain("CONFIRM_COPY.field");
      expect(src).toContain("CONFIRM_COPY.resend");
      expect(src).toContain("CONFIRM_COPY.changeLink");
      expect(src).toContain("CONFIRM_COPY.signOut");
      expect(src).toContain("CONFIRM_COPY.deleteAccount");
    }
    // one box the phone fills from Mail, typed in the shared form page
    expect(phone).toContain('textContentType="oneTimeCode"');
    expect(phone).toContain("<FormScreen");
    expect(phone).toContain("<LabeledField");
    expect(web).toContain('autoComplete="one-time-code"');
  });
});

// Found in the simulator's picture (Nov 26 2026): with the keyboard up the
// page brought the code box to the top and scrolled "Check your email" and
// the address the code was sent to out of sight.
describe("the code screen keeps its title and the address on screen", () => {
  it("the box rests where it already is when the keyboard comes up", () => {
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const screen = readFileSync("mobile/app/confirm-email.tsx", "utf8");
    expect(screen).toContain("revealTop={CODE_REVEAL_TOP}");
    const top = Number(/const CODE_REVEAL_TOP = (\d+);/.exec(screen)?.[1]);
    // the box sits a little over 200 points down the page (title, two lines, the field's name)
    expect(top).toBeGreaterThanOrEqual(220);
  });
});
