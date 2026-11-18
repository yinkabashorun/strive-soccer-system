import { describe, expect, it } from "vitest";
import { generateKeyPairSync, verify } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
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
    ]) {
      expect(plist).toContain(key);
    }
    expect(plist).toContain("ITSAppUsesNonExemptEncryption");
    // nothing the app does not use (each one is a review question)
    expect(plist).not.toContain("NSLocation");
    expect(plist).not.toContain("NSUserTrackingUsageDescription");
    expect(plist).not.toContain("NSContacts");
  });

  it("is set up for native push", () => {
    expect(read("native/ios/App/App/App.entitlements")).toContain("aps-environment");
    expect(project).toContain("CODE_SIGN_ENTITLEMENTS = App/App.entitlements;");
    const delegate = read("native/ios/App/App/AppDelegate.swift");
    expect(delegate).toContain("capacitorDidRegisterForRemoteNotifications");
    expect(delegate).toContain("capacitorDidFailToRegisterForRemoteNotifications");
  });

  it("has a real offline screen with a way back", () => {
    const offline = read("native/www/offline.html");
    expect(offline).toContain("Try again");
    expect(offline).toContain("https://thestriveapp.com/");
    expect(offline).not.toContain("—");
  });

  it("the sign-in screen inside the app is sign-in only", () => {
    const form = read("components/elite/LoginForm.tsx");
    expect(form).toMatch(/\{!native && \(\s*<p[^>]*>\s*New here\?/);
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
