import { NextResponse } from "next/server";
import { isStripeConfigured, stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/checkout/dribbling-course
// Body: { email?, name? }
// Returns: { url, sessionId }
//
// Creates a $97 Stripe Checkout Session for "Strive Dribbling System".
// Success → /dribbling-course/success?session_id=...
// Cancel  → /dribbling-course

const AMOUNT_CENTS = 9700;
const CURRENCY = "usd";
const PRODUCT_NAME = "Strive Dribbling System";
const PRODUCT_DESC =
  "Complete 4-module ball mastery course. Lifetime access. 14-day money-back guarantee.";

export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "STRIPE_SECRET_KEY is not set" },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim() : undefined;
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;

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
            currency: CURRENCY,
            unit_amount: AMOUNT_CENTS,
            product_data: {
              name: PRODUCT_NAME,
              description: PRODUCT_DESC,
            },
          },
        },
      ],
      metadata: {
        product: "dribbling-course",
        buyer_name: name ?? "",
      },
      success_url: `${origin}/dribbling-course/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dribbling-course`,
    });
    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "checkout_failed" },
      { status: 500 },
    );
  }
}
