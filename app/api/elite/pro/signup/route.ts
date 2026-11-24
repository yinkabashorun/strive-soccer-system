import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/elite/supabase/server";
import { establishSession } from "@/lib/elite/session-start";
import { emailHasFreeAccount } from "@/lib/elite/tracker-server";
import { createProMember } from "@/lib/elite/pro-server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { AGREEMENT_REQUIRED_MESSAGE, agreementComplete } from "@/lib/elite/legal";
import { recordConsent } from "@/lib/elite/legal-server";
import { nyToday } from "@/lib/elite/time";
import { isStripeConfigured } from "@/lib/stripe";
import {
  BIRTH_REQUIRED_MESSAGE,
  JOIN_FIELDS_MESSAGE,
  ageFromBirth,
  cleanBirth,
  cleanJoin,
  joinProblem,
} from "@/lib/elite/tracker";
import {
  PAYMENTS_OFF_MESSAGE,
  PRO_EMAIL_EXISTS_MESSAGE,
  PRO_FREE_ACCOUNT_MESSAGE,
} from "@/lib/elite/pro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Create a STRIVE PRO account (074): no invite code, paid by card. The
// same shape as the invite route (app/api/elite/auth/redeem): the login
// with its email already confirmed, the profile, one member row on tier
// "pro" at subscription_status "none", the recorded agreement, and a
// sign-in done here on the server. The browser then opens the checkout
// (/api/elite/pro/checkout); paying is what switches the membership on
// (the Stripe webhook), never this route.
//
// Nothing is created while payments are off: an account that cannot pay
// would only ever see a waiting screen.
//
// POST { birth: { month, year }, firstName, lastName, email, phone, password, agreed }
//   -> { ok, signedIn } | { error, reason?, step? }
export async function POST(req: Request) {
  if (!rateLimit(`pro-signup:${clientIp(req)}`, 10, 10 * 60_000)) {
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
    birth?: { month?: unknown; year?: unknown };
    agreed?: { guardian?: unknown; terms?: unknown };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: PAYMENTS_OFF_MESSAGE, reason: "payments_off" }, { status: 503 });
  }

  const today = nyToday();
  const birth = cleanBirth(body.birth ?? {}, today);
  if (!birth) return NextResponse.json({ error: BIRTH_REQUIRED_MESSAGE, reason: "field", step: "birth" }, { status: 400 });

  // Both boxes, ticked by the person (068). Which words the first box
  // carries follows the player's age (lib/elite/pro.ts proAgeStatement);
  // either way it must be ticked.
  if (!agreementComplete(body.agreed ?? {})) {
    return NextResponse.json({ error: AGREEMENT_REQUIRED_MESSAGE }, { status: 400 });
  }
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
    return NextResponse.json({ error: PAYMENTS_OFF_MESSAGE, reason: "payments_off" }, { status: 503 });
  }

  const fullName = `${fields.firstName} ${fields.lastName}`;

  // 1) the login, email already confirmed. The role goes where only the
  // server can write it (070).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: fields.email,
    password: fields.password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { role: "player" },
  });
  if (createErr || !created?.user) {
    const exists = Boolean(createErr?.message?.includes("already"));
    // An email that holds a FREE training log account (069) cannot also
    // become a member: say so plainly, never a silent second account.
    if (exists && (await emailHasFreeAccount(fields.email))) {
      return NextResponse.json({ error: PRO_FREE_ACCOUNT_MESSAGE, reason: "free_account" }, { status: 400 });
    }
    return NextResponse.json(
      { error: exists ? PRO_EMAIL_EXISTS_MESSAGE : "We couldn't create your account. Please try again.", reason: exists ? "exists" : undefined },
      { status: 400 }
    );
  }
  const userId = created.user.id;

  // 2) the profile row (the auth trigger also does this)
  await admin.from("elite_profiles").upsert({
    id: userId,
    role: "player",
    full_name: fullName,
    email: fields.email,
  });

  // 3) the member row (lib/elite/pro-server.ts createProMember: tier pro,
  // attributed to the head coach, never switched on here).
  const made = await createProMember(admin, {
    profileId: userId,
    fullName,
    age: ageFromBirth(birth, today),
    email: fields.email,
    phone: fields.phone,
  });
  const playerErr = !made;
  if (playerErr) {
    // A login with no member row behind it would be stuck for good.
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    return NextResponse.json({ error: "We couldn't create your account. Please try again." }, { status: 500 });
  }

  // 4) the agreement the person just gave (version, time, where)
  await recordConsent({
    profileId: userId,
    source: "signup",
    userAgent: req.headers.get("user-agent"),
  });

  // 5) signed in here, on the server (lib/elite/session-start.ts). If it
  // does not take, the account exists and the form sends them to sign in,
  // where the app offers the checkout.
  const signedIn = await establishSession(fields.email, fields.password);
  return NextResponse.json({ ok: true, signedIn });
}
