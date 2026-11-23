// What an account still owes before it trains: a profile photo and an
// @username (Nov 23 2026, Coach Yinka: the photo is required, "Instagram
// style", and so is the username). Pure, so the gate, the onboarding
// steps and the server's refusal all read the same rule.
import { normalizeUsername, usernameProblem } from "./username";
import { ownsAvatarPath } from "./tracker";

export type ProfileSetup = {
  // false until migration 081 is applied, or when the profile row could
  // not be read: then nothing is asked and nothing is refused, so a
  // database hiccup can never lock a family out of their training
  available: boolean;
  username: string | null;
  hasPhoto: boolean;
  // The id in the stored photo's file name: changes with every new photo,
  // so the photo's address can be kept by the phone until it changes.
  photoKey: string | null;
};

export const NO_SETUP: ProfileSetup = { available: false, username: null, hasPhoto: false, photoKey: null };

// From the profile row as it was read (select *): the two columns are
// keys on it once 081 is applied, null or not.
export function setupFromRow(row: Record<string, unknown> | null | undefined, profileId: string): ProfileSetup {
  if (!row || !("username" in row) || !("avatar_path" in row)) return NO_SETUP;
  const username = typeof row.username === "string" && usernameProblem(row.username) === null ? normalizeUsername(row.username) : null;
  const path = typeof row.avatar_path === "string" ? row.avatar_path : "";
  const hasPhoto = Boolean(path) && ownsAvatarPath(path, profileId);
  return { available: true, username, hasPhoto, photoKey: hasPhoto ? photoKeyOf(path) : null };
}

export function needsUsername(s: ProfileSetup): boolean {
  return s.available && !s.username;
}

export function needsPhoto(s: ProfileSetup): boolean {
  return s.available && !s.hasPhoto;
}

// The one-time screen (existing accounts) and the last onboarding steps
// (new ones) show while this is true.
export function profileSetupDue(s: ProfileSetup): boolean {
  return needsUsername(s) || needsPhoto(s);
}

// What the server says when onboarding is finished without them.
export const SETUP_REFUSED = "Add your profile photo and pick a username first.";

// The screens, in order: the username first (one thing a screen), then
// the photo. Only the ones still owed are shown.
export type SetupStep = "username" | "photo";

export function setupSteps(s: ProfileSetup): SetupStep[] {
  const steps: SetupStep[] = [];
  if (needsUsername(s)) steps.push("username");
  if (needsPhoto(s)) steps.push("photo");
  return steps;
}

// The id in a stored photo's file name (<profile>/avatar-<id>.jpg).
export function photoKeyOf(path: string): string | null {
  return /\/avatar-([0-9a-f-]{36})\.jpg$/.exec(path)?.[1] ?? null;
}

// The address a phone loads its own photo (or, for a coach, a member's)
// from: our own route, the same for as long as the photo is the same, so
// it is downloaded once and kept (app/api/elite/profile/photo).
export function photoAddress(setup: Pick<ProfileSetup, "photoKey">, of?: string): string | null {
  if (!setup.photoKey) return null;
  return `/api/elite/profile/photo?v=${setup.photoKey}${of ? `&of=${of}` : ""}`;
}
