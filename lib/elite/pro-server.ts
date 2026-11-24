// Strive Pro (074) on the server: the offer behind a member, and the
// membership's Stripe subscription. The rules themselves are pure, in
// lib/elite/tiers.ts and lib/elite/pro.ts.
import type Stripe from "stripe";
import { createServiceClient } from "./supabase/server";
import { isStripeConfigured, stripe } from "@/lib/stripe";
import { featureOn, isPro, tierOf, type Feature } from "./tiers";
import {
  PAYMENTS_OFF_MESSAGE,
  PRO_ALREADY_ACTIVE_MESSAGE,
  PRO_PLAN,
  proAccessFor,
  proActivation,
  proCheckoutParams,
} from "./pro";
import { APP_URL } from "./app-url";
import { normalizePhone } from "./sms";
import type { MembershipTier } from "./types";

type Admin = NonNullable<ReturnType<typeof createServiceClient>>;

// ---- The member row -----------------------------------------------------

// The member row every Strive Pro account starts with, whichever way it
// was started (the website's sign-up, or a free account tapping Start in
// the app): tier "pro", attributed to the head coach like every week the
// plan builder makes, and NEVER switched on here. Paying is what switches
// it on (activateProCheckout).
export async function createProMember(
  admin: Admin,
  input: { profileId: string; fullName: string; age: number; email: string; phone: string }
): Promise<boolean> {
  const { data: coach } = await admin
    .from("elite_profiles")
    .select("id")
    .in("role", ["coach", "admin"])
    .order("role")
    .limit(1)
    .maybeSingle();
  const { error } = await admin.from("elite_players").insert({
    profile_id: input.profileId,
    coach_id: (coach?.id as string | undefined) ?? null,
    full_name: input.fullName,
    age: input.age,
    parent_email: input.email,
    parent_phone: normalizePhone(input.phone) ?? input.phone,
    tier: "pro",
    // Never "active" here: the paid checkout switches it on (webhook).
    subscription_status: "none",
    current_week: 1,
    today_focus: "Welcome to Strive Pro. Answer the quiz and your first week is built around you.",
  });
  return !error;
}

// ---- The checkout ---------------------------------------------------------

export type ProCheckout =
  | { ok: true; url: string; sessionId: string }
  | { ok: false; status: number; error: string; reason?: "payments_off" | "not_pro" | "active" };

// The Strive Pro card checkout for one account's own member row. Who it is
// for comes from the caller's session, never from a request body. The
// price is written inline (lib/elite/pro.ts), and where the member lands
// is our own address (APP_URL), never a request's Origin header.
export async function openProCheckout(input: {
  profileId: string;
  playerId: string;
  email: string;
  returnTo?: "site" | "app";
}): Promise<ProCheckout> {
  const off: ProCheckout = { ok: false, status: 503, error: PAYMENTS_OFF_MESSAGE, reason: "payments_off" };
  if (!isStripeConfigured()) return off;
  const admin = createServiceClient();
  if (!admin) return off;
  const { data: player } = await admin
    .from("elite_players")
    .select("id, tier, subscription_status")
    .eq("id", input.playerId)
    .maybeSingle();
  if (!player || !isPro(player.tier as string | null)) {
    return { ok: false, status: 403, error: "This account is not a Strive Pro account.", reason: "not_pro" };
  }
  if (player.subscription_status === "active" || player.subscription_status === "trialing") {
    return { ok: false, status: 409, error: PRO_ALREADY_ACTIVE_MESSAGE, reason: "active" };
  }
  try {
    const session = await stripe().checkout.sessions.create(
      proCheckoutParams({
        profileId: input.profileId,
        email: input.email,
        appUrl: APP_URL,
        customerId: await stripeCustomerFor(input.profileId),
        returnTo: input.returnTo,
      })
    );
    if (!session.url) throw new Error("no_url");
    return { ok: true, url: session.url, sessionId: session.id };
  } catch {
    return { ok: false, status: 502, error: "We couldn't open the checkout. Please try again in a minute." };
  }
}

// A checkout that came back to a page with no sign-in (the sheet over the
// iPhone app): the session id in the address is only a pointer, and what
// Stripe says about that session decides. A paid Strive Pro checkout
// switches its own member on, exactly as the webhook would.
export async function confirmProSession(sessionId: string): Promise<boolean> {
  if (!isStripeConfigured() || !/^cs_[A-Za-z0-9_]{8,200}$/.test(sessionId)) return false;
  try {
    return await activateProCheckout(await stripe().checkout.sessions.retrieve(sessionId));
  } catch {
    return false;
  }
}

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
