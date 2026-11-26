import { useSyncExternalStore } from "react";
import type { Invite } from "@shared/friend-link";

// An invite link the phone handed the app (app/+native-intent.ts), kept
// until it can be shown: a teammate's code or a club's.
//
// A link never moves anyone and never sends anything. It waits here:
//   a player in the free app   the one screen that asks first opens over
//                              wherever they are (src/InviteOpener.tsx)
//   anyone else                signed out, joining, the photo, the door:
//                              they carry on, and the door finds the code
//                              already typed (src/CodeDoor.tsx)
//
// Held in memory only, for as long as the app is open, like what is typed
// while joining (src/join-draft.ts). One invite at a time: the newest
// link wins.
let held: Invite | null = null;
const watchers = new Set<() => void>();

function tell() {
  watchers.forEach((w) => w());
}

export function holdInvite(invite: Invite): void {
  held = { code: invite.code, kind: invite.kind };
  tell();
}

export function heldInvite(): Invite | null {
  return held;
}

// The invite was shown, used, or turned down: it is not offered again.
export function dropInvite(): void {
  if (!held) return;
  held = null;
  tell();
}

// Hand the invite over once (the screen that asks takes it from here).
export function takeInvite(): Invite | null {
  const invite = held;
  dropInvite();
  return invite;
}

function subscribe(fn: () => void): () => void {
  watchers.add(fn);
  return () => void watchers.delete(fn);
}

export function useHeldInvite(): Invite | null {
  return useSyncExternalStore(subscribe, heldInvite, heldInvite);
}
