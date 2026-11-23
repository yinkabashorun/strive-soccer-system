import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AGREEMENT_POINTS,
  GUARDIAN_STATEMENT,
  LEGAL_VERSION,
  TERMS_STATEMENT,
  agreementComplete,
  cleanGuardianName,
  needsConsent,
} from "../lib/elite/legal";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// Every account accepts the Terms and the Privacy Policy, and the
// acceptance is on record (migration 068). These hold the rules.
describe("the agreement", () => {
  it("is asked once per version, and again when the version changes", () => {
    expect(needsConsent([])).toBe(true);
    expect(needsConsent(["2026-01-01"])).toBe(true);
    expect(needsConsent([LEGAL_VERSION])).toBe(false);
    expect(needsConsent(["2026-01-01", LEGAL_VERSION])).toBe(false);
    expect(LEGAL_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("needs both boxes, ticked for real", () => {
    expect(agreementComplete({ guardian: true, terms: true })).toBe(true);
    expect(agreementComplete({ guardian: true, terms: false })).toBe(false);
    expect(agreementComplete({ guardian: false, terms: true })).toBe(false);
    expect(agreementComplete({ guardian: "true", terms: "true" })).toBe(false);
    expect(agreementComplete({ guardian: 1, terms: 1 })).toBe(false);
    expect(agreementComplete({})).toBe(false);
  });

  it("takes a real name from the adult agreeing", () => {
    expect(cleanGuardianName("  Tatsiana   Kovaleva ")).toBe("Tatsiana Kovaleva");
    expect(cleanGuardianName("T")).toBeNull();
    expect(cleanGuardianName("")).toBeNull();
    expect(cleanGuardianName("x".repeat(81))).toBeNull();
    expect(cleanGuardianName(null)).toBeNull();
  });

  it("says who is agreeing, what to, and how to stop texts, in the house voice", () => {
    expect(GUARDIAN_STATEMENT).toContain("parent or legal guardian");
    expect(GUARDIAN_STATEMENT).toContain("18 or older");
    expect(TERMS_STATEMENT).toContain("Terms of Service");
    expect(TERMS_STATEMENT).toContain("Privacy Policy");
    const all = [...AGREEMENT_POINTS, GUARDIAN_STATEMENT, TERMS_STATEMENT].join(" ");
    expect(all).toContain("Reply STOP");
    expect(all).toContain("service providers");
    expect(all).not.toContain("—");
    expect(all).not.toMatch(/your (child|kid)\b/i);
  });
});

describe("the agreement is enforced, not just shown", () => {
  it("no account is created without it, and it is recorded when one is", () => {
    const route = read("app/api/elite/auth/redeem/route.ts");
    const check = route.indexOf("agreementComplete(");
    const create = route.indexOf("auth.admin.createUser(");
    const record = route.indexOf("recordConsent(");
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(create); // refused before anything exists
    expect(record).toBeGreaterThan(create); // recorded for the new account
    expect(route).toContain('source: "signup"');
  });

  it("the sign-up boxes start empty and are required", () => {
    const form = read("components/elite/SignupForm.tsx");
    expect(form).toContain("useState(false);\n  const [terms, setTerms] = useState(false);");
    expect(form).toContain("GUARDIAN_STATEMENT");
    expect(form).toContain('href="/terms"');
    expect(form).toContain('href="/privacy"');
    expect(form).not.toContain("defaultChecked");
    // the old fine print ("By creating an account you agree") is gone:
    // agreement is an action, not a footnote
    expect(form).not.toContain("By creating an account you agree");
  });

  it("a member who has not accepted sees the agreement before the app", () => {
    const layout = read("app/(player)/layout.tsx");
    const gate = layout.indexOf("consentDue(");
    expect(gate).toBeGreaterThan(-1);
    expect(layout.indexOf("<AgreementScreen")).toBeGreaterThan(gate);
    // before the membership gate and the app itself
    expect(gate).toBeLessThan(layout.indexOf("gateFor("));
    // never in the demo tour (read side by side with the player and the
    // week, so the shell asks the database once, Nov 23 2026)
    expect(layout).toMatch(/viewer\.demo \? false : consentDue\(viewer\.profile\.id\)/);
  });

  it("the in-app screen records the adult's name and can always be left", () => {
    const action = read("lib/elite/legal-actions.ts");
    expect(action).toContain("agreementComplete(");
    expect(action).toContain("cleanGuardianName(");
    expect(action).toContain('source: "in_app"');
    const screen = read("components/elite/AgreementScreen.tsx");
    expect(screen).not.toContain("defaultChecked");
    expect(screen).toContain('href="/account"'); // delete the account instead
    expect(screen).toContain("Sign out");
    expect(screen).toContain('href="/terms"');
    expect(screen).toContain('href="/privacy"');
  });

  it("a database hiccup never locks a family out", () => {
    const server = read("lib/elite/legal-server.ts");
    expect(server).toMatch(/if \(!admin\) return false;/);
    expect(server).toMatch(/if \(error \|\| !data\) return false;/);
  });

  it("the record is append-only and leaves only with the account", () => {
    const sql = read("supabase/migrations/068_consents.sql");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("on delete cascade");
    expect(sql).toContain("unique (profile_id, version)");
    expect(sql).not.toMatch(/for (update|delete|all|insert)/i);
  });
});

describe("the Terms and the Privacy Policy say what the app does", () => {
  const terms = read("app/terms/page.tsx");
  const privacy = read("app/privacy/page.tsx");

  it("the Terms cover what every app's terms cover", () => {
    for (const section of [
      "Who can join",
      "Not medical advice",
      "Clips and messages",
      "Texts and notifications",
      "Deleting your account",
      "The iPhone app",
      "Physical activity and assumption of risk",
      "Limitation of liability",
    ]) {
      expect(terms, section).toContain(`title="${section}"`);
    }
    expect(terms).toContain("Reply STOP");
    expect(terms).toContain("under\n              13");
    expect(terms).toContain("No purchase is made inside the app");
  });

  it("the Privacy Policy names the agreement record and the ad pixel", () => {
    expect(privacy).toContain("record of that acceptance");
    expect(privacy).toContain("advertising pixel");
    expect(privacy).toContain("Film Room");
  });

  it("both pages carry a date no older than the version families accept", () => {
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    for (const page of [terms, privacy]) {
      const m = page.match(/const UPDATED = "(\w+) (\d+), (\d{4})"/)!;
      const iso = `${m[3]}-${String(months.indexOf(m[1]) + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
      expect(iso >= LEGAL_VERSION).toBe(true);
    }
  });
});
