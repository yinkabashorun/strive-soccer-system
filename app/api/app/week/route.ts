import { appRoute } from "@/lib/elite/app-api";
import { loadWeek } from "@/lib/elite/app-data";

// The week being trained, its sessions in order and every drill with its
// clip and still (lib/elite/app-payload.ts weekPayload).
export const dynamic = "force-dynamic";

export const GET = appRoute({ name: "week", access: "member" }, async ({ player }) => ({
  week: await loadWeek(player!),
}));
