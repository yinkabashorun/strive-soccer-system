// Who gets into the member app, and if not, which screen they see instead:
// ONE pure rule, in the order the web member shell checks it
// (app/(player)/layout.tsx) so the website and the native iPhone app can
// never let a different person in.
//
//   1. a coach or the admin: the coach side is the website, never the
//      member app
//   2. no player record: a free training log account (069) lives in the
//      free app; anyone else waits for the coach to set them up
//   3. the agreement (068) is due: accept it first, once
//   4. a Strive Pro member (074) who has not paid: the checkout first.
//      A FREE account that started Strive Pro and did not pay (or whose
//      Strive Pro ended) is still a free account: it stays in the free
//      app, where starting again is one tap (livesInFreeApp)
//   5. a player who has not finished the quiz: the quiz
//   6. any other membership that is not switched on: the coach is the way in
//   7. in
import type { Role } from "./types";
import { NO_PROFILE_GATE, gateFor, proMembershipGate, type GateCopy } from "./gates";
import { isPro } from "./tiers";
import type { FreeStage } from "./free-intake";

export type MemberState =
  | { kind: "coach" }
  | { kind: "free"; stage: FreeStage }
  | { kind: "no_profile"; gate: GateCopy }
  | { kind: "consent" }
  | { kind: "pro_checkout"; gate: GateCopy }
  | { kind: "onboarding" }
  | { kind: "membership"; gate: GateCopy }
  | { kind: "ok" };

export type MemberGateInput = {
  role: Role;
  playerId: string | null;
  // Has a free training log (069). Read when there is no player record,
  // and for a Strive Pro member whose membership is not on (mayBeFree).
  isFree: boolean;
  // Where that free account is (lib/elite/free-intake.ts). Left out by a
  // caller that only needs to know the account is free (the web shell).
  freeStage?: FreeStage;
  consentDue: boolean;
  player: {
    subscription_status?: string | null;
    tier?: string | null;
    onboarded_at?: string | null;
  } | null;
};

// Could this member row belong to an account that still lives in the free
// app? Only a Strive Pro row whose membership is not on: the row a free
// account gets the moment it taps Start, before it has paid, and the row
// it keeps if Strive Pro later ends. A caller reads the free account only
// when this says so, so an ordinary member costs no extra read.
export function mayBeFree(player: MemberGateInput["player"]): boolean {
  return Boolean(player) && isPro(player?.tier) && proMembershipGate(player?.subscription_status ?? "none") !== null;
}

// A free account stays a free account until a membership is actually on.
export function livesInFreeApp(i: { hasTracker: boolean; hasPlayer: boolean; player: MemberGateInput["player"] }): boolean {
  if (!i.hasTracker) return false;
  return !i.hasPlayer || mayBeFree(i.player);
}

export function memberState(i: MemberGateInput): MemberState {
  if (i.role !== "player") return { kind: "coach" };
  const free: MemberState = { kind: "free", stage: i.freeStage ?? "ready" };
  if (!i.playerId) return i.isFree ? free : { kind: "no_profile", gate: NO_PROFILE_GATE };
  if (i.consentDue) return { kind: "consent" };
  const gate = gateFor(i.player?.subscription_status ?? "none", i.player?.tier);
  if (gate?.startPro) return i.isFree ? free : { kind: "pro_checkout", gate };
  // Strict null, as the web shell: before 012 the column is absent
  // (undefined) and nobody is trapped in the quiz.
  if (i.player && i.player.onboarded_at === null) return { kind: "onboarding" };
  if (gate) return { kind: "membership", gate };
  return { kind: "ok" };
}
