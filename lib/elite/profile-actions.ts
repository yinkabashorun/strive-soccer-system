"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "./session";
import { rateLimit } from "@/lib/rate-limit";
import { checkUsernameFor, claimUsername, suggestUsernames } from "./account-profile-server";
import { USERNAME_MESSAGES, normalizeUsername, usernameIdeas, usernameProblem } from "./username";

// The @username, from the phone: checked as they type (debounced on the
// phone), taken when they tap Next, changed later from You, Account and
// the free app's settings. Every answer is decided here, never on the
// phone; the unique index in 081 is the last word.

export type UsernameAnswer =
  | { ok: true; name: string }
  | { ok: false; name: string; error: string; taken?: boolean };

function answer(r: Awaited<ReturnType<typeof checkUsernameFor>>): UsernameAnswer {
  if (r.ok) return { ok: true, name: r.name };
  return { ok: false, name: r.name, error: USERNAME_MESSAGES[r.problem], taken: r.problem === "taken" };
}

// Is this one free? Answers as they type.
export async function checkUsername(input: string): Promise<UsernameAnswer> {
  const name = normalizeUsername(input);
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "player") return { ok: false, name, error: "Sign in first." };
  const problem = usernameProblem(name);
  if (problem) return { ok: false, name, error: USERNAME_MESSAGES[problem] };
  if (viewer.demo) return { ok: true, name };
  // a phone checks once a keystroke settles; this stops anyone using the
  // check to list every username there is
  if (!rateLimit(`username-check:${viewer.profile.id}`, 120, 10 * 60_000)) {
    return { ok: false, name, error: USERNAME_MESSAGES.offline };
  }
  return answer(await checkUsernameFor(viewer.profile.id, name));
}

// Take it.
export async function saveUsername(input: string): Promise<UsernameAnswer> {
  const name = normalizeUsername(input);
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "player") return { ok: false, name, error: "Sign in first." };
  if (viewer.demo) {
    const problem = usernameProblem(name);
    return problem ? { ok: false, name, error: USERNAME_MESSAGES[problem] } : { ok: true, name };
  }
  if (!rateLimit(`username-save:${viewer.profile.id}`, 20, 10 * 60_000)) {
    return { ok: false, name, error: USERNAME_MESSAGES.offline };
  }
  const result = answer(await claimUsername(viewer.profile.id, name));
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

// A few to offer when they arrive, from their own name.
export async function myUsernameIdeas(): Promise<string[]> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "player") return [];
  if (viewer.demo) return usernameIdeas(viewer.profile.full_name).slice(0, 3);
  return suggestUsernames(viewer.profile.id, viewer.profile.full_name);
}
