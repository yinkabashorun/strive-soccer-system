import { NextResponse } from "next/server";
import { getViewer } from "@/lib/elite/session";
import { isStripeConfigured } from "@/lib/stripe";
import { openProCheckout } from "@/lib/elite/pro-server";
import { PAYMENTS_OFF_MESSAGE, PRO_AFTER_PAYMENT } from "@/lib/elite/pro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The Strive Pro card checkout (074). Only for the signed-in Pro member:
// who it is for comes from the session cookie, never from the request
// body. The price is written inline (lib/elite/pro.ts), so no Stripe
// Price ID needs to be set. Where the member lands is our own address
// (APP_URL), never the request's Origin header.
//
// POST -> { url } | { error, next? }
export async function POST() {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: PAYMENTS_OFF_MESSAGE, reason: "payments_off" }, { status: 503 });
  }

  const viewer = await getViewer();
  if (!viewer || viewer.demo || viewer.role !== "player" || !viewer.playerId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const res = await openProCheckout({
    profileId: viewer.profile.id,
    playerId: viewer.playerId,
    email: viewer.profile.email,
  });
  if (res.ok) return NextResponse.json({ url: res.url });
  return NextResponse.json(
    { error: res.error, ...(res.reason === "payments_off" ? { reason: res.reason } : {}), ...(res.reason === "active" ? { next: PRO_AFTER_PAYMENT } : {}) },
    { status: res.status }
  );
}
