"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, createServiceClient, verifyPassword } from "./supabase/server";
import { DEMO_COOKIE, getViewer } from "./session";
import {
  ACCOUNT_DELETED_NOTICE,
  DELETE_BLOCKED_MESSAGE,
  accountDeletedText,
  deleteGate,
  passwordChangeProblem,
} from "./account";
import { removePlayerFiles } from "./account-server";
import { textCoaches } from "./coach-alerts";
import { hasTracker, removeTrackerFiles } from "./tracker-server";
import { cancelSubscriptions, memberTier } from "./pro-server";
import { isPro } from "./tiers";

// "Delete my account", from inside the app (App Review Guideline
// 5.1.1(v)). The person re-enters their password, then everything goes:
// their uploaded clips, then the login itself, which takes the profile,
// the player record and every row that hangs off it with it (the same
// cascade the coach's Delete player uses). The coaches get one text,
// because the app does not touch billing and someone has to stop it.
export async function deleteMyAccount(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const viewer = await getViewer();
  const gate = deleteGate(viewer);
  if (!gate.allowed) return { error: DELETE_BLOCKED_MESSAGE[gate.reason] };

  const supabase = createClient();
  const admin = createServiceClient();
  if (!supabase || !admin || !viewer) {
    return { error: "We could not reach the server. Try again in a minute." };
  }

  const password = String(formData.get("password") ?? "");
  if (!password) return { error: "Enter your password to confirm." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Sign in again, then come back to this page." };
  if (!(await verifyPassword(user.email, password))) {
    return { error: "That password is not right. Nothing was deleted." };
  }

  // A Strive Pro member (074) pays by card through the app: the card is
  // never charged again for an account that no longer exists. Stopped
  // before anything is deleted, while the subscription rows still point
  // at it. (Elite billing is the coach's, as before: the text below.)
  if (viewer.playerId && isPro(await memberTier(viewer.playerId))) {
    await cancelSubscriptions(user.id, "now").catch(() => undefined);
  }

  // Files first: once the account is gone nothing points at them.
  if (viewer.playerId) await removePlayerFiles(admin, viewer.playerId);
  // A free training log account (069): its log and quiz answers leave
  // with the login (on delete cascade). Known now, while it still exists,
  // so the coaches' text says the right thing.
  const free = viewer.role === "player" && !viewer.playerId && (await hasTracker(user.id));
  // and its posted photos and its profile photo (every account has one,
  // 081, in this same folder), which do not leave by cascade
  await removeTrackerFiles(user.id);

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return {
      error:
        "Something stopped the deletion and nothing was removed. Try again, or email us and we will do it for you the same day.",
    };
  }

  await textCoaches(accountDeletedText(viewer.profile.full_name, viewer.role, free)).catch(() => 0);
  await supabase.auth.signOut().catch(() => undefined);
  cookies().delete(DEMO_COOKIE);
  redirect(`/login?notice=${ACCOUNT_DELETED_NOTICE}`);
}

// "Change password", from inside the app. The current password is checked
// first (a phone left unlocked is not enough), then the new one is set.
// The person stays signed in on this phone.
export async function changeMyPassword(
  _prev: { error: string | null; done: boolean },
  formData: FormData
): Promise<{ error: string | null; done: boolean }> {
  const fail = (error: string) => ({ error, done: false });
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in first.");
  if (viewer.demo) return fail("This is the example player, not a real account, so there is no password to change.");

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const problem = passwordChangeProblem({ current, next });
  if (problem) return fail(problem);

  const supabase = createClient();
  const admin = createServiceClient();
  if (!supabase || !admin) return fail("We could not reach the server. Try again in a minute.");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return fail("Sign in again, then come back to this page.");
  if (!(await verifyPassword(user.email, current))) {
    return fail("That current password is not right. Nothing was changed.");
  }

  const { error } = await admin.auth.admin.updateUserById(user.id, { password: next });
  if (error) return fail("Something stopped the change and your password is the same as before. Try again in a minute.");
  return { error: null, done: true };
}
