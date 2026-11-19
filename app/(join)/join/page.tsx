import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { JoinForm } from "@/components/elite/JoinForm";
import { UnderAge } from "@/components/elite/UnderAge";
import { nyToday } from "@/lib/elite/time";
import { getViewer } from "@/lib/elite/session";
import { isSupabaseConfigured } from "@/lib/elite/supabase/server";
import { inNativeApp } from "@/lib/elite/native-request";
import { homePathFor, inviteLandingFor, isFreeSignupOpen, trackerFor } from "@/lib/elite/tracker-server";
import {
  JOIN_AGE_COOKIE,
  JOIN_CLOSED_MESSAGE,
  birthYears,
  cleanClubCode,
  cleanReferralCode,
  clubAskPath,
  friendAskPath,
} from "@/lib/elite/tracker";

export const metadata: Metadata = {
  title: "Join your friends · Strive Elite",
};

export const dynamic = "force-dynamic";

// The free training log's front door (migration 069). Open to anyone only
// while a coach has free sign-up switched on at /coach/free; otherwise it
// says so and offers sign-in. A teammate's link carries ?ref=CODE: whoever
// joins with it becomes that teammate's friend.
export default async function JoinPage({
  searchParams,
}: {
  searchParams?: { ref?: string; club?: string };
}) {
  // Inside the App Store app, accounts are not created (the existing
  // rule, lib/elite/native-request.ts): the screen there is sign-in only.
  if (inNativeApp()) redirect("/login");

  const ref = cleanReferralCode(searchParams?.ref);
  const club = cleanClubCode(searchParams?.club);
  const viewer = await getViewer();
  if (viewer) {
    // Already has a free account and opened a club's link: their Friends
    // tab, where one sheet asks "Join <club>?".
    if (club && (await trackerFor(viewer))) redirect(clubAskPath(club));
    // Already has a free account and opened a teammate's link: their own
    // week, where one sheet asks whether to add that teammate as a friend.
    if (ref && (await trackerFor(viewer))) redirect(friendAskPath(ref));
    if (!viewer.demo) redirect(await homePathFor(viewer));
  }

  // With no database at all (a local build) the form is shown so it can
  // be looked at; it cannot create anything and says so, like the invite
  // form does.
  const configured = isSupabaseConfigured();
  if (configured && !(await isFreeSignupOpen())) {
    return (
      <div className="mx-auto flex min-h-[100svh] w-full max-w-md flex-col px-[22px] pb-[calc(32px+env(safe-area-inset-bottom))] pt-[calc(96px+env(safe-area-inset-top))]">
        <h1 className="font-display text-[46px] font-black uppercase leading-[0.9]">Not open yet</h1>
        <p className="mt-3 text-[15.5px] leading-[1.4] text-white/70">{JOIN_CLOSED_MESSAGE}</p>
        <Link
          href="/login"
          className="mt-auto flex h-[58px] w-full items-center justify-center rounded-[18px] bg-bone font-display text-[23px] font-black uppercase text-black"
        >
          Sign in
        </Link>
      </div>
    );
  }

  // An answer under 13 earlier in this visit: the same plain screen, and
  // no way to try again with another date until the browser is closed.
  if (cookies().get(JOIN_AGE_COOKIE)) return <UnderAge />;

  // Who sent the link: a friend's first name and initials, or a club's
  // name and crest. Nothing more is shown to someone not signed in.
  const invite = await inviteLandingFor(ref, club);
  return (
    <JoinForm
      configured={configured}
      referral={ref ?? ""}
      club={club ?? ""}
      years={birthYears(nyToday())}
      invite={invite}
    />
  );
}
