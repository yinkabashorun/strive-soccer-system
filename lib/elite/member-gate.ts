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
//   4. a Strive Pro member (074) who has not paid: the checkout first
//   5. a player who has not finished the quiz: the quiz
//   6. any other membership that is not switched on: the coach is the way in
//   7. in
import type { Role } from "./types";
import { NO_PROFILE_GATE, gateFor, type GateCopy } from "./gates";

export type MemberState =
  | { kind: "coach" }
  | { kind: "free" }
  | { kind: "no_profile"; gate: GateCopy }
  | { kind: "consent" }
  | { kind: "pro_checkout"; gate: GateCopy }
  | { kind: "onboarding" }
  | { kind: "membership"; gate: GateCopy }
  | { kind: "ok" };

export type MemberGateInput = {
  role: Role;
  playerId: string | null;
  // Has a free training log (069); only read when there is no player record.
  isFree: boolean;
  consentDue: boolean;
  player: {
    subscription_status?: string | null;
    tier?: string | null;
    onboarded_at?: string | null;
  } | null;
};

export function memberState(i: MemberGateInput): MemberState {
  if (i.role !== "player") return { kind: "coach" };
  if (!i.playerId) return i.isFree ? { kind: "free" } : { kind: "no_profile", gate: NO_PROFILE_GATE };
  if (i.consentDue) return { kind: "consent" };
  const gate = gateFor(i.player?.subscription_status ?? "none", i.player?.tier);
  if (gate?.startPro) return { kind: "pro_checkout", gate };
  // Strict null, as the web shell: before 012 the column is absent
  // (undefined) and nobody is trapped in the quiz.
  if (i.player && i.player.onboarded_at === null) return { kind: "onboarding" };
  if (gate) return { kind: "membership", gate };
  return { kind: "ok" };
}
