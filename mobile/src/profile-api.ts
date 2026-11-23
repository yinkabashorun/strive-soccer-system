import * as ImageManipulator from "expo-image-manipulator";
import { APP_API, type AppUsernameAnswer } from "@shared/app-contract";
import { normalizeUsername } from "@shared/username";
import { AVATAR_MAX_BYTES } from "@shared/tracker";
import { api, ApiError } from "./api/client";
import { FIXTURES } from "./config";

// The required profile photo and @username (migration 081): the website's
// own rules decide on the server (lib/elite/profile-actions.ts and the photo
// route); the phone answers the shape as they type with the same pure rule
// (lib/elite/username.ts) so nothing waits on the network to say "too short".

export async function checkUsername(input: string): Promise<AppUsernameAnswer> {
  return api<AppUsernameAnswer>(APP_API.username, { method: "POST", body: { username: normalizeUsername(input), check: true } });
}

export async function saveUsername(input: string): Promise<AppUsernameAnswer> {
  if (FIXTURES) return { ok: true, name: normalizeUsername(input) };
  return api<AppUsernameAnswer>(APP_API.username, { method: "POST", body: { username: normalizeUsername(input) } });
}

// A square, small JPEG made on the phone, as the website does: the server
// then checks it is a whole JPEG of a real size and takes out where and
// when it was taken before it is stored.
export async function savePhoto(uri: string): Promise<void> {
  if (FIXTURES) return;
  let out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 720, height: 720 } }], {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const size = async (u: string) => (await (await fetch(u)).blob()).size;
  if ((await size(out.uri)) > AVATAR_MAX_BYTES) {
    out = await ImageManipulator.manipulateAsync(out.uri, [{ resize: { width: 512, height: 512 } }], {
      compress: 0.6,
      format: ImageManipulator.SaveFormat.JPEG,
    });
  }
  const form = new FormData();
  form.append("photo", { uri: out.uri, name: "photo.jpg", type: "image/jpeg" } as unknown as Blob);
  const res = await api<{ ok: boolean; error?: string }>(APP_API.photo, { method: "POST", form, timeoutMs: 60_000 });
  if (!res.ok) throw new ApiError(400, null, res.error ?? "Your photo was not saved. Try again.");
}
