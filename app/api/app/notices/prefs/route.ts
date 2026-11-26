import { appJson, appRoute, readJson } from "@/lib/elite/app-api";
import { loadNoticePrefs, saveNoticeTopic, saveReminderChoice } from "@/lib/elite/notice-prefs-server";
import { prefsForApp } from "@/lib/elite/notice-prefs";

// "Notifications" in the iPhone app's Settings: one switch per topic that
// applies to this account, and for a member the reminder time. The same
// two savers the website's Account page uses (lib/elite/notice-actions.ts).
// A member or a free account; each only ever touches its own row.
export const dynamic = "force-dynamic";

export const GET = appRoute({ name: "notice-prefs", access: "person" }, async ({ viewer }) => ({
  // the app names no games under Clubs while they are out of it
  prefs: prefsForApp(await loadNoticePrefs(viewer)),
}));

// One change a request: { topic, on } flips a switch, { reminder } is the
// answer to "When do you usually train?".
export const POST = appRoute({ name: "notice-prefs", access: "person", limit: 30 }, async ({ req, viewer }) => {
  const body = await readJson(req);
  if (!body) return appJson({ ok: false, error: "bad_request" }, 400);
  const asked = (typeof body.topic === "string" ? 1 : 0) + (typeof body.reminder === "string" ? 1 : 0);
  if (asked !== 1) return appJson({ ok: false, error: "bad_request" }, 400);
  const saved =
    typeof body.topic === "string"
      ? await saveNoticeTopic(viewer, body.topic, body.on)
      : await saveReminderChoice(viewer, body.reminder);
  return appJson(saved.ok ? { ...saved, prefs: prefsForApp(saved.prefs) } : saved, saved.ok ? 200 : 400);
});
