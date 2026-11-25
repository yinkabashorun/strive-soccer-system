import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  CLOCK_CAP_MINUTES,
  CLOCK_GRACE_MINUTES,
  CLOCK_LIVE_SECONDS,
  CLOCK_MIN_SECONDS,
  CLOCK_PHOTO_MAX_BYTES,
  CLOCK_PHOTO_STEPS,
  CLOCK_SLACK_SECONDS,
  CLOCK_WORDS,
  NOT_TIMED,
  PROOFS,
  TYPED,
  TYPED_LINE,
  WEB_TYPED_LINE,
  cleanClockTimes,
  cleanLess,
  lessApplied,
  lessMax,
  clockFace,
  clockLength,
  clockState,
  clockWords,
  countsOnBoards,
  settleClock,
} from "@/lib/elite/training-clock";
import { boardMinutes, onBoards, buildFeed, ownsStartPath, startPhotoPath, type PostRow, type TrainingLog } from "@/lib/elite/tracker";
import { clockLogId, nyDayOf } from "@/lib/elite/training-clock-server";
import { filesForm } from "@/lib/elite/upload-body";

// THE TRAINING CLOCK (Coach Yinka, Nov 25 2026: "How could we keep it so
// people can't just lie. Maybe a pic when they arrive then when they dip?";
// then "this needs to be extremely practically implemented", yes to camera
// only, yes to 2h 30m).
//
// A player takes a photo to start training and a photo to finish. The time
// between the two is the training. Timed training counts everywhere; a
// length a player types counts on their own week only.

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
// code only: a comment may say what the code must not
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const f = join(dir, n);
    return statSync(f).isDirectory() ? (n === "node_modules" ? [] : walk(f)) : [f];
  });
}

const MIN = 60_000;
const T0 = Date.UTC(2026, 10, 25, 21, 0, 0); // a server instant

describe("the one rule: which time counts beyond the player's own week", () => {
  it("only typed time does not count; everything else does", () => {
    expect(PROOFS).toEqual(["before", "typed", "clock", "session"]);
    expect(PROOFS.filter((p) => countsOnBoards(p))).toEqual(["before", "clock", "session"]);
    expect(TYPED).toBe("typed");
    // a row read by old code, with no proof on it, is from before the clock
    expect(countsOnBoards(null)).toBe(true);
    expect(countsOnBoards(undefined)).toBe(true);
  });

  it("gym never counts on a board, timed or not", () => {
    expect(onBoards({ kind: "training", proof: "clock" })).toBe(true);
    expect(onBoards({ kind: "training", proof: "session" })).toBe(true);
    expect(onBoards({ kind: "training", proof: "before" })).toBe(true);
    expect(onBoards({ kind: "training", proof: "typed" })).toBe(false);
    expect(onBoards({ kind: "gym", proof: "clock" })).toBe(false);
  });

  it("a player's own row on the board adds up timed training only", () => {
    const log = (minutes: number, over: Partial<TrainingLog> = {}): TrainingLog => ({ id: `l${minutes}`, trained_on: "2026-11-25", minutes, kind: "training", ...over }) as TrainingLog;
    expect(boardMinutes([log(45, { timed: true }), log(60, { timed: false }), log(30, { kind: "gym", timed: true }), log(20)])).toBe(65);
  });

  it("a feed card says whether its time was timed, and carries the start photo only when open", () => {
    const row = (over: Partial<PostRow>): PostRow =>
      ({ id: "p1", profile_id: "gary", trained_on: "2026-11-25", minutes: 45, kind: "training", photo_path: "gary/p1.jpg", caption: null, created_at: "2026-11-25T20:00:00Z", removed_at: null, ...over }) as PostRow;
    const names = new Map([["gary", "Gary G."], ["me", "Marcus B."]]);
    const viewer = (unlocked: boolean) => ({ id: "me", staff: false, friendIds: new Set(["gary"]), unlocked, reported: new Set<string>() });
    const timed = row({ proof: "clock", start_photo_path: "gary/start-p1.jpg" });
    const [locked] = buildFeed({ rows: [timed], viewer: viewer(false), names, today: "2026-11-25" });
    expect(locked).toMatchObject({ state: "locked", timed: true });
    // nothing of a locked post's photos is ever sent, the start photo included
    expect(JSON.stringify(locked)).not.toContain(".jpg");
    const [open] = buildFeed({ rows: [timed], viewer: viewer(true), names, today: "2026-11-25" });
    expect(open).toMatchObject({ state: "open", timed: true, startPhotoPath: "gary/start-p1.jpg" });
    const [typed] = buildFeed({ rows: [row({ proof: "typed" })], viewer: viewer(true), names, today: "2026-11-25" });
    expect(typed).toMatchObject({ state: "open", timed: false });
    expect(NOT_TIMED).toBe("Not timed");
  });
});

