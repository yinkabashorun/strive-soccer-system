// The @username every account picks, members and free accounts alike
// (Nov 23 2026, Coach Yinka: "players should make a username during
// onboarding, Instagram style"). One namespace for every account, held in
// elite_profiles.username with a case-insensitive unique index (migration
// 081). Pure rules here, shared by the phone (to answer as they type) and
// the server (which decides).
import { isOffensive } from "./text-filter";

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

// Lowercase letters, numbers, dot and underscore. Held the same way in the
// database (081), so a name written another way can never be stored.
export const USERNAME_PATTERN = /^[a-z0-9._]{3,20}$/;

// Taken from the ends of what they typed: the @ they may add themselves,
// spaces, capitals.
export function normalizeUsername(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.trim().replace(/^@+/, "").toLowerCase();
}

// Words that read as Strive itself or as staff. A name is checked with its
// dots and underscores taken out, so "coach.yinka" and "strive_elite" are
// caught too. The coaches' own names are on it so nobody can pass for them.
export const RESERVED_EXACT = [
  "coach",
  "coaches",
  "admin",
  "support",
  "official",
  "help",
  "staff",
  "team",
  "moderator",
  "mod",
  "root",
  "system",
  "yinka",
  "gary",
  "yinkabashorun",
  "garygrigoryan",
  "thestriveapp",
] as const;

// Anything that starts with one of these is reserved ("striveofficial",
// "coachgary23").
export const RESERVED_PREFIXES = ["strive", "coachyinka", "coachgary"] as const;

// Anything that has one of these inside it is reserved ("realadmin").
export const RESERVED_INSIDE = ["official", "admin", "support", "moderator"] as const;

export function isReservedUsername(name: string): boolean {
  const compact = normalizeUsername(name).replace(/[._]/g, "");
  if (!compact) return false;
  if ((RESERVED_EXACT as readonly string[]).includes(compact)) return true;
  if (RESERVED_PREFIXES.some((p) => compact.startsWith(p))) return true;
  return RESERVED_INSIDE.some((w) => compact.includes(w));
}

export type UsernameProblem =
  | "short"
  | "long"
  | "characters"
  | "dots"
  | "letter"
  | "reserved"
  | "offensive";

export const USERNAME_MESSAGES: Record<UsernameProblem | "taken" | "offline", string> = {
  short: `Use at least ${USERNAME_MIN} characters.`,
  long: `Use ${USERNAME_MAX} characters or fewer.`,
  characters: "Use letters, numbers, dots and underscores only.",
  dots: "A dot cannot start or end it, or sit next to another dot.",
  letter: "Put at least one letter in it.",
  reserved: "That one is saved for Strive. Try another.",
  offensive: "That has words we don't allow. Try another.",
  taken: "That username is taken. Try another.",
  offline: "We could not check that right now. Try again in a moment.",
};

// What is wrong with a username, before anyone asks the database. null
// when it is a username that may be taken.
export function usernameProblem(input: unknown): UsernameProblem | null {
  const name = normalizeUsername(input);
  if (name.length < USERNAME_MIN) return "short";
  if (name.length > USERNAME_MAX) return "long";
  if (!USERNAME_PATTERN.test(name)) return "characters";
  if (name.startsWith(".") || name.endsWith(".") || name.includes("..")) return "dots";
  if (!/[a-z]/.test(name)) return "letter";
  if (isReservedUsername(name)) return "reserved";
  if (isOffensive(name) || isOffensive(name.replace(/[._]/g, " "))) return "offensive";
  return null;
}

// A few usernames to offer when they arrive, from their own name: the
// server then keeps the ones nobody has. Letters only from the name, so an
// accent or an apostrophe never makes a name that fails the rules.
export function usernameIdeas(fullName: string, seed = 0): string[] {
  const parts = (fullName || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .map((p) => p.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);
  const first = parts[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  const n = (k: number) => String(((seed + k * 37) % 89) + 10);
  const raw = [
    first && last ? `${first}.${last}` : "",
    first && last ? `${first}${last}` : "",
    first && last ? `${first}_${last[0]}` : "",
    first && last ? `${first}${last[0]}${n(1)}` : "",
    first ? `${first}.trains` : "",
    first ? `${first}${n(2)}` : "",
    first ? `${first}_${n(3)}` : "",
  ];
  const out: string[] = [];
  for (const r of raw) {
    const name = r.slice(0, USERNAME_MAX).replace(/[._]+$/, "");
    if (name && !out.includes(name) && usernameProblem(name) === null) out.push(name);
  }
  return out;
}

// How a username is shown: always with the @ in front.
export function atName(username: string | null | undefined): string | null {
  const name = normalizeUsername(username ?? "");
  return name ? `@${name}` : null;
}
