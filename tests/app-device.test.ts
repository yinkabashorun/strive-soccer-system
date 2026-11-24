import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { base64ToBytes, oneFileForm } from "@/lib/elite/upload-body";

// The native iPhone app (mobile/): what only shows on a real phone, held
// here so it cannot come back. (It lives with the site's tests because it
// reads the app's files as text, and the app's own tests are typed for a
// phone, with no Node. It never IMPORTS the app's code: the machine that
// runs the site's tests has only the site's packages.) Each of these was found on the first TestFlight build of the native app
// (Nov 23 2026): the profile photo never left the phone, the camera never
// opened, the sign-in keyboard could not be put away.

const root = path.resolve(__dirname, "../mobile");
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}
const sources = [...files(path.join(root, "app")), ...files(path.join(root, "src"))];
const rel = (f: string) => path.relative(root, f);
const read = (f: string) => readFileSync(f, "utf8");
// code only: a rule explained in a comment is not a use of the thing
const code = (f: string) =>
  read(f)
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");

describe("a file upload from the phone", () => {
  it("base64 from the image tool decodes to the same bytes, at every length", () => {
    for (const n of [0, 1, 2, 3, 4, 5, 255, 256, 1000, 4097]) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 31 + n) % 256);
      const text = Buffer.from(bytes).toString("base64");
      expect(Array.from(base64ToBytes(text)), `length ${n}`).toEqual(Array.from(bytes));
      // line breaks and url-safe padding quirks from a tool do not matter
      expect(base64ToBytes(text.replace(/(.{60})/g, "$1\n")).length).toBe(n);
    }
  });

  it("arrives at the server as the photo, byte for byte", async () => {
    // every byte value, plus the sequences a multipart parser trips on
    const tricky = [...Buffer.from("\r\n--\r\n----StriveEliteUpload\r\n\r\n")];
    const bytes = Uint8Array.from([0xff, 0xd8, ...Array.from({ length: 256 }, (_, i) => i), ...tricky, 0xff, 0xd9]);
    const form = oneFileForm("photo", "photo.jpg", "image/jpeg", bytes);
    expect(form.contentType).toMatch(/^multipart\/form-data; boundary=----StriveEliteUpload[A-Za-z0-9]{24}$/);
    // the same call the site's photo route makes
    const req = new Request("https://thestriveapp.com/api/app/profile/photo", {
      method: "POST",
      headers: { "content-type": form.contentType },
      body: form.body as unknown as BodyInit,
    });
    const file = (await req.formData()).get("photo");
    expect(file).toBeInstanceOf(Blob);
    const got = file as File;
    expect(got.type).toBe("image/jpeg");
    expect(got.name).toBe("photo.jpg");
    expect(Array.from(new Uint8Array(await got.arrayBuffer()))).toEqual(Array.from(bytes));
  });

  it("is never a FormData, and never a fetch of a file on the phone", () => {
    // This Expo version's fetch refuses a React Native file part
    // ({ uri, name, type }): the request never leaves the phone.
    for (const f of sources) {
      expect(code(f), rel(f)).not.toMatch(/new FormData\b/);
    }
    const fetchers = sources.filter((f) => /(^|[^.\w])fetch\(/.test(code(f))).map(rel);
    expect(fetchers).toEqual(["src/api/client.ts"]);
    expect(code(path.join(root, "src/profile-api.ts"))).toContain("base64: true");
  });
});

describe("the camera", () => {
  it("is asked for before it is opened, and a no is said plainly", () => {
    for (const f of sources) {
      const src = code(f);
      if (!src.includes("launchCameraAsync")) continue;
      expect(src.indexOf("requestCameraPermissionsAsync"), rel(f)).toBeGreaterThan(-1);
      expect(src.indexOf("requestCameraPermissionsAsync"), rel(f)).toBeLessThan(src.indexOf("launchCameraAsync("));
      expect(src, rel(f)).toContain("Linking.openSettings()");
    }
    expect(code(path.join(root, "src/ProfileSteps.tsx"))).toContain("launchCameraAsync");
  });
});

