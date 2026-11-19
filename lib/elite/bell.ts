// The notification bell, as pure rules (App Store punch list, A13).
//
// A red count is a debt: it must clear the moment the member has looked.
// Until Nov 18 2026 the count only dropped one note at a time, by tapping
// each one, so it sat at a number for weeks. Now opening the list is
// looking: everything is marked read and the count is gone. The notes that
// were new stay highlighted while the list is open, so the member can see
// which ones they had not read.
import type { EliteNotification } from "./types";

// How many notes the list shows, newest first. Older ones are not a
// backlog to work through; the app's screens are the record.
export const BELL_SHOWN = 12;

type Note = Pick<EliteNotification, "id" | "read" | "created_at">;

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
