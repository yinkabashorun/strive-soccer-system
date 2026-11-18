# Strive Elite on the App Store: the checklist

Written Nov 18 2026 from four research passes (Apple's App Review
Guidelines and developer documentation, the Capacitor documentation, the
FTC's COPPA rule and the app-store age laws, Apple's Human Interface
Guidelines). Rules change: re-read the linked page before relying on a
line here. Anything marked UNCONFIRMED could not be verified from the
source itself. Nothing in this file is legal advice.

Status words:
- BUILT: in the repository and tested.
- BUILT, NOT PROVEN: written, but it can only be proven with an Apple
  Developer account, a build, or a real iPhone.
- COACH YINKA: a decision or an account only he can provide.
- NOT BUILT: named so it is not forgotten.

## 1. What the app is, in Apple's terms

The App Store app is a native iPhone shell (`native/`, Capacitor 8) that
opens thestriveapp.com and adds what a browser tab cannot: native push,
haptics, a bundled offline screen. One codebase. A fix on the site is in
the app the same minute; only a change to the shell itself needs a new
build and review.

## 2. The one real rejection risk: guideline 3.1.1 (payments)

Apple requires in-app purchase for digital content unlocked inside an
app, and names "license keys" among the things an app may not use
instead. Strive Elite is paid for outside the app and unlocked by an
invite code. Coaching apps with sign-in-only access HAVE been rejected
under this rule (reviewers wrote "digital content purchased outside the
app"); others pass as person-to-person services. The exemptions:
- 3.1.3(d): real-time person-to-person services between two people
  (tutoring, coaching) may use other payment methods. One-to-few and
  one-to-many real-time services must use in-app purchase.
- 3.1.3(e): goods and services consumed outside the app.

Where Strive Elite stands: the week is built for one player by a coach,
clips are answered by a coach, the monthly call is 1:1 (fits 3.1.3(d));
the weekly Film Room is a group call and the course library is digital
content (these are what a reviewer could point at).

What is already done to lower the risk (BUILT):
- No price, no checkout and no "buy on our site" anywhere inside the
  member app.
- Inside the native app the sign-in screen is sign-in only: the "Create
  an account" link (the invite-code form) is not shown
  (`lib/elite/native-request.ts`, `LoginForm`).

COACH YINKA, before submitting:
- The review notes should describe the product as 1:1 remote coaching
  sold on a call, with the app as the tool the coach and player use.
- The old public $97 page at /dribbling-course is a price page for
  digital content on the same domain. A reviewer has cited a website
  pricing page in a rejection of a similar app. Decide whether it stays.
- The Dribbling Transformation card opens a password-gated site on
  another domain. In review this reads as unfinished or as content
  unlocked elsewhere. Decide: switch that course back to the in-app
  pages (they are still on the row), or hide the card inside the app.
- Fallback if Apple refuses: sell the subscription through in-app
  purchase on iPhone (Apple keeps 15% under the Small Business Program,
  UNCONFIRMED for this account until enrolled), or publish for the United
  States storefront only and use the external-purchase entitlement.
  Neither is built.

## 3. Review rules and where each one stands

| Rule | What it asks | Status |
|---|---|---|
| 2.1 | A working demo account for the reviewer, app complete, no placeholder content | COACH YINKA: create one player login and one coach login for review. The built-in demo tour does not replace an account without prior approval. |
| 2.3.7 | Name 30 characters or fewer, no prices in the name, subtitle or screenshots | "Strive Elite" fits. Screenshots NOT BUILT. |
| 2.5.19 | No hidden or undocumented features | The coach side is behind a coach login: say so in the review notes and give the coach demo login. |
| 4.2 | More than a repackaged website | BUILT, NOT PROVEN: native push, haptics on every tick, offline screen, camera and photo library for clips, full-screen session player, no browser chrome. |
| 4.5.4 | Push never required, an opt-out inside the app | BUILT: Account > Notifications on/off (web and native). |
| 5.1.1(i) | Privacy policy linked inside the app, with retention and deletion | BUILT: /privacy from the Account page. The policy states no retention periods yet (COACH YINKA, see section 6). Not lawyer-reviewed. |
| 5.1.1(v) | Account deletion inside the app, easy to find | BUILT: Account > Delete my account (password, then everything is removed, files included). Also explained at /support#delete for the web. |
| 5.1.2(i) | Sharing personal data with a third-party AI must be disclosed, with explicit permission | COACH YINKA: the plan builder sends training data to an outside AI service. The privacy policy discloses automated tools. Apple's wording asks for explicit permission; how to ask without breaking the no-"AI" copy rule is his call. |
| 1.2 | User content needs a way to report and a published contact | BUILT: Account > Report a concern, /support. Clips are private between a family and the coaches, there is no public feed. |
| 5.1.4 / 2.3.8 | Do not present the app as made for children, do not choose the Kids Category | Category: Sports (or Health & Fitness). Never Kids. |
| 4.8 | Sign in with Apple if third-party sign-in is offered | Not applicable: email and password only. |

## 4. Minors (members are 12 to 15)

- COPPA (amended rule, compliance date April 22 2026): one member is 12.
  A child under 13 who uploads clips, chats, or has a push token needs
  verifiable parental consent on file. Today the parent signs up and
  holds the account, which is the right shape, but no consent record is
  kept. NOT BUILT: a dated consent line at sign-up, stored. COACH YINKA:
  confirm with a lawyer.
- Posting a player's clip publicly (Instagram, the community) needs its
  own parent consent. The progress-clip tick exists; its wording is
  still parked.
- Texas SB 2420 (in force since June 2026) and similar state laws:
  Apple's Declared Age Range API and consent signals. NOT BUILT (native
  Swift work, needs the Apple account). Utah and Louisiana are delayed
  to 2027. UNCONFIRMED how Apple enforces this for a small app at review.
