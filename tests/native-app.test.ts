import { describe, expect, it } from "vitest";
import { generateKeyPairSync, verify } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import {
  DEFAULT_BUNDLE_ID,
  apnsBody,
  apnsConfig,
  apnsJwt,
  apnsShouldForget,
  cleanDeviceToken,
} from "../lib/elite/apns";
import { nativePushStep, notificationPath } from "../lib/elite/native-push";
import { NATIVE_UA_TOKEN, isNativeUserAgent } from "../lib/elite/native-request";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// The App Store app (native/) and native push. Nothing here can prove the
// app builds or that Apple delivers a push (that needs the Apple Developer
// account); these hold the rules and the files in the shape Apple needs.

describe("Apple push: the provider token", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const p8 = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  it("is a JWT Apple accepts: ES256, the key id, the team id, a valid signature", () => {
    const jwt = apnsJwt({ keyId: "KEY1234567", teamId: "TEAM123456", p8 }, 1_800_000_000);
    const [h, c, sig] = jwt.split(".");
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ alg: "ES256", kid: "KEY1234567" });
    expect(JSON.parse(Buffer.from(c, "base64url").toString())).toEqual({ iss: "TEAM123456", iat: 1_800_000_000 });
    const raw = Buffer.from(sig, "base64url");
    expect(raw.length).toBe(64); // raw r||s, not DER
    expect(
      verify("sha256", Buffer.from(`${h}.${c}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, raw)
    ).toBe(true);
  });

  it("is off until the three keys are set, and reads a key pasted on one line", () => {
    expect(apnsConfig({})).toBeNull();
    expect(apnsConfig({ APNS_KEY_ID: "K", APNS_TEAM_ID: "T" })).toBeNull();
    const cfg = apnsConfig({ APNS_KEY_ID: " K ", APNS_TEAM_ID: "T", APNS_P8: p8.replace(/\n/g, "\\n") });
    expect(cfg?.keyId).toBe("K");
    expect(cfg?.p8).toBe(p8.trim());
    expect(cfg?.bundleId).toBe(DEFAULT_BUNDLE_ID);
    // the pasted key still signs
    expect(apnsJwt(cfg!, 1).split(".")).toHaveLength(3);
  });
});

describe("Apple push: the message and dead devices", () => {
  it("carries the title, the body and the screen to open", () => {
    expect(JSON.parse(apnsBody({ title: "Week 4 is live", body: "Open it.", url: "/dashboard" }))).toEqual({
      aps: { alert: { title: "Week 4 is live", body: "Open it." }, sound: "default" },
      url: "/dashboard",
    });
    expect(JSON.parse(apnsBody({ title: "a", body: "b" }))).not.toHaveProperty("url");
  });

  it("forgets a device only when Apple says it is gone for good", () => {
    expect(apnsShouldForget(410, "Unregistered")).toBe(true);
    expect(apnsShouldForget(400, "BadDeviceToken")).toBe(true);
    expect(apnsShouldForget(400, "DeviceTokenNotForTopic")).toBe(true);
    expect(apnsShouldForget(400, "PayloadTooLarge")).toBe(false);
    expect(apnsShouldForget(403, "ExpiredProviderToken")).toBe(false);
    expect(apnsShouldForget(429, "TooManyRequests")).toBe(false);
    expect(apnsShouldForget(500, null)).toBe(false);
    expect(apnsShouldForget(0, null)).toBe(false);
  });

  it("accepts only a real device token", () => {
    const t = "a".repeat(64);
    expect(cleanDeviceToken(t)).toBe(t);
    expect(cleanDeviceToken(` ${"AB".repeat(32)} `)).toBe("ab".repeat(32));
    expect(cleanDeviceToken("a".repeat(63))).toBeNull();
    expect(cleanDeviceToken(`${"a".repeat(63)}/`)).toBeNull();
    expect(cleanDeviceToken("../../3/device/x")).toBeNull();
    expect(cleanDeviceToken(null)).toBeNull();
    expect(cleanDeviceToken(42)).toBeNull();
  });
});

describe("notifications inside the app", () => {
  it("asks once, stays quiet when allowed, and respects off", () => {
    expect(nativePushStep("prompt", null)).toBe("enable");
    expect(nativePushStep("prompt-with-rationale", null)).toBe("enable");
    expect(nativePushStep("granted", null)).toBe("resync");
    expect(nativePushStep("denied", null)).toBe("blocked");
    // turned off in the app: never re-registered behind the member's back
    expect(nativePushStep("granted", "off")).toBe("off");
    expect(nativePushStep("prompt", "off")).toBe("off");
    expect(nativePushStep(undefined, null)).toBe("enable");
  });

  it("a tapped notification only ever opens our own site", () => {
    expect(notificationPath("/dashboard")).toBe("/dashboard");
    expect(notificationPath("https://thestriveapp.com/film?x=1")).toBe("/film?x=1");
    expect(notificationPath("//evil.example/x")).toBeNull();
    expect(notificationPath("https://evil.example/")).toBeNull();
    expect(notificationPath("https://thestriveapp.com.evil.example/")).toBeNull();
    expect(notificationPath("https://thestriveapp.com//evil.example")).toBeNull();
    expect(notificationPath("javascript:alert(1)")).toBeNull();
    expect(notificationPath("/\\evil.example")).toBeNull();
    expect(notificationPath(undefined)).toBeNull();
  });

  it("every push goes to browsers and to phones with the app", () => {
    const push = read("lib/elite/push.ts");
    expect(push).toContain("elite_push_subscriptions");
    expect(push).toContain("elite_native_push_tokens");
    expect(push).toContain("sendApns(");
    // one sender: no caller talks to Apple on its own
    for (const f of ["lib/elite/coach-actions.ts", "lib/elite/unlock.ts", "lib/elite/film-room-actions.ts"]) {
      expect(read(f)).not.toContain("sendApns");
    }
  });

  it("the token table is locked down like the web push table", () => {
    const sql = read("supabase/migrations/067_native_push_tokens.sql");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("elite_owns_player(player_id)");
    expect(sql).toContain("on delete cascade"); // deleting an account removes its phones
    expect(sql).toMatch(/token\s+text not null unique/);
  });

  it("the member can turn them on and off from the Account page in the app", () => {
    const settings = read("components/elite/DeviceSettings.tsx");
    expect(settings).toContain("enableNativePush");
    expect(settings).toContain("disableNativePush");
  });
});

describe("the native shell (native/)", () => {
  const config = read("native/capacitor.config.ts");
  const plist = read("native/ios/App/App/Info.plist");
  const project = read("native/ios/App/App.xcodeproj/project.pbxproj");

  it("opens our site and gives the native bridge to nobody else", () => {
    expect(config).toContain('url: "https://thestriveapp.com"');
    expect(config).toMatch(/allowNavigation:\s*\[\]/);
    expect(config).toContain('errorPath: "offline.html"');
  });

  it("tells the server it is the app, in the words the server looks for", () => {
    expect(config).toContain(`appendUserAgent: "${NATIVE_UA_TOKEN}1"`);
    expect(isNativeUserAgent(`Mozilla/5.0 (iPhone) AppleWebKit/605 ${NATIVE_UA_TOKEN}1`)).toBe(true);
    expect(isNativeUserAgent("Mozilla/5.0 (iPhone) AppleWebKit/605 Safari/604")).toBe(false);
    expect(isNativeUserAgent(null)).toBe(false);
  });

  it("uses one bundle ID everywhere", () => {
    expect(config).toContain(`appId: "${DEFAULT_BUNDLE_ID}"`);
    const ids = [...project.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(id).toBe(DEFAULT_BUNDLE_ID);
  });

  it("is an iPhone app, portrait, with a reason for every permission it asks", () => {
    expect(project).not.toContain('TARGETED_DEVICE_FAMILY = "1,2"');
    expect(project).toContain("TARGETED_DEVICE_FAMILY = 1;");
    expect(plist).not.toContain("UIInterfaceOrientationLandscape");
    for (const key of [
      "NSCameraUsageDescription",
      "NSMicrophoneUsageDescription",
      "NSPhotoLibraryUsageDescription",
      // the share sheet's Save Video (My Drills reel, Then and now) closes
      // the app without this one
      "NSPhotoLibraryAddUsageDescription",
    ]) {
      expect(plist).toContain(key);
    }
    expect(plist).toContain("ITSAppUsesNonExemptEncryption");
    // nothing the app does not use (each one is a review question)
    expect(plist).not.toContain("NSLocation");
    expect(plist).not.toContain("NSUserTrackingUsageDescription");
    expect(plist).not.toContain("NSContacts");
  });

  it("installs only on iOS 16.4 or later, where the screen can be kept awake (A24)", () => {
    // The session keeps the screen on with the browser's wake lock, which
    // the iPhone web view has from iOS 16.4. An older iPhone would dim
    // mid-drill, so the app does not install there.
    const targets = [...project.matchAll(/IPHONEOS_DEPLOYMENT_TARGET = ([^;]+);/g)].map((m) => m[1]);
    expect(targets).toEqual(["16.4", "16.4", "16.4", "16.4"]);
    // the Swift package the CLI writes from that number (major version)
    expect(read("native/ios/App/CapApp-SPM/Package.swift")).toContain("platforms: [.iOS(.v16)]");
    // no keep-awake plugin: the wake lock in lib/elite/native.ts is the one way
    expect(read("native/package.json")).not.toMatch(/keep-awake/);
    expect(read("lib/elite/native.ts")).toContain('wl.request("screen")');
    expect(read("docs/app-store/README.md")).toContain("iOS 16.4 or later");
    expect(read("docs/app-store/README.md")).not.toContain("iOS 15 or later");
  });

  it("opens on plain black, like the first screen, with no logo (A28)", () => {
    // Apple's launch guidance: the launch screen looks like the app's first
    // screen and is not a branding moment. The first screen is black.
    const dir = "native/ios/App/App/Assets.xcassets/Splash.imageset";
    const set = JSON.parse(read(`${dir}/Contents.json`)) as {
      images: { idiom: string; filename: string; scale: string }[];
    };
    expect(set.images.map((i) => i.scale).sort()).toEqual(["1x", "2x", "3x"]);
    for (const image of set.images) {
      expect(image.idiom).toBe("universal");
      const file = join(__dirname, "..", dir, image.filename);
      expect(existsSync(file), image.filename).toBe(true);
      const png = readFileSync(file);
      // a PNG, 2732 x 2732 (the size the image set has always carried),
      // 8-bit RGB with no alpha: a launch image must be opaque
      expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(png.readUInt32BE(16)).toBe(2732);
      expect(png.readUInt32BE(20)).toBe(2732);
      expect([png[24], png[25]]).toEqual([8, 2]);
      // every pixel is black: the picture data inflates to nothing but zeros
      const idat: Buffer[] = [];
      for (let at = 8; at < png.length; ) {
        const size = png.readUInt32BE(at);
        if (png.subarray(at + 4, at + 8).toString("latin1") === "IDAT") {
          idat.push(png.subarray(at + 8, at + 8 + size));
        }
        at += 12 + size;
      }
      const pixels = inflateSync(Buffer.concat(idat));
      expect(pixels.length).toBe(2732 * (1 + 2732 * 3));
      expect(pixels.equals(Buffer.alloc(pixels.length)), image.filename).toBe(true);
    }

    // the storyboard shows that image on a black ground, never white
    const launch = read("native/ios/App/App/Base.lproj/LaunchScreen.storyboard");
    expect(launch).toContain('image="Splash"');
    expect(launch).toContain(
      '<color key="backgroundColor" red="0.0" green="0.0" blue="0.0" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>'
    );
    expect(launch).not.toContain("systemBackgroundColor");
    expect(launch).not.toMatch(/white="1"/);
    expect(read("native/capacitor.config.ts")).toContain('backgroundColor: "#000000"');

    // the app icon is a different thing and still carries the logo
    const icon = join(__dirname, "..", "native/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png");
    expect(statSync(icon).size).toBeGreaterThan(50_000);
  });

  it("is set up for native push", () => {
    expect(read("native/ios/App/App/App.entitlements")).toContain("aps-environment");
    expect(project).toContain("CODE_SIGN_ENTITLEMENTS = App/App.entitlements;");
    const delegate = read("native/ios/App/App/AppDelegate.swift");
    expect(delegate).toContain("capacitorDidRegisterForRemoteNotifications");
    expect(delegate).toContain("capacitorDidFailToRegisterForRemoteNotifications");
  });

  it("stays quiet while the app is open: no banner, no sound", () => {
    // The copy inside native/ios is written by "cap sync" at build time and
    // is not in the repository; this file is the source.
    const ts = read("native/capacitor.config.ts");
    expect(ts).toContain('presentationOptions: ["badge", "list"]');
    expect(ts).not.toMatch(/presentationOptions:[^\n]*(banner|sound)/);
  });

  it("ships a privacy manifest that says no tracking, inside the app target", () => {
    const manifest = read("native/ios/App/App/PrivacyInfo.xcprivacy");
    expect(manifest).toMatch(/<key>NSPrivacyTracking<\/key>\s*<false\/>/);
    for (const key of ["NSPrivacyTrackingDomains", "NSPrivacyCollectedDataTypes", "NSPrivacyAccessedAPITypes"]) {
      expect(manifest).toContain(`<key>${key}</key>`);
    }
    const project = read("native/ios/App/App.xcodeproj/project.pbxproj");
    expect(project).toContain("PrivacyInfo.xcprivacy in Resources");
    expect(project.match(/PrivacyInfo\.xcprivacy/g)!.length).toBe(6);
  });

  it("has a real offline screen with a way back", () => {
    const offline = read("native/www/offline.html");
    expect(offline).toContain("Try again");
    expect(offline).toContain("https://thestriveapp.com/");
    expect(offline).not.toContain("—");
  });

  it("the sign-in screen inside the app creates no member account, and offers Join free only while it is open", () => {
    const form = read("components/elite/LoginForm.tsx");
    const member = form.slice(form.indexOf("{!native && ("));
    expect(member.slice(0, member.indexOf(")}"))).toContain('href="/signup"');
    expect(form.slice(0, form.indexOf("{!native && ("))).not.toContain('href="/signup"');
    expect(form).toMatch(/\{freeOpen && \(\s*<p[^>]*>\s*New here\?\{" "\}\s*<Link href="\/join"/);
    expect(read("app/(auth)/login/page.tsx")).toContain("inNativeApp()");
  });

  it("the build to TestFlight only ever starts by hand", () => {
    const wf = read(".github/workflows/ios-testflight.yml");
    expect(wf).toContain("workflow_dispatch");
    expect(wf).not.toMatch(/^\s*push:/m);
    expect(wf).not.toMatch(/^\s*pull_request/m);
    expect(wf).not.toMatch(/^\s*schedule:/m);
  });

  it("no Apple key, certificate or profile is in the repository", () => {
    const bad = /\.(p8|p12|cer|mobileprovision|pem)$/i;
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === "node_modules" || name === ".git" || name === ".next") continue;
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (bad.test(name)) found.push(full);
      }
    };
    for (const d of ["native", "docs", ".github", "lib", "app", "public"]) {
      const full = join(__dirname, "..", d);
      if (existsSync(full)) walk(full);
    }
    expect(found).toEqual([]);
  });
});

describe("the iPhone app feels like an app (Nov 23 2026)", () => {
  const project = read("native/ios/App/App.xcodeproj/project.pbxproj");
  const controller = read("native/ios/App/App/StriveBridgeViewController.swift");

  it("swipes back from the left edge, in the screen the app actually shows", () => {
    expect(controller).toMatch(/class StriveBridgeViewController: CAPBridgeViewController/);
    expect(controller).toMatch(/override func capacitorDidLoad\(\) \{\s*super\.capacitorDidLoad\(\)/);
    expect(controller).toContain("webView?.allowsBackForwardNavigationGestures = true");
    // The scene builds the window in code, so that is the line that counts;
    // the storyboard says the same for anything that still loads it.
    const scene = read("native/ios/App/App/SceneDelegate.swift");
    expect(scene).toContain("window?.rootViewController = StriveBridgeViewController()");
    expect(scene).not.toContain("= CAPBridgeViewController()");
    expect(read("native/ios/App/App/Base.lproj/Main.storyboard")).toContain(
      'customClass="StriveBridgeViewController" customModule="App" customModuleProvider="target"'
    );
  });

  it("the new Swift file is compiled into the app target", () => {
    // a file reference, a build file, the group and the Sources phase, as
    // for SceneDelegate.swift
    expect(project.match(/StriveBridgeViewController\.swift/g)!.length).toBe(project.match(/SceneDelegate\.swift/g)!.length);
    expect(project).toContain("StriveBridgeViewController.swift in Sources");
    expect(project).toMatch(/path = StriveBridgeViewController\.swift; sourceTree = "<group>";/);
  });

  it("a long press opens no web page preview", () => {
    expect(read("native/capacitor.config.ts")).toMatch(/ios: \{[\s\S]*allowsLinkPreview: false/);
  });

  it("signing is untouched: automatic, never a hard-coded distribution identity", () => {
    expect(project).not.toContain('CODE_SIGN_IDENTITY = "Apple Distribution"');
    expect(project.match(/CODE_SIGN_STYLE = Automatic;/g)!.length).toBe(2);
  });

  it("the site's sideways swipe between tabs never starts at the edge the phone uses for back", async () => {
    const { EDGE_PX, startsAtEdge } = await import("../lib/elite/tab-motion");
    expect(EDGE_PX).toBeGreaterThanOrEqual(20);
    expect(startsAtEdge(10, 393)).toBe(true);
    expect(startsAtEdge(388, 393)).toBe(true);
    expect(startsAtEdge(200, 393)).toBe(false);
    expect(read("components/elite/SwipeTabs.tsx")).toContain("startsAtEdge(t.clientX, window.innerWidth)");
  });
});
