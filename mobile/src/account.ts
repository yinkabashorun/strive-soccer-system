import { signOutHere } from "./auth/session";
import { clearCache } from "./api/queryClient";
import { clearClockStore } from "./clock";
import { clearOutbox, sendOutbox } from "./outbox";
import { turnOffNotifications } from "./push";
import { setPref } from "./prefs";

// Signing out leaves nothing of the account on this phone: the phone comes
// off the account's notifications (a phone follows whoever is signed in on
// it), the session leaves the Keychain and the cached screens are wiped.
export async function signOutEverywhere(): Promise<void> {
  // a drill ticked with no signal gets one more try while the phone is
  // still signed in; after this the list is wiped with everything else
  await sendOutbox().catch(() => undefined);
  await turnOffNotifications().catch(() => undefined);
  await setPref("pushAsked", false);
  await signOutHere();
  await clearCache();
  await clearOutbox();
  await clearClockStore();
}

// After the account was deleted on the server there is nothing to take the
// phone off: just leave.
export async function leaveDeletedAccount(): Promise<void> {
  await setPref("pushOn", false);
  await setPref("pushAsked", false);
  await signOutHere();
  await clearCache();
  await clearOutbox();
  await clearClockStore();
}
