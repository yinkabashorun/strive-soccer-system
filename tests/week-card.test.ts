import { describe, expect, it } from "vitest";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PNG_DATA_PREFIX, WEEK_CARD_HEIGHT, WEEK_CARD_WIDTH, hasWeekToShare, isPngDataUri, weekCard } from "../lib/elite/week-card";
import { timeSize, weekCardPng } from "../lib/elite/week-card-image";
import { SHARE_LINE, shareText } from "../lib/elite/share-link";
import type { TrainingLog } from "../lib/elite/tracker";

// SHARE MY WEEK in the iPhone app (Nov 25 2026): the player's own week as
// a story-size picture, drawn on the server. Held here: what is on the
// card, what never is, that the picture really is a 1080 x 1920 PNG, and
// that the route is one of the free app's own.
//
// To look at the card: WEEK_CARD_OUT=/some/file.png npx vitest run tests/week-card.test.ts

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const TODAY = "2026-11-25"; // a Wednesday; the week is Mon Nov 23 to Sun Nov 29
const log = (day: string, minutes: number, kind: "training" | "gym" = "training"): TrainingLog => ({
  id: `${day}-${minutes}-${kind}`,
  trained_on: day,
  minutes,
  kind,
});
const LOGS = [log("2026-11-23", 60), log("2026-11-24", 55), log("2026-11-24", 45), log("2026-11-23", 30, "gym")];
const card = (over: Partial<Parameters<typeof weekCard>[0]> = {}) =>
  weekCard({ fullName: "Marcus Bryant", logs: LOGS, target: 240, today: TODAY, gym: true, ...over });

describe("what is on the week card", () => {
  it("is the player's own name as a friend sees it, never the full last name", () => {
    expect(card().name).toBe("Marcus B.");
    expect(card({ fullName: "Marcus" }).name).toBe("Marcus");
    expect(JSON.stringify(card())).not.toContain("Bryant");
  });

  it("is this week's training against the target the player set", () => {
    const c = card();
    expect(c.week).toBe("Nov 23 to Nov 29");
    expect(c.time).toBe("2h 40m");
    expect(c.of).toBe("of 4h");
    expect(c.share).toBeCloseTo(160 / 240, 5);
  });

  it("gym never fills the ring: it is said on its own line", () => {
    const withGym = card();
    const without = card({ logs: LOGS.filter((l) => l.kind !== "gym") });
    expect(withGym.share).toBe(without.share);
    expect(withGym.time).toBe(without.time);
    expect(withGym.gym).toBe("Gym this week: 30m");
    expect(without.gym).toBeNull();
    // a player who does not log gym is never shown a gym line
    expect(card({ gym: false }).gym).toBeNull();
  });

  it("the ring is full at the target and never more than full", () => {
    expect(card({ logs: [log("2026-11-23", 240)] }).share).toBe(1);
    const over = card({ logs: [log("2026-11-23", 300), log("2026-11-24", 60)] });
    expect(over.share).toBe(1);
    expect(over.time).toBe("6h"); // the time itself is never capped
  });

  it("a player with no target has a time and an empty ring, and no made-up target", () => {
    const c = card({ target: 0 });
    expect(c.of).toBeNull();
    expect(c.share).toBe(0);
    expect(c.time).toBe("2h 40m");
  });

  it("marks the days trained, Monday to Sunday, and only those", () => {
    const c = card();
    expect(c.days.map((d) => d.letter).join("")).toBe("MTWTFSS");
    expect(c.days.map((d) => d.trained)).toEqual([true, true, false, false, false, false, false]);
    // a gym day alone is not a training day
    expect(card({ logs: [log("2026-11-26", 40, "gym")] }).days.some((d) => d.trained)).toBe(false);
    // last week's work is not on this week's card
    expect(card({ logs: [log("2026-11-20", 90)] }).time).toBe("0m");
  });

  it("carries nothing but those facts: no planned day, no count of what was not done, no place on a board", () => {
    const c = card();
    expect(Object.keys(c).sort()).toEqual(["days", "gym", "name", "of", "share", "time", "week"]);
    expect(Object.keys(c.days[0]).sort()).toEqual(["letter", "trained"]);
  });
});

