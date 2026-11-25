// Clubs in the native iPhone app: the few pure rules the app's club
// screens add to the website's (lib/elite/tracker.ts for a club and its
// members, lib/elite/club-teams.ts for sessions, games and the record,
// lib/elite/club-matchups.ts for the weekly matchup). Nothing here decides
// who may see or do anything: that stays where the website decides it.
//
// What a club gives a player every day, all of it positive:
//   - who on the club trained TODAY (a member who has not is simply not in
//     the row; nothing anywhere says who did not)
//   - the club's training time this week next to its best week, a number
//     that can only be beaten
//   - the members ranked by this week's training (a member with nothing
//     yet this week is listed after them with no place and no time)
import { fmtDuration } from "./time-trained";
import { shiftDay } from "./time";
import {
  CLUB_CAP,
  cleanClubCode,
  clubLink,
  facesRow,
  friendsBoard,
  initialsOf,
  onBoards,
  weekOf,
  type Kind,
  type MyClub,
} from "./tracker";
import type { Proof } from "./training-clock";
import type { PlanCard } from "./club-teams";

// ---- Joining by code -------------------------------------------------------

// The app has no way to open a club's link, so a player types or pastes
// the club's code. A whole pasted link (or the whole message a teammate
// sent, link included) works too: the code is read out of it.
export function clubCodeFrom(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  const inLink = /[?&]club=([A-Za-z0-9]+)/.exec(text)?.[1];
  return cleanClubCode(inLink ?? text);
}

export const CLUB_CODE_MESSAGE = "That is not a club code. Ask your captain for the club's code or link.";

// What the iPhone share sheet sends: the link AND the code, so a teammate
// with the app can type the code and one without it can open the link.
export function clubShareText(input: { name: string; code: string; appUrl: string }): string {
  return `Join ${input.name} on Strive Elite.\nClub code: ${input.code}\n${clubLink(input.appUrl, input.code)}`;
}

// ---- Who trained today -----------------------------------------------------

export type ClubFace = { id: string; first: string; initials: string; photo: string | null; you: boolean };

// The members who logged anything today, you first. Nobody else is in it.
export function trainedToday(members: MyClub["members"], today: string): ClubFace[] {
  const me = members.find((m) => m.you);
  const active = new Set(members.filter((m) => m.lastDay === today).map((m) => m.id));
  const photo = new Map(members.map((m) => [m.id, m.photo ?? null]));
  return facesRow({
    me: { id: me?.id ?? "", name: me?.name ?? "" },
    friends: members.filter((m) => !m.you).map((m) => ({ id: m.id, name: m.name })),
    activeToday: active,
  })
    .filter((f) => f.active)
    .map((f) => ({ id: f.id, first: f.first, initials: f.initials, photo: photo.get(f.id) ?? null, you: f.you }));
}

// ---- The members, ranked by this week's training ----------------------------

export type ClubMemberRow = {
  id: string;
  name: string;
  initials: string;
  photo: string | null;
  you: boolean;
  captain: boolean;
  starred: boolean;
  // null for a member with no training logged yet this week: they are
  // listed, with no place and no time
  place: number | null;
  time: string | null;
  today: boolean;
};

// The friends board's own order (most training first, one place each),
// for everyone on the club with training this week; then the rest by name.
export function clubBoard(members: MyClub["members"], today: string): ClubMemberRow[] {
  const me = members.find((m) => m.you)?.id ?? "";
  const by = new Map(members.map((m) => [m.id, m]));
  const row = (id: string, place: number | null, time: string | null): ClubMemberRow => {
    const m = by.get(id)!;
    return {
      id,
      name: m.name,
      initials: initialsOf(m.name),
      photo: m.photo ?? null,
      you: m.you,
      captain: m.captain,
      starred: Boolean(m.starred),
      place,
      time,
      today: m.lastDay === today,
    };
  };
  const ranked = friendsBoard(
    members.filter((m) => (m.minutes ?? 0) > 0).map((m) => ({ id: m.id, name: m.name, minutes: m.minutes ?? 0 })),
    me,
    CLUB_CAP
  );
  const rest = members
    .filter((m) => !((m.minutes ?? 0) > 0))
    .sort((x, y) => x.name.localeCompare(y.name) || x.id.localeCompare(y.id));
  return [...ranked.map((r) => row(r.id, r.place, r.time)), ...rest.map((m) => row(m.id, null, null))];
}

