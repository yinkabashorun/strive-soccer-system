import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BELL_SHOWN, badgeText, bellList, openBell, unreadCount } from "@/lib/elite/bell";

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
