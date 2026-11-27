import * as ImageManipulator from "expo-image-manipulator";
import { APP_API, type AppUsernameAnswer } from "@shared/app-contract";
import { normalizeUsername } from "@shared/username";
import { AVATAR_MAX_BYTES, AVATAR_MESSAGE } from "@shared/tracker";
import { api, ApiError } from "./api/client";
import { FIXTURES } from "./config";
import { fixtureProfileSaved } from "./api/fixtures";
import { base64ToBytes, oneFileForm } from "@shared/upload-body";

// The required profile photo and @username (migration 081): the website's
// own rules decide on the server (lib/elite/profile-actions.ts and the photo
// route); the phone answers the shape as they type with the same pure rule
// (lib/elite/username.ts) so nothing waits on the network to say "too short".

export async function checkUsername(input: string): Promise<AppUsernameAnswer> {
  return api<AppUsernameAnswer>(APP_API.username, { method: "POST", body: { username: normalizeUsername(input), check: true } });
}

export async function saveUsername(input: string): Promise<AppUsernameAnswer> {
  if (FIXTURES) {
    fixtureProfileSaved("username", normalizeUsername(input));
    return { ok: true, name: normalizeUsername(input) };
  }
  return api<AppUsernameAnswer>(APP_API.username, { method: "POST", body: { username: normalizeUsername(input) } });
}

// A square, small JPEG made on the phone, as the website does: the server
// then checks it is a whole JPEG of a real size and takes out where and
// when it was taken before it is stored. The image tool hands the JPEG back
// as text (base64), so its size is known here and it is sent as plain bytes
// (lib/elite/upload-body.ts says why it is never a FormData or a fetch of the file).
const SHRINK: { side: number; compress: number }[] = [
  { side: 720, compress: 0.8 },
  { side: 512, compress: 0.6 },
  { side: 400, compress: 0.5 },
];

export async function savePhoto(uri: string): Promise<void> {
  if (FIXTURES) return fixtureProfileSaved("photo");
  let bytes: Uint8Array | null = null;
  for (const step of SHRINK) {
    const out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: step.side, height: step.side } }], {
      compress: step.compress,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
    if (!out.base64) throw new ApiError(0, "photo", AVATAR_MESSAGE);
    bytes = base64ToBytes(out.base64);
    if (bytes.length <= AVATAR_MAX_BYTES) break;
  }
  if (!bytes || bytes.length === 0 || bytes.length > AVATAR_MAX_BYTES) throw new ApiError(0, "photo", AVATAR_MESSAGE);
  const res = await api<{ ok: boolean; error?: string }>(APP_API.photo, {
    method: "POST",
    upload: oneFileForm("photo", "photo.jpg", "image/jpeg", bytes),
    timeoutMs: 60_000,
  });
  if (!res.ok) throw new ApiError(400, null, res.error ?? "Your photo wasn't saved. Try again.");
}
