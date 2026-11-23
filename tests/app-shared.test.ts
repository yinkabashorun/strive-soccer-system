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

  it("says why it asks for the camera and photos in the Capacitor app's own words", () => {
    const picker = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === "expo-image-picker")[1];
    expect(picker.cameraPermission).toBe(plistString("NSCameraUsageDescription"));
    expect(picker.photosPermission).toBe(plistString("NSPhotoLibraryUsageDescription"));
    expect(picker.microphonePermission).toBe(plistString("NSMicrophoneUsageDescription"));
    expect(app.ios.infoPlist.NSPhotoLibraryAddUsageDescription).toBe(plistString("NSPhotoLibraryAddUsageDescription"));
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
  });

  it("carries no secret", () => {
    for (const f of files(path.join(root, "mobile/src")).concat(files(path.join(root, "mobile/app")))) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/service_role|BEGIN PRIVATE KEY|sk_live_|sk_test_/);
    }
    expect(app.extra.supabaseKey).toMatch(/^sb_publishable_/);
  });
});
