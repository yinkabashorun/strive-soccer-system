// The agreement every account accepts (Nov 18 2026): the pure rules.
//
// Every family accepts the Terms of Service and the Privacy Policy when the
// account is created, and again whenever LEGAL_VERSION changes; each
// acceptance is recorded (elite_consents, migration 068) with the version,
// the time and where it happened. The wording accepted is whatever these
// constants and the two pages said at that version: the git history of this
// file and of app/terms and app/privacy is the record of the words.
//
// Bump LEGAL_VERSION (the date, YYYY-MM-DD) ONLY when the Terms or the
// Privacy Policy change in a way a family should agree to again. Every
// member is then asked once, the next time they open the app.
export const LEGAL_VERSION = "2026-11-18";

// Who is agreeing. Members are minors, so the adult says so in plain words.
export const GUARDIAN_STATEMENT =
  "I am this player's parent or legal guardian, or I am the player and I am 18 or older.";

export const TERMS_STATEMENT = "I agree to the Terms of Service and the Privacy Policy.";

// What that agreement covers, in three plain lines, shown above the boxes.
// The second line is the Privacy Policy's own wording for the tools that
// help prepare plans: Apple (App Review 5.1.2) asks that sharing data with
// such a service is stated where permission is given, not only in a policy.
export const AGREEMENT_POINTS: string[] = [
  "We store your player's profile, training, clips and messages to run their program.",
  "Some of that information is handled by the service providers named in the Privacy Policy, including automated tools that help our coaches prepare training plans.",
  "We text you about your player's training. Message and data rates may apply. Reply STOP to any text to end them.",
];

export type ConsentSource = "signup" | "in_app";

// Does this account still need to accept the current version?
export function needsConsent(acceptedVersions: string[]): boolean {
  return !acceptedVersions.includes(LEGAL_VERSION);
}

// What the sign-up route and the in-app screen both require before
// anything is recorded: both boxes, ticked by the person, never by default.
export function agreementComplete(input: { guardian?: unknown; terms?: unknown }): boolean {
  return input.guardian === true && input.terms === true;
}

// The typed name of the adult accepting inside the app: a real name, kept
// short. Null when it is not usable.
export function cleanGuardianName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 80) return null;
  return name;
}

export const AGREEMENT_REQUIRED_MESSAGE =
  "Tick both boxes to agree to the Terms and the Privacy Policy before creating the account.";

// The in-app agreement screen (the website's and the iPhone app's): both
// boxes ticked and the typed name of the adult agreeing. The name to
// record, or the one line to show.
export function inAppAgreement(input: {
  guardian?: unknown;
  terms?: unknown;
  guardianName?: unknown;
}): { ok: true; name: string } | { ok: false; error: string } {
  if (!agreementComplete({ guardian: input.guardian, terms: input.terms })) {
    return { ok: false, error: "Tick both boxes to continue." };
  }
  const name = cleanGuardianName(input.guardianName);
  if (!name) return { ok: false, error: "Type the full name of the parent or guardian who is agreeing." };
  return { ok: true, name };
}
