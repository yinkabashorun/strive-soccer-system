// The one profile photo and the one @username of an account, members and
// free accounts alike (migration 081). Both live on elite_profiles, the row
// every account has. The photo file sits in the account's own folder of
// the private tracker-posts bucket (<profile id>/avatar-<id>.jpg), the
// same place the free app has kept profile photos since 069, and is only
// ever handed out as a short-lived signed address.
//
// Until 081 is applied the two columns are not there. Every reader here
// then answers as if nothing were set and the gate stays open
// (lib/elite/account-profile.ts setupFor), and a free account's photo is
// still read from and written to elite_trackers.avatar_path, where it
// lived before; 081 copies those over.
import { createServiceClient } from "./supabase/server";
import { POST_BUCKET, POST_URL_SECONDS, AVATAR_MAX_BYTES, avatarPath, looksLikeJpeg, ownsAvatarPath } from "./tracker";
import { USERNAME_PATTERN, normalizeUsername, usernameIdeas, usernameProblem, type UsernameProblem } from "./username";
import { NO_SETUP, setupFromRow, type ProfileSetup } from "./account-profile";

type Admin = NonNullable<ReturnType<typeof createServiceClient>>;

// Postgres: "column does not exist" (42703). PostgREST answers PGRST204
// for an unknown column in a write.
function missingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42703" || error.code === "PGRST204" || /column .* does not exist|Could not find the/i.test(error.message ?? "");
}

// ---- Photos -----------------------------------------------------------

// The stored photo path of each of these accounts (only paths in the
// account's own folder). Pre-081: from elite_trackers.
export async function avatarPathsOf(admin: Admin, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 200) {
    const slice = unique.slice(i, i + 200);
    let rows: { id: string; avatar_path: string | null }[] = [];
    const { data, error } = await admin.from("elite_profiles").select("id, avatar_path").in("id", slice).not("avatar_path", "is", null);
    if (missingColumn(error)) {
      const old = await admin.from("elite_trackers").select("profile_id, avatar_path").in("profile_id", slice).not("avatar_path", "is", null);
      rows = ((old.data as { profile_id: string; avatar_path: string | null }[] | null) ?? []).map((r) => ({ id: r.profile_id, avatar_path: r.avatar_path }));
    } else {
      rows = (data as { id: string; avatar_path: string | null }[] | null) ?? [];
    }
    for (const r of rows) if (r.avatar_path && ownsAvatarPath(r.avatar_path, r.id)) out.set(r.id, r.avatar_path);
  }
  return out;
}

// Signed addresses for the photos of these accounts. A caller passes only
// ids the viewer may see a photo of; no id is ever taken from the browser.
export async function avatarUrlsOf(admin: Admin, ids: string[]): Promise<Map<string, string>> {
  const byId = await avatarPathsOf(admin, ids);
  const out = new Map<string, string>();
  if (byId.size === 0) return out;
  const paths = [...byId.values()];
  const { data } = await admin.storage.from(POST_BUCKET).createSignedUrls(paths, POST_URL_SECONDS);
  const signed = new Map<string, string>();
  for (const row of data ?? []) if (row.path && row.signedUrl) signed.set(row.path, row.signedUrl);
  for (const [id, path] of byId) {
    const url = signed.get(path);
    if (url) out.set(id, url);
  }
  return out;
}

// The signed-in account's own photo, for its own screens.
export async function myAvatarUrl(profileId: string): Promise<string | null> {
  const admin = createServiceClient();
  if (!admin) return null;
  return (await avatarUrlsOf(admin, [profileId])).get(profileId) ?? null;
}

// The bytes of an account's photo, for the photo route. The path is the
// account's own, read on the server; nothing from the browser names it.
export async function readProfilePhoto(profileId: string): Promise<ArrayBuffer | null> {
  const admin = createServiceClient();
  if (!admin) return null;
  const path = (await avatarPathsOf(admin, [profileId])).get(profileId);
  if (!path) return null;
  const { data, error } = await admin.storage.from(POST_BUCKET).download(path);
  if (error || !data) return null;
  return data.arrayBuffer();
}

// Where the pointer to an account's photo is written: the profile row,
// or (pre-081) the free account's tracker row.
async function writePointer(admin: Admin, profileId: string, path: string | null): Promise<boolean> {
  const { error } = await admin.from("elite_profiles").update({ avatar_path: path }).eq("id", profileId);
  if (!error) {
    // keep a free account's old pointer in step, so nothing reads a photo
    // that was replaced (it is copied over by 081 and unused after)
    await admin.from("elite_trackers").update({ avatar_path: path }).eq("profile_id", profileId);
    return true;
  }
  if (!missingColumn(error)) return false;
  const old = await admin.from("elite_trackers").update({ avatar_path: path }).eq("profile_id", profileId).select("profile_id");
  return !old.error && (old.data?.length ?? 0) > 0;
}

