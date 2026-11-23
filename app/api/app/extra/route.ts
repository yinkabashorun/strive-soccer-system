import { appJson, appRoute, readJson } from "@/lib/elite/app-api";
import { addExtraSession, addPickedExtraSession, getExtraPicker } from "@/lib/elite/extra-actions";
import { EXTRA_SHELVES, type ExtraShelf } from "@/lib/elite/bank-conform";
import { absoluteMedia } from "@/lib/elite/app-payload";
import { APP_URL } from "@/lib/elite/app-url";

// Extra work, both ways in, through the website's own actions (every rule
// and the membership check live there, lib/elite/extra-actions.ts):
//   GET   the shelves this player can use and the drills they can pick
//   POST  { shelf } builds a session from one shelf;
//         { drillIds } builds one from the player's own picks, in order
export const dynamic = "force-dynamic";

export const GET = appRoute({ name: "extra", access: "member" }, async ({ player }) => {
  const picker = await getExtraPicker();
  const shelves = (Object.keys(EXTRA_SHELVES) as ExtraShelf[])
    .filter((k) => k !== "wall_work" || player!.has_wall === true)
    .map((k) => ({ key: k, label: EXTRA_SHELVES[k].label, blurb: EXTRA_SHELVES[k].blurb }));
  if (!picker.ok) return { shelves, groups: [], warmUpMinutes: 0, finisherMinutes: 0, error: picker.error };
  return {
    shelves,
    // stills are served from the site; the phone needs the whole address
    groups: picker.groups.map((g) => ({
      ...g,
      drills: g.drills.map((d) => ({ ...d, poster: absoluteMedia(d.poster, APP_URL) })),
    })),
    warmUpMinutes: picker.warmUpMinutes,
    finisherMinutes: picker.finisherMinutes,
    error: null,
  };
});

export const POST = appRoute({ name: "extra", access: "member", limit: 20 }, async ({ req }) => {
  const body = await readJson(req);
  if (typeof body?.shelf === "string") {
    if (!(body.shelf in EXTRA_SHELVES)) return appJson({ ok: false, error: "Pick a shelf." }, 400);
    return addExtraSession(body.shelf as ExtraShelf);
  }
  if (Array.isArray(body?.drillIds)) return addPickedExtraSession(body.drillIds);
  return appJson({ ok: false, error: "Pick a shelf or your drills." }, 400);
});
