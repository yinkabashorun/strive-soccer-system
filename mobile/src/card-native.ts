import type { RefObject } from "react";
import type { CardView } from "@/SessionCard";
import { Linking, PixelRatio, Share } from "react-native";
import { captureRef } from "react-native-view-shot";
import { Asset, requestPermissionsAsync } from "expo-media-library";
import RNShare, { Social } from "react-native-share";
import { cardCapture } from "@shared/session-card";

// THE TRAINING CARD, ON THE PHONE ITSELF: made into a picture, saved to
// Photos, handed to Instagram or the share sheet. The example build never
// reaches this file (app/card.tsx guards every call on FIXTURES), and the
// browser build gets card-native.web.ts in its place.
//
// What each step uses (read in each package's own source, Nov 28 2026):
//   capture   react-native-view-shot captureRef with cardCapture(the
//             phone's pixels a point): a JPEG file of exactly 1080 x 1920
//             in the app's temporary folder (on iOS the size it is asked
//             for is in points, lib/elite/session-card.ts says why)
//   save      expo-media-library (SDK 58, the class API): add-only access,
//             requestPermissionsAsync(true) (PHAccessLevel.addOnly), then
//             Asset.create(file); the legacy saveToLibraryAsync throws
//             from the root import in this version
//   Instagram react-native-share shareSingle, Social.InstagramStories: the
//             card as the story's background image (put on the pasteboard
//             with a five-minute expiry, then instagram-stories://share
//             with the Meta app ID); top and bottom colours black so
//             nothing purple shows around a picture that is already 9:16
//   More      React Native's own Share with the file: the phone's share
//             sheet hands the picture itself on

export async function makeCardFile(view: RefObject<CardView | null>): Promise<string> {
  const uri = await captureRef(view, cardCapture(PixelRatio.get()));
  return uri.startsWith("file://") ? uri : `file://${uri}`;
}

export type Saved = "saved" | "refused" | "failed";

export async function saveCard(file: string): Promise<Saved> {
  try {
    const asked = await requestPermissionsAsync(true);
    if (!asked.granted) return "refused";
    await Asset.create(file);
    return "saved";
  } catch {
    return "failed";
  }
}

// Instagram is on this phone: the story scheme is declared in the app's
// LSApplicationQueriesSchemes (app.json), without which iOS always says no.
export async function instagramReady(): Promise<boolean> {
  try {
    return await Linking.canOpenURL("instagram-stories://share");
  } catch {
    return false;
  }
}

export async function shareToStory(file: string, appId: string): Promise<void> {
  await RNShare.shareSingle({
    social: Social.InstagramStories,
    appId,
    backgroundImage: file,
    backgroundTopColor: "#000000",
    backgroundBottomColor: "#000000",
  });
}

// Closing the sheet without sharing is an answer, not a failure.
export async function shareMore(file: string): Promise<void> {
  await Share.share({ url: file }).catch(() => undefined);
}
