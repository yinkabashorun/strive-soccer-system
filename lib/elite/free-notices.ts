// THE DAILY PULL (Nov 22 2026): the free app's notifications, as pure
// rules. A free player who turned notifications on hears:
//   - "Diego just posted": when an accepted friend posts and they have not
//     posted today. At most ONE a day: the first friend post triggers it,
//     later ones that day do not. Never across a block.
//   - "Diego gave you props": at most one per post, and at most three a
//     day.
//   - "<Club>: Club training Tue, Nov 24 at 6:00 PM. Tap I'm in.": when a
//     club they are on plans a training session, or a game between two
//     clubs is on. Once per plan, claimed in elite_plan_notices (084). The
//     only notification about clubs.
// Nothing between 9:30 PM and 7:00 AM New York time: a notice that would
// land then is dropped, not held. Each send is claimed first in
// elite_free_notices (078), keyed (profile, kind, NY date, ref), the same
// claim-first lock as lib/elite/announce.ts. The words are in push-texts.ts.

export type NoticeKind = "friend_post" | "props";

export const PROPS_NOTICES_PER_DAY = 3;
export const QUIET_FROM = { hour: 21, minute: 30 };
export const QUIET_UNTIL = { hour: 7, minute: 0 };

// The New York clock of an instant.
export function nyClock(at: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(at);
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { hour: n("hour") % 24, minute: n("minute") };
}

// 9:30 PM to 7:00 AM in New York.
export function isQuietTime(clock: { hour: number; minute: number }): boolean {
  const m = clock.hour * 60 + clock.minute;
  return m >= QUIET_FROM.hour * 60 + QUIET_FROM.minute || m < QUIET_UNTIL.hour * 60 + QUIET_UNTIL.minute;
}

// The key a notice is claimed under. A friend's post is one a day (the
// ref is empty, so every friend that day hits the same key); props are one
// per post, keyed by the post's own day and id so a post never notifies
// twice, whatever day the props come.
export function noticeKey(
  kind: NoticeKind,
  input: { today: string; postId?: string; postDay?: string }
): { kind: NoticeKind; ny_date: string; ref: string } {
  if (kind === "friend_post") return { kind, ny_date: input.today, ref: "" };
  return { kind, ny_date: input.postDay ?? input.today, ref: input.postId ?? "" };
}

// Who hears about a friend's post: their accepted friends, never across a
// block either way, only those with a device on file, and not one who has
// posted today already (they can see it).
export function friendPostReceivers(input: {
  posterId: string;
  friends: string[];
  blocks: { blocker: string; blocked: string }[];
  withDevice: Set<string>;
  postedToday: Set<string>;
}): string[] {
  const blocked = new Set<string>();
  for (const b of input.blocks) {
    if (b.blocker === input.posterId) blocked.add(b.blocked);
    if (b.blocked === input.posterId) blocked.add(b.blocker);
  }
  return [...new Set(input.friends)].filter(
    (id) =>
      id !== input.posterId &&
      !blocked.has(id) &&
      input.withDevice.has(id) &&
      !input.postedToday.has(id)
  );
}

// After the claim for a props notice: the props notices sent today,
// counting this one. Within three, it goes.
export function propsWithinDay(sentTodayIncludingThis: number): boolean {
  return sentTodayIncludingThis <= PROPS_NOTICES_PER_DAY;
}

// The first name a notice uses, from "Diego R." or a full name.
export function noticeName(name: string): string {
  return name.trim().split(/\s+/)[0] || "A friend";
}

// Who hears that a club's session or game is on: the members of the
// club(s) in it with a device on file, each once and for their own club
// (the organizing club first for a player on both), and never the player
// who planned or accepted it.
export function clubPlanReceivers(input: {
  clubIds: string[]; // the organizing club first
  members: { club_id: string; profile_id: string }[];
  byId: string;
  withDevice: ReadonlySet<string>;
}): { profileId: string; clubId: string }[] {
  const out = new Map<string, string>();
  for (const clubId of input.clubIds) {
    for (const m of input.members) {
      if (m.club_id !== clubId || m.profile_id === input.byId) continue;
      if (!input.withDevice.has(m.profile_id) || out.has(m.profile_id)) continue;
      out.set(m.profile_id, clubId);
    }
  }
  return [...out.entries()].map(([profileId, clubId]) => ({ profileId, clubId }));
}
