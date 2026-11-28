# Sharing one still image to Instagram Story, TikTok and Snapchat, plus saving it to Photos (iOS, Expo SDK 58)

Researched Nov 28 2026. No code was written.

## What I could and could not read (read this first)

This session's network refused the three platforms' own documentation hosts: **developers.facebook.com**, **developers.secure.facebook.com**, **developers.snap.com**, **docs.snap.com**, **kit.snapchat.com**, **snapkit.com** and **developers.tiktok.com** all failed. To read those pages directly, those hosts have to be allowed in the session's network settings. **docs.expo.dev** was also refused.

So every source is marked with one of these:
- **[READ]** I read the primary source myself: Apple's pages, Expo's docs source on GitHub, the platforms' own SDK repositories on GitHub, or a library's published source on npm.
- **[SEARCH]** A web search summarised the platform's official page and I could not open the page. The statement is attributed to that page, but I have not read it myself.
- **[3P]** A third-party source. These are named only where nothing official was reachable.

Primary sources I read directly:
- Apple App Store marketing guidelines: https://developer.apple.com/app-store/marketing/guidelines/
- Apple developer documentation, from the JSON behind the doc pages: `PHAccessLevel.addOnly`, `NSPhotoLibraryAddUsageDescription`, `UIApplication.canOpenURL(_:)` and "Delivering an Enhanced Privacy Experience in Your Photos App".
- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- TikTok's own SDK repository, `tiktok/tiktok-opensdk-ios`: the README, CHANGELOG, Package.swift and podspec.
- Snap's own sample repositories: `Snapchat/creative-kit`, which covers Creative Kit Lite, and `Snapchat/creative-kit-sample`, its iOS and React Native READMEs.
- `react-native-share` 12.3.1, the source in its npm package (`ios/InstagramStories.m`, `ios/RNShare.mm`, `src/index.tsx`, `plugin/src`).
- `expo-media-library` 58.0.14, the source in its npm package (the config plugin, the iOS permission requesters, `Asset.create`), plus `docs/pages/versions/v58.0.0/sdk/media-library.mdx` on GitHub.
- npm registry metadata, used for every release date below.

---

## 1. Instagram Story, still image

**How it works.** The app puts the image on the general pasteboard as one item dictionary, then opens a URL scheme.
- The URL is `instagram-stories://share?source_application=<FACEBOOK_APP_ID>`.
  - [SEARCH] Meta, "Sharing to stories", Instagram Platform: https://developers.facebook.com/documentation/instagram-platform/sharing-to-stories
  - [READ] The same URL is in `react-native-share` 12.3.1 `ios/InstagramStories.m`.
- The pasteboard keys used in shipping code [READ, `InstagramStories.m`]:
  - `com.instagram.sharedSticker.backgroundImage`: image data. The library sends PNG data.
  - `com.instagram.sharedSticker.stickerImage`: image data.
  - `com.instagram.sharedSticker.backgroundTopColor` / `...backgroundBottomColor`: hex strings.
  - `com.instagram.sharedSticker.contentURL`: an attribution link.
  - `com.instagram.sharedSticker.backgroundVideo`: video data.
  - The pasteboard item is set to expire after 5 minutes (`UIPasteboardOptionExpirationDate`).
- [SEARCH] Meta's page was last updated June 30 2026 and links to an "important update" to the sharing flow. I could not open that update. Read it before building.

**Meta (Facebook) app ID.** [SEARCH, Meta page above] A Facebook App ID has been required since January 2023. Without one, users see "The app you shared from doesn't currently support sharing to Stories".
- The ID goes in the `source_application` query parameter of the URL.
- In `react-native-share` it is passed as the `appId` option. `shareSingle` throws "To share to Instagram Stories you need to provide appId" when it is missing [READ, `src/index.tsx`].
- So the owner creates an app at developers.facebook.com and copies its App ID.
- Whether Meta also needs the iOS bundle ID registered on that app, or a `FacebookAppID` key in Info.plist, is NOT CONFIRMED.

