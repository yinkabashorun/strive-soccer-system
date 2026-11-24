import { redirect } from "next/navigation";
import { FreeSettings } from "@/components/elite/FreeSettings";
import { getViewer } from "@/lib/elite/session";
import { signOut } from "@/lib/elite/auth-actions";
import { APP_URL } from "@/lib/elite/app-url";
import { nyToday } from "@/lib/elite/time";
import { fmtDuration } from "@/lib/elite/time-trained";
import { blockedFor, profileFor, trackerFor } from "@/lib/elite/tracker-server";
import { FREE_HOME, joinLink, planDaysLabel, seasonWord } from "@/lib/elite/tracker";
import { loadNoticePrefs } from "@/lib/elite/notice-prefs-server";
import { NO_NOTICE_PREFS } from "@/lib/elite/notice-prefs";

export const metadata = { title: "Settings · Strive Elite" };
export const dynamic = "force-dynamic";

// Settings for a free account (the mock, screen 11). A member's Account
// page is a different page and is not changed by this one.
export default async function FreeSettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${FREE_HOME}`);
  const tracker = await trackerFor(viewer);
  if (!tracker) redirect("/account");
  const today = nyToday();
  const [profile, blocked, notices] = await Promise.all([
    profileFor(viewer, viewer.profile.id, today),
    blockedFor(viewer),
    viewer.demo ? Promise.resolve(NO_NOTICE_PREFS) : loadNoticePrefs(viewer).catch(() => NO_NOTICE_PREFS),
  ]);
  if (!profile) redirect(FREE_HOME);

  const target = tracker.target_minutes ? fmtDuration(tracker.target_minutes) : "Not set";
  const season = seasonWord(tracker.season);
  return (
    <FreeSettings
      me={{
        name: profile.name,
        initials: profile.initials,
        photo: profile.photo,
        level: profile.aura.level,
        progress: profile.aura.progress,
      }}
      targetLine={season && tracker.target_minutes ? `${target}, ${season}` : target}
      daysLine={tracker.plan_days.length ? planDaysLabel(tracker.plan_days) : null}
      blockedCount={blocked.length}
      inviteLink={joinLink(APP_URL, tracker.referral_code)}
      canChangePassword={!viewer.demo}
      notices={notices}
      signOut={signOut}
    />
  );
}
