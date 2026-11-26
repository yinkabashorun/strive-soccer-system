import { useEffect } from "react";
import { useRouter, useSegments, type Href } from "expo-router";
import { inviteRoute } from "@shared/friend-link";
import { useAuth } from "@/auth/session";
import { useMe } from "@/api/queries";
import { takeInvite, useHeldInvite } from "@/invite";
import { areaFor, hasTrain, inArea } from "@/navigation";

// Opens an invite link the app is holding (src/invite.ts), for a player
// who is IN the free app, and for nobody else.
//
// The link itself moved nobody (app/+native-intent.ts). Here, once it is
// known who this is and they are inside the free app with a screen of it
// on show, the one screen that asks first is put on top of wherever they
// are (app/friend/link.tsx), with a way back. It is the same rule a tapped
// notification follows in the gatekeeper beside this (app/_layout.tsx): it
// waits, and it never jumps a gate.
//
// Anyone else keeps the invite for the door: a new player finds the code
// already typed there (src/CodeDoor.tsx).
//
// Opening the screen sends nothing. The request is the screen's one button.
export function InviteOpener() {
  const { ready, signedIn } = useAuth();
  const me = useMe();
  const segments = useSegments();
  const router = useRouter();
  const held = useHeldInvite();
  const state = me.data?.state;
  const area = ready ? areaFor(signedIn, state, me.data?.profileSetup) : null;
  const inside = area === "free" && inArea(area, segments, hasTrain(state));

  useEffect(() => {
    if (!held || !inside) return;
    const invite = takeInvite();
    if (invite) router.navigate(inviteRoute(invite) as Href);
  }, [held, inside, router]);

  return null;
}
