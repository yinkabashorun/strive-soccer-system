"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, createServiceClient, verifyPassword } from "./supabase/server";
import { DEMO_COOKIE, getViewer } from "./session";
import { ACCOUNT_DELETED_NOTICE, passwordChangeProblem } from "./account";
import { deleteOwnAccount } from "./account-delete";

// "Delete my account", from inside the app (App Review Guideline
// 5.1.1(v)). The deletion itself is deleteOwnAccount (lib/elite/
// account-delete.ts), shared with the native iPhone app's API; this form
// then signs the browser out and lands on the sign-in page.
export async function deleteMyAccount(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const result = await deleteOwnAccount(String(formData.get("password") ?? ""));
  if (result.error) return result;
  const supabase = createClient();
  await supabase?.auth.signOut().catch(() => undefined);
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
