import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { JoinForm } from "@/components/elite/JoinForm";
import { GetTheApp } from "@/components/elite/GetTheApp";
import { isIos } from "@/lib/elite/install";
import { UnderAge } from "@/components/elite/UnderAge";
import { WaitlistForm } from "@/components/elite/WaitlistForm";
import { WaitlistStatus } from "@/components/elite/WaitlistStatus";
import { APP_URL } from "@/lib/elite/app-url";
import { waitlistInviter, waitlistStatus } from "@/lib/elite/waitlist-server";
import { WAITLIST_COOKIE, cleanSource, cleanWaitlistCode, waitlistLink } from "@/lib/elite/waitlist";
import { nyToday } from "@/lib/elite/time";
import { getViewer } from "@/lib/elite/session";
import { isSupabaseConfigured } from "@/lib/elite/supabase/server";
import { getAppVersion, homePathFor, inviteLandingFor, isFreeSignupOpen, trackerFor } from "@/lib/elite/tracker-server";
import {
  JOIN_AGE_COOKIE,
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
// is the waitlist (075): ?w=CODE is the teammate who sent the link and
// ?src=WORD where the visit came from (5v5, ig). A teammate's link carries ?ref=CODE: whoever
// joins with it sends that teammate a friend request (072). It works inside
// the App Store app too: a free account buys nothing.
export default async function JoinPage({
  searchParams,
}: {
  searchParams?: { ref?: string; club?: string; w?: string; src?: string; web?: string };
}) {
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
    // Sign-up is closed: this page is the waitlist (migration 075). A
    // player who joined on this phone sees their link and their teammates.
    const mine = await waitlistStatus(cookies().get(WAITLIST_COOKIE)?.value);
    if (mine) {
      return (
        <WaitlistStatus
          first={mine.first}
          link={waitlistLink(APP_URL, mine.code)}
          phone={mine.phone}
          teammates={mine.teammates}
        />
      );
    }
    if (cookies().get(JOIN_AGE_COOKIE)) return <UnderAge />;
    // A share from a free player who has no waitlist code carries their
    // free code (?ref=); it counts here as who sent them (share-link.ts).
    const w = cleanWaitlistCode(searchParams?.w) ?? ref;
    const sender = await waitlistInviter(w);
    return (
      <WaitlistForm
        configured={configured}
        referral={w ?? ""}
        source={cleanSource(searchParams?.src) ?? (w ? "teammate" : "")}
        years={birthYears(nyToday())}
        invite={sender ? { kind: "friend", first: sender.first, initials: sender.initials } : null}
      />
    );
  }

  // An answer under 13 earlier in this visit: the same plain screen, and
  // no way to try again with another date until the browser is closed.
  if (cookies().get(JOIN_AGE_COOKIE)) return <UnderAge />;

  // Who sent the link: a friend's first name and initials, or a club's
  // name and crest. Nothing more is shown to someone not signed in.
  const invite = await inviteLandingFor(ref, club);

  // On an iPhone, once the coaches have saved the link to the app
  // (/coach/free), an invite points to the APP: training is timed there,
  // and only timed training counts on the board. The code from the invite
  // is shown to type at the app's door. ?web=1 is the way past it, for a
  // player with no iPhone; every other device goes straight to the form.
  const app = searchParams?.web === "1" ? null : (await getAppVersion()).link;
  if (app && isIos(headers().get("user-agent") ?? "")) {
    const web = new URLSearchParams({ web: "1" });
    if (ref) web.set("ref", ref);
    if (club) web.set("club", club);
    const src = cleanSource(searchParams?.src);
    if (src) web.set("src", src);
    return <GetTheApp invite={invite} code={club ?? ref} link={app} webHref={`/join?${web.toString()}`} />;
  }

  return (
    <JoinForm
      configured={configured}
      referral={ref ?? ""}
      source={cleanSource(searchParams?.src) ?? ""}
      club={club ?? ""}
      years={birthYears(nyToday())}
      invite={invite}
    />
  );
}
