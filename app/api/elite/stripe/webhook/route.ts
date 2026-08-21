import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { isStripeConfigured, stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/elite/supabase/server";

export const runtime = "nodejs";

// Stripe webhook. Keeps the subscriptions table + a player's
// subscription_status in sync. Configure STRIPE_WEBHOOK_SECRET and point a
// Stripe webhook at /api/elite/stripe/webhook.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!isStripeConfigured() || !secret) {
    return NextResponse.json({ received: true, skipped: "not_configured" });
  }

  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, sig ?? "", secret);
  } catch (e) {
    return NextResponse.json(
      { error: `Webhook signature failed: ${(e as Error).message}` },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const email = s.customer_details?.email ?? s.customer_email ?? null;
        if (supabase && email) {
          await syncByEmail(supabase, email, {
            stripe_customer_id: (s.customer as string) ?? null,
            stripe_subscription_id: (s.subscription as string) ?? null,
            status: s.mode === "subscription" ? "active" : "none",
            plan: (s.metadata?.plan as string) ?? "",
          });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const status =
          event.type === "customer.subscription.deleted"
            ? "canceled"
            : mapStatus(sub.status);
        // Across Stripe API versions current_period_end lives either on the
        // subscription or on its first item - read whichever is present.
        const periodEnd =
          (sub as unknown as { current_period_end?: number })
            .current_period_end ??
          sub.items?.data?.[0]?.current_period_end ??
          null;
        if (supabase) {
          await supabase
            .from("elite_subscriptions")
            .update({
              status,
              current_period_end: periodEnd
                ? new Date(periodEnd * 1000).toISOString()
                : null,
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", sub.id);
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

function mapStatus(s: string): string {
  if (s === "active" || s === "trialing" || s === "past_due") return s;
  if (s === "canceled" || s === "unpaid" || s === "incomplete_expired")
    return "canceled";
  return "none";
}

type SubPatch = {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string;
  plan: string;
};

async function syncByEmail(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  email: string,
  patch: SubPatch
) {
  const { data: profile } = await supabase
    .from("elite_profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  await supabase.from("elite_subscriptions").insert({
    profile_id: profile?.id ?? null,
    ...patch,
    current_period_end: null,
  });

  // reflect on the player's status for quick reads
  if (profile?.id) {
    await supabase
      .from("elite_players")
      .update({ subscription_status: patch.status })
      .eq("profile_id", profile.id);
  }
}
