import { APP_LINK_PATHS, IOS_APP_ID } from "@/lib/elite/app-identity";

// The file an iPhone reads to learn that thestriveapp.com and the Strive
// Elite app belong together. The other half is the app's own entitlement
// (mobile/app.json, ios.associatedDomains); tests/app-shared.test.ts holds
// the two to the same app.
//
// Two things are shared, and only these two:
//   webcredentials   the phone offers a member's saved password on the
//                    app's sign-in screen and offers to save a new one
//                    (Apple's "shared web credentials").
//   applinks         an INVITE link opens the app when the app is
//                    installed (universal links): the page /join, where a
//                    teammate's link (?ref=CODE) and a club's (?club=CODE)
//                    land, and nothing else on the site. A player's QR
//                    code holds that same link. What the app does with it
//                    is lib/elite/friend-link.ts: one screen that asks
//                    first, never a request sent by the link itself.
//                    With the app not installed the link opens this
//                    website's own /join page, as it always did.

export const dynamic = "force-static";

export function GET(): Response {
  const body = {
    applinks: {
      details: [{ appIDs: [IOS_APP_ID], components: APP_LINK_PATHS.map((path) => ({ "/": path })) }],
    },
    webcredentials: { apps: [IOS_APP_ID] },
  };
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" },
  });
}
