import { NextResponse } from "next/server";
import {
  DRIBBLING_BUYER_TAG,
  isGHLBuyerConfigured,
  upsertDribblingCourseBuyer,
} from "@/lib/ghl-buyer";
import { isStripeConfigured, stripe } from "@/lib/stripe";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/ghl/dribbling-course-buyer
// Body: { email, name?, sessionId? }
//
// Fired from /dribbling-course/success the moment Stripe redirects back.
// Idempotent: re-firing with the same sessionId never creates duplicate
// course_sales rows (unique constraint on stripe_session_id).
//
// Steps:
//   1. (optional) Pull amount + email from the Stripe session if we have
//      sessionId and Stripe is configured — this is the trusted source.
//   2. Upsert the buyer in GHL with the "dribbling-course-buyer" tag.
//   3. Persist a course_sales row in Supabase.

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const sessionId =
    typeof body?.sessionId === "string" && body.sessionId
      ? body.sessionId
      : undefined;

  // Start from what the client told us, but prefer Stripe's record when
  // we can fetch it (the email Stripe collected is the canonical one).
  let email = typeof body?.email === "string" ? body.email.trim() : "";
  let name = typeof body?.name === "string" ? body.name.trim() : "";
  let amountCents = 9700;

  if (sessionId && isStripeConfigured()) {
    try {
      const session = await stripe().checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== "paid") {
        return NextResponse.json(
          { ok: false, error: "stripe_session_not_paid", status: session.payment_status },
          { status: 409 },
        );
      }
      email = session.customer_details?.email ?? session.customer_email ?? email;
      name = session.customer_details?.name ?? name;
      amountCents = session.amount_total ?? amountCents;
    } catch (err) {
      // Stripe lookup is best-effort — fall through to the client-supplied values.
      console.error("[ghl/dribbling-buyer] stripe lookup failed:", err);
    }
  }

  if (!email) {
    return NextResponse.json({ ok: false, error: "email_required" }, { status: 400 });
  }

  // GHL tag
  let ghlContactId: string | null = null;
  let ghlError: string | undefined;
  if (isGHLBuyerConfigured()) {
    const result = await upsertDribblingCourseBuyer({
      email,
      name: name || undefined,
      sessionId,
    });
    if (result.ok) {
      ghlContactId = result.contactId ?? null;
    } else {
      ghlError = result.error;
    }
  } else {
    ghlError = "ghl_not_configured";
  }

  // Persist the sale
  let saleId: string | null = null;
  if (isSupabaseConfigured()) {
    try {
      const db = supabase();
      const { data, error } = await db
        .from("course_sales")
        .upsert(
          {
            stripe_session_id: sessionId ?? null,
            buyer_email: email,
            buyer_name: name || null,
            amount_cents: amountCents,
            currency: "usd",
            product: "Strive Dribbling System",
            status: "paid",
            ghl_contact_id: ghlContactId,
            metadata: {
              tag: DRIBBLING_BUYER_TAG,
              source: "dribbling-course/success",
            },
          },
          { onConflict: "stripe_session_id" },
        )
        .select("id")
        .maybeSingle();
      if (error) {
        console.error("[ghl/dribbling-buyer] supabase upsert error:", error.message);
      } else {
        saleId = (data as { id?: string } | null)?.id ?? null;
      }
    } catch (err) {
      console.error("[ghl/dribbling-buyer] supabase exception:", err);
    }
  }

  return NextResponse.json({
    ok: true,
    ghl: { tagged: ghlContactId !== null, contactId: ghlContactId, error: ghlError },
    sale: { id: saleId, email, amountCents },
  });
}
