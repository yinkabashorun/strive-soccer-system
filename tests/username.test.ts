import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  USERNAME_MAX,
  USERNAME_MIN,
  atName,
  isReservedUsername,
  normalizeUsername,
  usernameIdeas,
  usernameProblem,
} from "../lib/elite/username";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// The @username (Nov 23 2026, Coach Yinka: "players should MAKE A USERNAME
// during onboarding, Instagram style"): one namespace for every account,
// members and free accounts alike.

describe("username format", () => {
  it("is lowercase letters, numbers, dot and underscore, 3 to 20", () => {
    expect(USERNAME_MIN).toBe(3);
    expect(USERNAME_MAX).toBe(20);
    for (const ok of ["marcus", "marcus.b", "marcus_b", "m4rcus", "abc", "a".repeat(20), "j.r_10"]) {
      expect(usernameProblem(ok), ok).toBeNull();
    }
    expect(usernameProblem("ab")).toBe("short");
    expect(usernameProblem("a".repeat(21))).toBe("long");
    expect(usernameProblem("marcus b")).toBe("characters");
    expect(usernameProblem("marcus-b")).toBe("characters");
    expect(usernameProblem("márcus")).toBe("characters");
    expect(usernameProblem("marcus!")).toBe("characters");
  });

  it("takes the @ and the capitals off what was typed, and shows it with the @", () => {
    expect(normalizeUsername("  @Marcus.B ")).toBe("marcus.b");
    expect(normalizeUsername(42)).toBe("");
    expect(usernameProblem("@Marcus")).toBeNull();
    expect(atName("Marcus.B")).toBe("@marcus.b");
    expect(atName(null)).toBeNull();
  });

  it("no dot at either end or two in a row, and at least one letter", () => {
    expect(usernameProblem(".marcus")).toBe("dots");
    expect(usernameProblem("marcus.")).toBe("dots");
    expect(usernameProblem("mar..cus")).toBe("dots");
    expect(usernameProblem("12345")).toBe("letter");
    expect(usernameProblem("___")).toBe("letter");
  });

  it("the database holds the same shape (081)", () => {
    const sql = read("supabase/migrations/081_profile_photo_and_username.sql");
    expect(sql).toContain("username ~ '^[a-z0-9._]{3,20}$'");
    expect(sql).toContain("position('..' in username) = 0");
    expect(sql).toContain("username ~ '[a-z]'");
  });
});

describe("reserved words", () => {
  it("Strive, the staff words and the coaches' names, however they are dotted", () => {
    for (const name of [
      "strive",
      "striveelite",
      "strive.elite",
      "strive_soccer",
      "strivesoccer",
      "strive123",
      "coach",
      "coach.yinka",
      "coachyinka",
      "coach_gary",
      "coachgary10",
      "yinka",
      "gary",
      "yinka.bashorun",
      "gary_grigoryan",
      "admin",
      "the.admin",
      "support",
      "striveofficial",
      "official.marcus",
      "moderator",
      "help",
    ]) {
      expect(isReservedUsername(name), name).toBe(true);
      expect(usernameProblem(name), name).toBe("reserved");
    }
  });

  it("an ordinary player's name is not caught by them", () => {
    for (const name of ["marcus", "garyson", "yinkab", "coachella", "marcus.trains", "abdul_r"]) {
      // "garyson" and "yinkab" are not the coaches' names; only the names
      // themselves, and coach plus either name, are held back
      expect(isReservedUsername(name), name).toBe(false);
    }
  });
});

describe("the word filter", () => {
  it("runs on a username, the dots and underscores read as spaces too", () => {
    expect(usernameProblem("fuck")).toBe("offensive");
    expect(usernameProblem("big.shit")).toBe("offensive");
    expect(usernameProblem("shit_head")).toBe("offensive");
    expect(usernameProblem("marcus.b")).toBeNull();
  });
});

describe("ideas from their own name", () => {
  it("are all usernames that pass the rules, never more than the list holds, never reserved", () => {
    const ideas = usernameIdeas("Marcus Bashorun");
    expect(ideas[0]).toBe("marcus.bashorun");
    expect(ideas).toContain("marcusbashorun");
    for (const i of ideas) expect(usernameProblem(i), i).toBeNull();
    expect(new Set(ideas).size).toBe(ideas.length);
  });

  it("handle accents, apostrophes, one word and nothing at all", () => {
    for (const i of usernameIdeas("José O'Neil")) expect(usernameProblem(i), i).toBeNull();
    expect(usernameIdeas("José O'Neil")[0]).toBe("jose.oneil");
    expect(usernameIdeas("Marcus").every((i) => i.startsWith("marcus"))).toBe(true);
    expect(usernameIdeas("")).toEqual([]);
    // a long name is cut to the limit, never past it
    for (const i of usernameIdeas("Maximilianus Wolfeschlegelsteinhausen")) expect(i.length).toBeLessThanOrEqual(USERNAME_MAX);
  });
});

