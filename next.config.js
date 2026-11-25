/** @type {import('next').NextConfig} */

// The App Store app adds this to its user agent (NATIVE_UA_TOKEN in
// lib/elite/app-links.ts; tests/demo-never-in-app.test.ts holds the two
// to the same words).
const NATIVE_APP_HEADER = { type: "header", key: "user-agent", value: ".*StriveEliteApp/.*" };

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // The weekly card (app/api/elite/tracker/card) reads its two brand fonts
  // from disk; this ships them with that route on the server.
  experimental: {
    // How long a screen the phone already has is shown again without
    // asking the server (Nov 23 2026, "when im clicking things there is a
    // delay"). dynamic: a screen the member opened; static: a screen
    // fetched ahead of the tap (every tab is, MemberNav). Anything a
    // member does (Done on a drill, Extra Work, a check-in, a message)
    // runs a server action that calls revalidatePath, and that empties
    // this whole cache at once, so nothing is ever shown stale after an
    // action; coming back to the app after a minute refreshes the screen
    // too (FreshOnReturn). tests/app-feel.test.ts holds these numbers.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
    outputFileTracingIncludes: {
      "/api/elite/tracker/card": ["./lib/elite/fonts/*.ttf"],
      // the iPhone app's Share my week card (lib/elite/week-card-image.ts)
      "/api/app/free/week/card": ["./lib/elite/fonts/*.ttf"],
    },
  },
  // The old $97 dribbling course sales page was retired Nov 18 2026. Any
  // old link or ad that still points at it lands on the Strive Elite page.
  //
  // That page (/demo) carries the Meta pixel and is never drawn inside the
  // App Store app, so from the app the same old links go to the app's
  // front door. The app's rules come first: the first match wins.
  async redirects() {
    return [
      { source: "/dribbling-course", has: [NATIVE_APP_HEADER], destination: "/", permanent: false },
      { source: "/dribbling-course/:path*", has: [NATIVE_APP_HEADER], destination: "/", permanent: false },
      { source: "/dribbling-course", destination: "/demo", permanent: true },
      { source: "/dribbling-course/:path*", destination: "/demo", permanent: true },
    ];
  },
};

module.exports = nextConfig;
