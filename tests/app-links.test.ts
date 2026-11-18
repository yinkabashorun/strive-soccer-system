import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  NATIVE_UA_TOKEN,
  SHEET_PARAM,
  embedSrc,
  isNativeUserAgent,
  linkKind,
  linkPlan,
  shownInSheet,
} from "../lib/elite/app-links";
import { ROOT, memberFiles, rel } from "./helpers/member-files";

const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

// Nothing bounces to Safari inside the iPhone app (App Store punch list
// A20). One rule decides what every outgoing link does; these hold the
// rule, and hold every member screen to it.

const CLIP =
  "https://abc.supabase.co/storage/v1/object/sign/elite-film/progress/p1/2/1700000000.mov?token=xyz";

describe("what a link is", () => {
  it("our own pages, by path or by name", () => {
    expect(linkKind("/terms")).toBe("page");
    expect(linkKind("/privacy#deleting")).toBe("page");
    expect(linkKind("https://thestriveapp.com/support")).toBe("page");
    expect(linkKind("https://www.thestriveapp.com/terms")).toBe("page");
  });

  it("a video file, by its name or because the caller says so", () => {
    expect(linkKind(CLIP)).toBe("video");
    expect(linkKind("/drills/speed-the-cross.mp4")).toBe("video");
    expect(linkKind("https://files.example.com/a/b/clip.MP4?x=1")).toBe("video");
    // a signed link with no file ending is still the family's clip
    expect(linkKind("https://abc.supabase.co/storage/v1/object/sign/x/y?token=1", { media: "video" })).toBe("video");
  });

  it("a film link we can play in place", () => {
    expect(linkKind("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("embed");
    expect(linkKind("https://youtu.be/dQw4w9WgXcQ?t=10")).toBe("embed");
    expect(linkKind("https://youtube.com/shorts/QoYKWmCN5lM")).toBe("embed");
    expect(linkKind("https://vimeo.com/123456789")).toBe("embed");
  });

  it("a Zoom call, an email, a phone number", () => {
    expect(linkKind("https://zoom.us/j/1234567890?pwd=abc")).toBe("call");
    expect(linkKind("https://us02web.zoom.us/j/1234567890")).toBe("call");
    expect(linkKind("mailto:coach@example.com?subject=Hi")).toBe("mail");
    expect(linkKind("tel:+15550100")).toBe("mail");
    expect(linkKind("sms:+15550100")).toBe("mail");
  });

  it("any other site is outside", () => {
    expect(linkKind("https://www.hudl.com/video/3/123/abc")).toBe("outside");
    expect(linkKind("https://app.veo.co/matches/abc")).toBe("outside");
    expect(linkKind("https://totalballmastery.netlify.app/")).toBe("outside");
    // a look-alike of our own name is not ours
    expect(linkKind("https://thestriveapp.com.evil.example/terms")).toBe("outside");
    expect(linkKind("https://notzoom.us.example/j/1")).toBe("outside");
  });

  it("a plain http link a family pasted is still a link, opened outside", () => {
    // the film form accepts http; a secure page cannot show it in place
    expect(linkKind("http://old-site.example/film")).toBe("outside");
    expect(linkKind("http://old-site.example/game.mp4")).toBe("outside");
    expect(linkKind("http://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("embed");
  });

  it("an address we will not open at all", () => {
    expect(linkKind("")).toBe("none");
    expect(linkKind("   ")).toBe("none");
    expect(linkKind("javascript:alert(1)")).toBe("none");
    expect(linkKind("data:text/html,hi")).toBe("none");
    expect(linkKind("//evil.example/x")).toBe("none");
    expect(linkKind("zoom.us/j/123")).toBe("none");
  });
});

describe("the plan: the website, and inside the app", () => {
  it("our own page: a new tab on the website, a sheet inside the app", () => {
    const plan = linkPlan("/terms");
    expect(plan).toMatchObject({ kind: "page", webNewTab: true, inApp: "sheet", leavesApp: false });
    expect(plan.sheetSrc).toBe(`/terms?${SHEET_PARAM}=1`);
    expect(linkPlan("/privacy?x=1#deleting").sheetSrc).toBe(`/privacy?x=1&${SHEET_PARAM}=1#deleting`);
  });

  it("a clip plays in the app", () => {
    const plan = linkPlan(CLIP, { media: "video" });
    expect(plan).toMatchObject({ kind: "video", inApp: "sheet", leavesApp: false });
    expect(plan.sheetSrc).toBe(CLIP);
  });

  it("a YouTube or Vimeo film link plays in the app, through its player", () => {
    expect(linkPlan("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toMatchObject({
      kind: "embed",
      inApp: "sheet",
      leavesApp: false,
      sheetSrc: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?playsinline=1&rel=0",
    });
    expect(embedSrc("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?playsinline=1&rel=0"
    );
    expect(embedSrc("https://vimeo.com/123456789/abcdef1234")).toBe(
      "https://player.vimeo.com/video/123456789?h=abcdef1234"
    );
    expect(embedSrc("https://www.youtube.com/watch?v=<script>")).toBeNull();
    expect(embedSrc("https://www.youtube.com/@strivesoccerfc")).toBeNull();
    expect(embedSrc("https://vimeo.com/channels/staffpicks")).toBeNull();
    expect(embedSrc("/watch?v=dQw4w9WgXcQ")).toBeNull();
  });

  it("a Zoom call and an email leave the app, and that is the point", () => {
    expect(linkPlan("https://zoom.us/j/1234567890")).toMatchObject({
      kind: "call",
      webNewTab: true,
      inApp: "leave",
      leavesApp: true,
      leavesOnPurpose: true,
    });
    expect(linkPlan("mailto:coach@example.com")).toMatchObject({
      kind: "mail",
      webNewTab: false,
      inApp: "leave",
      leavesOnPurpose: true,
    });
  });

  it("any other site opens in the same view, never as a new window, and the rule says it leaves", () => {
    expect(linkPlan("https://www.hudl.com/video/3/123/abc")).toMatchObject({
      kind: "outside",
      webNewTab: true,
      inApp: "same_view",
      leavesApp: true,
      leavesOnPurpose: false,
    });
  });

  it("only a call, an email or another site ever leaves the app", () => {
    const hrefs = [
      "/terms",
      "/privacy",
      CLIP,
      "/drills/x.mp4",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://zoom.us/j/1",
      "mailto:a@b.co",
      "https://www.hudl.com/x",
      "",
    ];
    for (const href of hrefs) {
      const plan = linkPlan(href);
      expect(plan.leavesApp, href).toBe(["call", "mail", "outside"].includes(plan.kind));
      // a sheet always has something to show
      if (plan.inApp === "sheet") expect(plan.sheetSrc, href).toBeTruthy();
    }
  });

  it("nothing we refuse to open gets a link", () => {
    expect(linkPlan("javascript:alert(1)")).toMatchObject({ kind: "none", webNewTab: false, sheetSrc: null });
  });
});

describe("knowing the app, and the sheet", () => {
  it("the app is known by its user agent", () => {
    expect(isNativeUserAgent(`Mozilla/5.0 (iPhone) AppleWebKit/605 ${NATIVE_UA_TOKEN}1`)).toBe(true);
    expect(isNativeUserAgent("Mozilla/5.0 (iPhone) AppleWebKit/605 Safari/604")).toBe(false);
    expect(isNativeUserAgent(undefined)).toBe(false);
  });

  it("a page knows it is inside the sheet from its own address", () => {
    expect(shownInSheet("1")).toBe(true);
    expect(shownInSheet(["1", "0"])).toBe(true);
    expect(shownInSheet("0")).toBe(false);
    expect(shownInSheet(undefined)).toBe(false);
  });

  it("the Terms and Privacy pages drop their way out when shown in the sheet", () => {
    for (const page of ["app/terms/page.tsx", "app/privacy/page.tsx"]) {
      const src = read(page);
      expect(src, page).toContain("shownInSheet(searchParams?.[SHEET_PARAM])");
      expect(src, page).toContain('<Wordmark href={sheet ? null : "/"} />');
      expect(src, page).toMatch(/\{!sheet && \(\s*<Link href="\/login"/);
    }
  });
});

// The guard. A new window is the one thing that always throws a member
// out of the app, so only the link that follows the rule may ask for one.
describe("every member screen follows the rule", () => {
  const LINK = "components/elite/AppLink.tsx";
  const files = memberFiles();

  it("the link component is on the member side and follows the one rule", () => {
    expect(files.map(rel)).toContain(LINK);
    const src = read(LINK);
    expect(src).toContain('from "@/lib/elite/app-links"');
    expect(src).toContain("linkPlan(href");
    // the website keeps its new tab; inside the app the tap is taken over
    expect(src).toContain('target: "_blank"');
    expect(src).toContain("e.preventDefault()");
  });

  it("no other member screen asks for a new window", () => {
    const bad: string[] = [];
    for (const f of files) {
      if (rel(f) === LINK) continue;
      const src = readFileSync(f, "utf8");
      if (/_blank/.test(src)) bad.push(`${rel(f)}: _blank`);
      if (/window\.open\s*\(/.test(src)) bad.push(`${rel(f)}: window.open`);
    }
    expect(bad).toEqual([]);
  });

  it("the screens that used to open a new tab now use the link", () => {
    for (const name of [
      "AgreementScreen",
      "SignupForm",
      "ProgressVideoCard",
      "FilmTimeline",
      "CourseLibrary",
      "FilmRoomCard",
      "CheckinBooking",
      "CoachingCallsCard",
    ]) {
      expect(read(`components/elite/${name}.tsx`), name).toContain("<AppLink");
    }
    // the family's own clip is always a video, whatever its address ends in
    expect(read("components/elite/ProgressVideoCard.tsx")).toMatch(/<AppLink[\s\S]{0,80}media="video"/);
  });
});
