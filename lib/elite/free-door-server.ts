// THE DOOR on the server (lib/elite/free-door.ts has the rule and the
// words): a new free account types the code a teammate or a club's captain
// sent with their invite.
//
// Nothing here makes anyone a friend or puts anyone in a club. A
// teammate's code sends that teammate a friend request to accept (072,
// confirmFriend); a club's code asks the club's captain (073,
// askToJoinByCode). Both are the website's own actions, with their own
// caps, blocks and refusals.
//
// What is new: in the SAME call that a real code was accepted, the server
// marks that this player takes the quiz later (migration 090), so they go
// straight to the free app. No other call can set that mark, and a code
// that matched nobody sets nothing.
//
// A teammate's code typed here by a player who is not in the free app yet
// also counts as who sent them (referred_by), exactly as joining with that
// teammate's link does on the website: the app's Join free has no link to
// carry it, so without this a teammate brought in through the app would
// never count toward "Bring your squad" (lib/elite/squad-pass.ts).
import { createServiceClient } from "./supabase/server";
import type { Viewer } from "./session";
import { clubByCode, getTargetTable, namesOf, type Tracker } from "./tracker-server";
import { confirmFriend } from "./tracker-actions";
import { askToJoinByCode } from "./club-app-server";
import { markQuizLater, type StoredIntake } from "./free-intake-server";
import { requestSentLine } from "./tracker";
import { DOOR_NOT_A_CODE, DOOR_NO_MATCH, DOOR_OWN_CODE, doorCodeFrom, type DoorAnswer } from "./free-door";

const OFFLINE = "We could not reach the server. Try again in a minute.";

export async function enterDoorCode(input: {
  viewer: Viewer;
  tracker: Tracker;
  intake: StoredIntake | null;
  raw: unknown;
}): Promise<DoorAnswer> {
  const typed = doorCodeFrom(input.raw);
  if (!typed) return { ok: false, error: DOOR_NOT_A_CODE };
  const admin = createServiceClient();
  if (!admin) return { ok: false, error: OFFLINE };
  const me = input.viewer.profile.id;
  if (typed.code === input.tracker.referral_code) return { ok: false, error: DOOR_OWN_CODE };

  // A pasted link says which kind it is; a bare code is looked up as a
  // club's, then as a teammate's (the two are drawn apart, and a clash of
  // eight random characters is not a case worth a question).
  let answer: { kind: "friend" | "club"; line: string; friendId?: string } | null = null;
  let refused: string | null = null;

  if (typed.kind !== "friend") {
    const club = await clubByCode(admin, typed.code);
    if (club) {
      const asked = await askToJoinByCode(input.viewer, typed.code);
      if (asked.ok) answer = { kind: "club", line: asked.line ?? "Request sent." };
      else refused = asked.error;
    }
  }
  if (!answer && !refused && typed.kind !== "club") {
    const { data } = await admin.from("elite_trackers").select("profile_id").eq("referral_code", typed.code).maybeSingle();
    const friendId = (data as { profile_id: string } | null)?.profile_id ?? null;
    if (friendId && friendId !== me) {
      const asked = await confirmFriend(typed.code);
      if (asked.ok) {
        const name = (await namesOf(admin, [friendId])).get(friendId) ?? "your teammate";
        answer = {
          kind: "friend",
          line: asked.result === "friends" ? `You and ${name} are friends.` : requestSentLine(name),
          friendId,
        };
      } else refused = asked.error;
    }
  }
  if (refused) return { ok: false, error: refused };
  if (!answer) return { ok: false, error: DOOR_NO_MATCH };

  // Not in the free app yet (no quiz answered, the week not set, and not
  // already let in by an earlier code): this code is how they came in. A
  // player who is in the free app and opens a teammate's invite link
  // (lib/elite/friend-link.ts) is adding a friend, not being brought in.
  const fresh = !input.intake?.answers && !input.tracker.quiz_done_at && input.intake?.later !== true;
  if (fresh && answer.friendId && !input.tracker.referred_by) {
    await admin
      .from("elite_trackers")
      .update({ referred_by: answer.friendId })
      .eq("profile_id", me)
      .is("referred_by", null)
      .then(() => undefined, () => undefined);
  }
  // The quiz waits (090). Only where the quiz can be stored at all, and
  // only for a player who has not answered it.
  const skipped =
    Boolean(input.intake?.available) && !input.intake?.answers
      ? input.intake?.later === true || (await markQuizLater(me, await getTargetTable().catch(() => [])))
      : false;
  return { ok: true, kind: answer.kind, line: answer.line, skipped };
}
