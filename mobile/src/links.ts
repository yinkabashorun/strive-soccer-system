import * as WebBrowser from "expo-web-browser";
import { API_BASE } from "./config";

// Our own pages that live on the website (the Terms, the Privacy Policy,
// Support, the password reset) open in a sheet over the app with Done, so
// the person never leaves for Safari (punch list A20).
export function openSite(path: string): Promise<unknown> {
  return WebBrowser.openBrowserAsync(`${API_BASE}${path}`, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    controlsColor: "#f2efe8",
    toolbarColor: "#000000",
  }).catch(() => undefined);
}