describe("how long a finished clock counts", () => {
  const phone = 1_800_000_000_000; // the phone's own clock, nothing like the server's
  const settle = (minutes: number, over: Partial<Parameters<typeof settleClock>[0]> = {}) =>
    settleClock({ nowMs: T0, phoneStartedMs: phone, phoneEndedMs: phone + minutes * MIN, phoneSentMs: phone + minutes * MIN + 3_000, seen: null, ...over });

  it("is the time between the two photos, whatever the phone's clock says the date is", () => {
    const out = settle(47);
    expect(out).toMatchObject({ ok: true, minutes: 47, startSeen: false });
    if (!out.ok) return;
    // pinned to the server's own time of receipt, not the phone's
    expect(out.endedAtMs).toBe(T0 - 3_000);
    expect(out.endedAtMs - out.startedAtMs).toBe(47 * MIN);
  });

  it("no signal at the field: a finish sent hours later still ends when the photo was taken", () => {
    const out = settle(60, { phoneSentMs: phone + 60 * MIN + 5 * 60 * MIN });
    expect(out).toMatchObject({ ok: true, minutes: 60 });
    if (out.ok) expect(out.endedAtMs).toBe(T0 - 5 * 60 * MIN);
  });

  it("never counts more than the cap, and a clock left running too long is not timed at all", () => {
    expect(CLOCK_CAP_MINUTES).toBe(150); // his number: 2 hours 30 minutes
    expect(settle(149)).toMatchObject({ ok: true, minutes: 149 });
    expect(settle(165)).toMatchObject({ ok: true, minutes: 150 }); // inside the grace: the cap
    expect(settle(CLOCK_CAP_MINUTES + CLOCK_GRACE_MINUTES)).toEqual({ ok: false, reason: "expired" });
    expect(settle(600)).toEqual({ ok: false, reason: "expired" });
  });

  it("under a minute is not a session", () => {
    expect(CLOCK_MIN_SECONDS).toBe(60);
    expect(settle(0.5)).toEqual({ ok: false, reason: "short" });
    expect(settle(1)).toMatchObject({ ok: true, minutes: 1 });
  });

  it("times that make no sense are refused", () => {
    expect(settle(-5)).toEqual({ ok: false, reason: "bad" });
    expect(settle(30, { phoneStartedMs: Number.NaN })).toEqual({ ok: false, reason: "bad" });
    expect(settle(30, { phoneSentMs: 0 })).toEqual({ ok: false, reason: "bad" });
  });

  it("when the server saw the start, moving the phone's clock forward gains nothing", () => {
    // The start photo was taken and the server heard of it 4 seconds later.
    // Ten real minutes on, the phone's clock is moved forward two hours and
    // the finish photo is taken.
    const seen = { atMs: T0 - 10 * MIN, agoSeconds: 4 };
    const cheated = settle(130, { seen });
    expect(cheated.ok).toBe(true);
    if (!cheated.ok) return;
    expect(cheated.startSeen).toBe(true);
    // ten minutes of real time, plus the room allowed for two clocks disagreeing
    expect(cheated.minutes).toBeLessThanOrEqual(10 + Math.ceil(CLOCK_SLACK_SECONDS / 60) + 1);
    // an honest session of the same real length is untouched by the check
    expect(settle(10, { seen })).toMatchObject({ ok: true, minutes: 10, startSeen: true });
  });

  it("a start the server heard of late proves nothing, so the phone's own time stands", () => {
    const late = { atMs: T0 - 2 * MIN, agoSeconds: CLOCK_LIVE_SECONDS + 1 };
    expect(settle(45, { seen: late })).toMatchObject({ ok: true, minutes: 45, startSeen: false });
  });

  it("the phone's times are whole numbers of milliseconds or nothing", () => {
    expect(cleanClockTimes({ started: "1700000000000", ended: "1700002700000", sent: "1700002705000" })).toEqual({ started: 1_700_000_000_000, ended: 1_700_002_700_000, sent: 1_700_002_705_000 });
    expect(cleanClockTimes({ started: 1_700_000_000_000, ended: 1_700_002_700_000, sent: 1_700_002_705_000 })).not.toBeNull();
    for (const bad of ["", "soon", "17e11", "-1700000000000", "1700000000000.5", null, undefined, {}]) {
      expect(cleanClockTimes({ started: bad, ended: "1700002700000", sent: "1700002705000" }), String(bad)).toBeNull();
    }
  });

  it("the same finish always makes the same entry, so a retry on weak signal writes one", () => {
    const a = clockLogId("u1", 1_700_000_000_000);
    expect(a).toBe(clockLogId("u1", 1_700_000_000_000));
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(clockLogId("u2", 1_700_000_000_000));
    expect(a).not.toBe(clockLogId("u1", 1_700_000_000_001));
    // the start photo sits beside the finish photo, in the account's own folder
    const start = startPhotoPath("11111111-1111-4111-8111-111111111111", a)!;
    expect(start).toBe(`11111111-1111-4111-8111-111111111111/start-${a}.jpg`);
    expect(ownsStartPath(start, "11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(ownsStartPath(start, "22222222-2222-4222-8222-222222222222")).toBe(false);
    expect(ownsStartPath(`11111111-1111-4111-8111-111111111111/${a}.jpg`, "11111111-1111-4111-8111-111111111111")).toBe(false);
    // the day an entry lands on is the New York day the finish photo was taken
    expect(nyDayOf(Date.UTC(2026, 10, 26, 3, 30))).toBe("2026-11-25");
  });
});

describe("the clock on the screen", () => {
  it("counts, stops counting at the cap, and can no longer be timed past the grace", () => {
    const at = (minutes: number) => clockState(T0, T0 + minutes * MIN);
    expect(at(42)).toEqual({ state: "running", elapsedSeconds: 42 * 60, countedSeconds: 42 * 60 });
    expect(at(160)).toEqual({ state: "capped", elapsedSeconds: 160 * 60, countedSeconds: 150 * 60 });
    expect(at(180).state).toBe("expired");
    // a phone whose clock went backwards shows zero, never a negative time
    expect(clockState(T0, T0 - 5_000).countedSeconds).toBe(0);
  });

  it("reads like a clock, and a length reads the way the rest of the app says it", () => {
    expect([clockFace(7), clockFace(42 * 60 + 10), clockFace(3909), clockFace(-3)]).toEqual(["0:07", "42:10", "1:05:09", "0:00"]);
    expect([clockLength(45), clockLength(60), clockLength(150)]).toEqual(["45m", "1h", "2h 30m"]);
    expect([clockWords(150), clockWords(180), clockWords(1), clockWords(61)]).toEqual(["2 hours 30 minutes", "3 hours", "1 minute", "1 hour 1 minute"]);
  });

  it("its words are plain, in the player's own words, and never count what was missed", () => {
    const all = [...Object.values(CLOCK_WORDS), TYPED_LINE, WEB_TYPED_LINE, NOT_TIMED];
    for (const line of all) {
      expect(line, line).not.toMatch(/[—–]/);
      expect(line, line).not.toMatch(/\b(AI|automated|algorithm|streak|missed|behind|proof|verified|cheat|lie)\b/i);
      // every sentence short enough to read at a glance
      for (const sentence of line.split(/(?<=[.?!])\s+/)) expect(sentence.split(/\s+/).length, sentence).toBeLessThanOrEqual(18);
      // the player's own words: no order barked, nothing shouted
      expect(line, line).not.toMatch(/!/);
    }
    expect(CLOCK_WORDS.startBody).toBe("Take a photo to start the clock. Take one more when you finish. The time between your two photos is your training.");
    expect(CLOCK_WORDS.cap).toBe("The clock counts up to 2 hours 30 minutes.");
    expect(CLOCK_WORDS.expiredBody).toContain("3 hours");
    expect(TYPED_LINE).toBe("It shows on your week. It does not count on the board.");
  });
});

describe("two photos in one request", () => {
  it("both together fit what one request to the site may carry", () => {
    // Vercel refuses a request body over 4.5 MB
    expect(CLOCK_PHOTO_MAX_BYTES * 2).toBeLessThan(4_000_000);
    expect(CLOCK_PHOTO_STEPS.map((s) => s.edge)).toEqual([1280, 1080, 800]);
    expect(code("app/api/app/free/clock/finish/route.ts")).toContain("part.size > CLOCK_PHOTO_MAX_BYTES");
  });

  it("arrive at the server as the two photos, byte for byte, with the times beside them", async () => {
    const tricky = [...Buffer.from("\r\n--\r\n----StriveEliteUpload\r\n\r\n")];
    const start = Uint8Array.from([0xff, 0xd8, 1, 2, 3, ...tricky, 0xff, 0xd9]);
    const finish = Uint8Array.from([0xff, 0xd8, ...Array.from({ length: 256 }, (_, i) => i), 0xff, 0xd9]);
    const form = filesForm({ started: "1700000000000", ended: "1700002700000", sent: "1700002705000", kind: "training", caption: "Weak foot ⚽ only" }, [
      { field: "start", fileName: "start.jpg", type: "image/jpeg", bytes: start },
      { field: "finish", fileName: "finish.jpg", type: "image/jpeg", bytes: finish },
    ]);
    const req = new Request("https://thestriveapp.com/api/app/free/clock/finish", { method: "POST", headers: { "content-type": form.contentType }, body: form.body as unknown as BodyInit });
    const got = await req.formData();
    expect([got.get("started"), got.get("ended"), got.get("sent"), got.get("kind"), got.get("caption")]).toEqual(["1700000000000", "1700002700000", "1700002705000", "training", "Weak foot ⚽ only"]);
    for (const [field, bytes] of [["start", start], ["finish", finish]] as const) {
      const file = got.get(field) as File;
      expect(file).toBeInstanceOf(Blob);
      expect(file.type).toBe("image/jpeg");
      expect(Array.from(new Uint8Array(await file.arrayBuffer()))).toEqual(Array.from(bytes));
    }
  });
});

describe("the rule is held everywhere time is added up or written", () => {
  it("every entry the server writes says how its time is known", () => {
    const writers = ["app", "lib"]
      .flatMap((d) => walk(join(root, d)))
      .filter((f) => /\.(ts|tsx)$/.test(f))
      .flatMap((f) => {
        const src = code(f.slice(root.length + 1));
        const out: { file: string; body: string }[] = [];
        for (const m of src.matchAll(/\.from\("elite_training_logs"\)\s*\.insert\(/g)) {
          out.push({ file: f.slice(root.length + 1), body: src.slice(m.index, src.indexOf("});", m.index)) });
        }
        return out;
      });
    expect(writers.map((w) => w.file).sort()).toEqual(["lib/elite/session-log.ts", "lib/elite/tracker-server.ts", "lib/elite/tracker-server.ts", "lib/elite/training-clock-server.ts"]);
    for (const w of writers) expect(w.body, w.file).toMatch(/\bproof: (TYPED|"clock"|"session")/);
    // a length the player typed is always written as typed
    for (const w of writers.filter((x) => x.file === "lib/elite/tracker-server.ts")) expect(w.body).toContain("proof: TYPED");
    expect(writers.find((w) => w.file === "lib/elite/session-log.ts")!.body).toContain('proof: "session"');
    const clock = writers.find((w) => w.file === "lib/elite/training-clock-server.ts")!.body;
    expect(clock).toContain('proof: "clock"');
    // its minutes are the server's own count, never the phone's
    const server = code("lib/elite/training-clock-server.ts");
    expect(server).toContain("const minutes = lessApplied(settled.minutes, input.less ?? 0);");
    expect(clock).toMatch(/\bminutes,/);
    expect(clock).not.toMatch(/minutes: input\./);
  });

  it("the friends board, a club's time, the club ranking, the matchup and the level leave typed time out", () => {
    const server = code("lib/elite/tracker-server.ts");
    const fn = (name: string) => server.slice(server.indexOf(`async function ${name}(`), server.indexOf("\n}\n", server.indexOf(`async function ${name}(`)));
    expect(fn("friendsWeekFor")).toContain('.neq("proof", TYPED)');
    expect(fn("auraLogsOf")).toContain('.neq("proof", TYPED)');
    expect(code("lib/elite/tracker-ranking.ts")).toContain('.neq("proof", TYPED)');
    expect(code("lib/elite/club-matchups-server.ts")).toContain('.neq("proof", TYPED)');
    expect(code("lib/elite/club-app.ts")).toContain("if (!onBoards(l)) continue;");
    // what a parent is shown, and the player's own row on the board
    expect(code("lib/elite/parent-link-server.ts")).toContain("boardMinutes(logs)");
    expect(code("lib/elite/free-app-server.ts")).toContain("minutes: boardMinutes(logs)");
  });

  it("a teammate counts toward the earned month on timed training only", () => {
    const callers = ["app", "lib"]
      .flatMap((d) => walk(join(root, d)))
      .filter((f) => /\.(ts|tsx)$/.test(f))
      .filter((f) => /countTeammate\(/.test(code(f.slice(root.length + 1))))
      .map((f) => f.slice(root.length + 1))
      .sort();
    expect(callers).toEqual(["app/api/app/free/clock/finish/route.ts", "app/api/elite/tracker/post/route.ts", "lib/elite/squad-pass-server.ts"]);
    // the website's post route counts one only for a finished session's photo
    const web = code("app/api/elite/tracker/post/route.ts");
    expect(web.match(/countTeammate\(/g)?.length).toBe(1);
    const sessionBranch = web.slice(web.indexOf("if (sessionRef && viewer.playerId) {"), web.indexOf("const saved = await savePost("));
    expect(sessionBranch).toContain("countTeammate(viewer.profile.id)");
    // the clock counts one only for the write that made the entry
    expect(code("app/api/app/free/clock/finish/route.ts")).toMatch(/if \(saved\.fresh\) \{[\s\S]{0,200}countTeammate\(viewer\.profile\.id\)/);
  });

  it("a post a coach removes comes off every board, and deleting a post deletes both its photos", () => {
    const acts = code("lib/elite/tracker-actions.ts");
    expect(acts).toContain("removed_by: c.profileId, proof: TYPED");
    expect(acts).toContain("ownsStartPath(row.start_photo_path, profileId)");
  });

  it("one stretch of time is trained once", () => {
    const server = code("lib/elite/training-clock-server.ts");
    expect(server).toMatch(/\.eq\("proof", "clock"\)\s*\.lt\("started_at", endedAt\)\s*\.gt\("ended_at", startedAt\)/);
    expect(server).toContain('if (clash?.length) return { ok: false, reason: "overlap" };');
    // the first word about a start is the one kept (a retry never replaces it)
    expect(server).toMatch(/phone_started_ms\) === phoneStartedMs\) return true;/);
  });
});

describe("migration 089", () => {
  const sql = read("supabase/migrations/089_training_clock.sql");
  const statements = sql.replace(/--.*$/gm, "");

  it("adds, never changes or drops, and old code keeps counting until the new server is live", () => {
    expect(statements).not.toMatch(/\bdrop\b/i);
    expect(statements).not.toMatch(/\bupdate\s+public\./i);
    expect(statements).toContain("add column if not exists proof text not null default 'before'");
    expect(statements).toContain("set lock_timeout = '8s'");
  });

  it("holds the proofs, and a clock entry's times and cap, in the database itself", () => {
    expect(statements).toContain("check (proof in ('before', 'typed', 'clock', 'session'))");
    expect(statements).toMatch(/proof <> 'clock'\s+or \(started_at is not null and ended_at is not null and ended_at > started_at and minutes <= 150\)/);
    expect(statements).toContain(`minutes <= ${CLOCK_CAP_MINUTES}`);
  });

  it("a running clock is one row per player, written by the server only", () => {
    expect(statements).toMatch(/create table if not exists public\.elite_training_clocks \(\s*profile_id\s+uuid primary key references public\.elite_trackers\(profile_id\) on delete cascade/);
    expect(statements).toContain("alter table public.elite_training_clocks enable row level security;");
    expect(statements.match(/create policy/g)?.length).toBe(1);
    expect(statements).toContain("for select using (public.elite_is_coach())");
  });
});

describe("the iPhone app", () => {
  const post = code("mobile/app/post.tsx");
  const store = code("mobile/src/clock.ts");

  it("both photos come from the camera: the photo library never starts or stops a clock", () => {
    // the one use of the library is the example build, which has no camera
    expect(post.match(/launchImageLibraryAsync/g)?.length).toBe(1);
    expect(post).toMatch(/if \(FIXTURES\) \{\s*res = await ImagePicker\.launchImageLibraryAsync\(/);
    expect(post).toMatch(/\} else \{\s*const asked = await ImagePicker\.requestCameraPermissionsAsync\(\);\s*if \(!asked\.granted\) return \{ off: true \};\s*res = await ImagePicker\.launchCameraAsync\(/);
    expect(post).not.toMatch(/Choose from photos|allowsEditing/);
  });

  it("nobody picks a length for a post: the chips are for training added without the clock", () => {
    expect(post.match(/LOG_CHIPS\.map/g)?.length).toBe(1);
    const typed = post.slice(post.indexOf("if (typed) {"), post.indexOf("if (clock && clock.finish"));
    expect(typed).toContain("LOG_CHIPS.map");
    expect(typed).toContain("{TYPED_LINE}");
    expect(typed).toContain("onPress={() => void addTyped()}");
    const addTyped = post.slice(post.indexOf("async function addTyped()"), post.indexOf("if (asking)"));
    expect(addTyped).toContain("logTraining(minutes, kind)");
    // and the clock's post sends no length at all
    expect(code("mobile/src/clock-core.ts")).toMatch(
      /return \{\s*started: String\(c\.start\.atMs\),\s*ended: String\(c\.finish\.atMs\),\s*sent: String\(sentMs\),\s*kind: p\.kind,\s*caption: p\.caption\.trim\(\),\s*less: String\(p\.less\),\s*\};/
    );
  });

  it("the clock is written to the phone at each photo, before anything is sent", () => {
    expect(store).toContain("await AsyncStorage.setItem(CLOCK_KEY, JSON.stringify(next));");
    const start = store.slice(store.indexOf("export async function startClock("), store.indexOf("export async function finishClock("));
    // the time is taken when the photo is, not after it has been made ready
    expect(start.indexOf("const atMs = Date.now()")).toBeLessThan(start.indexOf("await shrink(photo)"));
    expect(start.indexOf("await keep(")).toBeLessThan(start.indexOf("planTelling()"));
    const finish = store.slice(store.indexOf("export async function finishClock("), store.indexOf("export async function retakeFinish("));
    expect(finish.indexOf("const atMs = Date.now()")).toBeLessThan(finish.indexOf("await shrink(photo)"));
  });

  it("with no signal the finished clock stays on the phone, says so, and sends itself later", () => {
    const sent = store.slice(store.indexOf("async function attempt("), store.indexOf("let telling = false;"));
    // cleared in ONE place: when it was stored, or when sending again can never help
    expect(sent.match(/await clearClockStore\(\)/g)?.length).toBe(1);
    expect(sent).toContain("if (out.ok || out.final) await clearClockStore();");
    expect(sent).toContain('e.status === 0 && e.code === "offline" ? CLOCK_WORDS.kept : e.message');
    expect(CLOCK_WORDS.kept).toBe("Your training is saved on this phone. Post it when you are back online.");
    // what the player chose is stored BEFORE the first try
    const send = store.slice(store.indexOf("export async function sendClock("), store.indexOf("export async function resendClock("));
    expect(send.indexOf("await keep({ ...clock, post });")).toBeGreaterThan(-1);
    expect(send.indexOf("await keep({ ...clock, post });")).toBeLessThan(send.indexOf("await attempt(c, post)"));
    // and it is tried again when the app opens, comes back to the front, and on a timer
    expect(store).toMatch(/export async function loadClock\(\)[\s\S]{0,500}void resendClock\(\);/);
    expect(store).toMatch(/AppState\.addEventListener\("change", \(s\) => \{[\s\S]{0,200}void resendClock\(\);/);
    expect(store).toContain("}, resendDelayMs(tries++));");
    expect(code("mobile/app/_layout.tsx")).toContain('if (area === "free") void loadClock();');
    // one send at a time, so a tap and a timer never post it twice at once
    expect(store.match(/if \(sending/g)?.length).toBe(2);
    // a post the server will never take is not dropped silently
    expect(store).toContain("await AsyncStorage.setItem(NOTE_KEY, out.message)");
    expect(post).toContain("void takeClockNote().then((note) => note && setError(note));");
  });

  it("one tap goes to the camera, after the first clock, and never during the screen's own arrival", () => {
    for (const f of ["mobile/app/(free)/friends.tsx", "mobile/app/club/[id]/index.tsx", "mobile/src/ClockRow.tsx"]) {
      expect(code(f), f).toContain("router.push(OPEN_CLOCK)");
      expect(code(f), f).not.toContain('router.push("/post")');
    }
    expect(code("mobile/src/ClockRow.tsx")).toContain('export const OPEN_CLOCK = "/post?go=1" as Href;');
    expect(post).toContain("cameraFirst(clockView(mine, Date.now()), p.clockKnown, CLOCK_MIN_SECONDS)");
    expect(post).toContain("}, CAMERA_AFTER_MS);");
    // the first clock a player starts is what turns it on
    expect(store).toContain('void setPref("clockKnown", true);');
  });

  it("time taken off can only make a session shorter", () => {
    expect([cleanLess(null), cleanLess(""), cleanLess("0"), cleanLess("15"), cleanLess(30)]).toEqual([0, 0, 0, 15, 30]);
    for (const bad of ["-5", "7", "5.5", "150", "9999", "five", {}, 12]) expect(cleanLess(bad), String(bad)).toBeNull();
    expect([lessApplied(47, 0), lessApplied(47, 15), lessApplied(47, 45), lessApplied(47, 500), lessApplied(47, -30)]).toEqual([47, 32, 2, 1, 47]);
    expect([lessMax(47), lessMax(5), lessMax(6), lessMax(150), lessMax(1)]).toEqual([45, 0, 5, 145, 0]);
    // the phone shows it, the server applies it to its own count
    expect(post).toContain("const counted = lessApplied(measured, less);");
    expect(code("app/api/app/free/clock/finish/route.ts")).toContain('const less = cleanLess(form.get("less"));');
  });

  it("the example build's head start is never in a real build", () => {
    expect(store).toContain("const atMs = Date.now() - (FIXTURES ? EXAMPLE_HEAD_START_MS : 0);");
    expect(store.match(/EXAMPLE_HEAD_START_MS/g)?.length).toBe(2);
  });

  it("signing out leaves no clock on the phone", () => {
    const account = code("mobile/src/account.ts");
    expect(account.match(/await clearClockStore\(\);/g)?.length).toBe(2);
  });

  it("a running clock is in sight on Friends and Week, and the one button says where it stands", () => {
    expect(code("mobile/app/(free)/friends.tsx")).toContain("<ClockRow />");
    expect(code("mobile/app/(free)/my-week.tsx")).toContain("<ClockRow />");
    const core = code("mobile/src/clock-core.ts");
    expect(core).toContain('if (view.at === "ready") return CLOCK_WORDS.postShort;');
    expect(core).toContain('if (view.at === "none") return CLOCK_WORDS.start;');
    // nowhere in the app does a button still promise a post before any training
    for (const f of walk(join(root, "mobile/app")).concat(walk(join(root, "mobile/src"))).filter((x) => /\.tsx$/.test(x))) {
      expect(code(f.slice(root.length + 1)), f).not.toMatch(/label="Post my training"/);
    }
  });

  it("typed time is marked wherever it is shown", () => {
    expect(code("mobile/app/(free)/my-week.tsx")).toContain("e.timed === false ? NOT_TIMED : null");
    expect(code("mobile/src/FeedCards.tsx")).toContain("card.timed === false ? NOT_TIMED : null");
    expect(code("components/elite/MyWeek.tsx")).toContain("l.timed === false");
    expect(code("components/elite/FriendsFeed.tsx")).toContain("card.timed === false");
    // the website has no clock, and says so before a length is posted
    expect(code("components/elite/PostComposer.tsx")).toContain("{WEB_TYPED_LINE}");
  });
});
