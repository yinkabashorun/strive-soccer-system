import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  DOOR_BODY,
  DOOR_FIELD,
  DOOR_KEEP_GOING,
  DOOR_NOT_A_CODE,
  DOOR_NO_CODE,
  DOOR_NO_MATCH,
  DOOR_OWN_CODE,
  DOOR_SEASON,
  DOOR_TITLE,
  DOOR_TO_FRIENDS,
  DOOR_USE,
  DOOR_WORKED,
  doorCodeFrom,
  friendShareText,
  FRIEND_SHARE_FIRST_LINES,
} from "@/lib/elite/free-door";
import { freeStage } from "@/lib/elite/free-intake";
import { clubShareFirstLines, clubShareText } from "@/lib/elite/club-app";
import { clubLink, joinLink } from "@/lib/elite/tracker";
import { upgradeCard } from "@/lib/elite/upgrade-card";
import { pushTextProblems } from "@/lib/elite/notices";

// THE DOOR (Coach Yinka, Nov 26 2026: "yes 1 is great"): a new free
// account in the iPhone app is asked once, right after its photo, "Have a
// code from a teammate or a club?". A real code asks the way the website's
// link does (a friend request, or the club's captain) and the player goes
// STRAIGHT to the free app; the quiz and the offer wait behind the one
// card on Week. No code is the path as it always was. Held here: what a
// code is, that ONLY a real code lets anyone past the quiz, that an
// unapplied migration skips nobody, the words, and the invites that carry
// the code.

const root = join(__dirname, "..");
const code = (p: string) => readFileSync(join(root, p), "utf8");
const APP = "https://thestriveapp.com";

describe("what a typed or pasted code is", () => {
  it("a bare code, in any case, with spaces around it", () => {
    expect(doorCodeFrom("ABCD2345")).toEqual({ code: "ABCD2345", kind: null });
    expect(doorCodeFrom("  abcd2345 ")).toEqual({ code: "ABCD2345", kind: null });
  });

  it("a pasted link says which kind it is", () => {
    expect(doorCodeFrom(joinLink(APP, "ABCD2345"))).toEqual({ code: "ABCD2345", kind: "friend" });
    expect(doorCodeFrom(clubLink(APP, "WXYZ6789"))).toEqual({ code: "WXYZ6789", kind: "club" });
  });

  it("the whole invite, pasted as it was sent, is read", () => {
    const friend = friendShareText({ code: "ABCD2345", link: joinLink(APP, "ABCD2345"), day: "2026-11-28" });
    expect(FRIEND_SHARE_FIRST_LINES.map((l) => `${l}\nMy code: ABCD2345\nhttps://thestriveapp.com/join?ref=ABCD2345`)).toContain(friend);
    expect(doorCodeFrom(friend)).toEqual({ code: "ABCD2345", kind: "friend" });
    const club = clubShareText({ name: "Sunday Pickup", code: "WXYZ6789", appUrl: APP });
    expect(club).toContain("Club code: WXYZ6789");
    expect(doorCodeFrom(club)).toEqual({ code: "WXYZ6789", kind: "club" });
    // every first line the rotation can send, with the link and without it
    // (cut off by whatever carried it), still reads as the code
    for (const line of FRIEND_SHARE_FIRST_LINES) {
      expect(doorCodeFrom(`${line}\nMy code: ABCD2345\n${joinLink(APP, "ABCD2345")}`)).toEqual({ code: "ABCD2345", kind: "friend" });
      expect(doorCodeFrom(`${line}\nMy code: abcd2345`)).toEqual({ code: "ABCD2345", kind: null });
    }
    for (const line of clubShareFirstLines("Sunday Pickup")) {
      expect(doorCodeFrom(`${line}\nClub code: WXYZ6789\n${clubLink(APP, "WXYZ6789")}`)).toEqual({ code: "WXYZ6789", kind: "club" });
      expect(doorCodeFrom(`${line}\nClub code: WXYZ6789`)).toEqual({ code: "WXYZ6789", kind: "club" });
    }
    // every day's pick is one of them, and each is reachable
    const seen = new Set<string>();
    for (let d = 1; d <= 28; d++) seen.add(friendShareText({ code: "ABCD2345", link: "x", day: `2026-11-${String(d).padStart(2, "0")}` }).split("\n")[0]);
    expect([...seen].sort()).toEqual([...FRIEND_SHARE_FIRST_LINES].sort());
    // the words alone, with the link cut off by whatever carried them
    expect(doorCodeFrom("Join Sunday Pickup on Strive Elite.\nClub code: WXYZ6789")).toEqual({ code: "WXYZ6789", kind: "club" });
    expect(doorCodeFrom("Train with me on Strive Elite.\nMy code: abcd2345")).toEqual({ code: "ABCD2345", kind: null });
  });

  it("anything else is not a code, and nothing is looked up for it", () => {
    for (const raw of ["", "   ", "ABCD234", "ABCD23456", "ABCD-234", "hello there", "O0I1O0I1", null, undefined, 12345678, {}, "A".repeat(601)]) {
      expect(doorCodeFrom(raw), String(raw)).toBeNull();
    }
  });
});

