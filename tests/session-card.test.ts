import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  APP_STORE_BADGE_LIVE,
  CARD_LINK,
  CARD_PIXELS,
  CARD_POINT,
  CARD_POINTS,
  CARD_WORDS,
  SAVED_KEEP,
  cardButtons,
  cardCapture,
  cardFace,
  cardKey,
  cardSaid,
  cardShade,
  shadeAt,
  CARD_WORDS_TOP,
  CARD_WORDS_DARK,
  cardTitle,
  quoteSize,
  rememberSaved,
  savedAlready,
  type CardInput,
} from "@/lib/elite/session-card";
import { QUOTES } from "@/lib/elite/quotes";

// THE TRAINING CARD (Coach Yinka, Nov 28 2026: "the card is like strava
// ... literally copy strava with our own spin"): what is on it, how big the
// picture is, which buttons show, and that it is saved to Photos once per
// version. The phone's own files are read as text (a site test never
// imports the app's code, tests/app-shared.test.ts).

const root = path.resolve(__dirname, "..");
const read = (f: string) => readFileSync(path.join(root, f), "utf8");
const code = (f: string) =>
  read(f)
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");

const base: CardInput = {
  day: "2026-11-28",
  today: "2026-11-28",
  name: "Marcus B.",
  minutes: 75,
  kind: "training",
  note: "Weak foot only.",
  quoteId: null,
  stats: { weekMinutes: 250, allMinutes: 1860, level: 4 },
};