- Age rating questionnaire: expect 4+ or 9+. User-generated content
  (private clips, chat with a coach) must be declared.

## 5. App privacy label (App Store Connect)

Declare, all "linked to the user", none used for tracking:
- Contact info: name, email, phone number.
- User content: photos or videos (clips), customer support (messages),
  other user content (check-ins, notes).
- Identifiers: user ID, device ID (the push token).
- Usage data: product interaction (drills completed).
- Diagnostics: crash and error data (the in-app error log).
Tracking: No. The Meta Pixel runs on /demo only, never inside the app.

## 6. COACH YINKA: decisions and accounts, in order

1. Apple Developer Program, $99 a year. Individual shows his own name as
   the seller; Organization shows the business name and needs a legal
   entity and a D-U-N-S number. Then the bundle ID
   `com.strivesoccer.elite` (change it in `native/capacitor.config.ts`
   and the Xcode project if he wants another; one test holds them equal).
2. The seven values, into Vercel and GitHub secrets, never into this
   repository: `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_P8` (Vercel, for
   push); `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_P8`
   (GitHub, for the TestFlight build).
3. The 3.1.1 decisions in section 2.
4. A written retention schedule (how long clips, messages and deleted
   accounts' payment records are kept) and a lawyer's read of the
   privacy policy and terms.
5. Review logins: one player, one coach.
6. Screenshots: 6.9-inch iPhone (1320 x 2868). Taken from the real app
   once he approves the screens.
7. EU: declare trader status in App Store Connect, or do not sell in the
   EU storefronts.

## 7. The native shell (`native/`)

BUILT, NOT PROVEN (no Apple account yet, so nothing here has ever been
compiled or installed on a phone):
- `native/capacitor.config.ts`: opens https://thestriveapp.com, user
  agent `StriveEliteApp/1`, bundled offline page, the native bridge given
  to no other site.
- `native/ios/`: the Xcode project, generated on Linux. iPhone only,
  portrait, iOS 15 or later. Permission texts for camera, microphone and
  photo library. Push entitlement and the two AppDelegate hooks. App icon
  and launch image made from the 512 px logo (a sharper source would be
  better).
- Native push: the app asks, the phone returns a device token, the site
  saves it (`elite_native_push_tokens`, migration 067, applied), and every
  notification the app already sends also goes to Apple's push service
  (`lib/elite/apns.ts`). Off until the three `APNS_` values are set.
- `.github/workflows/ios-testflight.yml`: builds and uploads to
  TestFlight on a GitHub Mac runner. Starts by hand only. No Mac needed.

Known gaps to close on the first real build:
- Xcode must be version 26 (Apple's requirement since April 2026); the
  workflow asks for the `macos-26` runner.
- An app-level privacy manifest (`PrivacyInfo.xcprivacy`) may be asked
  for; Capacitor ships its own. Add it in Xcode if the upload warns.
- Universal links (a texted link opening the app instead of Safari) need
  the Team ID in `/.well-known/apple-app-site-association`. NOT BUILT.
- Capacitor documents `server.url` as meant for development. Shipping
  with it is common but it is the weakest point under guideline 4.2; the
  native features above are the answer to it.
- Keeping the screen awake during a session uses the browser's wake lock,
  UNCONFIRMED inside the native web view; a native plugin is the fix if
  it does not hold.
- Android: not started. The same shell can be built for Google Play
  (account deletion on the web is already at /support#delete).

## 8. Sources

- App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Account deletion: https://developer.apple.com/support/offering-account-deletion-in-your-app/
- App privacy details: https://developer.apple.com/app-store/app-privacy-details/
- Human Interface Guidelines (haptics, motion, tab bars): https://developer.apple.com/design/human-interface-guidelines/
- Capacitor: https://capacitorjs.com/docs/config and https://capacitorjs.com/docs/apis/push-notifications
- APNs provider API: https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns
- COPPA rule: https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa
