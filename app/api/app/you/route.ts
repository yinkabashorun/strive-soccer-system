import { appRoute } from "@/lib/elite/app-api";
import { loadYou } from "@/lib/elite/app-data";

// The You tab: the member card, this week's time, all time, the weekly
// bars, time by area and what has been earned (lib/elite/app-payload.ts).
export const dynamic = "force-dynamic";

export const GET = appRoute({ name: "you", access: "member" }, async ({ player }) => ({
  you: await loadYou(player!),
}));