describe("what is on the card", () => {
  it("the brand line, the day and the short name; the time said the app's way; the line; the three numbers; the link", () => {
    const f = cardFace(base);
    expect(f.dateLine).toBe("Sat, Nov 28 · Marcus B.");
    expect(f.eyebrow).toBe("Trained today");
    expect(f.time).toBe("1h 15m");
    expect(f.note).toBe("Weak foot only.");
    expect(f.stats).toEqual([
      { value: "4h 10m", label: "this week" },
      { value: "31h", label: "all time" },
      { value: "LVL 4", label: "level" },
    ]);
    expect(f.link).toBe(CARD_LINK);
    expect(CARD_LINK).toBe("thestriveapp.com/join");
    expect(f.quote).toBeNull();
  });
  it("a gym post says gym; a card made later from an older post never says today", () => {
    expect(cardFace({ ...base, kind: "gym" }).eyebrow).toBe("Gym today");
    expect(cardFace({ ...base, day: "2026-11-24" }).eyebrow).toBe("Trained");
    expect(cardFace({ ...base, day: "2026-11-24", kind: "gym" }).eyebrow).toBe("Gym");
    expect(cardFace({ ...base, day: "2026-11-24" }).dateLine).toBe("Tue, Nov 24 · Marcus B.");
  });
  it("the quote only when one is picked, with who said it", () => {
    const f = cardFace({ ...base, quoteId: "king-pressure" });
    expect(f.quote).toEqual({ id: "king-pressure", text: "Pressure is a privilege.", by: "Billie Jean King" });
    expect(cardFace({ ...base, quoteId: "not-a-quote" }).quote).toBeNull();
  });
  it("no line, no name: nothing is drawn for them, never an empty space", () => {
    const f = cardFace({ ...base, note: "   ", name: "" });
    expect(f.note).toBeNull();
    expect(f.dateLine).toBe("Sat, Nov 28");
  });
  it("numbers the phone never loaded leave the row off, never blanks or zeros", () => {
    expect(cardFace({ ...base, stats: null }).stats).toBeNull();
    expect(cardFace({ ...base, stats: { weekMinutes: Number.NaN, allMinutes: 10, level: 2 } }).stats).toBeNull();
    expect(cardFace({ ...base, stats: { weekMinutes: 0, allMinutes: 10, level: 0 } }).stats).toBeNull();
  });
  it("nothing on it claims a time was timed, names a friend or a place on a board", () => {
    for (const quoteId of [null, ...QUOTES.map((q) => q.id)]) {
      const said = cardSaid(cardFace({ ...base, quoteId }));
      expect(said).not.toMatch(/\btimed\b|clock|rank|place|#\d|ahead|passed|friend|board/i);
    }
  });
  it("the App Store badge is off until the app is live there, and nothing stands in its place", () => {
    expect(APP_STORE_BADGE_LIVE).toBe(false);
    expect(cardFace(base).badge).toBe(false);
    const card = code("mobile/src/SessionCard.tsx");
    expect(card).not.toMatch(/App Store|Download on/);
  });
});

describe("the picture", () => {
  it("is 1080 x 1920, laid out in points of three pixels", () => {
    expect(CARD_PIXELS).toEqual({ width: 1080, height: 1920 });
    expect(CARD_POINTS.width * CARD_POINT).toBe(1080);
    expect(CARD_POINTS.height * CARD_POINT).toBe(1920);
  });
  // On iOS react-native-view-shot draws width x height POINTS at the
  // screen's scale (ios/RNViewShot.mm), so the size asked for is pixels
  // divided by the phone's pixels a point.
  it("is captured as a JPEG file of exactly 1080 x 1920 on a phone of two or three pixels a point", () => {
    for (const ratio of [2, 3]) {
      const o = cardCapture(ratio);
      expect(o.width * ratio, `ratio ${ratio}`).toBe(1080);
      expect(o.height * ratio, `ratio ${ratio}`).toBe(1920);
      expect(o.format).toBe("jpg");
      expect(o.result).toBe("tmpfile");
      expect(o.quality).toBeGreaterThan(0.8);
      expect(o.quality).toBeLessThanOrEqual(1);
    }
    expect(cardCapture(Number.NaN).width).toBe(360);
    expect(cardCapture(0).height).toBe(640);
  });
  it("the phone asks for it with its own pixels a point", () => {
    expect(code("mobile/src/card-native.ts")).toContain("captureRef(view, cardCapture(PixelRatio.get()))");
  });
  it("a quote is set smaller as it gets longer, and the longest still fits", () => {
    const sizes = QUOTES.map((q) => [q.text.length, quoteSize(q.text)] as const).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < sizes.length; i++) expect(sizes[i][1]).toBeLessThanOrEqual(sizes[i - 1][1]);
    const longest = Math.max(...QUOTES.map((q) => q.text.length));
    expect(quoteSize("x".repeat(longest))).toBeLessThanOrEqual(50);
  });
  it("the dark fall runs further down with a quote, and stays black enough at the bottom for the time", () => {
    for (const q of [true, false]) {
      const s = cardShade(q);
      expect(s[0][0]).toBe(0);
      expect(s[s.length - 1]).toEqual([1, expect.any(Number)]);
      expect(s[s.length - 1][1]).toBeGreaterThanOrEqual(0.85);
      for (let i = 1; i < s.length; i++) expect(s[i][0]).toBeGreaterThan(s[i - 1][0]);
    }
    expect(cardShade(true)[1][0]).toBeGreaterThan(cardShade(false)[1][0]);
  });
  it("the fall is already dark where the bottom words start, and the middle of the photo stays clear", () => {
    // the first simulator pictures: the gold line over bright grass could not be read
    for (const q of [true, false]) {
      const s = cardShade(q);
      for (const at of [CARD_WORDS_TOP, 0.7, 0.8, 0.9, 1]) expect(shadeAt(s, at)).toBeGreaterThanOrEqual(CARD_WORDS_DARK);
      // and somewhere in the middle the photo is untouched
      expect(Math.min(...s.map((x) => x[1]))).toBe(0);
    }
    // the words really do start below that line: the block's bottom edge and its tallest height, in the picture's pixels
    const card = code("mobile/src/SessionCard.tsx");
    expect(card).toContain("bottom: px(230)");
    const tallest = 34 + 246 + 114 + 176; // the gold line, the time, a two-line note, the row of three
    expect((1920 - 230 - tallest) / 1920).toBeGreaterThanOrEqual(CARD_WORDS_TOP);
    expect(card).toMatch(/eyebrow: \{[^}]*textShadowColor/);
  });
  it("the card leaves room on the screen for the buttons under it", () => {
    expect(code("mobile/app/card.tsx")).toContain("(height * 0.52) / CARD_POINTS.height");
  });
});

