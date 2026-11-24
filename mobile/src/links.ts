import * as WebBrowser from "expo-web-browser";
import { API_BASE } from "./config";

// Our own pages that live on the website (the Terms, the Privacy Policy,
// Support, the password reset) open in a sheet over the app with Done, so
// the person never leaves for Safari (punch list A20).
export function openSite(path: string): Promise<unknown> {
  return openSheet(`${API_BASE}${path}`);
}

// A whole https address the server sent (a lesson's download), in the same
// sheet. Anything that is not https is not opened at all.
export function openLink(url: string): Promise<unknown> {
  if (!isHttps(url)) return Promise.resolve();
  return openSheet(url);
}

export function isHttps(url: string): boolean {
  return /^https:\/\/[^\s/]+(\/\S*)?$/i.test(url);
}

function openSheet(url: string): Promise<unknown> {
  return WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    controlsColor: "#f2efe8",
    toolbarColor: "#000000",
  }).catch(() => undefined);
}