// ---- One namespace, case-insensitive: the server and the index -----------

type Row = { id: string; username: string | null };
const rows: Row[] = [];

function fakeAdmin() {
  return {
    from(table: string) {
      if (table !== "elite_profiles") throw new Error("only elite_profiles");
      let filter: ((r: Row) => boolean) | null = null;
      let patch: Partial<Row> | null = null;
      const q = {
        select() {
          return q;
        },
        ilike(_col: string, pattern: string) {
          // the server escapes _ and %, so this is a plain match ignoring case
          const plain = pattern.replace(/\\([\\%_])/g, "$1").toLowerCase();
          filter = (r) => (r.username ?? "").toLowerCase() === plain;
          return q;
        },
        in(_col: string, names: string[]) {
          filter = (r) => names.includes(r.username ?? "");
          return Promise.resolve({ data: rows.filter((r) => filter!(r)), error: null });
        },
        limit() {
          return Promise.resolve({ data: rows.filter((r) => filter!(r)).map((r) => ({ id: r.id })), error: null });
        },
        update(p: Partial<Row>) {
          patch = p;
          return q;
        },
        eq(_col: string, id: string) {
          // the unique index on lower(username) (081)
          const name = (patch?.username ?? "").toLowerCase();
          if (name && rows.some((r) => r.id !== id && (r.username ?? "").toLowerCase() === name)) {
            return Promise.resolve({ error: { code: "23505", message: "duplicate key" } });
          }
          const row = rows.find((r) => r.id === id);
          if (row && patch) Object.assign(row, patch);
          return Promise.resolve({ error: null });
        },
      };
      return q;
    },
  };
}

vi.mock("../lib/elite/supabase/server", () => ({
  createServiceClient: () => fakeAdmin(),
  isSupabaseConfigured: () => true,
}));

describe("one username per account, whatever the case", () => {
  beforeEach(() => {
    rows.length = 0;
    rows.push({ id: "a", username: "marcus.b" }, { id: "b", username: null }, { id: "c", username: null });
  });

  it("a name someone has is taken, in any case; your own is yours", async () => {
    const { checkUsernameFor } = await import("../lib/elite/account-profile-server");
    expect(await checkUsernameFor("b", "MARCUS.B")).toEqual({ ok: false, name: "marcus.b", problem: "taken" });
    expect(await checkUsernameFor("a", "Marcus.B")).toEqual({ ok: true, name: "marcus.b" });
    expect(await checkUsernameFor("b", "jalen_r")).toEqual({ ok: true, name: "jalen_r" });
  });

  it("an underscore is a letter here, not a wildcard", async () => {
    const { checkUsernameFor } = await import("../lib/elite/account-profile-server");
    rows.push({ id: "d", username: "jalenxr" });
    expect(await checkUsernameFor("b", "jalen_r")).toEqual({ ok: true, name: "jalen_r" });
  });

  it("two people taking the same name: the index decides, the second is told it is taken", async () => {
    const { claimUsername } = await import("../lib/elite/account-profile-server");
    expect(await claimUsername("b", "Jalen.R")).toEqual({ ok: true, name: "jalen.r" });
    expect(rows.find((r) => r.id === "b")?.username).toBe("jalen.r");
    expect(await claimUsername("c", "JALEN.R")).toEqual({ ok: false, name: "jalen.r", problem: "taken" });
    expect(rows.find((r) => r.id === "c")?.username).toBeNull();
  });

  it("a reserved or filtered name never reaches the database", async () => {
    const { claimUsername } = await import("../lib/elite/account-profile-server");
    expect(await claimUsername("b", "coach.gary")).toMatchObject({ ok: false, problem: "reserved" });
    expect(await claimUsername("b", "shit_head")).toMatchObject({ ok: false, problem: "offensive" });
    expect(rows.find((r) => r.id === "b")?.username).toBeNull();
  });

  it("ideas offered are only the ones nobody has", async () => {
    const { suggestUsernames } = await import("../lib/elite/account-profile-server");
    rows.push({ id: "e", username: "marcus.bashorun" });
    const ideas = await suggestUsernames("b", "Marcus Bashorun");
    expect(ideas).not.toContain("marcus.bashorun");
    expect(ideas.length).toBeGreaterThan(0);
    expect(ideas.length).toBeLessThanOrEqual(3);
  });

  it("the index is unique on lower(username), across every account", () => {
    const sql = read("supabase/migrations/081_profile_photo_and_username.sql");
    expect(sql).toMatch(/create unique index if not exists elite_profiles_username_lower_key\s+on public\.elite_profiles \(lower\(username\)\)/);
    // on elite_profiles, the row every account has (members and free)
    expect(sql).toContain("alter table public.elite_profiles add column if not exists username text;");
  });
});
