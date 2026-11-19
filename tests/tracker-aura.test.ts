import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AURA_LEVELS,
  AURA_PHOTO_DAY,
  AURA_WEEK_HIT,
  RANKING_MIN_MEMBERS,
  RANKING_TOP,
  auraLabel,
  auraLevel,
  auraNextLine,
  auraPoints,
  cleanPlayingFor,
  clubRanking,
  type AuraLog,
  type RankingRow,
} from "@/lib/elite/tracker";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
const fn = (src: string, from: string) => src.slice(src.indexOf(from), src.indexOf("\n}\n", src.indexOf(from)) + 2);

const t = (day: string, minutes: number, photo = false): AuraLog => ({ trained_on: day, minutes, kind: "training", photo });
const gym = (day: string, minutes: number, photo = false): AuraLog => ({ trained_on: day, minutes, kind: "gym", photo });

describe("aura", () => {
  it("is a minute of training a point; gym never counts", () => {
    expect(auraPoints([t("2026-11-16", 30)], 0)).toBe(30);
    expect(auraPoints([t("2026-11-16", 30), gym("2026-11-16", 60)], 0)).toBe(30);
  });

  it("a photo day counts once, however many photos that day", () => {
    const one = auraPoints([t("2026-11-16", 30, true)], 0);
    const three = auraPoints([t("2026-11-16", 30, true), t("2026-11-16", 0, true), gym("2026-11-16", 0, true)], 0);
    expect(one).toBe(30 + AURA_PHOTO_DAY);
    expect(three).toBe(30 + AURA_PHOTO_DAY);
    expect(auraPoints([t("2026-11-16", 30, true), t("2026-11-17", 30, true)], 0)).toBe(60 + 2 * AURA_PHOTO_DAY);
  });

  it("a week that reached the target gets the week bonus, Monday to Sunday", () => {
    // Mon Nov 16 to Sun Nov 22 2026
    const week = [t("2026-11-16", 120), t("2026-11-22", 120)];
    expect(auraPoints(week, 240)).toBe(240 + AURA_WEEK_HIT);
    expect(auraPoints(week, 241)).toBe(240);
    // split across two weeks: no bonus
    expect(auraPoints([t("2026-11-15", 120), t("2026-11-16", 120)], 240)).toBe(240);
    // gym does not fill the target
    expect(auraPoints([t("2026-11-16", 200), gym("2026-11-17", 100)], 240)).toBe(200);
  });

  it("only goes up: old logs never lose anything as time passes", () => {
    const logs = [t("2025-01-06", 300, true), t("2026-11-16", 30)];
    const now = auraPoints(logs, 240);
    // the rule takes no "today": the same logs read the same forever
    expect(auraPoints.length).toBe(2);
    expect(auraPoints(logs, 240)).toBe(now);
    // logging more never lowers it
    expect(auraPoints([...logs, t("2026-11-17", 10)], 240)).toBeGreaterThan(now);
  });

  it("a deleted log takes its own minutes away; a removed post loses the photo day, keeps the minutes", () => {
    const logs = [t("2026-11-16", 45, true), t("2026-11-17", 30)];
    expect(auraPoints([logs[1]], 0)).toBe(auraPoints(logs, 0) - 45 - AURA_PHOTO_DAY);
    const removed = [{ ...logs[0], photo: false }, logs[1]];
    expect(auraPoints(removed, 0)).toBe(auraPoints(logs, 0) - AURA_PHOTO_DAY);
    // the server reads a removed post as no photo
    const server = code("lib/elite/tracker-server.ts");
    expect(fn(server, "export async function auraLogsOf(")).toContain("photo: Boolean(r.photo_path) && !r.removed_at");
  });

  it("is shown as a level from the table, never as a number of points", () => {
    expect(AURA_LEVELS).toEqual([0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500, 7500]);
    expect(auraLevel(0)).toEqual({ level: 1, progress: 0, toNext: 100 });
    expect(auraLevel(99).level).toBe(1);
    expect(auraLevel(100).level).toBe(2);
    expect(auraLevel(200)).toEqual({ level: 2, progress: 0.5, toNext: 100 });
    expect(auraLevel(7499).level).toBe(10);
    expect(auraLevel(7500)).toEqual({ level: 11, progress: 1, toNext: null });
    expect(auraLevel(99999).level).toBe(11);
    expect(auraLabel(4)).toBe("Aura Level 4");
    expect(auraNextLine(auraLevel(200))).toBe("1h 40m of training to Level 3");
    expect(auraNextLine(auraLevel(9000))).toBeNull();
    // the sheet shows the level and the bar, never the points
    const sheet = code("components/elite/ProfileSheet.tsx");
    expect(sheet).toContain("auraLabel(profile.aura.level)");
    expect(sheet).not.toMatch(/auraPoints|toNext\b/);
  });
});

