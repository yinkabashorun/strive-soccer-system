// The share link for the signed-in free player (lib/elite/share-link.ts
// has the rule). Reads whether free sign-up is open and, while it is
// closed, the player's own waitlist code by their phone.
import { createServiceClient } from "./supabase/server";
import { APP_URL } from "./app-url";
import { isFreeSignupOpen } from "./tracker-server";
import { shareJoinLink } from "./share-link";
import type { Tracker } from "./tracker-server";

export async function shareLinkFor(tracker: Pick<Tracker, "referral_code" | "phone">, demo: boolean): Promise<string> {
  if (demo) return shareJoinLink({ appUrl: APP_URL, signupOpen: false, referralCode: tracker.referral_code, waitlistCode: null });
  const signupOpen = await isFreeSignupOpen();
  let waitlistCode: string | null = null;
  if (!signupOpen && tracker.phone) {
    const admin = createServiceClient();
    const { data } = admin
      ? await admin.from("elite_waitlist").select("code").eq("phone", tracker.phone).maybeSingle()
      : { data: null };
    waitlistCode = (data as { code?: string } | null)?.code ?? null;
  }
  return shareJoinLink({ appUrl: APP_URL, signupOpen, referralCode: tracker.referral_code, waitlistCode });
}
