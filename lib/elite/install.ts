// Home-screen install and push notifications: the pure rules.
//
// Why this exists (Nov 18 2026): push shipped Sept 26 and by Nov 18 not one
// device had ever signed up. Two causes. (1) The app had no web manifest, so
// "Add to Home Screen" made a bookmark, not an installed app. (2) On an
// iPhone the browser only offers push to a web app that IS installed on the
// home screen, so in Safari the "Turn on notifications" card could never
// appear and nothing told the family why.
//
// The decision of what to show a member lives here, with no browser or
// database in it, so it can be unit-tested and cannot drift.

export type NotifyPermission = "default" | "granted" | "denied" | "unsupported";

export type InstallEnv = {
  userAgent: string;
  // Touch points separate an iPad (reports itself as a Mac) from a real Mac.
  maxTouchPoints: number;
  // True when the page runs as the installed app, not in a browser tab.
  standalone: boolean;
  // True when this browser offers Web Push here (service worker + PushManager).
  hasPush: boolean;
  permission: NotifyPermission;
};

// What the notifications card should do for this member, right now.
//   enable       ask them to turn notifications on (one tap)
//   install_ios  iPhone or iPad in a browser tab: show how to add the app to
//                the home screen, the only place Apple offers push
//   resync       already allowed: quietly make sure this device is on file
//   none         nothing to show (blocked, unsupported, or nothing to do)
export type NotifyStep = "enable" | "install_ios" | "resync" | "none";

export function isIos(userAgent: string, maxTouchPoints = 0): boolean {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

export function notifyStep(env: InstallEnv): NotifyStep {
  if (env.hasPush) {
    if (env.permission === "granted") return "resync";
    if (env.permission === "default") return "enable";
    return "none";
  }
  // No push offered here. On an Apple phone or tablet in a browser tab the
  // fix is the home screen; an installed app that still has no push is an
  // older iOS and there is nothing to offer.
  if (isIos(env.userAgent, env.maxTouchPoints) && !env.standalone) {
    return "install_ios";
  }
  return "none";
}

// The coach dashboard's one-line read on push (coach-only wording).
export type PushStatus = {
  // Both VAPID keys are set in the deploy environment.
  configured: boolean;
  // Devices on file, and how many different players they belong to.
  devices: number;
  playersOn: number;
  // Active or trialing players who could have it on.
  playersTotal: number;
};

export function pushStatusLine(s: PushStatus): { ok: boolean; line: string } {
  if (!s.configured) {
    return {
      ok: false,
      line:
        "Off. The two push keys are not set in Vercel (NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY), so no member can turn notifications on. Texts are not affected.",
    };
  }
  if (s.devices === 0) {
    return {
      ok: false,
      line: `Ready, but none of your ${s.playersTotal} active players has turned notifications on yet. On an iPhone they add the app to the home screen first; the app shows them how.`,
    };
  }
  const devices = s.devices === 1 ? "1 device" : `${s.devices} devices`;
  return {
    ok: true,
    line: `On for ${s.playersOn} of ${s.playersTotal} active players (${devices}).`,
  };
}
