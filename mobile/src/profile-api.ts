import * as ImageManipulator from "expo-image-manipulator";
import { api } from "./api/client";

// The required profile photo and @username (migration 081, being built on
// the website branch claude/app-feel-native). The server half does not
// exist on this branch yet: the bootstrap's profileSetup stays null, and the
// app shows these two screens only once it is not. When 081 lands, its
// server functions are wired to these two routes (app/api/app/profile/*)
// and the rules here are checked against its own (one namespace across
// members and free accounts, the word filter and the reserved list live on
// the server; the phone only checks the shape for instant feedback).
export const PROFILE_API = {
  username: "/api/app/profile/username",
  photo: "/api/app/profile/photo",
} as const;

// lowercase letters, numbers, dot and underscore, 3 to 20 (the shape the
// website branch uses; the server has the last word).
export const USERNAME_SHAPE = /^[a-z0-9._]{3,20}$/;

export function usernameShapeProblem(raw: string): string | null {
  const v = raw.trim().replace(/^@/, "");
  if (v.length < 3) return "At least 3 characters.";
  if (v.length > 20) return "20 characters at most.";
  if (!USERNAME_SHAPE.test(v)) return "Lowercase letters, numbers, dots and underscores only.";
  return null;
}

export async function saveUsername(username: string): Promise<void> {
  await api(PROFILE_API.username, { method: "POST", body: { username: username.trim().replace(/^@/, "") } });
}

// A square, small JPEG made on the phone (as the website does), sent as
// base64 so nothing about where or when it was taken travels with it.
export async function savePhoto(uri: string): Promise<void> {
  const out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 512, height: 512 } }], {
    compress: 0.82,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  await api(PROFILE_API.photo, { method: "POST", body: { jpegBase64: out.base64 } });
}
