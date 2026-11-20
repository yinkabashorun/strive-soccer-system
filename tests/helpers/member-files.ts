import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// Every member-facing screen file: each page a member can reach, plus
// every component those pages import, followed to the end. Not a
// hand-kept list, so a new member screen is covered the day it is added.

export const ROOT = resolve(__dirname, "..", "..");

export const MEMBER_ROOTS = [
  "app/(player)",
  "app/(free)",
  "app/(auth)",
  "app/(join)",
  "app/(public)/pro", // Strive Pro, its page and its sign-up (074)
  "app/account",
  "app/support",
  "app/onboarding",
  "app/privacy",
  "app/terms",
  "app/error.tsx",
  "app/global-error.tsx",
];

function walk(p: string): string[] {
  if (!existsSync(p)) return [];
  if (statSync(p).isDirectory()) return readdirSync(p).flatMap((f) => walk(join(p, f)));
  return [p];
}

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/")
    ? join(ROOT, spec.slice(2))
    : spec.startsWith(".")
      ? resolve(dirname(from), spec)
      : null;
  if (!base) return null;
  for (const c of [`${base}.tsx`, `${base}.ts`, join(base, "index.tsx"), join(base, "index.ts")]) {
    if (existsSync(c)) return c;
  }
  return null;
}

export function memberFiles(): string[] {
  const seen = new Set<string>();
  const queue = MEMBER_ROOTS.flatMap((r) => walk(join(ROOT, r))).filter((f) => /\.tsx?$/.test(f));
  while (queue.length) {
    const f = queue.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/from\s+["']([^"']+)["']/g)) {
      const r = resolveImport(f, m[1]);
      // Follow components only; lib code carries no markup.
      if (r && (r.endsWith(".tsx") || r.includes("/components/"))) queue.push(r);
    }
  }
  return [...seen].filter((f) => f.endsWith(".tsx")).sort();
}

export const rel = (f: string) => f.slice(ROOT.length + 1);
