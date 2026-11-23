import { NextResponse } from "next/server";
import { getViewer } from "@/lib/elite/session";
import { createServiceClient } from "@/lib/elite/supabase/server";
import { isStripeConfigured, stripe } from "@/lib/stripe";
import { APP_URL } from "@/lib/elite/app-url";
import { isPro } from "@/lib/elite/tiers";
import { stripeCustomerFor } from "@/lib/elite/pro-server";
import {
  PAYMENTS_OFF_MESSAGE,
  PRO_AFTER_PAYMENT,
  PRO_ALREADY_ACTIVE_MESSAGE,
  proCheckoutParams,
} from "@/lib/elite/pro";

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

  const admin = createServiceClient();
  if (!admin) {
    return NextResponse.json({ error: PAYMENTS_OFF_MESSAGE, reason: "payments_off" }, { status: 503 });
  }
  const { data: player } = await admin
    .from("elite_players")
    .select("id, tier, subscription_status")
    .eq("id", viewer.playerId)
    .maybeSingle();
  if (!player || !isPro(player.tier as string | null)) {
    return NextResponse.json({ error: "This account is not a Strive Pro account." }, { status: 403 });
  }
  if (player.subscription_status === "active" || player.subscription_status === "trialing") {
    return NextResponse.json({ error: PRO_ALREADY_ACTIVE_MESSAGE, next: PRO_AFTER_PAYMENT }, { status: 409 });
  }

  try {
    const session = await stripe().checkout.sessions.create(
      proCheckoutParams({
        profileId: viewer.profile.id,
        email: viewer.profile.email,
        appUrl: APP_URL,
        customerId: await stripeCustomerFor(viewer.profile.id),
      })
    );
    if (!session.url) throw new Error("no_url");
    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json(
      { error: "We couldn't open the checkout. Please try again in a minute." },
      { status: 502 }
    );
  }
}
