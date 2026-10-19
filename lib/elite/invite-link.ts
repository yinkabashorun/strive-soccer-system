// Where an invite link (/signup?code=...) should land. Pure, client-safe.
//
// Oct 19 2026: a returning player tapped his invite link a second time
// after his account already existed, got "invalid invite code", and had
// no idea the login page was the answer. An invite link is tapped more
// than once in real life (the text sits in the thread), so it has to be
// safe to tap again: a signed-in viewer goes to their app, a used code
// goes to sign-in with a plain explanation, and only a fresh code shows
// the sign-up form.

import type { Role } from "./types";

export const INVITE_USED_NOTICE = "invite_used";
export const INVITE_USED_MESSAGE =
  "That invite link already created your account. Sign in below with your email and the password you set.";

export function inviteLanding(input: {
  viewerRole: Role | null;
  demo: boolean;
  inviteUsed: boolean;
}): string | null {
  const { viewerRole, demo, inviteUsed } = input;
  if (viewerRole && !demo) {
    return viewerRole === "player" ? "/dashboard" : "/coach";
  }
  if (inviteUsed) return `/login?notice=${INVITE_USED_NOTICE}`;
  return null;
}
