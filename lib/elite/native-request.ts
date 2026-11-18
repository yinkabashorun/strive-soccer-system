// Is this request coming from inside the App Store app? The native shell
// adds "StriveEliteApp/<version>" to its user agent (appendUserAgent in
// native/capacitor.config.ts), so the server can know before the page is
// drawn, with no flash.
//
// Used for the few things that must differ inside the app: App Review
// does not allow an app to send people elsewhere to get what the app
// unlocks, so the sign-in screen there is sign-in only (accounts are
// created by invite, on the web, after the family has spoken to a coach).
//
// The token and the user-agent check themselves live in app-links.ts,
// which is pure, so a browser component can use them too; this file adds
// the server's own way of asking.
import { headers } from "next/headers";
import { NATIVE_UA_TOKEN, isNativeUserAgent } from "./app-links";

export { NATIVE_UA_TOKEN, isNativeUserAgent };

export function inNativeApp(): boolean {
  try {
    return isNativeUserAgent(headers().get("user-agent"));
  } catch {
    return false;
  }
}
