import { appJson, appRoute, readJson } from "@/lib/elite/app-api";
import { submitCheckin } from "@/lib/elite/player-actions";

// The weekly check-in that feeds the next week, through the website's own
// action. Ratings are 1 to 5 (or left out), text is kept short.
export const dynamic = "force-dynamic";

function scale(v: unknown): number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5 ? v : 0;
}
function line(v: unknown): string {
  return typeof v === "string" ? v.slice(0, 1000) : "";
}

export const POST = appRoute({ name: "checkin", access: "member", limit: 10 }, async ({ req }) => {
  const body = await readJson(req);
  if (!body) return appJson({ ok: false }, 400);
  const input = {
    rating: scale(body.rating),
    energy: scale(body.energy),
    went_well: line(body.went_well),
    struggled: line(body.struggled),
    note: line(body.note),
  };
  if (!input.rating && !input.energy && !input.went_well.trim() && !input.struggled.trim() && !input.note.trim()) {
    return appJson({ ok: false, error: "Tell us something about the week first." }, 400);
  }
  return submitCheckin(input);
});