describe("who goes straight to the free app", () => {
  it("the mark wins: a player who came in by a code is in the free app, quiz or no quiz", () => {
    expect(freeStage({ available: true, hasIntake: false, planned: false, later: true })).toBe("ready");
    // and stays there after taking the quiz later: never pushed through the offer or the week's set-up
    expect(freeStage({ available: true, hasIntake: true, planned: false, later: true })).toBe("ready");
    expect(freeStage({ available: true, hasIntake: true, planned: true, later: true })).toBe("ready");
  });

  it("with no mark, the path is exactly what it was", () => {
    expect(freeStage({ available: true, hasIntake: false, planned: false })).toBe("quiz");
    expect(freeStage({ available: true, hasIntake: false, planned: false, later: false })).toBe("quiz");
    expect(freeStage({ available: true, hasIntake: false, planned: true, later: false })).toBe("quiz");
    expect(freeStage({ available: true, hasIntake: true, planned: false, later: false })).toBe("offer");
    expect(freeStage({ available: true, hasIntake: true, planned: true, later: false })).toBe("ready");
    // where the quiz cannot be stored at all, the mark changes nothing
    expect(freeStage({ available: false, hasIntake: false, planned: false, later: true })).toBe("web");
  });

  it("the quiz and the offer wait behind the ONE card on Week", () => {
    const now = Date.UTC(2026, 10, 26);
    const card = upgradeCard({ place: "week", member: false, area: null, sessions: 0, dismissedAt: null, now, quiz: true });
    expect(card?.opens).toBe("quiz");
    expect(card?.action).toBe("See what you get");
    expect(pushTextProblems({ title: card!.title, body: card!.line })).toEqual([]);
    // the free app's readers say when: no answers stored
    const server = code("lib/elite/free-app-server.ts");
    expect(server).toContain("...(answers ? {} : { quiz: true })");
    // and the card is still on Week alone
    for (const f of ["mobile/app/(free)/friends.tsx", "mobile/app/(free)/me.tsx", "mobile/app/(free)/clubs.tsx"]) {
      expect(code(f), f).not.toContain("UpgradeCard");
    }
    expect(code("mobile/app/(free)/my-week.tsx")).toContain("UpgradeCard");
  });
});

