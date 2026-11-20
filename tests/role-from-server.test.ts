import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// An account's role can only come from our own server (migration 070).
// The new-user trigger once read it from the metadata the person signing up
// writes themselves, so a public sign-up could have asked to be an admin.

const root = join(__dirname, "..");
const migrations = readdirSync(join(root, "supabase", "migrations")).sort();

function lastDefinition(): string {
  let def = "";
  for (const f of migrations) {
    const sql = readFileSync(join(root, "supabase", "migrations", f), "utf8");
    const at = sql.lastIndexOf("function public.handle_new_elite_user()");
    if (at >= 0) def = sql.slice(at, sql.indexOf("end $$", at));
  }
  return def;
}

describe("the role on a new account", () => {
  it("comes from app metadata, which only the server can write", () => {
    const def = lastDefinition();
    expect(def).toContain("raw_app_meta_data->>'role'");
    expect(def).not.toContain("raw_user_meta_data->>'role'");
    expect(def).toContain("else 'player'::strive_role");
  });

  it("is passed as app_metadata by every route that creates a login", () => {
    for (const r of ["redeem", "join"]) {
      const src = readFileSync(join(root, "app", "api", "elite", "auth", r, "route.ts"), "utf8");
      expect(src, r).toMatch(/app_metadata: \{ role/);
      expect(src, r).not.toMatch(/user_metadata: \{[^}]*role/);
    }
  });
});
