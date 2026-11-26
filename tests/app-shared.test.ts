import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { AppMemberState } from "@/lib/elite/app-contract";
import type { MemberState } from "@/lib/elite/member-gate";
import { memberState } from "@/lib/elite/member-gate";

// The native iPhone app (mobile/) shares the site's pure rules straight
// from lib/elite ("@shared/*"). What is held here:
//   - every file the phone reaches that way, and everything it imports,
//     is pure: nothing from Next, the server, Node or a package the phone
//     does not have
//   - the member gate the server sends is the shape the phone expects
//   - the phone's build settings are the ones Apple needs and the ones the
//     Capacitor app already shipped with
//   - the example data (fixtures) can never reach a phone

const root = path.resolve(__dirname, "..");
const lib = path.join(root, "lib/elite");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    if (n === "node_modules" || n.startsWith("dist")) return [];
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

const IMPORT = /(?:import|export)\s+(type\s+)?(?:[^"';]*?\s+from\s+)?["']([^"']+)["']/g;
// The only packages a shared file may reach, and how.
const ALLOWED_EXTERNAL: Record<string, "any" | "type"> = { obscenity: "any", "@supabase/supabase-js": "type" };

function walk(start: string, seen = new Map<string, string[]>()): Map<string, string[]> {
  if (seen.has(start)) return seen;
  const src = readFileSync(start, "utf8");
  const problems: string[] = [];
  seen.set(start, problems);
  for (const m of src.matchAll(IMPORT)) {
    const typeOnly = Boolean(m[1]);
    const spec = m[2];
    if (spec.startsWith(".")) {
      const target = [".ts", ".tsx", "/index.ts"].map((e) => path.resolve(path.dirname(start), spec + e)).find(existsSync);
      if (!target || !target.startsWith(lib)) problems.push(`${spec} leaves lib/elite`);
      else walk(target, seen);
    } else {
      const allowed = ALLOWED_EXTERNAL[spec];
      if (!allowed || (allowed === "type" && !typeOnly)) problems.push(`imports ${spec}`);
    }
  }
  return seen;
}

describe("what the phone shares with the site", () => {
  const mobileFiles = [...files(path.join(root, "mobile/app")), ...files(path.join(root, "mobile/src"))];
  const shared = new Set<string>();
  for (const f of mobileFiles) {
    for (const m of readFileSync(f, "utf8").matchAll(/["']@shared\/([\w-]+)["']/g)) shared.add(m[1]);
  }

  it("the phone really does share the rules", () => {
    for (const name of ["session-flow", "set-timer", "experience", "quiz", "time-trained", "app-contract", "sign-in", "account"]) {
      expect(shared.has(name), name).toBe(true);
    }
  });

  it("every shared file and everything it imports is pure", () => {
    const seen = new Map<string, string[]>();
    for (const name of shared) {
      const file = path.join(lib, `${name}.ts`);
      expect(existsSync(file), name).toBe(true);
      walk(file, seen);
    }
    const bad = [...seen.entries()].filter(([, p]) => p.length).map(([f, p]) => `${path.relative(root, f)}: ${p.join(", ")}`);
    expect(bad).toEqual([]);
    // and none of it is a server file
    for (const f of seen.keys()) expect(readFileSync(f, "utf8"), f).not.toMatch(/^["']use (server|client)["']/m);
  });

  // A shared file sits outside mobile/, so on its own TypeScript looks for
  // its packages in the SITE's node_modules. The Mac that builds the app
  // installs only mobile/'s packages, so each package a shared file may
  // reach has to be one the app installs AND be pointed at the app's copy
  // (the first native TestFlight run failed on exactly this, Nov 23 2026).
  it("every package a shared file may reach is the app's own copy", () => {
    const pkg = JSON.parse(readFileSync(path.join(root, "mobile/package.json"), "utf8"));
    const paths = JSON.parse(readFileSync(path.join(root, "mobile/tsconfig.json"), "utf8")).compilerOptions.paths;
    for (const name of Object.keys(ALLOWED_EXTERNAL)) {
      expect(pkg.dependencies[name], `${name} in mobile/package.json`).toBeTruthy();
      expect(paths[name], `${name} in mobile/tsconfig.json paths`).toEqual([`./node_modules/${name}`]);
    }
  });

  // The other direction of the same trap: the machine that runs the SITE's
  // tests has only the site's packages, and a file under mobile/ is read
  // with mobile/'s own settings, which need the app's packages. A site test
  // may read the app's files as text; it never imports them (code both
  // sides need lives in lib/elite). A test that did passed here and failed
  // on GitHub and Vercel, Nov 23 2026.
  it("no site test imports the app's code", () => {
    const tests = readdirSync(path.join(root, "tests")).filter((n) => n.endsWith(".ts"));
    const bad = tests.filter((n) => /from\s+["'][^"']*\/mobile\//.test(readFileSync(path.join(root, "tests", n), "utf8")));
    expect(bad).toEqual([]);
  });

  it("the gate the server sends is the shape the phone reads", () => {
    const s: MemberState = memberState({ role: "player", playerId: "p", isFree: false, consentDue: true, player: null });
    const forPhone: AppMemberState = s; // fails to compile if the two drift
    expect(forPhone.kind).toBe("consent");
  });
});

describe("the phone's build", () => {
  const app = JSON.parse(readFileSync(path.join(root, "mobile/app.json"), "utf8")).expo;
  const capacitorPlist = readFileSync(path.join(root, "native/ios/App/App/Info.plist"), "utf8");
  const plistString = (key: string) => capacitorPlist.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`))?.[1];

  // Saved passwords on the sign-in screen: the iPhone offers them only when
  // the app names the site and the site names the app. The two halves are
  // held to the same app here.
  // Since Nov 26 2026 the same file also hands the app ONE page of the
  // site, the invite page (/join: a teammate's link, a club's link, a
  // player's QR code), so an invite opens the app when it is installed.
  // What the app does with it is held in tests/add-friend.test.ts.
  it("the app and the site name each other, for saved passwords and for an invite link, and nothing else", async () => {
    const { APP_DOMAIN, IOS_APP_ID, IOS_BUNDLE_ID } = await import("@/lib/elite/app-identity");
    expect(IOS_BUNDLE_ID).toBe(app.ios.bundleIdentifier);
    expect(app.ios.associatedDomains).toEqual([`webcredentials:${APP_DOMAIN}`, `applinks:${APP_DOMAIN}`]);
    const { GET } = await import("@/app/.well-known/apple-app-site-association/route");
    const res = GET();
    expect(res.headers.get("content-type")).toBe("application/json");
    // passwords, and the invite page only: no other page of the site is handed to the app
    expect(await res.json()).toEqual({
      applinks: { details: [{ appIDs: [IOS_APP_ID], components: [{ "/": "/join" }, { "/": "/join/*" }] }] },
      webcredentials: { apps: [IOS_APP_ID] },
    });
    // the sign-in fields say what they are, so the phone knows where a
    // saved password goes
    const signIn = readFileSync(path.join(root, "mobile/app/sign-in.tsx"), "utf8");
    expect(signIn).toContain('textContentType="username"');
    expect(signIn).toContain('textContentType="password"');
  });

  it("is the same App Store app, iPhone only, portrait, dark", () => {
    expect(app.ios.bundleIdentifier).toBe("com.strivesoccer.elite");
    expect(app.name).toBe("Strive Elite");
    expect(app.ios.supportsTablet).toBe(false);
    expect(app.orientation).toBe("portrait");
    expect(app.userInterfaceStyle).toBe("dark");
    expect(app.ios.infoPlist.ITSAppUsesNonExemptEncryption).toBe(false);
    expect(app.ios.config.usesNonExemptEncryption).toBe(false);
    expect(app.ios.entitlements["aps-environment"]).toBe("production");
  });

  it("runs on iOS 16.4 and later", () => {
    const props = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === "expo-build-properties");
    expect(props[1].ios.deploymentTarget).toBe("16.4");
  });

  // The sentence iOS shows in each permission box. It says what THIS app
  // does with it, in the player's words: two photos when they train and a
  // profile photo. Nothing about clips, filming or a coach (the first shell
  // loaded the website, which has those; this app does not).
  it("says why it asks for the camera and photos, and only what this app does with them", () => {
    const picker = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === "expo-image-picker")[1];
    expect(picker.cameraPermission).toBe(
      "Strive Elite uses the camera for your start photo and your finish photo when you train, and for your profile photo.",
    );
    expect(picker.photosPermission).toBe("Strive Elite opens your photo library so you can choose your profile photo.");
    expect(app.ios.infoPlist.NSPhotoLibraryAddUsageDescription).toBe(
      "Strive Elite saves the picture of your week to your photo library when you choose Save Image.",
    );
    for (const said of [picker.cameraPermission, picker.photosPermission, app.ios.infoPlist.NSPhotoLibraryAddUsageDescription]) {
      expect(said).not.toMatch(/coach|clip|film|video|\u2014/i);
    }
    // the microphone sentence has to exist (the audio library is linked),
    // and it is the first shell's own; this app never asks for it
    expect(picker.microphonePermission).toBe(plistString("NSMicrophoneUsageDescription"));
  });

  it("never asks for the microphone, and only ever picks a still photo", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const f = path.join(dir, e.name);
        if (e.isDirectory()) walk(f);
        else if (/\.tsx?$/.test(e.name)) files.push(f);
      }
    };
    walk(path.join(process.cwd(), "mobile/app"));
    walk(path.join(process.cwd(), "mobile/src"));
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/requestRecordingPermissions|requestMicrophonePermissions/);
      for (const m of src.matchAll(/mediaTypes:\s*\[([^\]]*)\]/g)) expect(m[1], f).toBe('"images"');
    }
  });

  it("tracks nobody and plays nothing in the background", () => {
    expect(app.ios.privacyManifests.NSPrivacyTracking).toBe(false);
    expect(app.ios.privacyManifests.NSPrivacyTrackingDomains).toEqual([]);
    const audio = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === "expo-audio")[1];
    expect(audio.enableBackgroundPlayback).toBe(false);
    const video = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === "expo-video")[1];
    expect(video.supportsBackgroundPlayback).toBe(false);
    expect(JSON.stringify(app)).not.toContain("UIBackgroundModes");
  });

  it("never ships the example data, and builds without EAS", () => {
    const wf = readFileSync(path.join(root, ".github/workflows/ios-native-testflight.yml"), "utf8");
    expect(wf).not.toContain("EXPO_PUBLIC_FIXTURES");
    expect(wf).not.toMatch(/eas (build|submit)|eas-cli|expo-github-action/i);
    expect(wf).toMatch(/workflow_dispatch:/);
    expect(wf).not.toMatch(/^\s+(push|pull_request|schedule):/m);
    // automatic signing with the API key, never a hard-coded identity (run #3)
    expect(wf).toContain("-allowProvisioningUpdates");
    const steps = wf.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");
    expect(steps).not.toContain("Apple Distribution");
    expect(steps).not.toContain("CODE_SIGN_IDENTITY");
    expect(wf).toContain("<string>app-store-connect</string>");
    expect(readFileSync(path.join(root, "mobile/src/config.ts"), "utf8")).toContain('process.env.EXPO_PUBLIC_FIXTURES === "1"');
    // the build number is typed every time: a default goes stale after each
    // build and Apple refuses a repeated number only after the whole compile
    const input = wf.slice(wf.indexOf("build_number:"), wf.indexOf("permissions:"));
    expect(input).toContain("required: true");
    expect(input).not.toMatch(/default:/);
    expect(input).not.toMatch(/\d+ or more/);
  });

  // The simulator check on GitHub's Mac (ios-simulator-screens.yml) builds
  // the app WITH the example data so every screen can be looked at. It must
  // stay a look and nothing more: no Apple key, nothing archived or
  // uploaded, never from main; and the example member can only be chosen
  // where the example data is on.
  it("the simulator check shows example data and ships nothing", () => {
    const sim = readFileSync(path.join(root, ".github/workflows/ios-simulator-screens.yml"), "utf8");
    const steps = sim.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");
    expect(steps).toContain('EXPO_PUBLIC_FIXTURES: "1"');
    expect(steps).toContain("-sdk iphonesimulator");
    expect(steps).not.toMatch(/secrets\.(ASC_|APPLE_|APNS_)/);
    expect(steps).not.toMatch(/exportArchive|xcodebuild archive|app-store-connect|TestFlight/);
    expect(steps).toMatch(/branches: \["claude\/\*\*"\]/);
    expect(steps).not.toMatch(/branches:.*main/);
    // both TestFlight workflows stay free of the example data
    for (const f of ["ios-native-testflight.yml", "ios-testflight.yml"]) {
      expect(readFileSync(path.join(root, ".github/workflows", f), "utf8"), f).not.toContain("FIXTURES");
    }
    // every example member the script and the flows ask for is one the app knows
    const fixtures = readFileSync(path.join(root, "mobile/src/api/fixtures.ts"), "utf8");
    const known = (fixtures.match(/FIXTURE_STATES = \[([^\]]+)\]/)?.[1] ?? "").match(/[a-z_]+/g) ?? [];
    expect(known).toContain("signedout");
    const shots = readFileSync(path.join(root, "mobile/sim/shots.sh"), "utf8");
    const asked = new Set<string>();
    for (const m of shots.matchAll(/^[\w-]+\|([a-z_]+)\|/gm)) asked.add(m[1]);
    for (const n of readdirSync(path.join(root, "mobile/sim/flows"))) {
      const flow = readFileSync(path.join(root, "mobile/sim/flows", n), "utf8");
      expect(flow, n).toContain("appId: com.strivesoccer.elite");
      for (const m of flow.matchAll(/fixtureState: ([a-z_]+)/g)) asked.add(m[1]);
    }
    expect(asked.size).toBeGreaterThan(4);
    for (const state of asked) expect(known, state).toContain(state);
    // the member is read from the launch argument only inside the example file
    const elsewhere = files(path.join(root, "mobile/src"))
      .concat(files(path.join(root, "mobile/app")))
      .filter((f) => !f.endsWith("fixtures.ts") && readFileSync(f, "utf8").includes("fixtureState"));
    expect(elsewhere).toEqual([]);
  });

  // The first simulator run (Nov 23 2026) opened each screen with the
  // simulator's "open this link" command. iOS answered with an "Open in
  // Strive Elite?" box that never went away: fifteen pictures of that box,
  // and every tapping flow blocked by it, while the run still read as passed.
  it("the simulator check opens a screen by launch argument, never by link", () => {
    const sim = readFileSync(path.join(root, ".github/workflows/ios-simulator-screens.yml"), "utf8");
    const shots = readFileSync(path.join(root, "mobile/sim/shots.sh"), "utf8");
    const flows = readdirSync(path.join(root, "mobile/sim/flows")).map((n) => readFileSync(path.join(root, "mobile/sim/flows", n), "utf8"));
    const live = (s: string) => s.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");
    for (const s of [sim, shots, ...flows]) {
      expect(live(s)).not.toMatch(/simctl openurl|openLink|striveelite:\/\//);
    }
    expect(live(shots)).toContain("-fixtureRoute");
    // a failed tapping pass must fail its step (its output is piped to a log)
    const maestro = sim.slice(sim.indexOf("Taps and typing (Maestro)"), sim.indexOf("Shrink the pictures"));
    expect(maestro).toContain("set -o pipefail");
    // every screen asked for has the shape the app accepts, and is a screen the app has
    const fixtures = readFileSync(path.join(root, "mobile/src/api/fixtures.ts"), "utf8");
    const shape = new RegExp(fixtures.match(/FIXTURE_ROUTE = \/(.+)\/;/)?.[1] ?? "never^");
    const asked = new Set<string>();
    for (const m of shots.matchAll(/^[\w-]+\|[a-z_]+\|([^|\n]+)\|\d+(\|film)?$/gm)) if (m[1] !== "-") asked.add(m[1]);
    for (const f of flows) for (const m of f.matchAll(/fixtureRoute: (\S+)/g)) asked.add(m[1]);
    expect(asked.size).toBeGreaterThan(8);
    const appDir = path.join(root, "mobile/app");
    const has = (dir: string, name: string) => readdirSync(dir).some((n) => n === name || n === `${name}.tsx`);
    for (const route of asked) {
      expect(route, route).toMatch(shape);
      const first = route.split(/[/?]/)[0];
      expect(has(appDir, first) || has(path.join(appDir, "(tabs)"), first) || has(path.join(appDir, "(free)"), first), route).toBe(true);
    }
    // the screen is read from the launch argument only inside the example
    // file, and opened only where the example data is on
    const readers = files(path.join(root, "mobile/src"))
      .concat(files(path.join(root, "mobile/app")))
      .filter((f) => !f.endsWith("fixtures.ts") && /Settings\??\.get|"fixtureRoute"/.test(readFileSync(f, "utf8")));
    expect(readers).toEqual([]);
    const layout = readFileSync(path.join(appDir, "_layout.tsx"), "utf8");
    expect(layout).toMatch(/if \(!FIXTURES \|\|[^\n]+\) return;\n\s+fixtureOpened\.current = true;\n\s+const route = fixtureRoute\(\);/);
    expect(layout.match(/fixtureRoute\(/g)?.length).toBe(1);
  });

  it("carries no secret", () => {
    for (const f of files(path.join(root, "mobile/src")).concat(files(path.join(root, "mobile/app")))) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/service_role|BEGIN PRIVATE KEY|sk_live_|sk_test_/);
    }
    expect(app.extra.supabaseKey).toMatch(/^sb_publishable_/);
  });
});
