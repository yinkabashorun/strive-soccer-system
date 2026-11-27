// AN INVITE LINK OPENS THE APP (Nov 26 2026: add a friend in person).
//
// A player's invite is a link to the website: thestriveapp.com/join?ref=CODE
// for a teammate, /join?club=CODE for a club. It is what "Send my link"
// shares and what a player's QR code holds (mobile/app/friend/code.tsx).
// On an iPhone with the app installed, the phone hands that link to the
// app instead of the browser (universal links: lib/elite/app-identity.ts
// APP_LINK_PATHS, app/.well-known/apple-app-site-association).
//
// What the app does with a link, all of it here so the phone and the tests
// read one rule:
//   an invite          becomes the app's own screen (INVITE_ROUTE), which
//                      says who it is from and has ONE button. Nothing is
//                      sent until that button is tapped.
//   anything else      is not an invite: the app opens where it always
//                      does, and stays where it is when it was already open.
//
// A link never moves anyone past a gate. The app keeps the invite
// (mobile/src/invite.ts) and opens the screen only for a player who is in
// the free app; a new player finds the code already typed at the door.
//
// Pure, and shared with the phone ("@shared/friend-link").
import { APP_DOMAIN, APP_SCHEME } from "./app-identity";
import { cleanReferralCode } from "./tracker";

export type Invite = { code: string; kind: "friend" | "club" };

// The screen an invite opens (mobile/app/friend/link.tsx).
export const INVITE_ROUTE = "/friend/link";

export function inviteRoute(invite: Invite): string {
  return `${INVITE_ROUTE}?code=${invite.code}&kind=${invite.kind}`;
}

const dots = (s: string) => s.replace(/\./g, "\\.");
// our own website, and nothing that only starts like it
const WEB = new RegExp(`^https?://(?:www\\.)?${dots(APP_DOMAIN)}(?::\\d+)?(?=[/?#]|$)`, "i");
// the app's own scheme: striveelite://join?ref=..., striveelite:///join?ref=...
const OWN = new RegExp(`^${APP_SCHEME}:/{2,3}`, "i");
const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function decoded(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return "";
  }
}

// The invite a link carries, or null. The link is whatever the phone
// handed over: a whole address on our website, the app's own scheme, or a
// bare path. Only the page /join with a real code (8 letters and digits)
// is an invite; a club's code wins when a link carries both, as it does at
// the door (free-door.ts doorCodeFrom).
export function inviteFromLink(raw: unknown): Invite | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text || text.length > 600) return null;
  let rest: string;
  const web = WEB.exec(text);
  const own = web ? null : OWN.exec(text);
  if (web) rest = text.slice(web[0].length);
  else if (own) rest = text.slice(own[0].length);
  else if (ANY_SCHEME.test(text)) return null; // another site, or another app
  else rest = text;
  const noHash = rest.split("#")[0] ?? "";
  const q = noHash.indexOf("?");
  if (q === -1) return null;
  const path = noHash.slice(0, q).replace(/^\/+|\/+$/g, "");
  if (path.toLowerCase() !== "join") return null;
  const pairs = noHash
    .slice(q + 1)
    .split("&")
    .map((part) => {
      const eq = part.indexOf("=");
      return eq === -1 ? ([part, ""] as const) : ([part.slice(0, eq), part.slice(eq + 1)] as const);
    });
  const pick = (name: string) => cleanReferralCode(decoded(pairs.find(([k]) => k === name)?.[1] ?? ""));
  const club = pick("club");
  if (club) return { code: club, kind: "club" };
  const ref = pick("ref");
  return ref ? { code: ref, kind: "friend" } : null;
}

// Where a link opens in the app: the invite's own screen, or home.
export function routeForLink(raw: unknown): string {
  const invite = inviteFromLink(raw);
  return invite ? inviteRoute(invite) : "/";
}

// What the invite's screen reads from its own address. The kind may be
// missing (a code with no word of whose it is): the server then looks it
// up as a club's, then as a teammate's, as it does for a typed code.
export type AskedInvite = { code: string; kind: "friend" | "club" | null };

export function inviteFromParams(params: { code?: unknown; kind?: unknown }): AskedInvite | null {
  const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);
  const code = cleanReferralCode(one(params.code));
  if (!code) return null;
  const kind = one(params.kind);
  return { code, kind: kind === "friend" || kind === "club" ? kind : null };
}

// What the app hands the door's own route when the one button is tapped:
// the invite as a link, so the door reads which kind it is the way it
// reads a pasted link (free-door.ts doorCodeFrom). A code alone is sent
// as it is.
export function inviteAsTyped(invite: AskedInvite): string {
  return invite.kind === "club" ? `?club=${invite.code}` : invite.kind === "friend" ? `?ref=${invite.code}` : invite.code;
}

// ---- The invite's screen: the words ------------------------------------

export const INVITE_EYEBROW = "Invite";
export const INVITE_NOT_NOW = "Not now";
export const INVITE_DONE = "Done";
export const INVITE_SENT_EYEBROW = "Asked";
export const INVITE_NOT_ONE = "That link is not an invite. Ask your teammate to send the link again.";

export function inviteFriendTitle(first: string): string {
  return `${first} invited you`;
}
export function inviteFriendButton(first: string): string {
  return `Send ${first} a friend request`;
}
export function inviteClubButton(name: string): string {
  return `Ask to join ${name}`;
}

// What the server says an invite is, before anything is sent: a teammate
// by first name and initials (never a photo: the two are not friends yet),
// or a club by its name (its id draws its crest, which is never a logo).
// `body` is the website's own line for what the button does.
export type AppInvite =
  | { ok: true; kind: "friend"; code: string; first: string; initials: string; body: string }
  | { ok: true; kind: "club"; code: string; id: string; name: string; body: string }
  | { ok: false; error: string };