describe("the keyboard", () => {
  const form = "src/FormScreen.tsx";

  it("is handled in one place", () => {
    const src = code(path.join(root, form));
    expect(src).toContain('keyboardShouldPersistTaps="handled"');
    expect(src).toContain("keyboardDismissMode");
    expect(src).toContain("KeyboardAvoidingView");
    const others = sources.filter((f) => rel(f) !== form && /KeyboardAvoidingView/.test(code(f))).map(rel);
    expect(others).toEqual([]);
  });

  it("every screen with something to type sits in that one place", () => {
    const typed = sources.filter((f) => /<TextInput\b/.test(code(f)));
    expect(typed.length).toBeGreaterThan(5);
    // a piece that holds a field, and the screens that show that piece
    const pieces = typed.filter((f) => rel(f).startsWith("src/"));
    for (const f of typed.filter((t) => rel(t).startsWith("app/"))) {
      expect(code(f), rel(f)).toMatch(/<FormScreen\b/);
    }
    for (const piece of pieces) {
      const name = path.basename(piece).replace(/\.tsx?$/, "");
      const hosts = sources.filter((f) => rel(f).startsWith("app/") && code(f).includes(`@/${name}"`));
      expect(hosts.length, `${name} is shown somewhere`).toBeGreaterThan(0);
      for (const h of hosts) expect(code(h), `${rel(h)} shows ${name}`).toMatch(/<FormScreen\b/);
    }
  });
});

// Found in the first simulator run (Nov 23 2026). The app is black on every
// screen, but the project was generated as "follow the phone's setting": on
// a phone in light mode the status bar clock and battery were drawn black
// on black, and the phone's own boxes (alerts, the photo picker) were white.
describe("the phone's own chrome", () => {
  const config = JSON.parse(read(path.join(root, "app.json"))).expo as {
    userInterfaceStyle?: string;
    plugins: unknown[];
  };
  it("is dark, whatever the phone is set to", () => {
    expect(config.userInterfaceStyle).toBe("dark");
    // a dark variant on the launch screen makes the generated project
    // "Automatic" again, over the line above
    const splash = config.plugins.find((p) => Array.isArray(p) && p[0] === "expo-splash-screen") as [string, Record<string, unknown>];
    expect(splash).toBeTruthy();
    expect(Object.keys(splash[1])).not.toContain("dark");
    expect(splash[1].backgroundColor).toBe("#000000");
  });
  it("has a light status bar on every screen", () => {
    const layout = code(path.join(root, "app/_layout.tsx"));
    expect(layout).toContain('statusBarStyle: "light"');
    expect(layout).toContain('<StatusBar style="light" />');
  });
});

// Also from the first simulator run: Home started a whole status bar too
// low. The iPhone tab bar adds room for the status bar to a tab's page by
// itself, and the page (src/Screen.tsx) was already leaving that room.
describe("a tab's page", () => {
  const tabs = files(path.join(root, "app/(tabs)")).filter((f) => !f.endsWith("_layout.tsx"));
  it("leaves room for the status bar and the tab bar once, in one place", () => {
    const layout = code(path.join(root, "app/(tabs)/_layout.tsx"));
    expect(layout).toMatch(/<NativeTabs\.Trigger[^>]*disableAutomaticContentInsets/);
    const screen = code(path.join(root, "src/Screen.tsx"));
    expect(screen).toContain('contentInsetAdjustmentBehavior="never"');
    expect(screen).toMatch(/paddingTop: insets\.top \+ \d+/);
    expect(screen).toMatch(/paddingBottom: insets\.bottom \+ bottom/);
    expect(tabs.length).toBeGreaterThanOrEqual(3);
    for (const f of tabs) {
      expect(code(f), rel(f)).toContain("<Screen");
      expect(code(f), rel(f)).not.toContain("useSafeAreaInsets");
    }
  });
  it("starts its headline right under the status bar", () => {
    for (const f of tabs) {
      expect(code(f), rel(f)).toContain("paddingTop: PAGE_TOP");
      // no page pushes its top down by a number of its own
      for (const m of code(f).matchAll(/paddingTop: (\d+)/g)) expect(Number(m[1]), rel(f)).toBeLessThanOrEqual(24);
    }
    const top = Number(read(path.join(root, "src/Screen.tsx")).match(/PAGE_TOP = (\d+)/)?.[1]);
    expect(top).toBeLessThanOrEqual(12);
  });
});

