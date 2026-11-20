// Deleting an account: the pure rules (Nov 18 2026).
//
// Apple requires that an app which lets people create an account also lets
// them delete it from inside the app, without having to email or call
// anyone (App Review Guideline 5.1.1(v)). These are the rules both delete
// paths share: the member's own "Delete my account" and the coach deleting
// a player from the roster.
import type { Role } from "./types";

// Every folder of the private film bucket that holds one player's own
// files: clips sent to the coach (036), progress videos (037) and Film
// Room clips (062). Deleting the account row does not remove files, so
// these are emptied first.
export const FILM_BUCKET = "elite-film";
export function playerFilePrefixes(playerId: string): string[] {
  return [`clips/${playerId}`, `progress/${playerId}`, `filmroom/${playerId}`];
}

export type DeleteGate =
  | { allowed: true }
  | { allowed: false; reason: "signed_out" | "demo" | "owner" };

// Who may delete their own account from inside the app. Players (the
// family's account) and coaches may. The owner's account is the one that
// runs the program for everyone, so it is not removed with a button; and
// the example player on the demo tour is not an account at all.
export function deleteGate(viewer: { role: Role; demo: boolean } | null): DeleteGate {
  if (!viewer) return { allowed: false, reason: "signed_out" };
  if (viewer.demo) return { allowed: false, reason: "demo" };
  if (viewer.role === "admin") return { allowed: false, reason: "owner" };
  return { allowed: true };
}

export const DELETE_BLOCKED_MESSAGE: Record<"signed_out" | "demo" | "owner", string> = {
  signed_out: "Sign in first.",
  demo: "This is the example player, not a real account, so there is nothing to delete.",
  owner:
    "This is the owner account that runs the program for every player. It cannot be deleted from here.",
};

// The text the coaches get when a family deletes its own account. The app
// does not touch billing, so the one thing a coach must do is named.
export function accountDeletedText(name: string, role: Role, free = false): string {
  const who = name.trim() || (role === "coach" ? "A coach" : "A player");
  // A free training log account (069) has no plan, no clips and no billing.
  if (free) return `${who} deleted their free training log account in the app.`;
  return role === "coach"
    ? `${who} deleted their coach account in the app.`
    : `${who} deleted their Strive Elite account in the app. Their login, plans, messages and clips are gone. Billing is not stopped by this: cancel it in Stripe.`;
}

// Shown on the sign-in page after a deletion.
export const ACCOUNT_DELETED_NOTICE = "account_deleted";
export const ACCOUNT_DELETED_MESSAGE =
  "Your account and everything in it has been deleted. If you paid monthly, your coach has been told and will stop the billing.";

// Changing a password from inside the app (App Store punch list, A9). A
// member should never have to sign out and use "Forgot your password" to
// set a new one. The rule for what is acceptable lives here; the action
// checks the current password before anything is changed.
export const PASSWORD_MIN = 8;

export function passwordChangeProblem(input: { current: string; next: string }): string | null {
  if (!input.current) return "Enter your current password.";
  if (input.next.length < PASSWORD_MIN) return `Your new password needs at least ${PASSWORD_MIN} characters.`;
  if (input.next === input.current) return "Your new password is the same as the current one. Choose a different one.";
  return null;
}

export const PASSWORD_CHANGED_MESSAGE = "Your password is changed. Use the new one the next time you sign in.";
