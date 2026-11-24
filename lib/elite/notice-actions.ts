"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "./session";
import { PREFS_NOT_SAVED, loadNoticePrefs, saveNoticeTopic, saveReminderChoice, type PrefsSaved } from "./notice-prefs-server";

// The website's two notification choices (Account for a member, Settings
// for a free account), and the reminder time asked once on the first
// finish screen. The same two savers the iPhone app's API calls
// (app/api/app/notices/prefs).

export async function setNoticeTopic(topic: string, on: boolean): Promise<PrefsSaved> {
  const viewer = await getViewer();
  if (!viewer || viewer.demo) return { ok: false, error: PREFS_NOT_SAVED };
  const saved = await saveNoticeTopic(viewer, topic, on);
  if (saved.ok) revalidatePath("/account");
  return saved;
}

export async function setReminderTime(choice: string): Promise<PrefsSaved> {
  const viewer = await getViewer();
  if (!viewer || viewer.demo) return { ok: false, error: PREFS_NOT_SAVED };
  const saved = await saveReminderChoice(viewer, choice);
  if (saved.ok) revalidatePath("/account");
  return saved;
}

// Can this person be asked when they usually train? Only a member, and
// only once the answer can be stored (migration 088): a question whose
// answer would be thrown away is not asked.
export async function reminderTimeOpen(): Promise<boolean> {
  const viewer = await getViewer();
  if (!viewer || viewer.demo) return false;
  const prefs = await loadNoticePrefs(viewer).catch(() => null);
  return Boolean(prefs?.reminder);
}
