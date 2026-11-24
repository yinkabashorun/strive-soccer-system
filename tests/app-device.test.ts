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
describe("a tab's page", () => {
  const tabs = files(path.join(root, "app/(tabs)")).filter((f) => !f.endsWith("_layout.tsx"));
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
  const you = code(path.join(root, "app/(tabs)/you.tsx"));
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

  it("has four tabs: Friends, Week, Courses, You", () => {
    expect(pages.map(names).sort()).toEqual(["courses", "friends", "me", "my-week"]);
    const tabs = code(path.join(root, "src/tabs.ts"));
    for (const p of pages) expect(tabs, names(p)).toContain(`route: "${names(p)}"`);
    expect(code(path.join(root, "app/_layout.tsx"))).toContain('<Stack.Screen name="(free)"');
  });

  it("draws its tabs only for an account that belongs in it", () => {
    expect(layout.indexOf('if (area !== "free")')).toBeGreaterThan(-1);
    expect(layout.indexOf('if (area !== "free")')).toBeLessThan(layout.indexOf("<NativeTabs"));
    expect(layout).toContain("<Holding");
    expect(layout).toMatch(/<NativeTabs\.Trigger[^>]*disableAutomaticContentInsets/);
  });

  it("every tab's page leaves its room in the one place, like a member's", () => {
    for (const f of pages) {
      expect(code(f), rel(f)).toContain("<Screen");
      expect(code(f), rel(f)).not.toContain("useSafeAreaInsets");
      expect(code(f), rel(f)).toContain("paddingTop: PAGE_TOP");
    }
  });

  it("shows the same Courses shelf, locked by the server, with no word about it", () => {
    const courses = code(path.join(root, "app/(free)/courses.tsx"));
    expect(courses).toContain("<CoursesList />");
    expect(courses).not.toMatch(/upgrade|offer|Pro\b|unlock|member/i);
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

// "When it shows the player card it should show the pfp" (Nov 24 2026).
describe("the member card", () => {
  const withCard = sources.filter((f) => rel(f).startsWith("app/") && /<MemberCard\b/.test(code(f)));

  it("is given the photo and the @username wherever it is shown", () => {
    expect(withCard.map(rel).sort()).toEqual(["app/(tabs)/you.tsx", "app/offer.tsx", "app/onboarding/index.tsx"]);
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
