import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BELL_READ,
  BELL_SHOWN,
  INBOX_SHOWN,
  badgeText,
  bellList,
  collapseKey,
  collapseNotes,
  inboxRows,
  openBell,
  unreadCount,
} from "@/lib/elite/bell";
import type { EliteNotification } from "@/lib/elite/types";

const note = (id: string, read: boolean, day: number) => ({
  id,
  read,
  created_at: `2026-11-${String(day).padStart(2, "0")}T12:00:00Z`,
});

// App Store punch list A13: a red count clears the moment the member has
// looked, and old notes never pile up into a backlog.
describe("the notification bell", () => {
  it("opening the list reads everything and clears the count", () => {
    const items = [note("a", false, 18), note("b", true, 17), note("c", false, 16)];
    expect(unreadCount(items)).toBe(2);
    const opened = openBell(items);
    expect(unreadCount(opened.items)).toBe(0);
    expect(opened.fresh).toEqual(["a", "c"]);
    // Nothing is dropped by opening.
    expect(opened.items.map((n) => n.id)).toEqual(["a", "b", "c"]);
  });

  it("opening a list with nothing new changes nothing", () => {
    const items = [note("a", true, 18)];
    const opened = openBell(items);
    expect(opened.fresh).toEqual([]);
    expect(opened.items).toEqual(items);
  });

  it("shows the newest notes only, newest first", () => {
    const many = Array.from({ length: 30 }, (_, i) => note(`n${i + 1}`, true, i + 1));
    const shown = bellList(many);
    expect(shown).toHaveLength(BELL_SHOWN);
    expect(BELL_SHOWN).toBeLessThanOrEqual(15);
    expect(shown[0].id).toBe("n30");
    expect(shown[shown.length - 1].id).toBe(`n${30 - BELL_SHOWN + 1}`);
  });

  it("the badge is short and gone at zero", () => {
    expect(badgeText(0)).toBeNull();
    expect(badgeText(1)).toBe("1");
    expect(badgeText(9)).toBe("9");
    expect(badgeText(52)).toBe("9+");
  });

  it("the bell marks everything read when it opens and is a full-size target", () => {
    const bell = readFileSync(resolve(__dirname, "..", "components/elite/NotificationBell.tsx"), "utf8");
    expect(bell).toContain("openBell(items)");
    expect(bell).toContain("markAllNotificationsRead()");
    expect(bell).toMatch(/h-11 w-11/);
    expect(bell).toContain("aria-label");
  });
});

// Nov 24 2026: production holds 95 copies of "Week 8 is ready" for one
// profile and 84 of "Week 12 is ready" for another, left by a since-fixed
// bug. Nobody's rows are deleted: a note is simply shown once.
describe("a note is shown once", () => {
  let n = 0;
  const row = (over: Partial<EliteNotification>): EliteNotification => ({
    id: `r${++n}`,
    player_id: "p1",
    kind: "new_week",
    title: "Week 8 is ready",
    body: "Coach built your new training week.",
    read: false,
    created_at: new Date(Date.UTC(2026, 10, 9, 5) + n * 3_600_000).toISOString(),
    ...over,
  });

  it("95 copies of the same old note are one note, the newest, and count as one", () => {
    const pile = Array.from({ length: 95 }, () => row({}));
    const other = row({ kind: "coach_message", title: "Coach Yinka sent you a message", body: "Good work." });
    const shown = collapseNotes([...pile, other]);
    expect(shown).toHaveLength(2);
    expect(shown[0].id).toBe(other.id);
    expect(shown[1].id).toBe(pile[94].id);
    expect(unreadCount(shown)).toBe(2);
    expect(badgeText(unreadCount(shown))).toBe("2");
  });

  it("a note is unread while any of its copies is", () => {
    const shown = collapseNotes([row({ read: true }), row({ read: false }), row({ read: true })]);
    expect(shown).toHaveLength(1);
    expect(shown[0].read).toBe(false);
    expect(collapseNotes([row({ read: true }), row({ read: true })])[0].read).toBe(true);
  });

  it("old notes with different words are different notes", () => {
    const a = row({ kind: "coach_message", title: "Coach Yinka sent you a message", body: "Good work." });
    const b = row({ kind: "coach_message", title: "Coach Yinka sent you a message", body: "Send me a clip of that turn." });
    expect(collapseNotes([a, b])).toHaveLength(2);
    expect(collapseNotes([row({ title: "Week 8 is ready" }), row({ title: "Week 9 is ready" })])).toHaveLength(2);
  });

  it("since migration 088 the key decides, and a coach's message is never folded into another", () => {
    const week = (over: Partial<EliteNotification> = {}) => row({ title: "Week 8 is here, Sam", url: "/dashboard", dedupe_key: "new_week:8", ...over });
    expect(collapseNotes([week(), week()])).toHaveLength(1);
    expect(collapseKey(week())).toBe("key:new_week:8");
    // the same words twice from a coach: two events, two notes
    const msg = () => row({ kind: "coach_message", title: "Coach Yinka", body: "Good work.", url: "/messages", dedupe_key: null });
    expect(collapseNotes([msg(), msg()])).toHaveLength(2);
  });

  it("nothing is ever removed from the list it is given", () => {
    const pile = Array.from({ length: 10 }, () => row({}));
    const before = JSON.stringify(pile);
    collapseNotes(pile);
    expect(JSON.stringify(pile)).toBe(before);
  });

  it("enough rows are read that a pile of repeats cannot push the other notes out", () => {
    expect(BELL_READ).toBeGreaterThanOrEqual(200);
    const data = readFileSync(resolve(__dirname, "..", "lib/elite/data.ts"), "utf8");
    expect(data).toContain(".limit(BELL_READ)");
    expect(data).toContain("collapseNotes(");
    // and the bell only ever marks read: no row is deleted anywhere
    const actions = readFileSync(resolve(__dirname, "..", "lib/elite/player-actions.ts"), "utf8");
    expect(actions).not.toMatch(/from\("elite_notifications"\)\s*\.delete\(/);
  });

  it("the iPhone app's Inbox is the same notes, each with where it opens", () => {
    const rows = inboxRows([
      row({ title: "Week 8 is here, Sam", body: "First touch, both feet.", url: "/dashboard", dedupe_key: "new_week:8" }),
      row({ kind: "earned", title: "10 Sessions", body: "Ten full sessions in the bank", url: "/you", dedupe_key: "earned:10 Sessions", read: true }),
      row({ kind: "coach_message", title: "Coach Yinka", body: "Good work.", url: "/messages", read: true }),
      row({}),
      row({}),
      row({ url: "https://example.com/x", title: "Odd", body: "An address that is not ours" }),
    ]);
    expect(rows.map((r) => [r.kind, r.topic, r.title, r.fresh, r.path])).toEqual([
      ["new_week", "week", "Odd", true, null],
      ["new_week", "week", "Week 8 is ready", true, null],
      ["coach_message", "coach", "Coach Yinka", false, "/messages"],
      ["earned", "week", "10 Sessions", false, "/you"],
      ["new_week", "week", "Week 8 is here, Sam", true, "/dashboard"],
    ]);
    expect(INBOX_SHOWN).toBe(30);
    expect(inboxRows(Array.from({ length: 80 }, (_, i) => row({ title: `Note ${i}` })))).toHaveLength(INBOX_SHOWN);
  });
});