// Store a new profile photo for this account, replacing the old one. NOT
// a server action: called only by the photo route, with the account it
// established from the session and a photo it already cleaned.
export async function saveProfilePhoto(profileId: string, photo: Uint8Array): Promise<boolean> {
  const admin = createServiceClient();
  if (!admin) return false;
  if (!looksLikeJpeg(photo) || photo.length > AVATAR_MAX_BYTES) return false;
  const path = avatarPath(profileId, crypto.randomUUID());
  if (!path) return false;
  const before = (await avatarPathsOf(admin, [profileId])).get(profileId) ?? null;
  const up = await admin.storage.from(POST_BUCKET).upload(path, photo, { contentType: "image/jpeg", upsert: false });
  if (up.error) return false;
  if (!(await writePointer(admin, profileId, path))) {
    await admin.storage.from(POST_BUCKET).remove([path]).catch(() => undefined);
    return false;
  }
  if (before && before !== path && ownsAvatarPath(before, profileId)) {
    await admin.storage.from(POST_BUCKET).remove([before]).catch(() => undefined);
  }
  return true;
}

// Take an account's photo off: the file and the pointer. Used by a coach
// (the report queue, a member's page). The photo is required, so the
// account is asked for a new one the next time it opens the app.
export async function clearProfilePhoto(profileId: string): Promise<boolean> {
  const admin = createServiceClient();
  if (!admin) return false;
  const old = (await avatarPathsOf(admin, [profileId])).get(profileId) ?? null;
  if (!(await writePointer(admin, profileId, null))) return false;
  if (old && ownsAvatarPath(old, profileId)) await admin.storage.from(POST_BUCKET).remove([old]).catch(() => undefined);
  return true;
}

// What another account has set, for a coach's screens (a member's page).
export async function setupOfAccount(profileId: string | null | undefined): Promise<ProfileSetup> {
  const admin = createServiceClient();
  if (!admin || !profileId) return NO_SETUP;
  const { data, error } = await admin.from("elite_profiles").select("*").eq("id", profileId).maybeSingle();
  if (error) return NO_SETUP;
  return setupFromRow(data as Record<string, unknown> | null, profileId);
}

// ---- Usernames ----------------------------------------------------------

export type UsernameCheck =
  | { ok: true; name: string }
  | { ok: false; name: string; problem: UsernameProblem | "taken" | "offline" };

// Is this username free for this account? The rules first, then the
// database. "Free" includes the account's own current username.
export async function checkUsernameFor(profileId: string | null, input: unknown): Promise<UsernameCheck> {
  const name = normalizeUsername(input);
  const problem = usernameProblem(name);
  if (problem) return { ok: false, name, problem };
  const admin = createServiceClient();
  if (!admin) return { ok: true, name }; // the example account: nothing to check against
  const { data, error } = await admin.from("elite_profiles").select("id").ilike("username", escapeLike(name)).limit(1);
  if (error) return { ok: false, name, problem: "offline" };
  const holder = (data as { id: string }[] | null)?.[0]?.id ?? null;
  if (holder && holder !== profileId) return { ok: false, name, problem: "taken" };
  return { ok: true, name };
}

// Take a username for this account. The unique index (081) is the last
// word: two people asking for the same name at the same moment, one gets
// it and the other is told it is taken.
export async function claimUsername(profileId: string, input: unknown): Promise<UsernameCheck> {
  const check = await checkUsernameFor(profileId, input);
  if (!check.ok) return check;
  const admin = createServiceClient();
  if (!admin) return check;
  const { error } = await admin.from("elite_profiles").update({ username: check.name }).eq("id", profileId);
  if (!error) return check;
  if (error.code === "23505") return { ok: false, name: check.name, problem: "taken" };
  return { ok: false, name: check.name, problem: "offline" };
}

// Usernames to offer when they arrive, from their own name, keeping only
// the ones nobody has. Never more than three.
export async function suggestUsernames(profileId: string, fullName: string): Promise<string[]> {
  const ideas = usernameIdeas(fullName, profileId.charCodeAt(0) || 0);
  const admin = createServiceClient();
  if (!admin || ideas.length === 0) return ideas.slice(0, 3);
  const { data, error } = await admin.from("elite_profiles").select("username").in("username", ideas);
  if (error) return ideas.slice(0, 3);
  const taken = new Set(((data as { username: string | null }[] | null) ?? []).map((r) => normalizeUsername(r.username ?? "")));
  return ideas.filter((n) => !taken.has(n)).slice(0, 3);
}

// The usernames of these accounts, for the screens that show them.
export async function usernamesOf(admin: Admin, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 200) {
    const { data, error } = await admin.from("elite_profiles").select("id, username").in("id", unique.slice(i, i + 200)).not("username", "is", null);
    if (error) return out;
    for (const r of (data as { id: string; username: string | null }[] | null) ?? []) if (r.username) out.set(r.id, r.username);
  }
  return out;
}

// The ONE account that has exactly this username, or null. A username is
// stored in lower case (081 holds it in the database), so an equals on the
// normalized name is the exact match with capitals ignored: never part of
// a name, never a pattern, never a list. "offline" when it could not be
// read. For adding a friend by their @username (lib/elite/friend-add-server.ts).
export async function accountByUsername(admin: Admin, name: string): Promise<{ id: string; full_name: string } | null | "offline"> {
  const exact = normalizeUsername(name);
  // a name that is not shaped like a username is one nobody has
  if (!USERNAME_PATTERN.test(exact)) return null;
  const { data, error } = await admin.from("elite_profiles").select("id, full_name").eq("username", exact).limit(2);
  if (error) return "offline";
  const rows = (data as { id: string; full_name: string | null }[] | null) ?? [];
  return rows.length === 1 ? { id: rows[0].id, full_name: rows[0].full_name ?? "" } : null;
}

// ilike with no wildcards: an underscore in a username is a literal.
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}
