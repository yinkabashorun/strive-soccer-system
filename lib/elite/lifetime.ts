// LIFETIME ACCESS (Coach Yinka, Nov 26 2026, on the coaching families
// moving into the app: "For now, give them lifetime access").
//
// A member with lifetime access keeps the app for life and is never
// charged for it (migration 092: elite_players.lifetime_access, set only
// by a coach on the player page). It is a promise to a family, so three
// things hold it, each tested (tests/lifetime.test.ts):
//
//   1. A PAYMENT EVENT NEVER SWITCHES THEM OFF. A card subscription that
//      ends, fails or is cancelled moves an ordinary Strive Pro member's
//      access; it never moves theirs (lib/elite/pro-server.ts syncProAccess).
//   2. THE APP NEVER SELLS THEM WHAT THEY HAVE. No prize that is "a month
//      of Strive Pro" (lib/elite/squad-pass.ts squadPrize).
//   3. ONLY A COACH GIVES OR TAKES IT. The database's own guard refuses a
//      player's change to it (092).
//
// What it does NOT do: it does not change which membership they are on or
// what that membership includes. Pausing a member by hand is still the
// coach's own switch.
//
// Pure. Shared with the phone ("@shared/lifetime").

export const LIFETIME_LABEL = "Lifetime access";
export const LIFETIME_ON_LINE = "This member keeps the app for life and is never charged for it. A payment that ends can never switch them off.";
export const LIFETIME_OFF_LINE = "Off: this member's access follows their membership.";

export function hasLifetime(player: { lifetime_access?: boolean | null } | null | undefined): boolean {
  return player?.lifetime_access === true;
}

// May a payment event set this member's access to `next`? Switching a
// lifetime member ON is fine; nothing a payment does may switch them off.
export function paymentMayMove(player: { lifetime_access?: boolean | null } | null | undefined, next: string): boolean {
  if (!hasLifetime(player)) return true;
  return next === "active" || next === "trialing";
}
