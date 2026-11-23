// The shape of an @username for instant feedback on the phone:
// lowercase letters, numbers, dot and underscore, 3 to 20 (the rule the
// website branch claude/app-feel-native sets in migration 081). The server
// has the last word: one namespace across members and free accounts, the
// word filter and the reserved list live there. Pure, tests/username.test.ts.
export const USERNAME_SHAPE = /^[a-z0-9._]{3,20}$/;

export function cleanUsername(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

export function usernameShapeProblem(raw: string): string | null {
  const v = cleanUsername(raw);
  if (v.length < 3) return "At least 3 characters.";
  if (v.length > 20) return "20 characters at most.";
  if (!USERNAME_SHAPE.test(v)) return "Lowercase letters, numbers, dots and underscores only.";
  return null;
}
