import type { NativeIntent } from "expo-router";
import { inviteFromLink } from "@shared/friend-link";
import { holdInvite } from "@/invite";

// Every link the iPhone hands the app comes through here first (expo-router
// calls redirectSystemPath with the link the app was started by, and with
// each link that arrives while it is open; when the app is started from
// its icon, the "link" is the app's own root).
//
// The only link that means anything is an INVITE: thestriveapp.com/join
// with a teammate's code (?ref=) or a club's (?club=), from a text or from
// a player's QR code (lib/elite/friend-link.ts has the rule). The invite is
// KEPT (src/invite.ts), and the app opens where it always does:
//   started by the link     home ("/"); the gatekeeper then takes each
//                           person where they belong, as on every start
//   already open            nothing moves (null)
// The screen that asks "Send Diego a friend request?" is opened afterwards,
// and only for a player who is in the free app (src/InviteOpener.tsx). So a
// link can never carry anyone past sign-in, the agreement or a gate, never
// lands on a screen with no way back, and never sends a request by itself.
//
// Any other link is not ours to act on: the same two answers, and nothing
// is kept. This function must not throw (the router would take the app
// down with it).
export const redirectSystemPath: NonNullable<NativeIntent["redirectSystemPath"]> = ({ path, initial }) => {
  try {
    const invite = inviteFromLink(path);
    if (invite) holdInvite(invite);
  } catch {
    // a link that cannot be read is no invite
  }
  return initial ? "/" : null;
};