// The weekly check-in opens as a sheet. Lifting the whole page out of the
// keyboard's way measures from the top of the screen, and in a sheet it left
// the last box under the keyboard: a player typing into a box they could not
// see (simulator run, Nov 24 2026).
describe("the box being typed in", () => {
  const form = read(path.join(root, "src/FormScreen.tsx"));
  it("is brought above the keyboard by the scroll view itself", () => {
    expect(code(path.join(root, "src/FormScreen.tsx"))).toContain("automaticallyAdjustKeyboardInsets={!footer}");
    // the lift is used only where a footer rides on the keyboard
    expect(form).toMatch(/behavior=\{Platform\.OS === "ios" && footer \? "padding" : undefined\}/);
    expect(form).toContain("if (!header && !footer) return page;");
  });
  it("is labelled, so it can be found by name (screen readers, and the tapped pass)", () => {
    const checkin = code(path.join(root, "app/checkin.tsx"));
    expect(checkin).toMatch(/<TextInput[^>]*accessibilityLabel=\{label\}/);
  });
});

// The first screen the app opens on used to be Home itself. Filmed in the
// simulator (Nov 24 2026): a new member saw the Home tabs for half a second
// before "You're in", and with no connection and nothing saved the app sat
// on an empty Home with no word of why.
describe("the first screen", () => {
  const tabs = code(path.join(root, "app/(tabs)/_layout.tsx"));
  const layout = code(path.join(root, "app/_layout.tsx"));
  const holding = code(path.join(root, "src/Holding.tsx"));
  it("is the tabs only for someone who belongs in the app", () => {
    expect(tabs).toMatch(/const area = ready \? areaFor\(signedIn, me\.data\?\.state, me\.data\?\.profileSetup\) : null;/);
    expect(tabs.indexOf('if (area !== "app")')).toBeGreaterThan(-1);
    expect(tabs.indexOf('if (area !== "app")')).toBeLessThan(tabs.indexOf("<NativeTabs"));
    expect(tabs).toContain("<Holding");
  });
  it("says so when it cannot be read, with a way to try again and a way out", () => {
    expect(tabs).toMatch(/failed = ready && signedIn && !me\.data && \(me\.isError \|\| me\.isPaused\)/);
    expect(holding).toContain("{OFFLINE_MESSAGE}");
    expect(holding).toContain('label="Try again"');
    expect(holding).toContain('label="Sign out"');
    expect(holding).toContain("if (!failed) return <View style={styles.fill} />;");
  });
  it("comes out from under the launch screen only once it is the right one, and never waits forever", () => {
    // one place hides the launch screen: when the gate has settled, or the clock runs out
    expect(layout.match(/SplashScreen\.hideAsync\(/g)?.length).toBe(2);
    expect(layout).toMatch(/const settled = unreadable \|\| \(area !== null && inArea\(area, segments\)\);/);
    expect(layout).toMatch(/setTimeout\(\(\) => void SplashScreen\.hideAsync\(\)[^;]*LAUNCH_SCREEN_MAX_MS\)/);
    const max = Number(layout.match(/LAUNCH_SCREEN_MAX_MS = (\d+)/)?.[1]);
    expect(max).toBeGreaterThanOrEqual(2000);
    expect(max).toBeLessThanOrEqual(6000);
    // a font that will not load does not hold the app on the launch screen
    expect(layout).toContain("if (!fontsLoaded && !fontsFailed)");
  });
});

// Filmed in the simulator (Nov 24 2026): on "You're in", the mark, the gold
// line and the headline went blank on the display the frame the member card
// started to rise, and stayed blank. The card was the one view in the app
// with a 3D tilt and a shadow (a black one, on a black screen).
describe("nothing in the app is tilted in 3D or casts a shadow", () => {
  it("so no view can blank its neighbours while it moves", () => {
    for (const f of sources) {
      expect(code(f), rel(f)).not.toMatch(/perspective|rotateX|rotateY|shadowColor|shadowOpacity|shadowRadius|shadowOffset/);
    }
  });
  it("the member card still rises: up, a touch larger, fading in", () => {
    const card = code(path.join(root, "src/MemberCard.tsx"));
    expect(card).toContain("translateY: (1 - up.value) * 60");
    expect(card).toContain("scale: 0.96 + 0.04 * up.value");
    expect(card).toContain("opacity: up.value");
  });
});

describe("the sign-in screen", () => {
  const src = read(path.join(root, "app/sign-in.tsx"));
  it("says whose app it is", () => {
    expect(src).toMatch(/Strive <Text[^>]*>Elite<\/Text>/);
    expect(src).toContain("Sign in to your Strive Elite account");
  });
  it("Next on the email moves to the password", () => {
    expect(src).toContain("passwordField.current?.focus()");
  });
});
