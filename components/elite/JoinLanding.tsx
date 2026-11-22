"use client";

import Link from "next/link";
import { Crest, FreeAvatar } from "./FreeAvatar";
import { WAITLIST_LANDING_LINE } from "@/lib/elite/waitlist";

// Who sent the link, as much as a signed-out visitor may see: a friend's
// first name and initials, or a club's name and crest. Never a photo of a
// player, never anything about anyone else (lib/elite/tracker-server.ts
// inviteLandingFor).
export type JoinInvite =
  | null
  | { kind: "friend"; first: string; initials: string }
  | { kind: "club"; name: string; letters: string; clubId: string };

// The photo behind the welcome: Strive's own, the same for every visitor.
export const JOIN_PHOTO = "/free-demo/post-gary-1.jpg";

// Opening an invite (the mock, screen 9): the photo full screen, who
// invited you, the wordmark, what the app is in one line, and one white
// button.
// While sign-up is closed the same page is the waitlist's front door
// (migration 075): "Opening soon" above the headline and one button,
// Get on the list.
export function JoinLanding({
  invite,
  onJoin,
  waitlist = false,
}: {
  invite: JoinInvite;
  onJoin: () => void;
  waitlist?: boolean;
}) {
  const button = waitlist
    ? "Get on the list"
    : !invite
      ? "Get started"
      : invite.kind === "friend"
        ? `Join ${invite.first}`
        : "Join the club";
  return (
    <div className="relative mx-auto min-h-[100svh] w-full max-w-md overflow-hidden">
      <div className="absolute inset-0" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={JOIN_PHOTO} alt="" className="h-full w-full object-cover object-[50%_20%]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.6)_0,rgba(0,0,0,0)_22%,rgba(0,0,0,0)_38%,rgba(0,0,0,.92)_66%,#000)]" />
      </div>

      {invite && (
        <div className="absolute inset-x-[18px] top-[calc(60px+env(safe-area-inset-top))] z-[2] flex justify-center">
          <div className="flex max-w-full items-center gap-2.5 rounded-[30px] border border-white/15 bg-black/45 py-1.5 pl-1.5 pr-4 text-[14px] font-semibold backdrop-blur-md">
            {invite.kind === "friend" ? (
              <FreeAvatar photo={null} initials={invite.initials} size={34} />
            ) : (
              <Crest club={{ id: invite.clubId, name: invite.name }} size={34} />
            )}
            <span className="truncate">
              {invite.kind === "friend" ? `${invite.first} invited you` : `Join ${invite.name}`}
            </span>
          </div>
        </div>
      )}

      <div className="absolute inset-x-[22px] bottom-[calc(40px+env(safe-area-inset-bottom))] z-[2]">
        <p className="font-display text-[15px] font-black tracking-[3px] text-bone">
          STRIVE <span className="text-accent">ELITE</span>
          {waitlist && <span className="ml-3 text-[13px] tracking-[2px] text-white/60">OPENING SOON</span>}
        </p>
        <h1 className="mt-3 font-display text-[56px] font-black uppercase leading-[0.86] tracking-[-0.5px]">
          Train.
          <br />
          Post it.
          <br />
          Compete with
          <br />
          your friends.
        </h1>
        <p className="mt-3.5 text-[16px] leading-[1.4] text-white/80">
          Log the work you put in on your own, see your friends&apos; training, and see who put in the most work this
          week.
          {waitlist && WAITLIST_LANDING_LINE}
        </p>
        <button
          type="button"
          onClick={onJoin}
          className="mt-6 flex h-[58px] w-full items-center justify-center rounded-[18px] bg-bone font-display text-[23px] font-black uppercase tracking-[0.5px] text-black"
        >
          <span className="truncate px-4">{button}</span>
        </button>
        <p className="mt-2 text-center text-[15px] font-semibold text-white/60">
          Already on Strive Elite?{" "}
          <Link href="/login" className="tap text-bone">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