**Info.plist.** [SEARCH, Meta page above] Add `instagram-stories` to `LSApplicationQueriesSchemes`. Nothing else is named for a background-image share.

**Background image versus sticker.** [SEARCH, Meta page above] You must supply a background asset, a sticker asset, or both. A sticker appears on top of the background.
- For a full-screen 1080 x 1920 card, send it as the **background image**.
- Use a sticker only if the player should place the card over their own photo.

**Size and format.** [SEARCH, Meta page above] Meta recommends a 9:16 image ratio; the page reportedly also says "9:18", which looks like a typo. 1080 x 1920 fits.
- [3P] Flutter package READMEs cite a background of "at least 720x1280, PNG or JPG" and a sticker of "640x480". I found no official source for those numbers.

**Review or approval.** I found NO statement that Meta App Review is needed for Sharing to Stories, and the Meta page could not be opened. NOT CONFIRMED. My understanding from memory: no review is needed, only a valid App ID. Unverified.

## 2. Snapchat, still image to Story or to chat

**Two official ways** [READ, `Snapchat/creative-kit` README, "Creative Kit Lite Samples"]:

1. **Creative Kit Lite.** No SDK, nothing added to the app's size.
   - Put a dictionary on `UIPasteboard` (5-minute expiry): `com.snapchat.creativekit.clientID` and `com.snapchat.creativekit.backgroundImage` as image data. Optionally add `com.snapchat.creativekit.captionText`, `...stickerImage` and `...payloadMetadata`.
   - Open the Snapchat URL with the query items `checkcount=<UIPasteboard.general.changeCount>`, `clientId=<CLIENT_ID>` and `appDisplayName=<name>`.
   - "Share to Preview" bypasses the camera and shows the app's full-screen image. The same README says: "We recommend that all background content passed through has a 9:16 ratio." A 1080 x 1920 image fits.
   - The user then "can send the Snap to his/her friends, Stories and Groups". So one button covers both Story and chat. The app cannot target one of them directly.
   - The Android section of the same README uses `snapchat://creativekit/preview`. The iOS snippet passes `shareDest` as `"preview"`. That the iOS URL is also `snapchat://creativekit/preview` is my inference and is not stated for iOS.
2. **Creative Kit SDK** (the `SnapSDK` CocoaPod: `SCSDKSnapAPI`, `SCSDKPhotoSnapContent`, `SCSDKSnapPhoto`).
   - [SEARCH] Class reference at https://kit.snapchat.com/reference/CreativeKit/ios/Classes/SCSDKPhotoSnapContent.html
   - [SEARCH] Overview at https://developers.snap.com/reference/CreativeKit/ios/index.html, which requires a client ID, Snapchat 10.34.1.0 or later and iOS 11 or later.

**Registration and review** [READ, `Snapchat/creative-kit` README and `Snapchat/creative-kit-sample` iOS/RN READMEs]:
- The app is registered on the Snap Kit developer portal with its **bundle ID**. Lite says: "Sharing of the content on Snapchat requires your app to be registered at kit.snapchat.com and prior approval from Snapchat."
- Two client IDs are issued:
  - **Staging / Development** works at once, but only for Snapchat accounts listed as **Demo Users**.
  - **Production** works for any account, but "your app must be approved for the Production clientID to work". The review guidelines page is linked but was unreachable.
- In the portal: enable Creative Kit on a version, add the bundle ID under Platform Identifiers, and activate that version on Staging. No review is needed to test on Staging.
- **Age and category restrictions for an app whose users are 13 to 18: NOT CONFIRMED.** Snap's review guidelines and developer terms were unreachable. Read them before applying, because the users are minors.

**Info.plist** [READ]:
- Creative Kit Lite sample: `LSApplicationQueriesSchemes` with `snapchat`.
- SDK route (RN sample): `LSApplicationQueriesSchemes` with `snapchat`, `bitmoji-sdk` and `tms-apps`; `SCSDKClientId`; `SCSDKRedirectUrl` plus a matching URL type. The redirect is only needed for Login Kit; for share-only I could not confirm that it can be left out.

