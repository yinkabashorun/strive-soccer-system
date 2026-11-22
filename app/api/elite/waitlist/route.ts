import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { nyToday } from "@/lib/elite/time";
import { isFreeSignupOpen } from "@/lib/elite/tracker-server";
import { BIRTH_REQUIRED_MESSAGE, JOIN_AGE_COOKIE, cleanBirth, oldEnough } from "@/lib/elite/tracker";
import { joinWaitlist } from "@/lib/elite/waitlist-server";
import {
  WAITLIST_COOKIE,
  WAITLIST_EXISTS_MESSAGE,
  cleanSource,
  cleanWaitlist,
  cleanWaitlistCode,
  waitlistProblem,
} from "@/lib/elite/waitlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Join the waitlist for the free app (migration 075). Open only while free
// sign-up is closed; once it is open, /join makes an account instead.
//
// POST { birth: { month, year }, firstName, lastName, phone, team?, ref?, source? }
//   -> { ok } | { error, reason?, step? }
export async function POST(req: Request) {
  if (!rateLimit(`waitlist:${clientIp(req)}`, 6, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many tries. Please wait a few minutes and try again." }, { status: 429 });
  }

  let body: {
    birth?: { month?: unknown; year?: unknown };
    firstName?: unknown;
    lastName?: unknown;
    phone?: unknown;
    team?: unknown;
    ref?: unknown;
    source?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (await isFreeSignupOpen()) {
    return NextResponse.json({ error: "The app is open. Make your account instead.", reason: "open" }, { status: 409 });
  }

  // 13 and older, the free app's own rule. Under 13: nothing is stored,
  // and this visit cannot try another date.
  const today = nyToday();
  if (cookies().get(JOIN_AGE_COOKIE)) return NextResponse.json({ error: "age", reason: "age" }, { status: 403 });
  const birth = cleanBirth(body.birth ?? {}, today);
  if (!birth) return NextResponse.json({ error: BIRTH_REQUIRED_MESSAGE, reason: "field", step: "age" }, { status: 400 });
  if (!oldEnough(birth, today)) {
    cookies().set(JOIN_AGE_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return NextResponse.json({ error: "age", reason: "age" }, { status: 403 });
  }

  const problem = waitlistProblem(body);
  const fields = cleanWaitlist(body);
  if (problem || !fields) {
    return NextResponse.json(
      { error: problem?.message ?? "Check your details and try again.", reason: "field", step: problem?.step ?? "name" },
      { status: 400 }
    );
  }

  const result = await joinWaitlist({
    fields,
    birth,
    ref: cleanWaitlistCode(body.ref),
    source: cleanSource(body.source),
  });
  if (result.kind === "exists") {
    return NextResponse.json({ error: WAITLIST_EXISTS_MESSAGE, reason: "field", step: "phone" }, { status: 409 });
  }
  if (result.kind === "offline") {
    return NextResponse.json({ error: "We could not save that. Please try again." }, { status: 503 });
  }

  // This device remembers the row, so coming back to /join shows how many
  // teammates have joined. The id is never shown or sent anywhere else.
  cookies().set(WAITLIST_COOKIE, result.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  return NextResponse.json({ ok: true });
}
