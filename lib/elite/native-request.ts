// Is this request coming from inside the App Store app? The native shell
// adds "StriveEliteApp/<version>" to its user agent (appendUserAgent in
// native/capacitor.config.ts), so the server can know before the page is
// drawn, with no flash.
//
// Used for the few things that must differ inside the app: App Review
// does not allow an app to send people elsewhere to get what the app
// unlocks, so the sign-in screen there is sign-in only (accounts are
// created by invite, on the web, after the family has spoken to a coach).
import { headers } from "next/headers";

export const NATIVE_UA_TOKEN = "StriveEliteApp/";

export function isNativeUserAgent(userAgent: string | null | undefined): boolean {
  return typeof userAgent === "string" && userAgent.includes(NATIVE_UA_TOKEN);
}

export function inNativeApp(): boolean {
  try {
    return isNativeUserAgent(headers().get("user-agent"));
  } catch {
    return false;
  }
}
