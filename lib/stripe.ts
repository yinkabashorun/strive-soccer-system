// Stripe client + helpers for the $97 dribbling course.
//
// Only instantiates the SDK when STRIPE_SECRET_KEY is set, so the rest of
// the app can run without Stripe wired (Sales / Command Center degrade
// to "Stripe not configured" cards instead of crashing).

import Stripe from "stripe";

let _client: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function isStripeWebhookConfigured(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET);
}

export function stripe(): Stripe {
  if (_client) return _client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("stripe_not_configured");
  _client = new Stripe(key);
  return _client;
}
