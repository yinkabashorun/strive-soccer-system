import Stripe from "stripe";

// Stripe client + config check.
// Only instantiates the SDK when STRIPE_SECRET_KEY is set so the rest of
// the app — and the public dribbling course page — still renders without
// Stripe wired up.

let _client: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function stripe(): Stripe {
  if (_client) return _client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("stripe_not_configured");
  _client = new Stripe(key);
  return _client;
}
