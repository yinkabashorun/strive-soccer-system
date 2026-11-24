import { appRoute } from "@/lib/elite/app-api";
import { confirmUpgrade } from "@/lib/elite/free-upgrade-server";

// The checkout's sheet closed. The server asks Stripe about the checkout
// this account last opened: a paid one switches the membership on now,
// anything else changes nothing. The phone then reads who it is again.
// "account": by the time this is called the account may already be a
// member (the webhook got there first).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = appRoute({ name: "free-upgrade-confirm", access: "account", limit: 20 }, ({ viewer }) =>
  confirmUpgrade(viewer.profile.id)
);
