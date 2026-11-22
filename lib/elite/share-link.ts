// EVERY SHARE IS AN INVITE (Nov 22 2026). Whatever a free player shares
// from the app (the week card, a drill's Then and now, a progress reel)
// carries their own join link, so whoever joins through it counts toward
// them exactly like an invite does.
//
// There are two kinds of code in the app, and the right one depends on
// whether free sign-up is open:
//   - open:   /join is the sign-up form; ?ref=<their free referral code>
//             sends them a friend request (072), as an invite always has
//   - closed: /join is the waitlist (075); ?w=<their waitlist code> counts
//             as a teammate they brought. A player with no waitlist code
//             carries their free code (?ref=), which the closed page now
//             takes in its place (joinWaitlist accepts a free player's
//             code as who sent them).
// Every share link also carries src=share, so the coaches can see which
// joins came from a share (the waitlist's source, the free account's
// source, 078).
//
// The picture or video itself shows only SHARE_LINE: the address, never
// the code. The full link goes in the share text.

export const SHARE_SOURCE = "share";
export const SHARE_LINE = "thestriveapp.com/join";

export function shareJoinLink(input: {
  appUrl: string;
  signupOpen: boolean;
  referralCode: string | null; // the free account's own referral code
  waitlistCode: string | null; // their waitlist code, when they have one
}): string {
  const base = `${input.appUrl.replace(/\/+$/, "")}/join`;
  if (!input.signupOpen && input.waitlistCode) return `${base}?w=${input.waitlistCode}&src=${SHARE_SOURCE}`;
  if (input.referralCode) return `${base}?ref=${input.referralCode}&src=${SHARE_SOURCE}`;
  return `${base}?src=${SHARE_SOURCE}`;
}

export type ShareKind = "week" | "then_and_now" | "progress_reel";

// The words that go with the file on the share sheet (and to the
// clipboard where a phone cannot share a file). One line, then the link.
export function shareText(kind: ShareKind, link: string): string {
  const line =
    kind === "week"
      ? "My week of training on Strive."
      : kind === "then_and_now"
        ? "Then and now, on Strive."
        : "My progress, take by take, on Strive.";
  return `${line} Train with me: ${link}`;
}
