// The notification bell, as pure rules (App Store punch list, A13).
//
// A red count is a debt: it must clear the moment the member has looked.
// Until Nov 18 2026 the count only dropped one note at a time, by tapping
// each one, so it sat at a number for weeks. Now opening the list is
// looking: everything is marked read and the count is gone. The notes that
// were new stay highlighted while the list is open, so the member can see
// which ones they had not read.
//
// A note is shown ONCE (Nov 24 2026). Production holds 95 copies of "Week 8
// is ready" for one profile, left by a since-fixed bug; nothing collapsed
// them. Now the database refuses a repeat (one row per player per key,
// migration 088), and the rows already there are collapsed when the list
// is read: nobody's rows are deleted, the repeats are simply not shown.
import type { EliteNotification } from "./types";
import { cleanNoticePath, topicOfKind, type NoticeTopic } from "./notices";

// How many notes the list shows, newest first. Older ones are not a
// backlog to work through; the app's screens are the record.
export const BELL_SHOWN = 12;

type Note = Pick<EliteNotification, "id" | "read" | "created_at">;

// What makes two rows the same note:
//   - the same key (a row written since 088);
//   - no key but an address: a coach's message or reply, each its own
//     event, never collapsed;
//   - neither (a row from before 088): the same kind and the same words.
type Keyed = Note & Partial<Pick<EliteNotification, "kind" | "title" | "body" | "url" | "dedupe_key">>;

export function collapseKey(n: Keyed): string {
  if (n.dedupe_key) return `key:${n.dedupe_key}`;
  if (n.url || n.title === undefined) return `id:${n.id}`;
  return `old:${n.kind ?? ""}|${n.title}|${n.body ?? ""}`;
}

// Each note once, the newest of its copies kept, newest first. It is
// unread while any of its copies is, so the count is of notes, not rows.
export function collapseNotes<T extends Keyed>(items: T[]): T[] {
  const kept = new Map<string, T>();
  for (const n of [...items].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    const k = collapseKey(n);
    const have = kept.get(k);
    if (!have) kept.set(k, n);
    else if (!n.read && have.read) kept.set(k, { ...have, read: false });
  }
  return [...kept.values()];
}

// How many rows are read to build the list: enough that a pile of repeats
// cannot push the other notes out of it.
export const BELL_READ = 200;

export function bellList<T extends Note>(items: T[]): T[] {
  return [...items].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, BELL_SHOWN);
}

export function unreadCount(items: Note[]): number {
  return items.filter((n) => !n.read).length;
}

// What the red badge prints: the count, capped so it never grows wide.
export function badgeText(unread: number): string | null {
  if (unread <= 0) return null;
  return unread > 9 ? "9+" : String(unread);
}

// Opening the list: every note becomes read, and the ids that were new
// are handed back so they can stay highlighted until the list is closed.
export function openBell<T extends Note>(items: T[]): { items: T[]; fresh: string[] } {
  return {
    items: items.map((n) => (n.read ? n : { ...n, read: true })),
    fresh: items.filter((n) => !n.read).map((n) => n.id),
  };
}

// The Inbox of the iPhone app: the same notes as the bell, a few more of
// them, each with where it opens. `fresh` is "not read yet"; the app shows
// a quiet gold dot for it, never a count.
export const INBOX_SHOWN = 30;

export type InboxRow = {
  id: string;
  kind: string;
  topic: NoticeTopic | null;
  title: string;
  body: string;
  at: string;
  fresh: boolean;
  // a path on our own site, or null for a note from before 088
  path: string | null;
};

export function inboxRows(items: EliteNotification[]): InboxRow[] {
  return collapseNotes(items)
    .slice(0, INBOX_SHOWN)
    .map((n) => ({
      id: n.id,
      kind: n.kind,
      topic: topicOfKind(n.kind),
      title: n.title,
      body: n.body,
      at: n.created_at,
      fresh: !n.read,
      path: cleanNoticePath(n.url),
    }));
}
