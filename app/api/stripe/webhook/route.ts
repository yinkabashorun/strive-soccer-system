import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  isStripeConfigured,
  isStripeWebhookConfigured,
  stripe,
} from "@/lib/stripe";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  TAG_BUYER,
  isGHLLeadConfigured,
  upsertGHLContact,
} from "@/lib/ghl-lead";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/stripe/webhook
//
// Receives Stripe events. We care about checkout.session.completed:
//   - persist a course_sales row
//   - log the buyer as a lead_event
//   - push the buyer to GHL with the "Dribbling Course Buyer" tag
//
// Signature is verified via STRIPE_WEBHOOK_SECRET. If the secret isn't
// set we log a warning and accept the request (dev convenience).

async function logIntegration(entry: {
  service: string;
  event: string;
  status: "ok" | "error" | "warn" | "info";
  detail?: string;
  metadata?: unknown;
}) {
  if (!isSupabaseConfigured()) return;
  try {
    const db = supabase();
    await db.from("integration_logs").insert({
      service: entry.service,
      event: entry.event,
      status: entry.status,
      detail: entry.detail ?? null,
      metadata: entry.metadata ?? null,
    });
  } catch (err) {
    console.error("[stripe/webhook] log insert failed:", err);
  }
}

async function recordLeadEvent(entry: {
  event_type: string;
  email?: string;
  name?: string;
  ghl_contact_id?: string | null;
  metadata?: unknown;
}) {
  if (!isSupabaseConfigured()) return;
  try {
    const db = supabase();
    await db.from("lead_events").insert({
      event_type: entry.event_type,
      email: entry.email ?? null,
      name: entry.name ?? null,
      source: "stripe",
      ghl_contact_id: entry.ghl_contact_id ?? null,
      metadata: entry.metadata ?? null,
    });
  } catch (err) {
    console.error("[stripe/webhook] lead_event insert failed:", err);
  }
}

export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "STRIPE_SECRET_KEY is not set" },
      { status: 400 },
    );
  }

  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  if (isStripeWebhookConfigured() && signature) {
    try {
      event = stripe().webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "signature_failed";
      console.error("[stripe/webhook] signature error:", message);
      await logIntegration({
        service: "stripe",
        event: "signature.invalid",
        status: "error",
        detail: message,
      });
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  } else {
    if (!isStripeWebhookConfigured()) {
      console.warn(
        "[stripe/webhook] WARNING: STRIPE_WEBHOOK_SECRET not set — skipping signature check",
      );
    }
    try {
      event = JSON.parse(rawBody) as Stripe.Event;
    } catch {
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }
  }

  if (event.type !== "checkout.session.completed") {
    await logIntegration({
      service: "stripe",
      event: event.type,
      status: "info",
      detail: "acknowledged",
    });
    return NextResponse.json({ ok: true, event: event.type, ignored: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const buyerEmail =
    session.customer_details?.email ?? session.customer_email ?? null;
  const buyerName =
    session.customer_details?.name ??
    (typeof session.metadata?.buyer_name === "string"
      ? session.metadata.buyer_name
      : null);
  const amountCents = session.amount_total ?? 0;
  const currency = session.currency ?? "usd";
  const product =
    (typeof session.metadata?.product === "string"
      ? session.metadata.product
      : null) || "Strive Dribbling Course";

  // 1) Save the sale to Supabase
  if (isSupabaseConfigured()) {
    try {
      const db = supabase();
      const { error: saleErr } = await db.from("course_sales").upsert(
        {
          stripe_session_id: session.id,
          stripe_payment_intent_id:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : null,
          buyer_email: buyerEmail,
          buyer_name: buyerName,
          amount_cents: amountCents,
          currency,
          product,
          status: "paid",
          metadata: session.metadata ?? null,
        },
        { onConflict: "stripe_session_id" },
      );
      if (saleErr) {
        console.error("[stripe/webhook] course_sales upsert error:", saleErr);
        await logIntegration({
          service: "stripe",
          event: "checkout.session.completed",
          status: "error",
          detail: `course_sales: ${saleErr.message}`,
        });
      }
    } catch (err) {
      console.error("[stripe/webhook] course_sales exception:", err);
    }
  }

  // 2) Push the buyer to GHL as "Dribbling Course Buyer"
  let ghlContactId: string | null = null;
  if (isGHLLeadConfigured() && buyerEmail) {
    const tagResult = await upsertGHLContact({
      email: buyerEmail,
      name: buyerName ?? undefined,
      source: "Stripe · Strive OS",
      tags: [TAG_BUYER],
    });
    if (tagResult.ok) {
      ghlContactId = tagResult.contactId ?? null;
      await logIntegration({
        service: "ghl",
        event: "buyer.tagged",
        status: "ok",
        detail: `tagged ${buyerEmail} as ${TAG_BUYER}`,
        metadata: { contactId: ghlContactId },
      });
      if (isSupabaseConfigured() && ghlContactId) {
        try {
          const db = supabase();
          await db
            .from("course_sales")
            .update({ ghl_contact_id: ghlContactId })
            .eq("stripe_session_id", session.id);
        } catch {
          // best effort
        }
      }
    } else {
      await logIntegration({
        service: "ghl",
        event: "buyer.tag_failed",
        status: "error",
        detail: tagResult.error,
      });
    }
  }

  // 3) Record the lead event for analytics
  await recordLeadEvent({
    event_type: "checkout_completed",
    email: buyerEmail ?? undefined,
    name: buyerName ?? undefined,
    ghl_contact_id: ghlContactId,
    metadata: { sessionId: session.id, amountCents, currency, product },
  });

  await logIntegration({
    service: "stripe",
    event: "checkout.session.completed",
    status: "ok",
    detail: `${buyerEmail ?? "unknown"} · ${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()}`,
  });

  return NextResponse.json({ ok: true });
}
