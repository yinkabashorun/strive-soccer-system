import { appJson, appRoute } from "@/lib/elite/app-api";
import { freeWeekCardFor } from "@/lib/elite/free-app-server";
import { nyToday } from "@/lib/elite/time";
import { PNG_DATA_PREFIX } from "@/lib/elite/week-card";
import { weekCardPng } from "@/lib/elite/week-card-image";
import type { AppWeekCard } from "@/lib/elite/app-contract";

// Share my week: the signed-in player's own week as a story-size picture
// (1080 x 1920 PNG), with the words that go with it on the share sheet.
// On it: their first name and last initial, the training time this week
// against the target they set, the days they trained, STRIVE ELITE and
// the address. Nobody else is on it, and it is never stored or cached.
//
// The picture travels as a data URI inside the JSON every app route
// answers with: the phone's one API client reads JSON, and its image tool
// turns a base64 data URI into the file the share sheet needs.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Drawing a picture costs more than a read: a caller gets 20 a minute.
export const GET = appRoute({ name: "free-week-card", access: "free_app", limit: 20 }, async ({ viewer, tracker }) => {
  if (!tracker) return appJson({ error: "unavailable" }, 409);
  const made = await freeWeekCardFor(viewer, tracker, nyToday());
  // nothing trained yet this week: the phone does not show the row either
  if (!made) return appJson({ error: "nothing_yet" }, 409);
  const png = await weekCardPng(made.card);
  return { image: PNG_DATA_PREFIX + png.toString("base64"), text: made.text } satisfies AppWeekCard;
});
