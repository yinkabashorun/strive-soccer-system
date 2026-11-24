import { appRoute } from "@/lib/elite/app-api";
import { loadInbox } from "@/lib/elite/app-data";
import { markAllNotificationsRead } from "@/lib/elite/player-actions";

// The Inbox of the iPhone app: the member's notes, each once, newest first
// (the same rows and the same rule as the website's bell, lib/elite/bell.ts).
// Opening the Inbox is reading it: the POST marks everything read through
// the website's own action, and the gold dot on Home goes out.
export const dynamic = "force-dynamic";

export const GET = appRoute({ name: "notices", access: "member" }, ({ player }) => loadInbox(player!));

export const POST = appRoute({ name: "notices", access: "member", limit: 30 }, async () => {
  const done = await markAllNotificationsRead();
  return { ok: done.ok };
});