describe("the buttons", () => {
  it("Instagram story only with Instagram on the phone AND a Meta app ID; then Save to Photos; then More", () => {
    expect(cardButtons({ instagram: true, metaAppId: "1234567890123456" })).toEqual(["instagram", "save", "more"]);
    expect(cardButtons({ instagram: false, metaAppId: "1234567890123456" })).toEqual(["save", "more"]);
    expect(cardButtons({ instagram: true, metaAppId: null })).toEqual(["save", "more"]);
    expect(cardButtons({ instagram: true, metaAppId: "  " })).toEqual(["save", "more"]);
    expect(cardButtons({ instagram: true, metaAppId: "not-an-id" })).toEqual(["save", "more"]);
  });
  it("the app ID is read from one place, at bundle time, and unset means no Instagram button", () => {
    const config = code("mobile/src/config.ts");
    expect(config).toContain('export const META_APP_ID = (process.env.EXPO_PUBLIC_META_APP_ID ?? "").trim() || null;');
    expect(code("mobile/app/card.tsx")).toContain("cardButtons({ instagram, metaAppId: META_APP_ID })");
  });
  it("are plain labels, and only those three: no TikTok, no Snapchat", () => {
    expect([CARD_WORDS.instagram, CARD_WORDS.save, CARD_WORDS.more]).toEqual(["Instagram story", "Save to Photos", "More"]);
    for (const f of ["mobile/app/card.tsx", "mobile/src/card-native.ts"]) expect(code(f), f).not.toMatch(/tiktok|snapchat/i);
  });
});

describe("saved to Photos once per card version", () => {
  it("the same photo and quote is one version; a new quote is a new one", () => {
    expect(cardKey("post:1", null)).toBe(cardKey("post:1", null));
    expect(cardKey("post:1", null)).not.toBe(cardKey("post:1", "king-adjust"));
    expect(cardKey("post:1", "king-adjust")).not.toBe(cardKey("post:2", "king-adjust"));
  });
  it("remembered newest last, never twice, kept to the last few", () => {
    let saved: string[] = [];
    saved = rememberSaved(saved, "a");
    saved = rememberSaved(saved, "b");
    saved = rememberSaved(saved, "a");
    expect(saved).toEqual(["b", "a"]);
    expect(savedAlready(saved, "a")).toBe(true);
    expect(savedAlready(saved, "c")).toBe(false);
    for (let i = 0; i < 100; i++) saved = rememberSaved(saved, `k${i}`);
    expect(saved).toHaveLength(SAVED_KEEP);
    expect(saved[saved.length - 1]).toBe("k99");
  });
  it("every share saves first, through the one save that checks the version", () => {
    const card = code("mobile/app/card.tsx");
    const run = card.slice(card.indexOf("async function run("), card.indexOf("const label:"));
    expect(run.indexOf("saveOnce(key, file)")).toBeGreaterThan(-1);
    expect(run.indexOf("saveOnce(key, file)")).toBeLessThan(run.indexOf("shareToStory("));
    expect(run.indexOf("saveOnce(key, file)")).toBeLessThan(run.indexOf("shareMore(file)"));
    expect(card).toContain("if (savedAlready(saved, key))");
    expect(card).toContain('setPref("cardsSaved", rememberSaved(saved, key))');
  });
  it("a no from the phone never stops the share: one plain line, and Open Settings", () => {
    const card = code("mobile/app/card.tsx");
    expect(card).toContain('if (saved === "refused") setNote({ text: CARD_WORDS.notSaved, settings: true });');
    expect(card).toContain("Linking.openSettings()");
    expect(CARD_WORDS.notSaved).toMatch(/Settings/);
  });
  it("asks for add-only access, and saves with the SDK 58 class API", () => {
    const native = code("mobile/src/card-native.ts");
    expect(native).toContain("requestPermissionsAsync(true)");
    expect(native).toContain("await Asset.create(file)");
    expect(native).not.toMatch(/saveToLibraryAsync|expo-media-library\/legacy/);
  });
});

