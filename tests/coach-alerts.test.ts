import { describe, expect, it } from "vitest";
import { clipText, dedupeRecipients, filmRoomText, progressText, withFallback } from "@/lib/elite/coach-alerts";

describe("who gets the upload text", () => {
  const yinka = { full_name: "Coach Yinka", alert_phone: "(571) 000-0001", role: "admin" };
  const gary = { full_name: "Gary Grigoryan", alert_phone: "571-000-0002", role: "coach" };
  it("texts every coach with a number, once per number", () => {
    const r = dedupeRecipients([yinka, gary, { ...gary, full_name: "Gary again" }]);
    expect(r.map((x) => x.phone)).toEqual(["+15710000001", "+15710000002"]);
    expect(r[1].name).toBe("Gary");
  });
  it("skips a coach with no number or a number that is not one", () => {
    expect(dedupeRecipients([{ full_name: "A", alert_phone: null }, { full_name: "B", alert_phone: "" }])).toEqual([]);
  });
  it("never leaves the admin unreached", () => {
    // Gary set his number, Coach Yinka has not: the fallback still goes to Coach Yinka
    const r = withFallback([{ ...yinka, alert_phone: null }, gary], "+15710000009");
    expect(r.map((x) => x.phone).sort()).toEqual(["+15710000002", "+15710000009"]);
    // once the admin has set one, the fallback is not added
    const r2 = withFallback([yinka, gary], "+15710000009");
    expect(r2.map((x) => x.phone)).toEqual(["+15710000001", "+15710000002"]);
    // nobody set a number: the fallback alone
    expect(withFallback([{ ...yinka, alert_phone: null }], "+15710000009").map((x) => x.phone)).toEqual([
      "+15710000009",
    ]);
  });
});

describe("the upload texts", () => {
  const url = "https://thestriveapp.com/coach/players/abc";
  it("say who, what and where to watch, in plain words", () => {
    expect(clipText("Tim Kovalev", "L turn, roll, touch", url)).toBe(
      `Tim Kovalev sent a clip of L turn, roll, touch. Watch it and reply: ${url}`
    );
    expect(progressText("Tim Kovalev", 4, url)).toContain("week 4 progress clip");
    expect(filmRoomText("Tim Kovalev", 3, 3, "Sunday", url)).toBe(
      `Tim Kovalev added 3 clips for the Sunday Film Room (3 so far). Watch them: ${url}`
    );
    expect(filmRoomText("Tim Kovalev", 1, 4, "Sunday", url)).toContain("added 1 clip for");
  });
  it("keep the house rules: no em dash, no exclamation point, one text long", () => {
    for (const s of [
      clipText("Tim Kovalev", "Pass, touch past, Cruyff turn, outside touch", url),
      progressText("Tim Kovalev", 12, url),
      filmRoomText("Tim Kovalev", 5, 5, "Sunday", url),
    ]) {
      expect(s).not.toMatch(/—|!/);
      expect(s.length).toBeLessThanOrEqual(160);
    }
  });
});
