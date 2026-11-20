import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/elite/supabase/server";
import { establishSession } from "@/lib/elite/session-start";
import { normalizePhone } from "@/lib/elite/sms";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { AGREEMENT_REQUIRED_MESSAGE, agreementComplete } from "@/lib/elite/legal";
import { recordConsent } from "@/lib/elite/legal-server";
import { nyToday } from "@/lib/elite/time";
import { isFreeSignupOpen, joinClubByCode, requestFriend } from "@/lib/elite/tracker-server";
import {
  BIRTH_REQUIRED_MESSAGE,
  JOIN_AGE_COOKIE,
  JOIN_CLOSED_MESSAGE,
  JOIN_FIELDS_MESSAGE,
  UNDER_AGE_LINE,
  cleanBirth,
  cleanClubCode,
  cleanJoin,
  joinProblem,
  cleanReferralCode,
  freeLanding,
  newReferralCode,
  oldEnough,
} from "@/lib/elite/tracker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Create a FREE account: the free app (migration 069). No invite code.
// Refused unless a coach has opened free sign-up at /coach/free, and
// refused for anyone under 13 (the birth month and year come first; an
// answer under 13 creates nothing and stores nothing).
//
// What is created: the login, the profile (role player) and one
// elite_trackers row. Never an elite_players row, so a free account is
// invisible to the plan builder, the roster and every other member query.
//
// POST { birth: { month, year }, firstName, lastName, email, phone, password, ref?, club?, agreed }
//   -> { ok, signedIn, next } | { error, reason? }
export async function POST(req: Request) {
  if (!rateLimit(`join:${clientIp(req)}`, 10, 10 * 60_000)) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429 }
    );
  }

  let body: {
    firstName?: unknown;
    lastName?: unknown;
    email?: unknown;
    phone?: unknown;
    password?: unknown;
    ref?: unknown;
    club?: unknown;
    birth?: { month?: unknown; year?: unknown };
    agreed?: { guardian?: unknown; terms?: unknown };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // The switch first: while it is closed nothing else is even looked at.
  if (!(await isFreeSignupOpen())) {
    return NextResponse.json({ error: JOIN_CLOSED_MESSAGE, reason: "closed" }, { status: 403 });
  }
  // 13 and older. The flag the age question left in this browser (an
  // answer under 13 earlier in this visit) refuses on its own; so does a
  // birth month and year under 13 sent here directly.
  const today = nyToday();
  const flagged = (req.headers.get("cookie") ?? "")
    .split(/;\s*/)
    .some((c) => c.startsWith(`${JOIN_AGE_COOKIE}=`));
  const birth = cleanBirth(body.birth ?? {}, today);
  if (flagged || (birth && !oldEnough(birth, today))) {
    return NextResponse.json({ error: UNDER_AGE_LINE, reason: "age" }, { status: 403 });
  }
  if (!birth) return NextResponse.json({ error: BIRTH_REQUIRED_MESSAGE }, { status: 400 });

  // No account without the agreement (068): both boxes, ticked by the
  // person. Checked before anything is created.
  if (!agreementComplete(body.agreed ?? {})) {
    return NextResponse.json({ error: AGREEMENT_REQUIRED_MESSAGE }, { status: 400 });
  }
  // A typed detail the form should have caught: say which one, and which
  // screen it lives on, so the form takes the person straight back to it.
  const problem = joinProblem(body);
  const fields = cleanJoin(body);
  if (problem || !fields) {
    return NextResponse.json(
      { error: problem?.message ?? JOIN_FIELDS_MESSAGE, reason: "field", step: problem?.step ?? "name" },
      { status: 400 }
    );
  }

  const admin = createServiceClient();
  if (!admin) {
    return NextResponse.json({ error: JOIN_CLOSED_MESSAGE, reason: "closed" }, { status: 503 });
  }

  const fullName = `${fields.firstName} ${fields.lastName}`;

  // 1) the login, email already confirmed. The auth trigger reads the role
  // off the metadata and makes the matching profile row.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: fields.email,
    password: fields.password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { role: "player" },
  });
  if (createErr || !created?.user) {
    const msg = createErr?.message?.includes("already")
      ? "An account with that email already exists. Sign in instead."
      : "We couldn't create your account. Please try again.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const userId = created.user.id;

  // 2) the profile row (the auth trigger also does this)
  await admin.from("elite_profiles").upsert({
    id: userId,
    role: "player",
    full_name: fullName,
    email: fields.email,
  });

  // 3) who sent them, when the link carried a real code. A code that
  // matches nobody is ignored: it never stops a sign-up.
  let referredBy: string | null = null;
  const ref = cleanReferralCode(body.ref);
  if (ref) {
    const { data: sender } = await admin
      .from("elite_trackers")
      .select("profile_id")
      .eq("referral_code", ref)
      .maybeSingle();
    referredBy = (sender?.profile_id as string | undefined) ?? null;
  }

  // 4) the free account itself, with its own link to share. The code is
  // unique in the database; on the rare clash, draw again.
  let made = false;
  for (let attempt = 0; attempt < 4 && !made; attempt++) {
    const { error } = await admin.from("elite_trackers").insert({
      profile_id: userId,
      phone: normalizePhone(fields.phone) ?? fields.phone,
      birth_year: birth.year,
      birth_month: birth.month,
      referral_code: newReferralCode(),
      referred_by: referredBy,
    });
    made = !error;
  }
  if (!made) {
    // A login with no account behind it would be stuck on a waiting
    // screen for good. Take it back out and say so.
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    return NextResponse.json(
      { error: "We couldn't create your account. Please try again." },
      { status: 500 }
    );
  }

  // 4b) joining with a teammate's link sends that teammate a friend
  // request to accept (072); they are friends once it is accepted.
  // referred_by above stays as the count the coach sees. Best effort: a
  // failure here never undoes the account.
  if (referredBy) await requestFriend(userId, referredBy).catch(() => "error");

  // 4c) a club's link: the new player joins the club, and with it is
  // friends with everyone already on it. Best effort, like the friendship.
  const club = cleanClubCode(body.club);
  if (club) await joinClubByCode(userId, club).catch(() => "error");

  // 5) the agreement the person just gave (version, time, where).
  await recordConsent({
    profileId: userId,
    source: "signup",
    userAgent: req.headers.get("user-agent"),
  });

  // 6) sign them in here, on the server, the same way an invite does
  // (lib/elite/session-start.ts). If it does not take, the account still
  // exists and the form sends them to sign in. A new account has not
  // answered the four questions yet, so it opens on them.
  const signedIn = await establishSession(fields.email, fields.password);
  return NextResponse.json({ ok: true, signedIn, next: freeLanding(false) });
}