describe("the line on a profile", () => {
  it("is one plain line of 40, no links, blank takes it off", () => {
    expect(cleanPlayingFor("  NVA 2010 Boys ECNL ")).toBe("NVA 2010 Boys ECNL");
    expect(cleanPlayingFor("x".repeat(41))).toBeNull();
    expect(cleanPlayingFor("follow me at insta.com/x")).toBeNull();
    const set = fn(code("lib/elite/tracker-actions.ts"), "export async function setPlayingFor(");
    expect(set).toContain('.update({ playing_for: line }).eq("profile_id", o.profileId)');
    expect(read("supabase/migrations/069_free_training_log.sql")).toContain(
      "playing_for    text check (playing_for is null or char_length(playing_for) between 1 and 40)"
    );
  });

  it("a friend can report it from the profile, and only a coach clears it", () => {
    const acts = code("lib/elite/tracker-actions.ts");
    const report = fn(acts, "export async function reportLine(");
    // the reporter must be allowed to see that profile in the first place
    expect(report).toContain("profileFor(viewer, targetId, nyToday())");
    expect(report).toMatch(/if \(!count\) \{[\s\S]*?await textCoaches\(/);
    for (const name of ["clearPlayingFor", "dismissLineReports"]) {
      const body = fn(acts, `export async function ${name}(`);
      expect(body, name).toContain("const c = await coach();");
      expect(body, name).toContain('if (c.kind === "no") return fail("Only a coach can do this.");');
    }
    expect(code("components/elite/ProfileSheet.tsx")).toContain("reportLine(profile.id)");
    expect(code("app/(coach)/coach/free/page.tsx")).toContain("<LineReports reports={data.lineReports} />");
  });
});

describe("the club ranking", () => {
  const clubs = (n: number, size = 3) =>
    [...Array(n).keys()].map((i) => ({
      id: `c${i}`,
      name: `Club ${String(i).padStart(2, "0")}`,
      memberIds: [...Array(size).keys()].map((j) => `p${i}-${j}`),
    }));

  it("ranks clubs of three or more by the average training a member logged", () => {
    const weekMinutes = new Map([
      ["a", 300],
      ["b", 0],
      ["c", 0],
      ["d", 60],
      ["e", 60],
      ["f", 60],
      ["g", 999],
    ]);
    const rows = clubRanking({
      clubs: [
        { id: "x", name: "X", memberIds: ["a", "b", "c"] },
        { id: "y", name: "Y", memberIds: ["d", "e", "f"] },
        { id: "small", name: "Two of us", memberIds: ["g", "a"] },
      ],
      weekMinutes,
      myClubIds: new Set(),
    });
    expect(RANKING_MIN_MEMBERS).toBe(3);
    expect(rows.map((r) => [r.name, r.place, r.average])).toEqual([
      ["X", 1, 100],
      ["Y", 2, 60],
    ]);
  });

  it("ties share a place; the top ten, plus your own clubs wherever they are", () => {
    const list = clubs(14);
    const weekMinutes = new Map<string, number>();
    list.forEach((c, i) => c.memberIds.forEach((id) => weekMinutes.set(id, 140 - i * 10)));
    for (const id of list[0].memberIds) weekMinutes.set(id, 130); // club 0 ties club 1
    const rows = clubRanking({ clubs: list, weekMinutes, myClubIds: new Set(["c13"]) });
    expect(RANKING_TOP).toBe(10);
    expect(rows.length).toBe(11);
    expect(rows[0].place).toBe(1);
    expect(rows[1].place).toBe(1);
    expect(rows[2].place).toBe(3);
    expect(rows[10]).toMatchObject({ id: "c13", mine: true, place: 14 });
  });

  it("carries club names only: nothing about any player leaves the ranking", () => {
    const rows: RankingRow[] = clubRanking({ clubs: clubs(3), weekMinutes: new Map(), myClubIds: new Set() });
    for (const r of rows) expect(Object.keys(r).sort()).toEqual(["average", "id", "mine", "name", "place"]);
    const ranking = code("lib/elite/tracker-ranking.ts");
    expect(ranking).not.toMatch(/elite_profiles|full_name|shortName|namesOf/);
    expect(ranking).toMatch(/Promise<RankingRow\[\]>/);
    // the sheet shows a club and its average, never a member
    const section = code("components/elite/ClubsSection.tsx");
    const sheet = section.slice(section.indexOf('sheet?.kind === "ranking"'), section.indexOf('sheet?.kind === "started"'));
    expect(sheet).toContain("{r.name}");
    expect(sheet).not.toMatch(/members|memberIds|profile\(/);
  });

  it("players are still only ever ranked next to their friends", () => {
    const board = fn(code("lib/elite/tracker-server.ts"), "export async function friendsWeekFor(");
    expect(board).toContain("friendIdsOf(");
  });
});

describe("the star", () => {
  it("is given and taken back by a coach only", () => {
    const acts = code("lib/elite/tracker-actions.ts");
    const star = fn(acts, "export async function setStar(");
    expect(star).toContain("const c = await coach();");
    expect(star).toContain('if (c.kind === "no") return fail("Only a coach can do this.");');
    expect(star).toContain("starred_by: c.profileId");
    // nothing else a browser can call writes the star or the note
    expect(acts.replace(star, "")).not.toMatch(/starred_at|starred_by|elite_tracker_star_notes/);
    // and the browser cannot write elite_trackers at all
    const sql = read("supabase/migrations/069_free_training_log.sql");
    expect(sql).not.toMatch(/on public\.elite_trackers\s+for (insert|update|delete|all)/);
  });

  it("the coaches' note is in a table only coaches read", () => {
    const sql = read("supabase/migrations/069_free_training_log.sql");
    const part = sql.slice(sql.indexOf("create table if not exists public.elite_tracker_star_notes"), sql.indexOf("-- 11)"));
    expect(part).toContain("for select using (public.elite_is_coach())");
    expect(part).not.toMatch(/auth\.uid\(\)/);
    for (const f of ["lib/elite/tracker-server.ts", "components/elite/ProfileSheet.tsx", "components/elite/FriendsFeed.tsx"]) {
      expect(code(f), f).not.toMatch(/star_note|elite_tracker_star_notes/);
    }
  });

  it("shows as the gold mark beside a name wherever it appears", () => {
    expect(code("components/elite/StarMark.tsx")).toContain("aria-label={STAR_LABEL}");
    expect(code("components/elite/FriendsFeed.tsx")).toContain("{card.starred && <StarMark");
    expect(code("components/elite/FriendsFeed.tsx")).toContain("{f.starred && <StarMark");
    expect(code("components/elite/FriendsBoard.tsx")).toContain("{r.starred && <StarMark");
    expect(code("components/elite/ClubsSection.tsx")).toContain("{m.starred && <StarMark");
    expect(code("components/elite/ProfileSheet.tsx")).toContain("{profile.starred && <StarMark");
    expect(code("app/(coach)/coach/free/page.tsx")).toContain("<StarToggle");
  });
});
