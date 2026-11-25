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
    // posting a training photo opens the camera too
    expect(code(path.join(root, "app/post.tsx"))).toContain("launchCameraAsync");
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
// A tab whose page is the one shared Home (src/HomeScreen.tsx: the member
// app's Home tab, and the Train tab Strive Pro adds to the free tabs) is
// held to the rules through that file.
const pageOf = (f: string) => (/<HomeScreen\b/.test(code(f)) ? path.join(root, "src/HomeScreen.tsx") : f);

describe("a tab's page", () => {
  const tabs = files(path.join(root, "app/(tabs)"))
    .filter((f) => !f.endsWith("_layout.tsx"))
    .map(pageOf);
  it("leaves room for the status bar and the tab bar once, in one place", () => {
    const layout = code(path.join(root, "app/(tabs)/_layout.tsx"));
    expect(layout).toMatch(/<NativeTabs\.Trigger[^>]*disableAutomaticContentInsets/);
    const screen = code(path.join(root, "src/Screen.tsx"));
    expect(screen).toContain('contentInsetAdjustmentBehavior="never"');
    // The room for the clock is on the frame AROUND the scroll view, so a
    // page scrolled up is cut off under the clock and never runs through
    // it (build 7 on his phone, Nov 24 2026: "WEEK 10" over the time).
    expect(screen).toMatch(/<View style=\{\{[^}]*paddingTop: insets\.top \}\}>\s*<ScrollView/);
    expect(screen).not.toMatch(/contentContainerStyle=\{\[\{ paddingTop: insets\.top/);
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

// Build 7 on his phone (Nov 24 2026): a badge was a grey tile with its line
// cut short ("doesn't look like an achievement"), and the Week tab was five
// equal cards ("I don't think that screen is super addicting").
describe("what was earned, and the week's path", () => {
  // what was earned is ONE component, on both You tabs (src/YouEarned.tsx)
  const you = code(path.join(root, "src/YouEarned.tsx"));
  const week = code(path.join(root, "app/(tabs)/week.tsx"));
  it("a badge is a gold medal with its whole line, never cut short", () => {
    const badges = you.slice(you.indexOf("y.achievements.map"), you.indexOf("</>", you.indexOf("y.achievements.map")));
    expect(badges).toContain("<Medal");
    expect(badges).toContain("achievementMark(a.title)");
    expect(badges).not.toContain("numberOfLines");
    expect(badges).not.toContain("<Card");
  });
  it("the week has ONE big card, the session it is waiting on, worked out in one place", () => {
    expect(week).toContain("weekRows(w)");
    expect(week.match(/<NextCard\b/g)?.length).toBe(1);
    expect(week).toContain('state === "next"');
    // the rules are not re-derived on the screen
    expect(week).not.toMatch(/s\.n === w\.current/);
  });
  it("Start is a bone button with black words: gold is never a button", () => {
    const start = week.slice(week.indexOf("  start: {"), week.indexOf("}", week.indexOf("  start: {")));
    expect(start).toContain("backgroundColor: color.bone");
    expect(start).not.toMatch(/gold/);
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
    const field = code(path.join(root, "src/LabeledField.tsx"));
    expect(field).toMatch(/<TextInput[^>]*accessibilityLabel=\{label\}/);
    expect(code(path.join(root, "app/checkin.tsx"))).toMatch(/<LabeledField\b/);
  });
});

// Build 7 on his phone: a tab scrolled up and ran through the clock. The
// tabs were fixed in Screen.tsx; the simulator (Nov 24 2026) then showed
// the same thing on a pushed page, a club scrolled into the time. The rule
// is one rule: the status bar's room is never inside anything that scrolls.
describe("the room for the status bar", () => {
  it("is never part of what scrolls, on any screen", () => {
    for (const f of sources) {
      expect(code(f), rel(f)).not.toMatch(/content(Container)?Style=\{[^=]*?insets\.top/);
    }
  });
  it("is left on the black frame around the scroll view, by the two shared pieces", () => {
    const screen = code(path.join(root, "src/Screen.tsx"));
    expect(screen).toContain("export function useBelowClock()");
    expect(screen).toContain("return { marginTop: insets.top };");
    const form = code(path.join(root, "src/FormScreen.tsx"));
    expect(form).toContain("marginTop: safeTop && !header ? insets.top : 0");
    // the pushed pages that scroll on their own
    for (const f of ["app/club/[id]/index.tsx", "app/club/[id]/near.tsx", "app/settings.tsx", "app/week-plan.tsx", "app/offer.tsx"]) {
      expect(code(path.join(root, f)), f).toMatch(/<ScrollView\s+style=\{\[[^\]]*belowClock\]\}/);
    }
    // a form with no fixed header of its own asks for the room
    for (const f of sources.filter((x) => /<FormScreen\b/.test(code(x)) && !x.endsWith("FormScreen.tsx"))) {
      for (const tag of code(f).match(/<FormScreen\b[^>]*>/g) ?? []) {
        // a sheet (the check-in, the post) and a form with a header do not sit under the clock
        if (/header=|^<FormScreen>$/.test(tag) || /app\/(checkin|post)\.tsx$/.test(f)) continue;
        expect(tag, rel(f)).toMatch(/\bsafeTop\b/);
      }
    }
  });
});

// A course scrolled past its picture (simulator, Nov 24 2026): the floating
// back arrow sat on top of a drill's name and the photo ran under the clock.
describe("a course scrolled past its top", () => {
  const course = code(path.join(root, "app/course/[slug].tsx"));
  it("gets a solid bar with the course's name, and the back button sits on it", () => {
    expect(course).toContain("onPastTop={setBarred}");
    expect(course).toMatch(/\{barred \? \(\s*<View style=\{\[styles\.bar, \{ height: insets\.top \+ BAR, paddingTop: insets\.top \}\]\}/);
    expect(course).toContain("{found.data.name}");
    expect(course).toMatch(/bar: \{[^}]*backgroundColor: color\.black/);
    // told only when it changes, not on every frame of a scroll
    expect(course).toContain("if (now !== past.current) {");
  });
});

// Join free, "How do we reach you?" (simulator, Nov 24 2026): with the
// keyboard up for the email, the phone box sat behind the Next button that
// rides on the keyboard, and a tap aimed at it pressed Next.
describe("a box behind the button that rides on the keyboard", () => {
  const form = code(path.join(root, "src/FormScreen.tsx"));
  it("the box being typed in is scrolled to the top of a page with a footer", () => {
    expect(form).toContain("TextInput.State.currentlyFocusedInput()");
    expect(form).toContain('Keyboard.addListener("keyboardDidShow", reveal)');
    expect(form).toMatch(/view\.scrollTo\(\{ y: Math\.max\(0, y\), animated: true \}\)/);
    expect(form).toContain("<RevealContext.Provider value={onBoxFocus}>");
    // only where a footer rides on the keyboard
    expect(form).toContain("if (!hasFooter) return;");
  });
  it("every named box tells the page when it takes the cursor", () => {
    const field = code(path.join(root, "src/LabeledField.tsx"));
    expect(field).toContain("const reveal = useRevealOnFocus();");
    expect(field).toMatch(/onFocus=\{\(e\) => \{\s*reveal\(\);/);
    expect(code(path.join(root, "app/onboarding/[step].tsx"))).toContain("onFocus={reveal}");
  });
  it("the keyboard's Next key moves to the next box on Join free", () => {
    const join = code(path.join(root, "app/join/[step].tsx"));
    expect(join.match(/onNext=\{\(\) => second\.current\?\.focus\(\)\}/g)?.length).toBe(2);
    expect(join.match(/inputRef=\{second\}/g)?.length).toBe(2);
    expect(join).toContain('returnKeyType={onNext ? "next" : undefined}');
  });
});

// Join free, the last screen (simulator, Nov 24 2026): eight points to read,
// and the second tick box sat below the fold, so "Create my account" was in
// reach while a box it needs was not on the screen.
describe("the two boxes on the last Join free screen", () => {
  it("stay with the button: the points scroll, the boxes never leave the screen", () => {
    const join = code(path.join(root, "app/join/[step].tsx"));
    const footer = join.slice(join.indexOf("footer={"), join.indexOf("<Animated.View"));
    expect(footer).toContain("label={FREE_AGE_STATEMENT}");
    expect(footer).toContain("label={TERMS_STATEMENT}");
    expect(footer.indexOf("label={TERMS_STATEMENT}")).toBeLessThan(footer.indexOf('"Create my account"'));
    // and they are written once, not also in the page
    expect(join.match(/label=\{TERMS_STATEMENT\}/g)?.length).toBe(1);
  });
});

// A name written above a box. The simulator's tapping pass (Nov 24 2026)
// tapped the words "First name" on the Join free screen, nothing happened,
// and the name was never typed: a player who aims at the words gets a dead
// tap. One shared piece holds the two rules, and every screen that writes a
// name above a box uses it.
describe("a name above a text box", () => {
  const field = code(path.join(root, "src/LabeledField.tsx"));
  it("a tap on the name puts the cursor in the box", () => {
    expect(field).toContain("onPress={() => box.current?.focus()}");
    expect(field).toMatch(/<TextInput\s+ref=\{box\}/);
  });
  it("the name and the box are one thing to a screen reader", () => {
    expect(field).toContain("accessible={false}");
    expect(field).toContain("accessibilityElementsHidden");
    expect(field).toContain('importantForAccessibility="no-hide-descendants"');
  });
  it("no screen keeps its own copy: a box named by a label above it is the shared piece", () => {
    const screens = files(path.join(root, "app")).concat(files(path.join(root, "src"))).filter((f) => /\.tsx$/.test(f) && !f.endsWith("LabeledField.tsx"));
    for (const f of screens) {
      // a box that takes its name from a `label` prop is a labelled box
      expect(code(f), rel(f)).not.toMatch(/<TextInput[^>]*accessibilityLabel=\{label\}/);
    }
    expect(code(path.join(root, "app/join/[step].tsx"))).toMatch(/<LabeledField\b/);
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
    expect(layout).toMatch(/const settled = unreadable \|\| \(area !== null && inArea\(area, segments, train\)\);/);
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

// Nov 24 2026, the owner on the offer: "Drills like these" did not work,
// it was showing them the exact drills. The stills are a taste, shown
// locked; the drills' names never reach a free player's phone.
describe("the offer's drills", () => {
  const site = path.resolve(root, "..");
  it("are locked stills with no names, on the screen and in what the server sends", () => {
    const offer = read(path.join(site, "lib/elite/offer.ts"));
    expect(offer).toContain('OFFER_DRILLS_LABEL = "Inside your first week"');
    expect(offer).not.toMatch(/OFFER_DRILLS_LABEL = "Drills like these"/);
    const contract = read(path.join(site, "lib/elite/app-contract.ts"));
    expect(contract).toContain("drills: { poster: string }[];");
    const server = read(path.join(site, "lib/elite/free-app-server.ts"));
    const sent = server.slice(server.indexOf("drills: preview.drills.flatMap"), server.indexOf("gets: [...OFFER_GETS]"));
    expect(sent).toContain("[{ poster:");
    expect(sent).not.toMatch(/title/);
    const screen = code(path.join(root, "app/offer.tsx"));
    expect(screen).not.toMatch(/d\.title/);
    expect(screen).toContain('<Icon name="lock"');
    expect(screen).toContain("accessibilityLabel={o.drillLocked}");
    const fixtures = read(path.join(root, "src/api/fixtures.ts"));
    const example = fixtures.slice(fixtures.indexOf("FIXTURE_OFFER"), fixtures.indexOf("gets:", fixtures.indexOf("FIXTURE_OFFER")));
    expect(example).not.toMatch(/title:/);
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

// The Courses tab (Nov 24 2026). A course can hold seventeen drills, and a
// video player for each at once is a phone out of memory: one clip is live
// at a time. An account that is not a member is sent the shelf locked, and
// a locked card goes to the offer without asking the server for a course.
describe("the Courses tab", () => {
  const shelf = code(path.join(root, "src/CoursesList.tsx"));
  const course = code(path.join(root, "app/course/[slug].tsx"));
  const view = code(path.join(root, "src/course-view.ts"));

  it("is a tab, and a course is a screen of the app", () => {
    expect(code(path.join(root, "src/tabs.ts"))).toMatch(/key: "courses", route: "courses"/);
    expect(code(path.join(root, "app/(tabs)/courses.tsx"))).toContain("<CoursesList />");
    expect(code(path.join(root, "app/_layout.tsx"))).toContain('<Stack.Screen name="course/[slug]" />');
    expect(code(path.join(root, "src/navigation.ts"))).toMatch(/APP_ROUTES = new Set\(\[[^\]]*"course"/);
  });

  it("a locked card opens the offer and never reads a course", () => {
    expect(shelf).toContain('c.locked ? "/offer" : `/course/${c.slug}`');
    expect(shelf).not.toMatch(/useCourse\b|appCoursePath|prefetch/);
    // one course is asked for only from inside the member app
    const hooks = read(path.join(root, "src/api/queries.ts"));
    expect(hooks.slice(hooks.indexOf("export function useCourse("))).toMatch(/enabled: inApp && Boolean\(slug\)/);
  });

  it("plays one clip at a time, by the phone's own setting", () => {
    // the player is mounted for the live clip only; every other tile is a still
    expect(course.match(/<DrillVideo\b/g)?.length).toBe(1);
    expect(course).toMatch(/\{live \? \(\s*<DrillVideo src=\{step\.video\} poster=\{step\.poster\} autoplay \/>/);
    expect(course).toContain("liveClip({ autoplay: prefs.autoplay, picked, inView })");
    expect(view).toContain("return i.autoplay ? i.inView[0] ?? null : null;");
  });

  it("opens a lesson's download in the sheet over the app, https only", () => {
    expect(course).toContain("openLink(download)");
    expect(course).not.toMatch(/Linking\.openURL/);
    const links = code(path.join(root, "src/links.ts"));
    expect(links).toMatch(/export function openLink\(url: string\)[^}]*if \(!isHttps\(url\)\) return Promise\.resolve\(\);/);
    expect(links).toContain("PAGE_SHEET");
  });

  it("is a library: nothing is ticked, counted or tracked", () => {
    for (const src of [shelf, course, view]) {
      expect(src).not.toMatch(/completed|\bprogress|\bpercent|streak|useMutation|<Ring\b|<Disc\b/i);
    }
  });
});

// The free app (Nov 24 2026): a free account lives in the app, in its own
// tabs. The rules below are the owner's, each held to the files.
describe("the free app", () => {
  const free = files(path.join(root, "app/(free)"));
  const pages = free.filter((f) => !f.endsWith("_layout.tsx"));
  const layout = code(path.join(root, "app/(free)/_layout.tsx"));
  const names = (f: string) => path.basename(f).replace(/\.tsx$/, "");

  // Nov 24 2026, "pro should just add tabs": four tabs for a free player,
  // and Train is the one screen Strive Pro adds (lib/elite/one-app.ts).
  it("has four tabs, Friends, Week, Clubs, You, and the one Strive Pro adds, Train", () => {
    expect(pages.map(names).sort()).toEqual(["clubs", "friends", "me", "my-week", "train"]);
    const tabs = code(path.join(root, "src/tabs.ts"));
    for (const p of pages) expect(tabs, names(p)).toContain(`route: "${names(p)}"`);
    // which of them a person sees is the shared rule's, never this app's
    expect(tabs).toContain("oneAppTabs(train)");
    expect(layout).toContain("oneAppTabBar(train)");
    // a tab they do not have is hidden, and the bar is built again when
    // Train arrives or goes
    expect(layout).toMatch(/<NativeTabs key=\{train \? "pro" : "free"\}/);
    expect(layout).toMatch(/name=\{ONE_APP_SCREENS\[k\]\.route\} hidden/);
    expect(code(path.join(root, "app/_layout.tsx"))).toContain('<Stack.Screen name="(free)"');
  });

  it("draws its tabs only for an account that belongs in it", () => {
    expect(layout.indexOf('if (area !== "free")')).toBeGreaterThan(-1);
    expect(layout.indexOf('if (area !== "free")')).toBeLessThan(layout.indexOf("<NativeTabs"));
    expect(layout).toContain("<Holding");
    expect(layout).toMatch(/<NativeTabs\.Trigger[^>]*disableAutomaticContentInsets/);
  });

  it("every tab's page leaves its room in the one place, like a member's", () => {
    for (const f of pages.map(pageOf)) {
      expect(code(f), rel(f)).toContain("<Screen");
      expect(code(f), rel(f)).not.toContain("useSafeAreaInsets");
      expect(code(f), rel(f)).toContain("paddingTop: PAGE_TOP");
    }
  });

  it("Train is the member's own Home with the Courses shelf under the week, and a free player has no Courses tab", () => {
    expect(code(path.join(root, "app/(free)/train.tsx"))).toContain("<HomeScreen train />");
    const home = code(path.join(root, "src/HomeScreen.tsx"));
    expect(home).toMatch(/\{train \? \([\s\S]{0,600}<CoursesList \/>/);
    // the truth about saving is said on Train (the member app says it on Week)
    expect(home).toContain("REFUSED_LINE : UNSENT_LINE");
    expect(files(path.join(root, "app/(free)")).map(names)).not.toContain("courses");
  });

  it("Strive Pro adds to the You tab and the finish screen, and takes nothing off", () => {
    const me = code(path.join(root, "app/(free)/me.tsx"));
    expect(me).toContain("{train && member ? <YouEarned y={member} /> : null}");
    // the free numbers, the invite row and Settings are there for everyone
    expect(me).toContain("y.weekMinutes");
    expect(me).toContain('label="Send my link to a teammate"');
    const session = code(path.join(root, "app/session/[n].tsx"));
    expect(session).toMatch(/hasTrain\(me\.data\?\.state\) && finish\.added >= 1/);
    expect(session).toContain("/post?session=${week.week}-${session.n}");
    // one quiet row under the main button, never a second big button
    expect(session.match(/POST_SESSION_ROW\}/g)?.length).toBe(2);
  });

  // "Not too much CTAs": one prompt in the whole free app, on Week.
  it("has ONE upgrade prompt, on the Week tab, and none anywhere else", () => {
    const users = sources.filter((f) => /<UpgradeCard\b/.test(code(f))).map(rel);
    expect(users).toEqual(["app/(free)/my-week.tsx"]);
    expect(code(path.join(root, "app/(free)/my-week.tsx")).match(/<UpgradeCard\b/g)?.length).toBe(1);
    // the only ways to the offer: that card, and a locked course
    const toOffer = sources.filter((f) => /["`]\/offer["`]/.test(code(f))).map(rel).sort();
    expect(toOffer).toEqual(["src/CoursesList.tsx", "src/UpgradeCard.tsx"]);
    // nothing on Friends, on You, or after a post
    for (const f of ["app/(free)/friends.tsx", "app/(free)/me.tsx", "app/post.tsx", "src/FeedCards.tsx"]) {
      expect(code(path.join(root, f)), f).not.toMatch(/upgrade|Strive Pro|\/offer|a month|membership/i);
    }
  });

  it("the card is a card in the page: whether it shows is the one shared rule", () => {
    const card = code(path.join(root, "src/UpgradeCard.tsx"));
    expect(card).toContain('from "@shared/upgrade-card"');
    expect(card).toContain("upgradeCard({ place, member, area, sessions, dismissedAt, now: Date.now() })");
    expect(card).not.toMatch(/<Modal\b|Alert\.alert|presentation/);
    // the price is never written on the phone: the offer's words are the
    // server's (the example data stands in for the server, and says so)
    for (const f of sources.filter((x) => rel(x) !== "src/api/fixtures.ts")) {
      expect(code(f), rel(f)).not.toMatch(/\$29|\$\s?\d+ a month/);
    }
  });

  it("a post can be reported and its poster blocked, from the post itself", () => {
    const cards = code(path.join(root, "src/FeedCards.tsx"));
    expect(cards).toContain('"Report this post"');
    expect(cards).toContain("`Block ${card.first}`");
    expect(cards).toContain("reportPost(card.id, reason.id)");
    expect(cards).toContain("blockPlayer(card.ownerId)");
    expect(cards).toContain("REPORT_REASONS");
    // a locked post shows nothing of the post: it is given no photo to draw
    const locked = cards.slice(cards.indexOf("export function LockedPost"), cards.indexOf("export function OpenPost"));
    expect(locked).not.toMatch(/photoUrl|caption/);
  });

  it("asks for notifications once, after a post, with the reason", () => {
    const post = code(path.join(root, "app/post.tsx"));
    expect(post).toContain("if (photo && !prefs.pushAsked)");
    expect(post).toContain("Know the moment your friends post?");
    expect(post).toContain("turnOnNotifications()");
    // and never from the tabs themselves
    for (const f of pages) expect(code(f), rel(f)).not.toMatch(/turnOnNotifications|requestPermissionsAsync/);
  });

  it("never counts what was missed", () => {
    for (const f of [...free, path.join(root, "app/post.tsx"), path.join(root, "app/week-plan.tsx"), path.join(root, "src/FeedCards.tsx")]) {
      expect(code(f), rel(f)).not.toMatch(/streak|missed|behind|\bpercent\b/i);
    }
  });
});

// Clubs in the iPhone app (Nov 24 2026): the Clubs tab, the club's page and
// the screens off it. What holds here is what a reader of the screens
// cannot see: that no rule or sentence was copied onto the phone, that
// nothing sells, that a locked photo is never drawn, and that the example
// clubs are made up.
describe("clubs", () => {
  const clubFiles = sources.filter((f) =>
    /^(app\/club\/|app\/\(free\)\/clubs\.tsx$|src\/(Crest|MatchupCard|PlanCards|CountyPicker|play-terms|sheet)\.tsx?$|src\/api\/clubs\.ts$)/.test(rel(f))
  );
  const at = (f: string) => code(path.join(root, f));

  it("is a tab, a club's page, and the screens off it", () => {
    expect(clubFiles.map(rel).sort()).toEqual([
      "app/(free)/clubs.tsx",
      "app/club/[id]/index.tsx",
      "app/club/[id]/manage.tsx",
      "app/club/[id]/near.tsx",
      "app/club/[id]/plan.tsx",
      "app/club/how.tsx",
      "app/club/join.tsx",
      "app/club/start.tsx",
      "src/CountyPicker.tsx",
      "src/Crest.tsx",
      "src/MatchupCard.tsx",
      "src/PlanCards.tsx",
      "src/api/clubs.ts",
      "src/play-terms.ts",
      "src/sheet.ts",
    ]);
    const layout = at("app/_layout.tsx");
    for (const name of ["club/[id]/index", "club/[id]/manage", "club/[id]/plan", "club/[id]/near", "club/start", "club/join", "club/how"]) {
      expect(layout, name).toContain(`<Stack.Screen name="${name}"`);
    }
    // only a free account is ever let onto them
    expect(at("src/navigation.ts")).toMatch(/FREE_ROUTES = new Set\(\[[^\]]*"club"/);
  });

  it("sells nothing: the one upgrade prompt stays on Week", () => {
    for (const f of clubFiles) {
      expect(code(f), rel(f)).not.toMatch(/upgrade|Strive Pro|\/offer|a month|membership|\bPro\b|unlock/i);
    }
  });

  it("never counts what was missed, and has no streaks", () => {
    for (const f of clubFiles) expect(code(f), rel(f)).not.toMatch(/streak|missed|behind|\bpercent\b|has not trained|did not train/i);
  });

  it("the matchup's words are the one shared file's, never written on the phone", () => {
    const card = at("src/MatchupCard.tsx");
    expect(card).toContain('from "@shared/club-matchup-words"');
    expect(card).toContain("{matchupTitle(matchup.state)}");
    expect(card).toContain("{matchup.line}");
    expect(card).toContain("MATCHUP_PER_PLAYER");
    expect(card).toContain('router.push("/club/how")');
    const how = at("app/club/how.tsx");
    expect(how).toContain("MATCHUP_HOW_LINES.map");
    expect(how).toContain("{MATCHUP_HOW_TITLE}");
    // no sentence about the matchup anywhere else on the phone
    for (const f of clubFiles.filter((x) => !/fixtures/.test(rel(x)))) {
      expect(code(f), rel(f)).not.toMatch(/won the week|per player\.|gets matched|Weeks won/);
    }
    // the record lines and the card line are the server's
    const page = at("app/club/[id]/index.tsx");
    // (Nov 24 2026: the page shows each record as the two numbers a player
    // says, "4-1", read from the server's own line; the plain sentence is
    // what a screen reader says)
    expect(page).toContain("says={c.recordLine}");
    expect(page).toContain("says={c.matchup!.recordLine}");
    expect(page).toContain("recordShort(c?.matchup?.recordLine)");
    expect(at("app/(free)/clubs.tsx")).toContain("{club.matchup}");
  });

  it("the two acceptance sheets are the website's words, recorded by the server", () => {
    const terms = at("src/play-terms.ts");
    expect(terms).toContain('from "@shared/club-teams"');
    for (const w of ["ORGANIZER_SHEET_TITLE", "ORGANIZER_SHEET_LINE", "PLAYER_SHEET_TITLE", "PLAYER_SHEET_LINE"]) expect(terms, w).toContain(w);
    expect(terms).toContain("acceptPlayTerms(kind)");
    // the server says when one is owed; the phone remembers nothing
    expect(terms).toContain("if (first.ok || !first.needs) return first;");
    expect(terms).not.toMatch(/AsyncStorage|SecureStore|prefs/);
    // every way to organize or to be in goes through it
    expect(at("src/PlanCards.tsx")).toContain("withPlayTerms(() => setImIn(card.id, !imIn))");
    expect(at("app/club/start.tsx")).toContain("withPlayTerms(");
    expect(at("app/club/[id]/plan.tsx")).toContain("withPlayTerms(");
    expect(at("app/club/[id]/manage.tsx")).toContain("withPlayTerms(() => answerGame(g.id, true))");
  });

  it("a session or game says which club organized it, never Strive", () => {
    const cards = at("src/PlanCards.tsx");
    expect(cards).toContain("{organizedBy(card.organizer.name)}");
    expect(cards).toContain('from "@shared/club-teams"');
    for (const f of clubFiles) expect(code(f), rel(f)).not.toMatch(/Organized by Strive|by Strive Elite/);
  });

  it("a locked photo is given no photo of the post to draw", () => {
    const page = at("app/club/[id]/index.tsx");
    const tile = page.slice(page.indexOf("function Tile("), page.indexOf("const styles"));
    const locked = tile.slice(tile.indexOf('tile.state === "locked"'), tile.indexOf("return (", tile.indexOf("</Press>")));
    expect(locked).toContain("<Avatar uri={tile.photo}");
    expect(locked).not.toMatch(/photoUrl|<Image\b/);
    // and the type itself carries none (lib/elite/app-contract.ts)
    const contract = read(path.resolve(root, "../lib/elite/app-contract.ts"));
    const type = contract.slice(contract.indexOf("export type AppClubTile"), contract.indexOf("export type AppClubRequest"));
    expect(type).toMatch(/state: "locked";[^}]*\}/);
    expect(type.slice(type.indexOf('state: "locked"')).split("}")[0]).not.toContain("photoUrl");
  });

  it("every member is drawn with their photo, and a crest is never a real logo", () => {
    const page = at("app/club/[id]/index.tsx");
    expect(page).toMatch(/<MyAvatar uri=\{m\.photo\}/);
    expect(page).toMatch(/<Avatar uri=\{m\.photo\}/);
    const tab = at("app/(free)/clubs.tsx");
    expect(tab).toMatch(/<Avatar key=\{f\.id\} uri=\{f\.photo\}/);
    const crest = at("src/Crest.tsx");
    expect(crest).toContain('from "@shared/tracker"');
    expect(crest).toContain("crestOf(club)");
    expect(crest).not.toMatch(/<Image\b|uri:/);
    // two crests on one screen never share a colour by accident
    expect(crest).toContain("crest-${crestIndex(club.id)}");
  });

  it("joining asks, by a code typed or a whole link pasted, read by the one shared rule", () => {
    const join = at("app/club/join.tsx");
    expect(join).toContain('from "@shared/club-app"');
    expect(join).toContain("clubCodeFrom(code)");
    expect(join).toContain("CLUB_CODE_MESSAGE");
    expect(join).toContain("{done.line}");
    expect(join).toMatch(/<FormScreen\b/);
    // sharing sends the link and the code, in the server's words
    expect(at("app/club/[id]/index.tsx")).toContain("Share.share({ message: c.share!.text })");
  });

  it("a captain's tools sit behind one row, and a member is shown none of them", () => {
    const page = at("app/club/[id]/index.tsx");
    expect(page.match(/label="Manage"/g)?.length).toBe(1);
    expect(page).toMatch(/\{c\.captain \? \(\s*<>\s*\{c\.share \? <Hairline \/> : null\}\s*<SettingRow\s+label="Manage"/);
    // nothing planned: the captain is offered to plan, everyone else nothing
    expect(page).toContain(") : c.captain && !c.ended ? (");
    // a game is only ever sent to a club from the list of clubs near you
    const near = at("app/club/[id]/near.tsx");
    expect(near).toContain("plan?vs=");
    expect(at("app/club/[id]/plan.tsx")).toMatch(/<FormScreen\b/);
    expect(at("app/club/[id]/manage.tsx")).toMatch(/<FormScreen\b/);
    expect(at("app/club/start.tsx")).toMatch(/<FormScreen\b/);
  });

  it("the tab leaves its room in the one place and asks for nothing", () => {
    const tab = at("app/(free)/clubs.tsx");
    expect(tab).toContain("<Screen");
    expect(tab).toContain("paddingTop: PAGE_TOP");
    for (const f of clubFiles) expect(code(f), rel(f)).not.toMatch(/turnOnNotifications|requestPermissionsAsync/);
  });

  it("a tapped club notification opens that club, and only for a free account", () => {
    const nav = at("src/navigation.ts");
    expect(nav).toContain("export function pushRoute(");
    expect(at("app/_layout.tsx")).toContain("pushRoute(where.current,");
    // the notification's words say what the notification is for
    expect(at("app/settings.tsx")).toContain("or your club plans a session or a game. Nothing else.");
  });

  it("the example clubs are made up, and every picture is a drill still", () => {
    const fx = read(path.join(root, "src/api/fixtures-clubs.ts"));
    expect(fx).toContain("const m = (file: string) => `${MEDIA_BASE}/drills/posters/${file}.jpg`;");
    // no other address, and no picture from anywhere but that one helper
    expect(code(path.join(root, "src/api/fixtures-clubs.ts")).match(/https?:\/\/[^"`\s]+/g) ?? []).toEqual([
      "https://thestriveapp.com/join?club=${code}",
      "https://thestriveapp.com",
    ]);
    const posters = readdirSync(path.resolve(root, "../public/drills/posters"));
    const stills = [...fx.matchAll(/m\("([a-z0-9-]+)"\)/g)].map((x) => x[1]).concat([...fx.matchAll(/open\("[a-z-]+", "[A-Za-z]+", "([a-z0-9-]+)"/g)].map((x) => x[1]));
    expect(stills.length).toBeGreaterThan(8);
    for (const s of stills) expect(posters, s).toContain(`${s}.jpg`);
    for (const name of ["Renegados FC", "Sunday Pickup", "Gainesville HS", "Diego R.", "Nico A.", "Jalen T.", "Kai M.", "Marcus B."]) expect(fx, name).toContain(name);
    // the example answers every clubs call the app makes
    const api = at("src/api/clubs.ts");
    expect(api).toContain("APP_API.freeClubs");
    expect(api).toContain("APP_API.freeClubJoin");
    expect(api).toContain("APP_API.freePlans");
    expect(api).toContain("APP_API.freePlayTerms");
    expect(read(path.join(root, "src/api/fixtures.ts"))).toContain("/^(clubs|plans|play-terms)(\\/|$)/.test(at)");
  });
});

// "When it shows the player card it should show the pfp" (Nov 24 2026).
describe("the member card", () => {
  const withCard = sources.filter((f) => rel(f).startsWith("app/") && /<MemberCard\b/.test(code(f)));

  it("is given the photo and the @username wherever it is shown", () => {
    expect(withCard.map(rel).sort()).toEqual(["app/(free)/me.tsx", "app/(tabs)/you.tsx", "app/offer.tsx", "app/onboarding/index.tsx"]);
    for (const f of withCard) {
      const src = code(f);
      for (const tag of src.match(/<MemberCard\b[^>]*\/>/g) ?? []) {
        expect(tag, rel(f)).toMatch(/\bphoto=\{photo\}/);
        expect(tag, rel(f)).toMatch(/\busername=\{/);
      }
      expect(src.match(/<MemberCard\b/g)?.length, rel(f)).toBe(src.match(/<MemberCard\b[^>]*\/>/g)?.length);
      expect(src, rel(f)).toContain("const photo = useMyPhoto();");
    }
  });

  it("shows the photo whenever there is one, never the mark in its place", () => {
    const card = code(path.join(root, "src/MemberCard.tsx"));
    expect(card).toMatch(/\{photo \? \(\s*<Image source=\{photo\}/);
  });

  it("the photo is picked before any screen that shows the card", () => {
    const nav = code(path.join(root, "src/navigation.ts"));
    // a new member: before the door. A free account: before the offer.
    expect(nav).toMatch(/case "onboarding":\s*return owed \? "profile" : "onboarding";/);
    expect(nav).toMatch(/if \(owed\) return "profile";\s*return state\.stage === "offer" \? "free-offer" : "free";/);
    // and it is one screen, never a step of the quiz, so nobody is asked twice
    const quiz = code(path.join(root, "app/onboarding/[step].tsx"));
    expect(quiz).not.toMatch(/PhotoStep|UsernameStep/);
    const asks = sources.filter((f) => /<PhotoStep\b/.test(code(f))).map(rel);
    expect(asks).toEqual(["app/profile-setup.tsx"]);
  });

  it("every example account has a photo to show, and none is a real person's", () => {
    const fixtures = read(path.join(root, "src/api/fixtures.ts"));
    expect(fixtures).toMatch(/const ME_PHOTO = m\("\/drills\/posters\/[a-z0-9-]+\.jpg"\);/);
    expect(fixtures).toContain("const photo = l.owed.includes(\"photo\") ? null : ME_PHOTO;");
    // every picture in the example is a drill still from our own site
    for (const m of fixtures.matchAll(/photo(?:Url)?: m\((["`])([^"`]+)\1\)/g)) expect(m[2]).toMatch(/^\/drills\/posters\//);
  });
});

describe("the offer", () => {
  const offer = code(path.join(root, "app/offer.tsx"));
  it("is the server's words and price, with one button and a quiet way on", () => {
    expect(offer).toContain("{o.headline}");
    expect(offer).toContain("{o.price}");
    expect(offer).toContain("label={o.start}");
    expect(offer).toContain("{o.later}");
    // ONE main button (Start). The only other button is the quiet "Send
    // to a parent" (lib/elite/parent-link.ts): the same offer, for the one
    // who pays, not a second ask of the player.
    const buttons = offer.match(/<Button\b[\s\S]*?\/>/g)?.filter((b) => /label=\{o\./.test(b)) ?? [];
    expect(buttons.filter((b) => !/\bquiet\b/.test(b))).toHaveLength(1);
    expect(buttons.filter((b) => /\bquiet\b/.test(b)).map((b) => /label=\{(o\.[\w.]+)\}/.exec(b)?.[1])).toEqual(["o.parent.label"]);
    expect(offer).not.toMatch(/countdown|left today|spots|guarantee|\d+% off|testimonial/i);
  });
  it("opens the checkout in the sheet over the app, then asks the server what happened", () => {
    expect(offer).toContain("await openLink(res.url);");
    expect(offer.indexOf("await openLink(res.url);")).toBeLessThan(offer.indexOf("await confirmUpgrade()"));
    expect(offer.indexOf("await confirmUpgrade()")).toBeLessThan(offer.indexOf("await rereadMe();"));
    expect(offer).not.toMatch(/Linking\.openURL/);
  });
});

// The simulator, Nov 24 2026: on the quiz's typed questions ("What team do
// you play for?") the Next button was pinned to the bottom of the screen
// with position absolute, so it sat behind the keyboard and there was
// nothing to tap. A footer rides on the keyboard only when it is laid out
// in the page's own flow.
describe("a button under a typed question rides on the keyboard", () => {
  const withFooter = sources.filter((f) => rel(f).startsWith("app/") && /<FormScreen[\s\S]*?\bfooter=\{/.test(code(f)));
  it("no screen pins its footer with position absolute", () => {
    expect(withFooter.length).toBeGreaterThanOrEqual(2);
    for (const f of withFooter) {
      const src = code(f);
      for (const m of src.matchAll(/\b(cta|foot|footer)\w*: \{([^}]*)\}/g)) {
        expect(m[2], `${rel(f)} ${m[1]}`).not.toMatch(/position: "absolute"/);
      }
    }
    expect(code(path.join(root, "app/onboarding/[step].tsx"))).toMatch(/\bcta: \{ paddingHorizontal/);
  });
});

// Nov 24 2026 (Coach Yinka: "polish the social half to match the training
// loop"): Friends, Week, Clubs and You are held to the standard Train set:
// one picture and one button at the top, numbers a player can read at a
// glance, and never a plain grey box.
describe("the social half is built like the training loop", () => {
  const friends = code(path.join(root, "app/(free)/friends.tsx"));
  const hero = code(path.join(root, "src/TodayHero.tsx"));

  it("Friends opens on one card with one button until today's post is up", () => {
    expect(friends).toMatch(/\{f\.unlocked \? \([\s\S]{0,260}<Button quiet label="Post my training"[\s\S]{0,120}\) : \(\s*<TodayHero/);
    // the card IS the feed's first locked post, so it is not said twice
    expect(friends).toContain("cards.filter((c) => c.id !== heroCard.id)");
    expect(hero.match(/<Button\b/g)?.length).toBe(1);
    // its words are the feed's own
    expect(hero).toContain("lockedHeadlineLines(locked.first, locked.minutes, locked.kind)");
    // behind them: the friend's profile photo, blurred. Never the post.
    expect(hero).toMatch(/source=\{\{ uri: locked\.photo \}\}[^>]*blurRadius=/);
    expect(hero).not.toMatch(/photoUrl/);
    // nobody is named as not having trained
    expect(friends).toContain("f.faces.filter((x) => !x.you && x.active)");
    expect(hero).not.toMatch(/has not|hasn't|missed|behind/i);
  });

  it("the first-days list never pushes the photos off the first screen", () => {
    expect(friends).toContain("const listAfterFirstPost = f.friendCount > 0 && feedCards.length > 0;");
    expect(friends).toContain("{i === 0 && listAfterFirstPost ? firstDays : null}");
  });

  it("the friends board shows who is ahead at a glance, and the player's own time is the gold one", () => {
    const week = code(path.join(root, "app/(free)/my-week.tsx"));
    expect(week).toContain("barShare(r.minutes, boardTop)");
    expect(week).toMatch(/r\.me \? styles\.barMe : null/);
    expect(week).toMatch(/barMe: \{ backgroundColor: color\.gold \}/);
  });

  it("a club leads with its own picture or its own colour, and its record is numbers", () => {
    const page = code(path.join(root, "app/club/[id]/index.tsx"));
    expect(page).toMatch(/\{heroPhoto \? \([\s\S]{0,400}\) : \(\s*<CrestGlow club=\{c\} \/>/);
    expect(page).toContain("<RecordChip big={c.record}");
    expect(code(path.join(root, "app/(free)/clubs.tsx"))).toMatch(/\) : \(\s*<CrestGlow club=\{club\} \/>/);
    expect(code(path.join(root, "src/MatchupCard.tsx"))).toContain("matchupSplit(matchup.mine.minutes, matchup.theirs.minutes)");
  });

  it("You is one card: who they are, the level their training earned, their two numbers", () => {
    const me = code(path.join(root, "app/(free)/me.tsx"));
    const parts = code(path.join(root, "src/ProfileParts.tsx"));
    // the level and the two numbers are the profile's own pieces, shared
    // with a friend's profile so the two can never drift
    expect(me).toContain("<LevelBar aura={y.aura} />");
    expect(me).toContain("<TwoNumbers weekMinutes={y.weekMinutes} allMinutes={y.allMinutes} mine />");
    expect(parts).toContain("<Eyebrow>{aura.label}</Eyebrow>");
    expect(parts).toMatch(/fill: \{[^}]*backgroundColor: color\.gold/);
    // gold stays on what was earned, never on a button
    expect(me).not.toMatch(/<Button[^>]*gold/);
    // under the card: your clubs and your own training photos, the same
    // reader a friend's view of you comes from
    expect(me).toContain('useProfile("me")');
    expect(me).toContain("<ClubRow clubs={mine.data.clubs} />");
    expect(me).toContain("<PostGrid posts={mine.data.posts} first={mine.data.first} mine />");
  });

  // A social app where a face does nothing feels dead: every place a friend
  // is shown opens their profile, and the profile holds to the house rules.
  it("a friend's face opens their profile, from every place a friend is shown", () => {
    for (const f of ["app/(free)/friends.tsx", "app/(free)/my-week.tsx", "app/club/[id]/index.tsx", "src/FeedCards.tsx"]) {
      expect(code(path.join(root, f)), f).toMatch(/<PlayerLink\b/);
    }
    const parts = code(path.join(root, "src/ProfileParts.tsx"));
    // your own face is never a link (your profile is the You tab), and a
    // link says what the tap does
    expect(parts).toMatch(/if \(you \|\| !id\) \{\s*return \(\s*<View style=\{style\} accessible accessibilityLabel=\{said\}>/);
    expect(parts).toContain("router.push(`/player/${id}` as Href)");
    expect(parts).toContain("Open ${first}'s profile.");
    // a club the viewer is not in is only named: its page is its members'
    expect(parts).toMatch(/c\.mine \? \(\s*<Press[\s\S]{0,120}router\.push\(`\/club\/\$\{c\.id\}`/);
  });

  // A screen the gatekeeper does not know is sent straight back home: a
  // friend's profile was built and its first open bounced to Friends. Every
  // screen in the app has to be named in one of the gatekeeper's lists.
  it("every screen is one the gatekeeper knows", () => {
    const nav = code(path.join(root, "src/navigation.ts"));
    const known = new Set([...nav.matchAll(/"([()a-z-]+)"/g)].map((m) => m[1]));
    const screens = readdirSync(path.join(root, "app"))
      .filter((n) => !n.startsWith("_") && !n.startsWith("+"))
      .map((n) => n.replace(/\.tsx$/, ""));
    expect(screens.length).toBeGreaterThan(15);
    for (const name of screens) expect(known.has(name), `mobile/app/${name} is not in src/navigation.ts`).toBe(true);
  });

  it("a profile never says a player has not trained, sells nothing, and keeps report, remove and block behind one menu", () => {
    const page = code(path.join(root, "app/player/[id].tsx"));
    const parts = code(path.join(root, "src/ProfileParts.tsx"));
    // no photos to show: the grid is simply not there
    expect(parts).toMatch(/export function PostGrid[\s\S]{0,200}if \(posts\.length === 0\) return null;/);
    for (const text of [page, parts]) {
      expect(text).not.toMatch(/has not (trained|posted)|hasn't|no training|missed|streak|upgrade|Strive Pro|\/offer|followers?/i);
    }
    // what the next level takes is said only to the player themselves: the
    // words are the server's, and it sends them to nobody else
    expect(parts).toContain("{aura.next ? (");
    expect(page).toContain("<LevelBar aura={p.aura} />");
    expect(page).toContain("<TwoNumbers weekMinutes={p.weekMinutes} allMinutes={p.allMinutes} mine={p.you} />");
    // one menu, the iPhone's own sheet; the player is never told
    expect(page).toContain("is not told if you report, remove or block them.");
    for (const label of ['"Report the profile photo"', '"Report the Playing for line"', '"Remove from my friends"', "`Block ${first}`"]) {
      expect(page, label).toContain(label);
    }
    // a profile the server will not send is said plainly, never a blank page
    expect(page).toContain("error.status === 404");
    expect(page).toContain("You see a player&apos;s profile once you are friends.");
    // the room for the clock is outside the scroll, like every pushed page
    expect(page).toContain("useBelowClock()");
    // a block can be taken back: Settings, for an account with friends
    const settings = code(path.join(root, "app/settings.tsx"));
    expect(settings).toMatch(/\{social \? \([\s\S]{0,120}label="Blocked players"/);
    expect(code(path.join(root, "app/blocked.tsx"))).toContain("Unblocking does not make you friends again.");
  });
});

// A control that is switched off has to look switched off. The dim sat in a
// plain style beside an animated one, and the animated one is applied last,
// so a disabled button showed at full brightness (the simulator, Nov 24
// 2026: Next on a rating page with a row missed).
describe("a switched-off control looks switched off", () => {
  const ui = read(path.resolve(root, "src/ui.tsx"));
  it("the dim is inside the one animated style", () => {
    const press = ui.slice(ui.indexOf("export function Press("), ui.indexOf("export function Button("));
    const styled = press.slice(press.indexOf("useAnimatedStyle("), press.indexOf("[off, reduce]"));
    expect(styled).toContain("opacity: (off ? DISABLED_OPACITY : 1)");
    expect(press).toMatch(/\[off, reduce\]/);
    // no plain opacity beside the animated style, where it would be dropped
    expect(press).not.toMatch(/disabled \? \{ opacity/);
    expect(press).toContain("style={[style, a]}");
  });
  it("the main button passes its off state down", () => {
    const button = ui.slice(ui.indexOf("export function Button("), ui.indexOf("export function Card("));
    expect(button).toContain("disabled={disabled || busy}");
  });
});
