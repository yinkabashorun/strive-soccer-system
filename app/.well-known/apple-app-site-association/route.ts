import { IOS_APP_ID } from "@/lib/elite/app-identity";

// The file an iPhone reads to learn that thestriveapp.com and the Strive
// Elite app belong together, so the phone offers a member's saved password
// on the app's sign-in screen and offers to save a new one (Apple's
// "shared web credentials"). The other half is the app's own entitlement
// (mobile/app.json, ios.associatedDomains); tests/app-shared.test.ts holds
// the two to the same app.
//
// Only passwords are shared. Links are not handed to the app from here
// (no "applinks"): a texted link still opens the website.

export const dynamic = "force-static";

export function GET(): Response {
  return new Response(JSON.stringify({ webcredentials: { apps: [IOS_APP_ID] } }), {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" },
  });
}