describe("the picture", () => {
  it("is a 1080 x 1920 PNG, drawn with the app's own type", async () => {
    const png = await weekCardPng(card());
    // the PNG signature, then the IHDR chunk: width and height as 4 bytes each
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(png.subarray(12, 16).toString("ascii")).toBe("IHDR");
    expect(png.readUInt32BE(16)).toBe(WEEK_CARD_WIDTH);
    expect(png.readUInt32BE(20)).toBe(WEEK_CARD_HEIGHT);
    expect(png.length).toBeGreaterThan(20_000);
    // small enough to travel as base64 inside one JSON answer
    expect(png.length).toBeLessThan(1_500_000);
    expect(isPngDataUri(PNG_DATA_PREFIX + png.toString("base64"))).toBe(true);
    if (process.env.WEEK_CARD_OUT) writeFileSync(process.env.WEEK_CARD_OUT, png);
  }, 30_000);

  it("draws an empty week and a long time without failing", async () => {
    const empty = await weekCardPng(card({ logs: [] }));
    expect(empty.readUInt32BE(16)).toBe(WEEK_CARD_WIDTH);
    const long = await weekCardPng(card({ logs: [log("2026-11-23", 480), log("2026-11-24", 270)], target: 720 }));
    expect(long.readUInt32BE(20)).toBe(WEEK_CARD_HEIGHT);
    if (process.env.WEEK_CARD_OUT) {
      writeFileSync(process.env.WEEK_CARD_OUT.replace(/\.png$/, "-empty.png"), empty);
      writeFileSync(process.env.WEEK_CARD_OUT.replace(/\.png$/, "-long.png"), long);
    }
  }, 30_000);

  it("a long time is set smaller so it stays inside the ring", () => {
    expect(timeSize("45m")).toBeGreaterThan(timeSize("2h 40m"));
    expect(timeSize("2h 40m")).toBeGreaterThan(timeSize("12h 30m"));
  });

  it("is told apart from anything that is not a PNG data URI", () => {
    expect(isPngDataUri(null)).toBe(false);
    expect(isPngDataUri("")).toBe(false);
    expect(isPngDataUri("https://thestriveapp.com/card.png")).toBe(false);
    expect(isPngDataUri(PNG_DATA_PREFIX)).toBe(false);
    expect(isPngDataUri("data:image/jpeg;base64," + "A".repeat(200))).toBe(false);
  });

  it("ships its fonts with the route, with their licences beside them", () => {
    for (const f of ["Oswald-Bold.ttf", "Inter-SemiBold.ttf"]) {
      expect(statSync(join(root, "lib/elite/fonts", f)).size).toBeGreaterThan(10_000);
    }
    for (const f of ["OFL-Oswald.txt", "OFL-Inter.txt"]) expect(read(`lib/elite/fonts/${f}`)).toContain("SIL OPEN FONT LICENSE");
    expect(read("next.config.js")).toContain('"/api/app/free/week/card": ["./lib/elite/fonts/*.ttf"]');
  });
});

describe("there is a week to share only once the player has trained in it", () => {
  it("is one rule, the server's and the phone's", () => {
    expect(hasWeekToShare(0)).toBe(false);
    expect(hasWeekToShare(1)).toBe(true);
    const server = read("lib/elite/free-app-server.ts");
    // gym alone is not training: the rule reads the week's training minutes
    expect(server).toContain("if (!hasWeekToShare(weekProgress(logs, 0, today).minutes)) return null;");
    expect(read("app/api/app/free/week/card/route.ts")).toContain('if (!made) return appJson({ error: "nothing_yet" }, 409);');
    expect(read("mobile/src/share-week.ts")).toContain("return hasWeekToShare(trainingMinutes);");
  });
});

