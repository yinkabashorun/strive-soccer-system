import type { RefObject } from "react";
import type { CardView } from "@/SessionCard";

// The browser build (the example data's preview): nothing is captured,
// saved or shared from a browser. app/card.tsx never calls these in the
// example build; they are here so the browser bundle never pulls in the
// phone's capture, Photos and Instagram packages (react-native-view-shot
// asks a browser for a package the app does not install).

export type Saved = "saved" | "refused" | "failed";

export async function makeCardFile(_view: RefObject<CardView | null>): Promise<string> {
  throw new Error("The card is made on the phone.");
}
export async function saveCard(_file: string): Promise<Saved> {
  return "failed";
}
export async function instagramReady(): Promise<boolean> {
  return false;
}
export async function shareToStory(_file: string, _appId: string): Promise<void> {}
export async function shareMore(_file: string): Promise<void> {}
