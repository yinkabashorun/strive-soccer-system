import type { AppMemberState } from "@shared/app-contract";
import type { FreeStage } from "@shared/free-intake";

// Is the door's "Have a code from a teammate or a club?" shown now
// (lib/elite/free-door.ts, src/CodeDoor.tsx)?
//
// Only to a free account that has not taken the quiz and is not in the
// free app: stage "quiz". A player who came in by a code is "ready" at
// once and never sees it again; so is everyone who finished the quiz. A
// player who said "I do not have a code" is remembered on this phone by
// their email, so the door is asked once and the quiz's own first screen
// is what they come back to.
//
// Pure, tested in tests/logic.test.ts.
export function doorDue(i: { stage: FreeStage | null | undefined; email: string | null | undefined; passed: string | null | undefined }): boolean {
  if (i.stage !== "quiz") return false;
  const email = (i.email ?? "").trim().toLowerCase();
  if (!email) return true;
  return (i.passed ?? "").trim().toLowerCase() !== email;
}

// After the quiz is saved: was it taken LATER, from the one card on Week,
// by a player who is already in the free app? Then the screen has to open
// the offer itself. A new player's quiz leaves them at stage "offer", and
// the gatekeeper carries them there as it always did.
export function quizWasLater(state: AppMemberState | null | undefined): boolean {
  return state?.kind === "free" && state.stage === "ready";
}
