import type { Href, useRouter } from "expo-router";
import type { AppBootstrap } from "@shared/app-contract";
import { keys } from "@/api/queries";
import { queryClient } from "@/api/queryClient";
import { homeOf } from "@/navigation";

// A step that is finished leaves for the app's first screen, and takes the
// steps before it off the stack: after "Start my week" there is no offer
// to swipe back to, and after a payment there is no offer left on screen.
//
// Why a screen has to do this itself: the gatekeeper (app/_layout.tsx)
// only moves someone who is OUTSIDE their area, and the week's set-up and
// the offer are both inside the free app's area too (they open again from
// the Week tab). So once the account is read again and belongs in the free
// app, nothing else would move them. Found by the simulator Nov 25 2026:
// "Start my week" saved, the button turned into "Save", and the player was
// left on the same screen.
//
// Call it after rereadMe(): it reads who this is from what was just read.
export function openHome(router: Pick<ReturnType<typeof useRouter>, "canDismiss" | "dismissAll" | "replace">): void {
  const state = queryClient.getQueryData<AppBootstrap>(keys.me)?.state;
  if (router.canDismiss()) router.dismissAll();
  router.replace(homeOf(state) as Href);
}
