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

// What an invite code creates (054, Oct 29 2026). Every code before 054
// was a player code; a coach code (admin-generated) redeems as a coach
// profile with no player row and lands on the coach dashboard.
export type InviteRole = "player" | "coach";

export function inviteRoleOf(raw: unknown): InviteRole {
  return raw === "coach" ? "coach" : "player";
}

// Where a freshly redeemed account goes once signed in.
export function signupLanding(role: InviteRole): string {
  return role === "coach" ? "/coach" : "/dashboard";
}

// The fields a redeem needs. A family gives the parent phone (text
// updates go there); a coach gives name, email and password only.
export function redeemFieldsComplete(
  role: InviteRole,
  fields: { fullName: string; email: string; phone: string; password: string }
): boolean {
  const { fullName, email, phone, password } = fields;
  if (!fullName.trim() || !email.trim() || password.length < 8) return false;
  return role === "coach" || phone.trim().length > 0;
}

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
