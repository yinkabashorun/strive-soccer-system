import type { CapacitorConfig } from "@capacitor/cli";

// The native iPhone shell for Strive Elite.
//
// The app is the live site: the shell opens https://thestriveapp.com in the
// phone's own web view and adds what a browser tab cannot do (native push,
// haptics, a bundled offline page). There is no second copy of the app to
// keep in step, so a fix on the site is in the App Store app the same
// minute.
//
// appId is the bundle ID. It must match the identifier registered in the
// Apple Developer account before the first build (see docs/app-store).
const config: CapacitorConfig = {
  appId: "com.strivesoccer.elite",
  appName: "Strive Elite",
  webDir: "www",
  // Lets the site know, on the server too, that it is inside the app.
  appendUserAgent: "StriveEliteApp/1",
  backgroundColor: "#000000",
  ios: {
    contentInset: "never",
    backgroundColor: "#000000",
  },
  server: {
    url: "https://thestriveapp.com",
    // Shown when the site cannot be reached: a bundled page with Retry.
    errorPath: "offline.html",
    // Deliberately empty: only our own site ever gets the native bridge.
    allowNavigation: [],
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "banner", "list"],
    },
  },
};

export default config;
