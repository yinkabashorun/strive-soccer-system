// Does this link take the member out of Strive Elite?
//
// Inside the App Store app, the phone hands two kinds of link to Safari:
// any link that asks for a new window (even one to our own Terms page),
// and any link to another site. A member who taps "Privacy Policy" on the
// agreement screen and lands in Safari has left the app with the form
// half filled in, and App Review reads that as an unfinished app
// (docs/app-store/research-2026-11-18.md, B5).
//
// This file is the ONE rule for every such link a member can tap. It is
// pure (no browser, no server), so the same answer is used by the link
// component (components/elite/AppLink.tsx), the pages and the tests. On
// the website nothing changes: a link that opened a new tab still does.

// The App Store app adds this to its user agent (appendUserAgent in
// native/capacitor.config.ts).
export const NATIVE_UA_TOKEN = "StriveEliteApp/";

export function isNativeUserAgent(userAgent: string | null | undefined): boolean {
  return typeof userAgent === "string" && userAgent.includes(NATIVE_UA_TOKEN);
}

// Our own site, by name. A path ("/terms") is ours without asking.
export const OWN_HOSTS = ["thestriveapp.com", "www.thestriveapp.com"];

// A page of ours shown inside the in-app sheet carries this, so the page
// can leave out the links that would walk the sheet somewhere else.
export const SHEET_PARAM = "sheet";

export type LinkKind =
  | "page" // a page on our own site (Terms, Privacy)
  | "video" // a video file: a clip a family uploaded, a drill
  | "embed" // a film link we can play in place (YouTube, Vimeo)
  | "call" // a Zoom call: opening Zoom is the point
  | "mail" // an email, a phone number, a text: the phone's own app
  | "outside" // any other site
  | "none"; // not an address we will open at all

export type LinkPlan = {
  kind: LinkKind;
  // On the website: does it open in a new tab? (Everything this rule
  // covers did before; mail never did.)
  webNewTab: boolean;
  // Inside the app: a sheet over the screen, the same view, or let the
  // phone take it.
  inApp: "sheet" | "same_view" | "leave";
  // What the sheet shows, when there is one.
  sheetSrc: string | null;
  // The truth about a tap inside the app: does the member end up outside
  // Strive Elite?
  leavesApp: boolean;
  // And is that the point (a call, an email)?
  leavesOnPurpose: boolean;
};

const VIDEO_FILE = /\.(mp4|mov|m4v|webm)$/i;
const ZOOM_HOST = /(^|\.)(zoom\.us|zoom\.com|zoomgov\.com)$/i;
const YOUTUBE_HOST = /(^|\.)(youtube\.com|youtube-nocookie\.com)$/i;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/;

function parse(href: string): URL | null {
  try {
    // A path is read against our own site.
    return new URL(href, `https://${OWN_HOSTS[0]}`);
  } catch {
    return null;
  }
}

function isPath(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

// A YouTube or Vimeo address as the address of its player, or null.
export function embedSrc(href: string): string | null {
  const url = parse(href);
  if (!url || isPath(href) || !/^https?:$/.test(url.protocol)) return null;
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);

  let youtubeId: string | null = null;
  if (host === "youtu.be") youtubeId = parts[0] ?? null;
  else if (YOUTUBE_HOST.test(host)) {
    if (parts[0] === "watch") youtubeId = url.searchParams.get("v");
    else if (["shorts", "embed", "live"].includes(parts[0] ?? "")) youtubeId = parts[1] ?? null;
  }
  if (youtubeId && YOUTUBE_ID.test(youtubeId)) {
    return `https://www.youtube-nocookie.com/embed/${youtubeId}?playsinline=1&rel=0`;
  }

  if (host === "vimeo.com" || host === "www.vimeo.com" || host === "player.vimeo.com") {
    const at = parts[0] === "video" ? 1 : 0;
    const id = parts[at];
    const hash = parts[at + 1] ?? url.searchParams.get("h");
    if (id && /^\d{5,12}$/.test(id)) {
      const h = hash && /^[A-Za-z0-9]{6,20}$/.test(hash) ? `?h=${hash}` : "";
      return `https://player.vimeo.com/video/${id}${h}`;
    }
  }
  return null;
}

function withSheetParam(href: string): string {
  const [beforeHash, hash] = href.split("#", 2);
  const joiner = beforeHash.includes("?") ? "&" : "?";
  return `${beforeHash}${joiner}${SHEET_PARAM}=1${hash ? `#${hash}` : ""}`;
}

// What a link is. `media: "video"` is the caller saying "this address is
// a video file" (a signed link to a clip always is, whatever its name).
export function linkKind(href: string, opts: { media?: "video" } = {}): LinkKind {
  const raw = (href ?? "").trim();
  if (!raw) return "none";
  if (/^(mailto|tel|sms):/i.test(raw)) return "mail";
  if (!isPath(raw) && !/^https?:\/\//i.test(raw)) return "none"; // javascript:, data:, "//host", no scheme
  const url = parse(raw);
  if (!url) return "none";

  // Only a secure address can be shown inside our own (secure) pages. A
  // plain http link a family pasted is still a link; it opens outside.
  const secure = isPath(raw) || url.protocol === "https:";
  const own = isPath(raw) || OWN_HOSTS.includes(url.hostname.toLowerCase());
  if (secure && (opts.media === "video" || VIDEO_FILE.test(url.pathname))) return "video";
  if (secure && own) return "page";
  if (ZOOM_HOST.test(url.hostname)) return "call";
  if (embedSrc(raw)) return "embed";
  return "outside";
}

// The plan for a link: what it does on the website and inside the app.
export function linkPlan(href: string, opts: { media?: "video" } = {}): LinkPlan {
  const raw = (href ?? "").trim();
  const kind = linkKind(raw, opts);
  switch (kind) {
    case "page":
      return { kind, webNewTab: true, inApp: "sheet", sheetSrc: withSheetParam(raw), leavesApp: false, leavesOnPurpose: false };
    case "video":
      return { kind, webNewTab: true, inApp: "sheet", sheetSrc: raw, leavesApp: false, leavesOnPurpose: false };
    case "embed":
      return { kind, webNewTab: true, inApp: "sheet", sheetSrc: embedSrc(raw), leavesApp: false, leavesOnPurpose: false };
    case "call":
      return { kind, webNewTab: true, inApp: "leave", sheetSrc: null, leavesApp: true, leavesOnPurpose: true };
    case "mail":
      return { kind, webNewTab: false, inApp: "leave", sheetSrc: null, leavesApp: true, leavesOnPurpose: true };
    case "outside":
      // Opened in the same view, never as a new window. The phone still
      // hands another site to the browser (only our own site runs inside
      // the app), so this is the one kind that leaves without meaning to.
      return { kind, webNewTab: true, inApp: "same_view", sheetSrc: null, leavesApp: true, leavesOnPurpose: false };
    default:
      return { kind: "none", webNewTab: false, inApp: "leave", sheetSrc: null, leavesApp: false, leavesOnPurpose: false };
  }
}

// Is a page of ours being shown inside the in-app sheet? Read by the
// Terms and Privacy pages from their own address.
export function shownInSheet(value: string | string[] | undefined): boolean {
  return (Array.isArray(value) ? value[0] : value) === "1";
}
