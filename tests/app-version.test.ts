import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  APP_LINK_HOSTS,
  GET_APP_BODY,
  GET_APP_BODY_NO_CODE,
  GET_APP_BUTTON,
  GET_APP_TITLE,
  GET_APP_WEB,
  NO_APP_VERSION,
  UPDATE_BODY,
  UPDATE_BUTTON,
  UPDATE_NO_LINK,
  UPDATE_TITLE,
  cleanAppLink,
  cleanAppVersion,
  cleanBuild,
  mustUpdate,
} from "@/lib/elite/app-version";

const src = (p: string) => readFileSync(p, "utf8");
// code only: a comment may say what the code must never do
const code = (p: string) => src(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("the one link to the app", () => {
  it("is Apple's own: TestFlight or the App Store, over https, and nothing else", () => {
    expect(APP_LINK_HOSTS).toEqual(["apps.apple.com", "testflight.apple.com"]);
    expect(cleanAppLink("https://testflight.apple.com/join/AbC123")).toBe("https://testflight.apple.com/join/AbC123");
    expect(cleanAppLink("  https://apps.apple.com/us/app/strive/id123  ")).toBe("https://apps.apple.com/us/app/strive/id123");
    for (const bad of [
      "http://testflight.apple.com/join/x",
      "https://testflight.apple.com.evil.com/join/x",
      "https://evil.com/?https://testflight.apple.com",
      "https://user:pw@apps.apple.com/x",
      "https://apps.apple.com:8443/x",
      "javascript:alert(1)",
      "itms-apps://apps.apple.com/x",
      "",
      null,
      42,
      "https://apps.apple.com/" + "a".repeat(400),
    ]) {
      expect(cleanAppLink(bad), String(bad)).toBeNull();
    }
  });
});

describe("the oldest build that still works", () => {
  it("a build number is a whole number, typed or reported", () => {
    expect(cleanBuild("10")).toBe(10);
    expect(cleanBuild(10)).toBe(10);
    expect(cleanBuild(" 9 ")).toBe(9);
    expect(cleanBuild(0)).toBe(0);
    for (const bad of ["", "10.5", "-1", "abc", "1e3", null, undefined, 1.5, -2, 1e9, Number.NaN]) expect(cleanBuild(bad), String(bad)).toBeNull();
  });

  it("only a build under the number stops, and only when both numbers are known", () => {
    const v = { minBuild: 10, link: null };
    expect(mustUpdate("9", v)).toBe(true);
    expect(mustUpdate("10", v)).toBe(false);
    expect(mustUpdate("11", v)).toBe(false);
    // 0 means every build works: where it starts
    expect(mustUpdate("1", NO_APP_VERSION)).toBe(false);
    expect(mustUpdate("1", { minBuild: 0, link: "https://testflight.apple.com/join/x" })).toBe(false);
  });

  it("fails OPEN: nothing that cannot be read ever locks a player out", () => {
    const v = { minBuild: 10, link: null };
    expect(mustUpdate(null, v)).toBe(false);
    expect(mustUpdate(undefined, v)).toBe(false);
    expect(mustUpdate("not a build", v)).toBe(false);
    expect(mustUpdate("9", null)).toBe(false);
    expect(mustUpdate("9", undefined)).toBe(false);
    // an answer that is not the shape expected reads as "every build works"
    expect(cleanAppVersion(null)).toEqual(NO_APP_VERSION);
    expect(cleanAppVersion({ minBuild: "x", link: "http://evil.com" })).toEqual(NO_APP_VERSION);
    expect(cleanAppVersion({ minBuild: 10, link: "https://testflight.apple.com/join/x" })).toEqual({
      minBuild: 10,
      link: "https://testflight.apple.com/join/x",
    });
  });

  it("the server's reader answers 'every build works' whenever the setting cannot be read", () => {
    const server = src("lib/elite/tracker-server.ts");
    const fn = server.slice(server.indexOf("export async function getAppVersion"), server.indexOf("// ---- Who is looking"));
    expect(fn).toContain("if (!admin) return NO_APP_VERSION;");
    expect(fn).toContain("if (error || !data) return NO_APP_VERSION;");
    expect(fn).toMatch(/catch \{\s*return NO_APP_VERSION;/);
    expect(fn).toContain('cleanAppVersion({ minBuild: of("app_min_build"), link: of("app_link") })');
  });

  it("the app asks a public route, fresh every time", () => {
    const route = src("app/api/app/version/route.ts");
    expect(route).toContain('publicAppRoute({ name: "version" }');
    expect(route).toContain('export const dynamic = "force-dynamic"');
    expect(route).toContain('export const fetchCache = "force-no-store"');
  });

  it("only a coach saves it; a link that is not Apple's is refused; the stored value is never null", () => {
    const actions = src("lib/elite/tracker-actions.ts");
    const fn = actions.slice(actions.indexOf("export async function saveAppVersion"), actions.indexOf("// Change the recommended weekly target"));
    expect(fn).toContain('if (c.kind === "no") return fail(');
    expect(fn).toContain("if (typed && !link) return fail(");
    expect(fn).toContain("if (minBuild === null) return fail(");
    expect(fn).toContain('{ key: "app_link", value: link ?? "", updated_at: now }');
    expect(fn).toContain('{ key: "app_min_build", value: minBuild, updated_at: now }');
  });
});

describe("the update screen in the iPhone app", () => {
  const gate = code("mobile/src/UpdateGate.tsx");
  const layout = code("mobile/app/_layout.tsx");

  it("stands in front of the whole app, signed in or not", () => {
    expect(layout).toMatch(/<UpdateGate>\s*<Gatekeeper \/>\s*<Stack/);
    expect(layout).toMatch(/<\/Stack>\s*<\/UpdateGate>/);
  });

  it("asks without a sign-in, keeps nothing on the phone, and lets everyone through when there is no answer", () => {
    expect(gate).toContain('api<AppVersion>("/api/app/version", { open: true, timeoutMs: 8000 })');
    expect(gate).toContain("if (!mustUpdate(ownBuild(), version)) return <>{children}</>;");
    expect(gate).not.toMatch(/AsyncStorage|SecureStore|useQuery|persist/);
    // a failed ask is tried again the next time the app comes to the front
    expect(gate).toMatch(/\.catch\(\(\) => \{\s*asked\.current = 0;/);
  });

  it("takes the launch screen down itself, and its one button opens only Apple's link", () => {
    expect(gate).toContain("SplashScreen.hideAsync()");
    expect(gate).toContain("const safe = cleanAppLink(link);");
    expect(gate).toContain("Linking.openURL(safe)");
    expect(gate.match(/Linking\.openURL\(/g)?.length).toBe(1);
  });

  it("the example build can picture it", () => {
    expect(src("mobile/src/api/fixtures.ts")).toContain('if (path.startsWith("/api/app/version"))');
    expect(src("mobile/sim/shots.sh")).toContain("57-update|update|-|9");
  });
});

describe("an invite opened on an iPhone points to the app", () => {
  const page = code("app/(join)/join/page.tsx");

  it("only once the coaches saved the link, only on an iPhone, and the website is one tap away", () => {
    expect(page).toContain('const app = searchParams?.web === "1" ? null : (await getAppVersion()).link;');
    expect(page).toContain('if (app && isIos(headers().get("user-agent") ?? "")) {');
    expect(page).toContain("<GetTheApp invite={invite} code={club ?? ref} link={app} webHref={`/join?${web.toString()}`} />");
    // the way past it carries the invite with it
    expect(page).toContain('if (ref) web.set("ref", ref);');
    expect(page).toContain('if (club) web.set("club", club);');
  });

  it("shows the code to type at the app's door, and never a player's photo", () => {
    const view = code("components/elite/GetTheApp.tsx");
    expect(view).toContain("{code ? GET_APP_BODY : GET_APP_BODY_NO_CODE}");
    expect(view).toContain("href={link}");
    expect(view).toContain("photo={null}");
  });
});

describe("a screen that breaks on a phone reaches the coaches", () => {
  const layout = code("mobile/app/_layout.tsx");
  const report = code("mobile/src/report-error.ts");

  it("the app has its own broken-screen page, and reports what nothing caught", () => {
    expect(layout).toContain("export const ErrorBoundary = BrokenScreen;");
    expect(layout).toContain("reportUncaught();");
    expect(layout).toContain("noteScreen(segments);");
    const screen = code("mobile/src/BrokenScreen.tsx");
    expect(screen).toContain('reportAppError(error, "screen");');
    // it stands outside the app's wrappers: nothing that needs them
    expect(screen).not.toMatch(/useSafeAreaInsets|useMe\(|useAuth\(|useRouter\(/);
  });

  it("goes to the recorder the website uses, through the one API client, never from the example build", () => {
    expect(report).toContain('void api("/api/elite/errors", {');
    expect(report).toContain("open: true");
    expect(report).toContain("if (FIXTURES) return;");
    expect(report).not.toMatch(/(^|[^.\w])fetch\(/);
    // the error's own words and where it was: nothing of the player
    expect(report).toContain("body: { message: `[${kind}] ${message}`, stack, route }");
    // the handler that was there before still runs
    expect(report).toContain("before?.(error, isFatal);");
  });
});

describe("the words", () => {
  it("are plain: no dash clauses, no shouting, and they say nothing is lost", () => {
    const all = [UPDATE_TITLE, UPDATE_BODY, UPDATE_BUTTON, UPDATE_NO_LINK, GET_APP_TITLE, GET_APP_BODY, GET_APP_BODY_NO_CODE, GET_APP_BUTTON, GET_APP_WEB];
    for (const line of all) {
      expect(line).not.toMatch(/[—–]/);
      expect(line).not.toMatch(/\b(AI|automated|algorithm)\b/i);
      expect(line).not.toMatch(/!/);
    }
    expect(UPDATE_BODY).toContain("Your training, your friends and your clubs are all still there.");
  });
});
