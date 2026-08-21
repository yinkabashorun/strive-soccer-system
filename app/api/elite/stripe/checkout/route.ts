import { NextResponse } from "next/server";
import { isStripeConfigured, stripe } from "@/lib/stripe";

export const runtime = "nodejs";

// Price map for Strive Elite plans. Set these env vars to your Stripe Price
// IDs. Monthly plans are subscriptions; the single session is one-time.
const PRICE_ENV: Record<string, { env: string; mode: "subscription" | "payment" }> = {
  monthly: { env: "STRIVE_PRICE_MONTHLY", mode: "subscription" },
  elite: { env: "STRIVE_PRICE_ELITE", mode: "subscription" },
  session: { env: "STRIVE_PRICE_SESSION", mode: "payment" },
};

export async function POST(req: Request) {
  let plan = "monthly";
  try {
    const body = await req.json();
    if (body.plan) plan = body.plan;
  } catch {
    /* default */
  }

  const cfg = PRICE_ENV[plan] ?? PRICE_ENV.monthly;
  const origin =
    req.headers.get("origin") ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  // Not wired up yet - send the user into signup so the flow still completes.
  if (!isStripeConfigured() || !process.env[cfg.env]) {
    return NextResponse.json({
      url: null,
      fallback: `/signup?plan=${plan}`,
    });
  }

  try {
    const session = await stripe().checkout.sessions.create({
      mode: cfg.mode,
      line_items: [{ price: process.env[cfg.env]!, quantity: 1 }],
      success_url: `${origin}/dashboard?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=cancelled`,
      allow_promotion_codes: true,
      metadata: { plan },
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json(
      { url: null, fallback: `/signup?plan=${plan}`, error: (e as Error).message },
      { status: 200 }
    );
  }
}
