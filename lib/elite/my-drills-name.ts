// A drill's name, as the player typed it (078). Kept apart from
// my-drills.ts so the word filter (a large word list) is never sent to
// the phone: the server checks every name before it is saved.
import { isOffensive, OFFENSIVE_MESSAGE } from "./text-filter";
import { DRILL_NAME_MAX } from "./my-drills";

export function cleanDrillName(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  const name = (typeof raw === "string" ? raw : "").replace(/\s+/g, " ").trim();
  if (!name) return { ok: false, error: "Give your drill a name." };
  if (name.length > DRILL_NAME_MAX) return { ok: false, error: `Keep the name to ${DRILL_NAME_MAX} characters.` };
  if (isOffensive(name)) return { ok: false, error: OFFENSIVE_MESSAGE };
  return { ok: true, name };
}