// The iPhone app's side, read as text (the site's tests never import the
// app's code: tests/app-shared.test.ts).
describe("Share my week in the iPhone app", () => {
  const app = (p: string) => read(`mobile/${p}`);
  const noComments = (s: string) =>
    s
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");
  const row = noComments(app("src/ShareWeekRow.tsx"));
  const rules = noComments(app("src/share-week.ts"));
  const week = noComments(app("app/(free)/my-week.tsx"));

  it("is ONE row on the Week tab, under the friends board, there once the player has trained", () => {
    expect(week.match(/<ShareWeekRow\b/g)?.length).toBe(1);
    expect(week).toContain("{shareWeekShown(w.minutes) ? <ShareWeekRow /> : null}");
    // the board keeps the first screen: the row comes after it, before what was logged
    expect(week.indexOf("<ShareWeekRow")).toBeGreaterThan(week.indexOf("{BOARD_TITLE}"));
    expect(week.indexOf("<ShareWeekRow")).toBeGreaterThan(week.indexOf("{BOARD_EMPTY_LINE}"));
    expect(week.indexOf("<ShareWeekRow")).toBeLessThan(week.indexOf("Logged this week"));
    // a member with Strive Pro has the same Week tab and the same row: nothing about it asks who they are
    expect(week).not.toMatch(/train[^\n]*<ShareWeekRow|<ShareWeekRow[^\n]*train/);
    // and nowhere else in the app
    for (const f of ["app/(free)/friends.tsx", "app/(free)/me.tsx", "app/(free)/clubs.tsx", "app/(free)/train.tsx"]) {
      expect(app(f), f).not.toContain("ShareWeekRow");
    }
  });

  it("is not a second upgrade prompt, and counts nothing that was not done", () => {
    for (const src of [row, rules]) {
      expect(src).not.toMatch(/upgrade|Strive Pro|\/offer|membership|a month|\$\d/i);
      expect(src).not.toMatch(/streak|missed|behind|\bpercent\b|\brank/i);
      expect(src).not.toMatch(/\bAI\b|automated|algorithm/i);
      expect(src).not.toContain("—");
    }
    // a quiet row: no button of its own, and gold is never on it
    expect(row).not.toMatch(/<Button\b|color\.gold|metal\./);
  });

  it("gets the card through the one API client, and makes the file with what is already installed", () => {
    expect(noComments(app("src/api/free.ts"))).toContain("api<AppWeekCard>(APP_API.freeWeekCard");
    expect(row).toContain("await getWeekCard()");
    expect(row).not.toMatch(/(^|[^.\w])fetch\(|new FormData\b|XMLHttpRequest/);
    // the server's data URI becomes a PNG file in the app's cache
    expect(row).toContain("ImageManipulator.manipulateAsync(picture, [], { format: ImageManipulator.SaveFormat.PNG })");
    expect(row).toContain("Share.share(shareWeekContent({ text: card.text, file }))");
    // nothing new to compile: every package the row and its rules import is one the app already declares
    const declared = Object.keys((JSON.parse(app("package.json")) as { dependencies: Record<string, string> }).dependencies);
    const imported = [...(row + rules).matchAll(/from "([^"]+)"/g)].map((m) => m[1]).filter((n) => !n.startsWith("@/") && !n.startsWith("@shared/") && !n.startsWith("."));
    expect(imported.sort()).toEqual(["expo-image-manipulator", "react", "react-native"]);
    for (const n of imported) expect(declared, n).toContain(n);
    for (const n of ["expo-file-system", "expo-sharing", "expo-media-library", "react-native-share", "react-native-view-shot"]) {
      expect(declared, n).not.toContain(n);
    }
  });

  it("the example build is handed the words and no picture, so it reads and writes nothing", () => {
    const fixtures = app("src/api/fixtures.ts");
    expect(fixtures).toContain('if (at === "week/card") {');
    expect(fixtures).toMatch(/image: "", text: shareText\("week", "https:\/\/thestriveapp\.com\/join\?ref=EXAMPLE2&src=share"\)/);
    expect(row).toContain("if (FIXTURES || !picture) return null;");
  });

  it("the words on the phone are the server's: the link is never built there", () => {
    for (const src of [row, rules]) expect(src).not.toMatch(/shareJoinLink|shareText\(|\?ref=|referral|\/join/);
  });
});

describe("the card's own rules", () => {
  const image = read("lib/elite/week-card-image.ts");
  const facts = read("lib/elite/week-card.ts");
  const route = read("app/api/app/free/week/card/route.ts");
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");

  it("shows the address only, never the player's code: the full link rides in the words", () => {
    expect(image).toContain("SHARE_LINE");
    expect(SHARE_LINE).toBe("thestriveapp.com/join");
    for (const src of [image, facts, route]) expect(strip(src)).not.toMatch(/referral_code|shareJoinLink|\?ref=|\?w=/);
    const server = read("lib/elite/free-app-server.ts");
    expect(server).toContain('text: shareText("week", link)');
    expect(server).toContain("shareLinkFor(tracker, false)");
    expect(shareText("week", "https://thestriveapp.com/join?ref=ABCD2345&src=share")).toMatch(/Train with me: https:\/\/thestriveapp\.com\/join\?ref=ABCD2345&src=share$/);
  });

  it("has no streak, nothing missed, no ranking, no price, and none of the words we never say", () => {
    for (const src of [image, facts, route].map(strip)) {
      expect(src).not.toMatch(/streak|missed|behind|\brank|\bplace\b|leaderboard/i);
      expect(src).not.toMatch(/\$\d|a month|per month/i);
      expect(src).not.toMatch(/\bAI\b|automated|algorithm/i);
      expect(src).not.toContain("—");
    }
  });

  it("puts nobody else on it: no friend, no photo, no board", () => {
    for (const src of [image, facts].map(strip)) expect(src).not.toMatch(/friend|photo|board|avatar/i);
  });

  it("is served only to the player it belongs to, inside the free app, and never cached", () => {
    expect(route).toContain('appRoute({ name: "free-week-card", access: "free_app", limit: 20 }');
    expect(route).toContain('export const dynamic = "force-dynamic"');
    // the answer goes out through appRoute, whose every answer is private, no-store
    expect(read("lib/elite/app-api.ts")).toContain('"Cache-Control": "private, no-store"');
    expect(strip(route)).not.toMatch(/new Response\(|NextResponse/);
  });
});
