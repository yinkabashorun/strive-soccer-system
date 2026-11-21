// Strive Pro (074) on the server: the offer behind a member, and the
// membership's Stripe subscription. The rules themselves are pure, in
// lib/elite/tiers.ts and lib/elite/pro.ts.
import type Stripe from "stripe";
import { createServiceClient } from "./supabase/server";
import { isStripeConfigured, stripe } from "@/lib/stripe";
import { featureOn, isPro, tierOf, type Feature } from "./tiers";
import { PRO_PLAN, proAccessFor, proActivation } from "./pro";
import type { MembershipTier } from "./types";

// ---- Switching a membership on and off ---------------------------------

// A paid Strive Pro checkout switches that member on. Called by the Stripe
// webhook AND by the page the member returns to (confirmProReturn), so
// whichever arrives first does it and the second changes nothing: one
// subscription row per checkout session (074's unique index), and the
// member row set to active. Only a member who really is on tier pro: a
// checkout can never switch on an Elite family or a profile with no row.
export async function activateProCheckout(s: Stripe.Checkout.Session): Promise<boolean> {
  const admin = createServiceClient();
  if (!admin) return false;
  const hit = proActivation({
    mode: s.mode,
    payment_status: s.payment_status,
    client_reference_id: s.client_reference_id,
    metadata: (s.metadata ?? null) as Record<string, string> | null,
  });
  if (!hit) return false;
  const { data: player } = await admin
    .from("elite_players")
    .select("id, tier")
    .eq("profile_id", hit.profileId)
    .maybeSingle();
  if (!player || !isPro(player.tier as string | null)) return false;

  const customer = typeof s.customer === "string" ? s.customer : s.customer?.id ?? null;
  const subscription = typeof s.subscription === "string" ? s.subscription : s.subscription?.id ?? null;
  const { error } = await admin.from("elite_subscriptions").upsert(
    {
      profile_id: hit.profileId,
      stripe_customer_id: customer,
      stripe_subscription_id: subscription,
      stripe_checkout_session_id: s.id,
      status: "active",
      plan: PRO_PLAN,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_checkout_session_id" }
  );
  if (error) return false;
  const { error: upErr } = await admin
    .from("elite_players")
    .update({ subscription_status: "active" })
    .eq("id", player.id);
  return !upErr;
}

// The member came back from Stripe's page (success_url carries the
// checkout session id). The webhook may not have landed yet, so the
// session is read from Stripe here and, when it is this member's own paid
// Pro checkout, the membership is switched on now: nobody is shown "Start
// Strive Pro" again a second after paying. The id in the address is only
// a pointer: what decides is what Stripe says about it.
export async function confirmProReturn(profileId: string, sessionId: string): Promise<boolean> {
  if (!isStripeConfigured() || !/^cs_[A-Za-z0-9_]{8,200}$/.test(sessionId)) return false;
  try {
    const s = await stripe().checkout.sessions.retrieve(sessionId);
    const hit = proActivation({
      mode: s.mode,
      payment_status: s.payment_status,
      client_reference_id: s.client_reference_id,
      metadata: (s.metadata ?? null) as Record<string, string> | null,
    });
    if (!hit || hit.profileId !== profileId) return false;
    return await activateProCheckout(s);
  } catch {
    return false;
  }
}

// A Pro subscription that changed: reflect it on the member row, but only
// for a member on tier pro (an Elite family's access stays the coach's
// switch) and only for a change that should move access (proAccessFor).
export async function syncProAccess(subscriptionId: string, status: string, deleted: boolean): Promise<void> {
  const access = proAccessFor(status, deleted);
  if (!access) return;
  const admin = createServiceClient();
  if (!admin) return;
  const { data: rows } = await admin
    .from("elite_subscriptions")
    .select("profile_id")
    .eq("stripe_subscription_id", subscriptionId)
    .limit(1);
  const profileId = (rows as { profile_id: string | null }[] | null)?.[0]?.profile_id ?? null;
  if (!profileId) return;
  const { data: player } = await admin
    .from("elite_players")
    .select("id, tier")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!player || !isPro(player.tier as string | null)) return;
  await admin.from("elite_players").update({ subscription_status: access }).eq("id", player.id);
}

// The offer a member is on. Read with the service client so a server
// action can never be talked out of it by what the browser sends. The
// demo tour has no row and reads as it always has.
export async function memberTier(playerId: string): Promise<MembershipTier> {
  const admin = createServiceClient();
  if (!admin) return tierOf(null);
  const { data } = await admin.from("elite_players").select("tier").eq("id", playerId).maybeSingle();
  return tierOf((data as { tier?: string } | null)?.tier ?? null);
}

// Does this member's offer include the feature? The server side of every
// switch the screens make with featureOn (a stale page or a hand-made
// request is refused, not just hidden).
export async function memberHasFeature(playerId: string, feature: Feature): Promise<boolean> {
  return featureOn(await memberTier(playerId), feature);
}

// The Stripe customer already on file for this account, so a member who
// starts Pro again is not made into a second customer.
export async function stripeCustomerFor(profileId: string): Promise<string | null> {
  const admin = createServiceClient();
  if (!admin) return null;
  const { data } = await admin
    .from("elite_subscriptions")
    .select("stripe_customer_id, created_at")
    .eq("profile_id", profileId)
    .not("stripe_customer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  return ((data as { stripe_customer_id: string | null }[] | null)?.[0]?.stripe_customer_id as string | undefined) ?? null;
}

// The account's subscriptions that are still running.
async function runningSubscriptionIds(profileId: string): Promise<string[]> {
  const admin = createServiceClient();
  if (!admin) return [];
  const { data } = await admin
    .from("elite_subscriptions")
    .select("stripe_subscription_id, status")
    .eq("profile_id", profileId)
    .in("status", ["active", "trialing", "past_due"])
    .not("stripe_subscription_id", "is", null);
  const ids = ((data as { stripe_subscription_id: string | null }[] | null) ?? [])
    .map((r) => r.stripe_subscription_id)
    .filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
}

// Does this account have a running Strive Pro subscription to cancel?
export async function hasRunningSubscription(profileId: string): Promise<boolean> {
  return (await runningSubscriptionIds(profileId)).length > 0;
}

// Stop the account's subscriptions. "period_end" (the member's own
// Cancel): no more charges, the membership runs to the end of the month
// already paid for, and Stripe's own update then switches access off.
// "now" (the account is being deleted): stopped at once, so nobody is
// charged for an account that no longer exists. Returns how many were
// stopped, and the date access ends when cancelled at period end.
export async function cancelSubscriptions(
  profileId: string,
  when: "period_end" | "now"
): Promise<{ ok: boolean; stopped: number; endsAt: string | null }> {
  const ids = await runningSubscriptionIds(profileId);
  if (ids.length === 0) return { ok: true, stopped: 0, endsAt: null };
  if (!isStripeConfigured()) return { ok: false, stopped: 0, endsAt: null };
  let stopped = 0;
  let endsAt: string | null = null;
  let ok = true;
  for (const id of ids) {
    try {
      if (when === "now") {
        await stripe().subscriptions.cancel(id);
      } else {
        const sub = await stripe().subscriptions.update(id, { cancel_at_period_end: true });
        const end =
          (sub as unknown as { current_period_end?: number }).current_period_end ??
          sub.items?.data?.[0]?.current_period_end ??
          null;
        if (end) endsAt = new Date(end * 1000).toISOString();
      }
      stopped++;
    } catch {
      ok = false;
    }
  }
  return { ok, stopped, endsAt };
}
