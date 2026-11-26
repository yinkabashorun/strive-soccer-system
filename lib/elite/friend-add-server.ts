// ADD A FRIEND IN PERSON, on the server (the rule and the words:
// lib/elite/friend-add.ts and lib/elite/friend-link.ts).
//
// Nothing here makes anyone a friend, and nothing here is a second way to
// send a request. A username is looked up, EXACTLY, and the request goes
// through the one function every friend request goes through
// (tracker-server.ts requestFriend): a block, a player who was taken off
// and the 30 waiting requests are decided there, as they are for a link
// and for a typed code. What this file adds is the lookup and the words.
//
// It reads no table of the free app itself: who has a username is
// account-profile-server.ts, everything about friends is tracker-server.ts.
//
// Called only by the app's own routes (app/api/app/free/friend/ask and the
// GET of app/api/app/free/code), after their gate and their rate limits.
import { createServiceClient } from "./supabase/server";
import type { Viewer } from "./session";
import { accountByUsername } from "./account-profile-server";
import { clubByCode, friendAskFacts, getTracker, inviteLandingFor, requestFriend, type Tracker } from "./tracker-server";
import { clubAskLine, friendRequestLine, shortName } from "./tracker";
import { normalizeUsername } from "./username";
import { ADD_OFFLINE, friendAddAnswer, usernameToFind, type FriendAddAnswer } from "./friend-add";
import { DOOR_OWN_CODE } from "./free-door";
import { INVITE_NOT_ONE, type AppInvite, type AskedInvite } from "./friend-link";

const NOT_FOUND = { found: false } as const;

// "Send a friend request" on the Add a friend screen. `raw` is what was
// typed; who is asking comes from the sign-in token, never from the phone.
export async function askFriendByUsername(viewer: Viewer, raw: unknown): Promise<FriendAddAnswer> {
  const name = usernameToFind(raw);
  if (!name) return friendAddAnswer(NOT_FOUND);
  const me = viewer.profile.id;
  const self = { found: true, self: true, name: "", removedBefore: false, waitingBefore: false, result: null } as const;
  if (name === normalizeUsername(viewer.setup.username ?? "")) return friendAddAnswer(self);
  const admin = createServiceClient();
  if (!admin) return { ok: false, error: ADD_OFFLINE };

  // the exact username, capitals ignored: one account or none
  const other = await accountByUsername(admin, name);
  if (other === "offline") return { ok: false, error: ADD_OFFLINE };
  if (!other) return friendAddAnswer(NOT_FOUND);
  if (other.id === me) return friendAddAnswer(self);
  // Every kind of account has a username; only a player in the free app
  // has friends. Anyone else reads as a username nobody has.
  if (!(await getTracker(other.id))) return friendAddAnswer(NOT_FOUND);

  // read first, for the wording only: the request function answers "sent"
  // both for a player who was taken off and for a request already waiting
  const before = await friendAskFacts(me, other.id);
  if (!before) return { ok: false, error: ADD_OFFLINE };
  const result = await requestFriend(me, other.id);
  return friendAddAnswer({
    found: true,
    self: false,
    name: shortName(other.full_name),
    removedBefore: before.removed,
    waitingBefore: before.waiting,
    result,
  });
}

// What an invite link is, for the one screen that asks before anything is
// sent (mobile/app/friend/link.tsx): a teammate by first name and initials,
// exactly what the website shows a visitor on that link and no more (never
// a photo, never a last name), or a club by its name. Read only: the
// request itself is the door's own route, on the tap.
export async function inviteFor(tracker: Tracker, asked: AskedInvite): Promise<AppInvite> {
  if (asked.code === tracker.referral_code) return { ok: false, error: DOOR_OWN_CODE };
  const admin = createServiceClient();
  if (!admin) return { ok: false, error: ADD_OFFLINE };
  // as the door does for a typed code: a club's first, unless the link
  // said it is a teammate's
  if (asked.kind !== "friend") {
    const club = await clubByCode(admin, asked.code);
    if (club && !club.archived_at) {
      return { ok: true, kind: "club", code: asked.code, id: club.id, name: club.name, body: clubAskLine(club.kind === "coach") };
    }
  }
  if (asked.kind !== "club") {
    const who = await inviteLandingFor(asked.code, null);
    if (who?.kind === "friend") {
      return { ok: true, kind: "friend", code: asked.code, first: who.first, initials: who.initials, body: friendRequestLine(who.first) };
    }
  }
  return { ok: false, error: INVITE_NOT_ONE };
}