describe("Instagram", () => {
  const app = JSON.parse(read("mobile/app.json")).expo;
  it("is asked whether it is on the phone through its story scheme, which the app declares", () => {
    expect(app.ios.infoPlist.LSApplicationQueriesSchemes).toEqual(["instagram-stories"]);
    expect(code("mobile/src/card-native.ts")).toContain('Linking.canOpenURL("instagram-stories://share")');
  });
  it("gets the card as the story's background, with the app ID, on black", () => {
    const native = code("mobile/src/card-native.ts");
    expect(native).toMatch(/RNShare\.shareSingle\(\{\s*social: Social\.InstagramStories,\s*appId,\s*backgroundImage: file,/);
    expect(native).toContain('backgroundTopColor: "#000000"');
    expect(native).toContain('backgroundBottomColor: "#000000"');
  });
});

describe("where it lives in the app", () => {
  it("only one file touches the phone's capture, Photos and share packages, and the browser build has its own", () => {
    const walk = (dir: string): string[] =>
      readdirSync(path.join(root, dir)).flatMap((n) => {
        const p = path.join(dir, n);
        return statSync(path.join(root, p)).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
      });
    const users = [...walk("mobile/app"), ...walk("mobile/src")].filter((f) => /from\s+["'](react-native-view-shot|react-native-share|expo-media-library)["']/.test(read(f)));
    expect(users).toEqual(["mobile/src/card-native.ts"]);
    expect(code("mobile/src/card-native.web.ts")).not.toMatch(/react-native-view-shot|react-native-share|expo-media-library/);
  });
  it("the example build never captures, saves or shares", () => {
    const card = code("mobile/app/card.tsx");
    const run = card.slice(card.indexOf("async function run("), card.indexOf("const label:"));
    expect(run.indexOf("if (FIXTURES) return")).toBeGreaterThan(-1);
    expect(run.indexOf("if (FIXTURES) return")).toBeLessThan(run.indexOf("picture(key)"));
    expect(card).toContain("if (FIXTURES) return;\n    void instagramReady()");
    expect(card).toContain("cardSource() ?? (FIXTURES ? exampleCardSource(seedDay()) : null)");
    // its example photo is one of our own stills
    expect(code("mobile/src/card-source.ts")).toContain("/drills/posters/weak-foot-tap-pull-push.jpg");
  });
  it("opens after a post, first, and the notifications ask follows the card", () => {
    const post = code("mobile/app/post.tsx");
    expect(post.match(/openCard\(/g)?.length).toBe(2);
    expect(post.match(/askAfter: !prefs\.pushAsked/g)?.length).toBe(2);
    const card = code("mobile/app/card.tsx");
    expect(card).toContain("if (src?.askAfter && !prefsNow().pushAsked)");
    expect(card).toContain("<AskNotifications onDone={() => void leave()} />");
  });
  it("the numbers are the You tab's own answer, never worked out again", () => {
    const card = code("mobile/app/card.tsx");
    expect(card).toContain("const you = useFreeYou().data;");
    expect(card).toContain("{ weekMinutes: you.weekMinutes, allMinutes: you.allMinutes, level: you.aura.level }");
  });
  it("Make my card is on your own post in the feed and your own photo on You, never on a friend's", () => {
    const feed = code("mobile/src/FeedCards.tsx");
    const mine = feed.slice(feed.indexOf("if (card.mine) {"), feed.indexOf("sheet(\n      {\n        message"));
    expect(mine).toContain("CARD_WORDS.make");
    expect(mine).toContain("openCard(router, cardFromFeed(card))");
    const grid = code("mobile/src/ProfileParts.tsx");
    expect(grid).toMatch(/onMakeCard=\{\s*mine && open/);
    expect(code("mobile/src/navigation.ts")).toMatch(/const FREE_ROUTES = new Set\(\[[^\]]*"card"/);
  });
  it("the Week tab's Share my week stays as it was", () => {
    expect(code("mobile/src/ShareWeekRow.tsx")).toContain("getWeekCard()");
  });
});

describe("the screen's words", () => {
  const words = [...Object.values(CARD_WORDS).flat()];
  it("no exclamation mark, emoji or long dash; never they or them; never the machinery", () => {
    for (const w of words) {
      expect(w, w).not.toMatch(/!/);
      expect(w, w).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(w, w).not.toMatch(/[—–]/);
      expect(w, w).not.toMatch(/\b(they|them|their)\b/i);
      expect(w, w).not.toMatch(/\b(AI|automated|algorithm)\b/);
    }
  });
  it("the title line is one of three, the same one every time for the same card", () => {
    expect(CARD_WORDS.titles).toEqual(["In the books.", "That one's yours.", "Locked in."]);
    expect(cardTitle("me:post:1")).toBe(cardTitle("me:post:1"));
    const seen = new Set(Array.from({ length: 60 }, (_, i) => cardTitle(`me:post:${i}`)));
    expect([...seen].sort()).toEqual([...CARD_WORDS.titles].sort());
  });
});