// ---- This week and the best week --------------------------------------------

export type ClubLog = { profile_id: string; trained_on: string; minutes: number; kind: Kind; proof?: Proof | null };

// The club's training time by week (Monday to Sunday), from its members'
// logs: training only, gym never counts. A member's training counts from
// the week they joined, so a new player's earlier weeks never become the
// club's. `best` is the most the club trained in one week BEFORE this one
// (null when no earlier week has any).
export function clubWeeks(input: {
  logs: ClubLog[];
  members: { id: string; joinedOn: string }[];
  today: string;
}): { minutes: number; best: number | null } {
  const from = new Map(input.members.map((m) => [m.id, weekOf(m.joinedOn).monday]));
  const thisMonday = weekOf(input.today).monday;
  const byWeek = new Map<string, number>();
  for (const l of input.logs) {
    if (!onBoards(l)) continue; // training only, and never time that was simply typed in
    const since = from.get(l.profile_id);
    const monday = weekOf(l.trained_on).monday;
    if (!since || monday < since || monday > thisMonday) continue;
    byWeek.set(monday, (byWeek.get(monday) ?? 0) + l.minutes);
  }
  let best: number | null = null;
  for (const [monday, minutes] of byWeek) {
    if (monday < thisMonday && minutes > 0 && (best === null || minutes > best)) best = minutes;
  }
  return { minutes: byWeek.get(thisMonday) ?? 0, best };
}

// The first day a club's weeks are read from: the Monday of the week it
// was started.
export function clubWeeksSince(startedOn: string): string {
  return weekOf(startedOn).monday;
}

export type ClubWeek = {
  minutes: number;
  time: string; // "14h"
  // "Best week 19h." A club in its first week has none.
  bestLine: string | null;
  // this week has passed every week before it: an earned thing
  record: boolean;
};

// "This week 14h. Best week 19h." A week that has passed the best says so
// and keeps the number it beat; nothing here ever says a club is behind.
export function clubWeek(w: { minutes: number; best: number | null }): ClubWeek {
  const time = fmtDuration(w.minutes);
  if (w.best === null) return { minutes: w.minutes, time, bestLine: null, record: false };
  if (w.minutes > w.best) {
    return { minutes: w.minutes, time, bestLine: `Your club's best week yet. The one before was ${fmtDuration(w.best)}.`, record: true };
  }
  return { minutes: w.minutes, time, bestLine: `Best week ${fmtDuration(w.best)}.`, record: false };
}

// ---- What is next ------------------------------------------------------------

// "Club training · Tue, Nov 24, 6:00 PM", for a club's card on the tab.
export function nextLine(card: Pick<PlanCard, "kind" | "title" | "when" | "organizer" | "opponent">, clubId: string): string {
  if (card.kind === "training") return `${card.title ?? "Club training"} · ${card.when}`;
  const other = card.opponent && card.opponent.id !== clubId ? card.opponent : card.organizer;
  return `Game against ${other.name} · ${card.when}`;
}

// A club page's plans in two parts: what is coming up (the soonest first,
// as the server orders them), and the games that have started, with their
// result or waiting on one. A game request whose start time passed with no
// answer is in neither.
export function splitPlans(cards: PlanCard[]): { next: PlanCard[]; results: PlanCard[] } {
  return {
    next: cards.filter((c) => !c.result && !(c.status === "pending" && c.started)),
    results: cards.filter((c) => Boolean(c.result)),
  };
}

// ---- The days a plan can be set for -------------------------------------------

// The next days a captain can pick, as the phone lists them, today first.
// The server checks the day again (cleanStart): this only fills the picker.
export function planDays(today: string, count = 14): string[] {
  return Array.from({ length: count }, (_, i) => shiftDay(today, i));
}