**React Native.**
- `@snapchat/snap-kit-react-native` (official): last release 0.4.0 on **June 30 2022** [READ, npm]. It is stale and predates the new architecture; treat it as unmaintained.
- Recommendation: Creative Kit Lite, because it needs no SDK.
  - Its whole mechanism is "set pasteboard items, then open a URL". That is about 30 lines in a small local Expo module (Swift), plus a config plugin for the plist entry.
  - `react-native-share` on iOS has NO Snapchat target. Its `shareSingle` handles facebook, facebookstories, twitter, whatsapp, instagram, instagramstories, telegram, email, viber, messenger, sms and discord only [READ, `ios/RNShare.mm`]. Snapchat is Android-only there.

## 3. TikTok, still image

**Images are supported.** [READ, `tiktok-opensdk-ios` README and CHANGELOG] The SDK "enables your users ... [to] share images and videos to TikTok". CHANGELOG 2.0.0 says "share one or more videos or one or more images".
- The API is `TikTokShareRequest(localIdentifiers: [...], mediaType: ..., redirectURI: ...)` from `TikTokOpenShareSDK`.
- It takes **Photos-library local identifiers**, not a file or data. The image must first be saved to the camera roll, and its `PHAsset` identifier passed in.
- [SEARCH, "Share Kit for iOS", https://developers.tiktok.com/docs/en/share-kit-ios-quickstart-v2]
  - "Your app must have access to the user's photo library to successfully share videos to TikTok."
  - Media must be all videos or all images, with at most 35 images.
  - The aspect ratio must be between 1/2.2 and 2.2, so 9:16 is fine.
  - `shareFormat` takes `.normal`, the default, or `.greenScreen`.
- Whether add-only Photos access is enough for TikTok to read the asset: NOT CONFIRMED. The third-party `tiktok-opensdk-react-native` README asks for both `NSPhotoLibraryUsageDescription` and `NSPhotoLibraryAddUsageDescription` [READ, npm README], which suggests full read access may be needed.

**Story versus post.** I found no Story target in the SDK README, the changelog or the searched docs. The only formats are `.normal`, which opens TikTok's post editor, and `.greenScreen`. The app can only open the **general editor**. Whether the user can then pick "Story" inside TikTok's own editor is NOT CONFIRMED.

**Registration** [READ, SDK README]:
- A TikTok developer account and an app, with a **Client Key** issued "upon application approval".
- Add the Share Kit product in Manage apps.
- A **universal link** is needed as the redirect URI. The demos need "a working universal link ... with the Associated Domains capability".
- Whether Share Kit needs a separate audit before working for the public, and which scopes it needs: NOT CONFIRMED. The README only says the app is approved before keys are issued.

**Info.plist** [READ, SDK README]:
- `LSApplicationQueriesSchemes`: `tiktoksharesdk`, plus `snssdk1233` and `snssdk1180` "to check if TikTok is installed". `tiktokopensdk` is only for Login Kit.
- `TikTokClientKey` = the client key.
- `CFBundleURLTypes` → `CFBundleURLSchemes` containing the client key.
- AppDelegate/SceneDelegate code calling `TikTokURLHandler.handleOpenURL` for both URLs and universal-link activities.

**SDK state** [READ]: version 2.5.0 (podspec), iOS 12 or later, SPM and CocoaPods, privacy manifest included since 2.4.0. The 2.5.0 changelog line ("Add support for Xcode 16 beta 3") suggests releases are infrequent.

**React Native**:
- No official package.
- `tiktok-opensdk-react-native` 0.10.9, released **Sep 18 2025** [READ, npm], third-party. It has `share(mediaPaths, isImage, isGreenScreen)`. Its own to-do list includes "Handle photo library permissions in native side". New-architecture and Expo plugin support were not checked.
- `react-native-tiktok` 2.1.17 (Jan 20 2026) is **login only** ("Get authorized and fetch user profile") [READ].
- Expect to write a local Expo module, or vet `tiktok-opensdk-react-native` closely.

## 4. React Native libraries for Expo SDK 58 and the new architecture

| Package | Latest (npm) | Covers | Notes |
|---|---|---|---|
| `react-native-share` | 12.3.1, May 4 2026 | Instagram Stories on iOS (and the system share sheet) | Has a TurboModule codegen spec (`codegenConfig: RNShareSpec`), so it supports the new architecture. Has an Expo config plugin whose `ios` array becomes `LSApplicationQueriesSchemes`; the README example lists `instagram` (add `instagram-stories` yourself). The plugin imports `expo-build-properties`, which is NOT listed as a dependency, so install it alongside. `shareSingle({ social: Share.Social.INSTAGRAM_STORIES, appId, backgroundImage })` works per the source. No Snapchat or TikTok on iOS. `isPackageInstalled` "is not implemented for iOS" [READ, `RNShare.mm`], so use `Linking.canOpenURL`. |
| `@snapchat/snap-kit-react-native` | 0.4.0, Jun 30 2022 | Snapchat SDK | Stale. Do not use. |
| `tiktok-opensdk-react-native` | 0.10.9, Sep 18 2025 | TikTok Share | Third-party. New-architecture and Expo plugin support not verified. |
| `react-native-tiktok` | 2.1.17, Jan 20 2026 | TikTok **Login** only | Not for sharing. |
| `expo-media-library` | 58.0.14 (SDK 58 line) | Saving to Photos | See section 5. |

## 5. Saving to the photo library with add-only access (Expo SDK 58)

- **Package:** `expo-media-library` 58.x [READ].
  - In SDK 58 the default import is the new class-based API.
  - Save with **`Asset.create(fileUri)`**. On iOS it checks write permission and accepts add-only (`checkIfWritePermissionGranted` passes on the write-only grant).
  - The old `saveToLibraryAsync(localUri)` now lives in **`expo-media-library/legacy`**. Importing it from the root "will throw in runtime" (`legacyWarnings.ts`).
- **Asking for add-only access:** `requestPermissionsAsync(true)` (the `writeOnly` argument). On iOS it uses `PHAccessLevel.addOnly` (`ios/Requesters.swift`).
- **Info.plist key:** **`NSPhotoLibraryAddUsageDescription`**.
  - [READ, Apple] "A message that tells people why the app is requesting add-only access to their photo library. This key is required if your app uses APIs that have write access to the user's photo library."
  - The Expo plugin sets it from the `savePhotosPermission` option [READ, `withMediaLibrary.js`]. The plugin ALSO writes `NSPhotoLibraryUsageDescription` (`photosPermission`, with a default text) even when only saving.
  - The legacy save throws `MissingPListKeyException` without the add key.
- **Saving without a tap each time:** Apple's documents I read contain no rule saying each save needs its own tap. Permission is granted once, and the app may then add to the library. [READ]
  - "If your app only adds to the library, use the `NSPhotoLibraryAddUsageDescription` key."
  - App Review 5.1.1: "Ensure your purpose strings clearly and completely describe your use of the data."
  - So the purpose string should say plainly that the card is saved every time the player shares.
  - That silent saving is explicitly *allowed* is not stated anywhere I read; it is only not forbidden. NOT CONFIRMED either way.
  - The minors line in the guidelines: apps that "share personal information (such as ... photos ...) from a minor must include a privacy policy and must comply with all applicable children's privacy statutes."

## 6. Checking whether each app is installed

- [READ, Apple, `canOpenURL(_:)`] It returns false for undeclared schemes: "you must declare the URL schemes you pass to this method by adding the `LSApplicationQueriesSchemes` key".
  - Limit: at most 50 entries for apps linked on iOS 15 or later, and **25 entries for apps linked on or after iOS 27**.
- In Expo, call `Linking.canOpenURL('<scheme>://')` and declare the schemes through `ios.infoPlist.LSApplicationQueriesSchemes` or a plugin.
- Schemes to declare:
  - Instagram Story: `instagram-stories` [SEARCH, Meta].
  - Snapchat: `snapchat` [READ, Snap samples].
  - TikTok: `snssdk1233` and `snssdk1180` (install check) plus `tiktoksharesdk` (Share Kit) [READ, TikTok SDK README].
  - That is 5 entries, well under 25.

## 7. Apple's "Download on the App Store" badge before the app is live

[READ, https://developer.apple.com/app-store/marketing/guidelines/]

- **Before launch, or TestFlight only:** the licence lets you use the artwork "only in connection with Your applications that are available for download on the App Store". For an app not yet downloadable, the only provided variant is the **pre-order badge** ("Use the pre-order badge to indicate that your app is available for pre-order on the App Store. Once the app is released ... replace the pre-order badge with the download badge"). TestFlight is not mentioned. My reading: **no Download badge on images until the app is live on the App Store**, or a pre-order badge if the app is set up for pre-order.
- **Artwork:** use only the badge artwork provided, from the "Download Artwork" links on that page (available in 50 localizations). "Never translate App Store or create your own localized badge."
- **Minimum size:** 40 px height onscreen and 10 mm in print. In very limited layouts, pick a size that is clearly legible.
- **Clear space:** one quarter of the badge height, with no photos, type or graphics inside it; one tenth of the height in very limited layouts.
- **Not altered:** "Don't modify, angle, or animate the App Store badge." The grey border is part of the artwork. Add no symbols.
- **Placement:** one badge per layout, in a subordinate position, never the dominant artwork.

---

## Summary table

| Platform | Still image works? | Owner must register | Review needed | Native code needed |
|---|---|---|---|---|
| Instagram Story | Yes (pasteboard + `instagram-stories://share`) | Meta developer app, for its **Facebook App ID** | None found (unconfirmed) | No custom code: `react-native-share` (Expo plugin + `expo-build-properties`) |
| Snapchat (Story or chat, user picks) | Yes (Creative Kit Lite "Share to Preview") | Snap Kit developer portal: bundle ID, client IDs, Creative Kit enabled | **Yes, Snap approval for the Production client ID** (Staging works for Demo Users only) | Yes: a small local Expo module (pasteboard + URL), since no maintained RN package exists |
| TikTok | Yes, images via Share Kit, but **general post editor only** (no Story target found) | TikTok developer app (Client Key), Share Kit product, a universal link as the redirect | App approval before keys are issued; a separate Share Kit audit is unconfirmed | Yes: the OpenSDK pod/SPM + AppDelegate URL handling, via a local Expo module or a vetted third-party package |
| Save to camera roll | Yes | None | App Review only (purpose string) | No: `expo-media-library` `Asset.create` with `requestPermissionsAsync(true)` |

The system share sheet (`Share.open` / `expo-sharing`) also reaches all three apps with no registration. But it hands over a plain image: there is no direct Instagram Story canvas and no Snapchat Preview.

## Could not confirm from a primary source

1. Everything on developers.facebook.com, developers.snap.com, kit.snapchat.com and developers.tiktok.com was reachable only as search summaries. Those hosts must be allowed in the session's network settings to read them directly.
2. Meta's June 2026 "important update" to the Sharing to Stories flow: content unknown.
3. Whether Meta needs the iOS bundle ID on the Facebook app, or any Meta review, for Story sharing.
4. Official image size and format limits for Instagram Story backgrounds (720x1280, PNG or JPG are third-party figures).
5. The exact iOS URL for Snapchat Creative Kit Lite. `snapchat://creativekit/preview` is confirmed for Android only.
6. Snap's review guidelines, and any age or category rules for an app used by 13 to 18 year olds.
7. Whether the Snap SDK route needs `SCSDKRedirectUrl` for share-only use.
8. TikTok: any Story target, a separate Share Kit audit, the scopes needed, and whether add-only Photos access is enough to share an asset.
9. The new-architecture and Expo-plugin status of `tiktok-opensdk-react-native`.
10. Whether Apple explicitly allows saving to Photos on every share without a tap each time. No rule against it was found; none for it either.
11. Whether a Download badge may be shown for a TestFlight-only app. The licence wording points to no; TestFlight is not mentioned.
