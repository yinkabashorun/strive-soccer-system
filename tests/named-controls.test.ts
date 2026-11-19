import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { memberFiles, rel } from "./helpers/member-files";

// App Store punch list A15: a button or link that shows only an icon has
// a name a screen reader can say. Every member-facing file is scanned, so
// a new icon-only control without a name fails here the day it is added.

type Control = { open: string; inner: string };

// The end of a JSX opening tag: the first ">" outside braces and quotes.
function tagEnd(src: string, from: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (depth === 0 && (c === '"' || c === "'")) quote = c;
    else if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return i;
  }
  return -1;
}

export function controls(src: string): Control[] {
  const out: Control[] = [];
  for (const m of src.matchAll(/<(button|a|Link)\b/g)) {
    const end = tagEnd(src, m.index! + m[0].length);
    if (end === -1 || src[end - 1] === "/") continue; // self-closing: no children
    const close = src.indexOf(`</${m[1]}>`, end);
    if (close === -1) continue;
    out.push({ open: src.slice(m.index!, end + 1), inner: src.slice(end + 1, close) });
  }
  return out;
}

// Only icons inside: nothing left once self-closing elements, comments
// and white space are taken away. Any word or any {expression} counts as
// a visible name.
export function iconOnly(inner: string): boolean {
  let rest = inner.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  let before = "";
  while (before !== rest) {
    before = rest;
    rest = rest.replace(/<[A-Za-z][\w.]*\b[^<>]*\/>/g, "");
  }
  return /<[A-Za-z]/.test(inner) && rest.trim() === "";
}

const named = (open: string) => /\baria-label(ledby)?=|\btitle=|\{\.\.\./.test(open);

describe("every icon-only control has a name", () => {
  it("the scanner tells an icon-only control from one with words", () => {
    expect(iconOnly(' <X className="h-5 w-5" /> ')).toBe(true);
    expect(iconOnly(' <X className="h-5 w-5" /> Close ')).toBe(false);
    expect(iconOnly(" {label} ")).toBe(false);
    expect(iconOnly(' <Send className={on ? "a" : "b"} /> ')).toBe(true);
    const found = controls('<button onClick={() => go(1)} aria-label="Next"><Chevron /></button>');
    expect(found).toHaveLength(1);
    expect(named(found[0].open)).toBe(true);
    expect(named('<button onClick={() => go(1)}>')).toBe(false);
  });

  it("on every member-facing screen", () => {
    const files = memberFiles();
    expect(files.length).toBeGreaterThan(40);
    const unnamed: string[] = [];
    let seen = 0;
    for (const f of files) {
      for (const c of controls(readFileSync(f, "utf8"))) {
        if (!iconOnly(c.inner)) continue;
        seen++;
        if (!named(c.open)) unnamed.push(`${rel(f)}: ${c.open.replace(/\s+/g, " ").slice(0, 110)}`);
      }
    }
    // The bell, the close buttons, send, remove a clip and so on.
    expect(seen).toBeGreaterThan(4);
    expect(unnamed).toEqual([]);
  });
});
