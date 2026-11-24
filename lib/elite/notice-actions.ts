"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "./session";
import { PREFS_NOT_SAVED, saveNoticeTopic, saveReminderChoice, type PrefsSaved } from "./notice-prefs-server";

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
