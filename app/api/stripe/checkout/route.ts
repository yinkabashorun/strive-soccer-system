import { NextResponse } from "next/server";
import {
  isStripeConfigured,
  stripe,
} from "@/lib/stripe";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/stripe/checkout
// Body: { email?, name?, priceCents?, productName? }
// Returns: { url, sessionId }
//
// Creates a Stripe Checkout Session for the $97 dribbling course. The
// session URL is what the VSL "Buy now" button should redirect to.

export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "STRIPE_SECRET_KEY is not set" },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email : undefined;
  const name = typeof body?.name === "string" ? body.name : undefined;
  const priceCents =
    typeof body?.priceCents === "number" && body.priceCents > 0
      ? Math.floor(body.priceCents)
      : await loadFunnelPriceCents();
  const productName =
    typeof body?.productName === "string" && body.productName
      ? body.productName
      : "Strive Dribbling Course";

  const origin =
    req.headers.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  try {
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: priceCents,
            product_data: {
              name: productName,
              description: "30-day dribbling course · 5 minutes a day",
            },
          },
        },
      ],
      metadata: {
        source: "strive_os",
        product: productName,
        buyer_name: name ?? "",
      },
      success_url: `${origin}/sales?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/funnel?status=cancelled`,
    });
    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "checkout_failed" },
      { status: 500 },
    );
  }
}

async function loadFunnelPriceCents(): Promise<number> {
  const fallback = 9700;
  if (!isSupabaseConfigured()) return fallback;
  try {
    const db = supabase();
    const { data, error } = await db
      .from("funnel_settings")
      .select("offer_price_cents")
      .eq("slug", "dribbling-course")
      .maybeSingle();
    if (error || !data) return fallback;
    return data.offer_price_cents ?? fallback;
  } catch {
    return fallback;
  }
}
