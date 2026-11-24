// Where a notice opens in the native iPhone app: ONE map from the website
// path a notice carries (lib/elite/notices.ts `path`) to a screen of the
// app. Pure, shared with the phone ("@shared/notice-routes"), used by the
// tap on a notification (mobile/app/_layout.tsx, through
// mobile/src/navigation.ts pushRoute) and by a tap on a row of the Inbox.
//
// Before Nov 24 2026 a tapped notification always opened Home, whatever it
// was about.
//
// The app has no Coach screens yet (messages, Film Room and check-in calls
// are on the website for now). So anything from the coach opens the INBOX,
// where the note itself shows the coach's words, with one plain row that
// opens the website page in the sheet over the app.
import { cleanNoticePath, type NoticeTopic } from "./notices";

// Whose app it is: the member tabs, or the free app's.
export type NoticeAudience = "member" | "free";

export const NATIVE_HOME: Record<NoticeAudience, string> = {
  member: "/",
  free: "/(free)/friends",
};
export const NATIVE_INBOX = "/inbox";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const CLUB_PAGE = new RegExp(`^/log/club/(${UUID})$`, "i");
const COURSE_PAGE = /^\/courses\/([a-z0-9][a-z0-9-]{0,80})$/;

// The website pages a member has no screen for in the app yet.
const WEBSITE_ONLY = ["/messages", "/film"];
const under = (path: string, root: string) => path === root || path.startsWith(root + "/");

export function nativeRouteFor(
  rawPath: unknown,
  who: NoticeAudience,
  topic?: NoticeTopic | null
): string {
  const home = NATIVE_HOME[who];
  // a notice's own address only: anything else opens where the person lives
  const full = cleanNoticePath(rawPath);
  if (!full) return home;
  const path = full.split(/[?#]/)[0].replace(/\/+$/, "") || "/";

  if (who === "member") {
    if (topic === "coach" || WEBSITE_ONLY.some((p) => under(path, p))) return NATIVE_INBOX;
    if (path === "/" || path === "/dashboard") return home;
    if (path === "/homework" || path === "/week") return "/week";
    if (path === "/you" || under(path, "/progress") || under(path, "/you")) return "/you";
    if (path === "/courses") return "/courses";
    const course = COURSE_PAGE.exec(path)?.[1];
    if (course) return `/course/${course}`;
    return home;
  }

  // the free app
  if (path === "/log") return home;
  if (path === "/log/week") return "/(free)/my-week";
  if (path === "/log/clubs") return "/(free)/clubs";
  const club = CLUB_PAGE.exec(path)?.[1];
  if (club) return `/club/${club}`;
  // every course is locked for a free account: the shelf, never a course
  if (under(path, "/courses")) return "/(free)/courses";
  if (under(path, "/log/u") || under(path, "/log/settings")) return "/(free)/me";
  return home;
}

// The one plain row under a note in the Inbox whose page lives on the
// website: what it says and the page it opens (in the sheet over the app).
// Null for a note that needs none (the note's own words are all of it, or
// the app has the screen).
export function inboxWebRow(note: { kind: string; path: string | null }): { label: string; path: string } | null {
  const path = (cleanNoticePath(note.path) ?? "").split(/[?#]/)[0];
  if (under(path, "/messages")) return { label: "Reply on thestriveapp.com", path: "/messages" };
  if (under(path, "/film")) return { label: "Open on thestriveapp.com", path: "/film" };
  // the times of a check-in day are picked on the website's Home
  if (note.kind === "checkin_days") return { label: "Open on thestriveapp.com", path: "/dashboard" };
  return null;
}