describe("the server decides, and only a real code is let past the quiz", () => {
  const door = code("lib/elite/free-door-server.ts");
  const intake = code("lib/elite/free-intake-server.ts");

  it("the mark is written in ONE place, called from ONE place", () => {
    const writers: string[] = [];
    const callers: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(join(root, dir))) {
        const p = `${dir}/${name}`;
        if (statSync(join(root, p)).isDirectory()) {
          if (name !== "node_modules" && name !== ".next") walk(p);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(name)) continue;
        const src = code(p);
        if (/quiz_later_at:/.test(src)) writers.push(p);
        if (/markQuizLater\(/.test(src) && !src.includes("export async function markQuizLater(")) callers.push(p);
      }
    };
    walk("lib");
    walk("app");
    expect(writers).toEqual(["lib/elite/free-intake-server.ts"]);
    expect(callers).toEqual(["lib/elite/free-door-server.ts"]);
  });

  it("a code that matched nobody, a refusal and the player's own code return before the mark", () => {
    const mark = door.indexOf("markQuizLater(");
    expect(mark).toBeGreaterThan(-1);
    for (const early of [
      "if (!typed) return { ok: false, error: DOOR_NOT_A_CODE };",
      "if (typed.code === input.tracker.referral_code) return { ok: false, error: DOOR_OWN_CODE };",
      "if (refused) return { ok: false, error: refused };",
      "if (!answer) return { ok: false, error: DOOR_NO_MATCH };",
    ]) {
      expect(door.indexOf(early), early).toBeGreaterThan(-1);
      expect(door.indexOf(early), early).toBeLessThan(mark);
    }
    // and never for a player who already answered the quiz, or where it cannot be stored
    expect(door).toContain("Boolean(input.intake?.available) && !input.intake?.answers");
  });

  it("a code asks; it never makes a friend or puts anyone in a club by itself", () => {
    // the website's own two actions, with their caps, blocks and refusals
    expect(door).toContain("askToJoinByCode(input.viewer, typed.code)");
    expect(door).toContain("confirmFriend(typed.code)");
    expect(door).not.toMatch(/elite_tracker_friends|elite_tracker_club_members|\.insert\(/);
    // the only row it writes is the player's own: who sent them, once, while still new
    expect(door.match(/\.update\(/g)).toHaveLength(1);
    expect(door).toContain('.update({ referred_by: answer.friendId })');
    expect(door).toContain('.eq("profile_id", me)');
    expect(door).toContain('.is("referred_by", null)');
  });

  it("until 090 is applied a code still asks and nobody skips", () => {
    // the mark is read apart from the quiz, and a failed read is "no"
    const read = intake.slice(intake.indexOf("async function readLater"), intake.indexOf("export async function markQuizLater"));
    expect(read).toContain('.select("quiz_later_at")');
    expect(read).toContain("return !error && Boolean(");
    expect(read).toContain("return false;");
    // a mark that could not be written answers false, so `skipped` is false
    const write = intake.slice(intake.indexOf("export async function markQuizLater"), intake.indexOf("export async function intakeColumnsReady"));
    expect(write).toContain("return !error;");
    expect(write).toContain("return false;");
    // the quiz's own read never selects the new column, so 082 alone still works
    expect(intake).toContain('.select("intake, upgrade_checkout")');
  });

  it("a player who skipped trains toward the coaches' in-season row until they set their own", () => {
    expect(DOOR_SEASON).toBe("in_season");
    const write = intake.slice(intake.indexOf("export async function markQuizLater"), intake.indexOf("export async function intakeColumnsReady"));
    expect(write).toContain("...(hasTarget ? {} : { target_minutes: recommendation(targets, DOOR_SEASON).minutes })");
    // never a number written here
    expect(write).not.toMatch(/target_minutes:\s*\d/);
    // and "Change your target and days" saves for them with no quiz behind it
    expect(intake).toContain("if (!now || (!now.season && !(await readLater(admin, input.profileId))))");
  });

  it("the route is the free account's own, throttled, and waits for the photo", () => {
    const route = code("app/api/app/free/code/route.ts");
    expect(route).toMatch(/appRoute\(\{ name: "free-code", access: "free", limit: 12, windowMs: 10 \* 60_000 \}/);
    expect(route).toContain("enterDoorCode(");
    expect(route).not.toMatch(/createServiceClient|\.from\(/);
  });
});

describe("migration 090", () => {
  const sql = code("supabase/migrations/090_the_door_and_champs.sql");
  const body = sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");

  it("adds one column and one ledger, and takes nothing away", () => {
    expect(body).toContain("add column if not exists quiz_later_at timestamptz");
    expect(body).toContain("create table if not exists public.elite_champs_notices");
    expect(body).toContain("primary key (week_monday, club_id, profile_id)");
    expect(body).not.toMatch(/\bdrop\b|\bdelete\s+from\b|\btruncate\b|\bupdate\s+public\./i);
    expect(body).toContain("set lock_timeout = '8s'");
  });

  it("the ledger is closed: row security on, coaches may read, nobody writes but the server", () => {
    expect(body).toContain("alter table public.elite_champs_notices enable row level security");
    expect(body.match(/create policy/g)).toHaveLength(1);
    expect(body).toContain("for select using (public.elite_is_coach())");
  });
});

describe("the door's words", () => {
  it("are his question, one box, and a clear way on with no code", () => {
    expect(DOOR_TITLE).toBe("Have a code from a teammate or a club?");
    expect(DOOR_FIELD).toBe("Code from a teammate or a club");
    expect(DOOR_USE).toBe("Use my code");
    expect(DOOR_NO_CODE).toBe("I don't have a code");
    expect(DOOR_TO_FRIENDS).toBe("Go to my friends");
    expect(DOOR_KEEP_GOING).toBe("Keep going");
    expect(DOOR_WORKED).toBe("Your code worked");
  });

  it("say the whole thing, with no dash and nothing a player has to decode", () => {
    for (const line of [DOOR_TITLE, DOOR_BODY, DOOR_NOT_A_CODE, DOOR_NO_MATCH, DOOR_OWN_CODE]) {
      expect(line, line).not.toMatch(/[—–]/);
      expect(line, line).not.toMatch(/\b(AI|automated|algorithm|invalid|error)\b/i);
      expect(line.length, line).toBeLessThanOrEqual(120);
    }
  });

  it("the screen uses them, and its two ways on are both always there", () => {
    const screen = code("mobile/src/CodeDoor.tsx");
    for (const name of ["DOOR_TITLE", "DOOR_BODY", "DOOR_FIELD", "DOOR_USE", "DOOR_NO_CODE", "DOOR_TO_FRIENDS", "DOOR_KEEP_GOING"]) {
      expect(screen, name).toContain(name);
    }
    // the named box (a tap on its name puts the cursor in it) on the shared typing page
    expect(screen).toContain("<LabeledField");
    expect(screen).toContain("<FormScreen");
    // both ways on ride on the keyboard: they are the page's footer, never under the box
    const typing = screen.slice(screen.lastIndexOf("<FormScreen"));
    const footer = typing.slice(typing.indexOf("footer={"), typing.indexOf("<Animated.View"));
    expect(footer).toContain("label={DOOR_USE}");
    expect(footer).toContain("label={DOOR_NO_CODE}");
    expect(screen).not.toMatch(/position:\s*"absolute"/);
    // the button that sends the code is never switched off
    expect(footer).not.toMatch(/disabled/);
    // gold is never a button
    expect(screen).not.toMatch(/backgroundColor:\s*colors\.gold/);
  });
});

describe("the invites carry the code to type", () => {
  it("a friend's invite from the app is the words with the code, on every tab that shares it", () => {
    const server = code("lib/elite/free-app-server.ts");
    expect(server).toContain("friendShareText(");
    for (const f of ["mobile/app/(free)/friends.tsx", "mobile/app/(free)/me.tsx"]) {
      expect(code(f), f).toContain("inviteShare(");
    }
  });

  it("a club's invite already does", () => {
    const text = clubShareText({ name: "Renegados FC", code: "WXYZ6789", appUrl: APP, day: "2026-11-28" });
    expect(clubShareFirstLines("Renegados FC").map((l) => `${l}\nClub code: WXYZ6789\nhttps://thestriveapp.com/join?club=WXYZ6789`)).toContain(text);
  });
});
