// Deleting the signed-in person's own account (App Review Guideline
// 5.1.1(v)), shared by the website's "Delete my account" form
// (lib/elite/account-actions.ts) and the native iPhone app's API
// (app/api/app/account/delete). Server only.
import { createClient, createServiceClient, verifyPassword } from "./supabase/server";
import { getViewer } from "./session";
import { DELETE_BLOCKED_MESSAGE, accountDeletedText, deleteGate } from "./account";
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
export async function deleteOwnAccount(password: string): Promise<{ error: string | null }> {
  const viewer = await getViewer();
  const gate = deleteGate(viewer);
  if (!gate.allowed) return { error: DELETE_BLOCKED_MESSAGE[gate.reason] };

  const supabase = createClient();
  const admin = createServiceClient();
  if (!supabase || !admin || !viewer) {
    return { error: "We could not reach the server. Try again in a minute." };
  }

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
  // and its posted photos, which do not leave by cascade
  if (free) await removeTrackerFiles(user.id);

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return {
      error:
        "Something stopped the deletion and nothing was removed. Try again, or email us and we will do it for you the same day.",
    };
  }

  await textCoaches(accountDeletedText(viewer.profile.full_name, viewer.role, free)).catch(() => 0);
  return { error: null };
}
