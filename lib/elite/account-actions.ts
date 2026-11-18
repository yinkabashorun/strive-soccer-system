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
} from "./account";
import { removePlayerFiles } from "./account-server";
import { textCoaches } from "./coach-alerts";

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

  // Files first: once the account is gone nothing points at them.
  if (viewer.playerId) await removePlayerFiles(admin, viewer.playerId);

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return {
      error:
        "Something stopped the deletion and nothing was removed. Try again, or email us and we will do it for you the same day.",
    };
  }

  await textCoaches(accountDeletedText(viewer.profile.full_name, viewer.role)).catch(() => 0);
  await supabase.auth.signOut().catch(() => undefined);
  cookies().delete(DEMO_COOKIE);
  redirect(`/login?notice=${ACCOUNT_DELETED_NOTICE}`);
}
