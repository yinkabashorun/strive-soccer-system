import { appRoute } from "@/lib/elite/app-api";
import { loadBootstrap } from "@/lib/elite/app-data";

// The native app's first call on every open: who is signed in, which
// screen they belong on (the same member gate as the website), the card,
// the tabs and the unread count.
export const dynamic = "force-dynamic";

export const GET = appRoute({ name: "me", access: "account" }, ({ viewer, state, player }) =>
  loadBootstrap(viewer, state, player)
);
