import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/elite/supabase/server";
import { sendPlayerEmail } from "@/lib/elite/email";
import { normalizePhone } from "@/lib/elite/sms";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { inviteRoleOf, redeemFieldsComplete } from "@/lib/elite/invite-link";

export const runtime = "nodejs";

// Redeem an invite code and create a fully-provisioned account: a player
// (the default) or, for a coach code (054), a coach profile with no player
// row. Uses the service role so the new user is email-confirmed immediately
// (no confirmation link) and the invite is validated server-side.
//
// POST { code, fullName, email, phone, password } -> { ok, role } | { error }
export async function POST(req: Request) {
  // Invite codes are STRIVE-XXXXXX (6 hex chars, ~16.7M combinations) with
  // no other throttling anywhere - without this, someone could script
  // guesses against real, unused codes and burn a family's invite before
  // they ever redeem it themselves. 10 attempts / 10 minutes per IP is
  // generous for a real typo-prone human, brutal for a guessing script.
  if (!rateLimit(`redeem:${clientIp(req)}`, 10, 10 * 60_000)) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429 }
    );
  }

  let body: {
    code?: string;
    fullName?: string;
    email?: string;
    phone?: string;
    playerPhone?: string;
    password?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const code = (body.code ?? "").trim().toUpperCase();
  const fullName = (body.fullName ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const phone = (body.phone ?? "").trim();
  const playerPhone = (body.playerPhone ?? "").trim();
  const password = body.password ?? "";

  if (!code) return NextResponse.json({ error: "An invite code is required." }, { status: 400 });
  if (!fullName || !email || password.length < 8) {
    return NextResponse.json(
      { error: "Enter your name, email, phone, and a password of at least 8 characters." },
      { status: 400 }
    );
  }

  const admin = createServiceClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Sign-up isn't fully configured yet. Please contact your coach." },
      { status: 503 }
    );
  }

  // 1) validate the code (unused + not expired)
  const { data: invite } = await admin
    .from("elite_invite_codes")
    .select("id, created_by, used_by, expires_at, role")
    .eq("code", code)
    .maybeSingle();

  if (!invite) {
    return NextResponse.json({ error: "That invite code isn't valid. Check it against the text your coach sent." }, { status: 400 });
  }
  if (invite.used_by) {
    // A used code means the account already exists: say so, and the form
    // shows a sign-in link (reason "used"). See lib/elite/invite-link.ts.
    return NextResponse.json(
      {
        error: "That invite code already created an account. Sign in instead.",
        reason: "used",
      },
      { status: 400 }
    );
  }
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "That invite code has expired." }, { status: 400 });
  }
  // The code decides what gets created (054). A family's code needs the
  // parent phone (every text goes there); a coach's code does not.
  const role = inviteRoleOf(invite.role);
  if (!redeemFieldsComplete(role, { fullName, email, phone, password })) {
    return NextResponse.json(
      { error: "Enter your name, email, phone, and a password of at least 8 characters." },
      { status: 400 }
    );
  }

  // 2) create the auth user (email pre-confirmed). The auth trigger reads
  // the role off the metadata and creates the matching profile row.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });
  if (createErr || !created?.user) {
    const msg = createErr?.message?.includes("already")
      ? "An account with that email already exists. Try signing in."
      : "We couldn't create your account. Please try again.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const userId = created.user.id;

  // 3) ensure the profile row (the auth trigger also does this)
  await admin.from("elite_profiles").upsert({
    id: userId,
    role,
    full_name: fullName,
    email,
  });

  // A coach is a profile, nothing more: no player row, no membership
  // gate, no welcome text. Burn the code and send them to the dashboard.
  if (role === "coach") {
    await admin
      .from("elite_invite_codes")
      .update({ used_by: userId, used_at: new Date().toISOString() })
      .eq("id", invite.id);
    return NextResponse.json({ ok: true, role });
  }

  // 4) provision the player linked to the inviting coach. subscription_status
  // starts at "none", NOT "active" - there is no real payment-to-account
  // link yet (Stripe checkout doesn't provision accounts), so redemption
  // alone was silently granting full paid access to anyone with a code
  // regardless of whether they'd actually paid. The coach flips this to
  // "active" from the player's profile once payment is confirmed; the
  // membership gate in app/(player)/layout.tsx shows a clean "reach out to
  // your coach" screen in the meantime, and onboarding/intake still works
  // (it's outside that gate) so nothing about the code-redemption flow
  // itself is blocked.
  const { data: playerRow } = await admin
    .from("elite_players")
    .insert({
      profile_id: userId,
      coach_id: invite.created_by,
      full_name: fullName,
      parent_email: email,
      // NOT parent_name: fullName - fullName here is the PLAYER's name
      // (that's what this form actually asks for), and parent_name feeds
      // every "Hey [Parent]," greeting in SMS/email. A wrong placeholder
      // there is worse than leaving it blank (defaults to '' in the
      // schema) - real value gets collected at onboarding instead, where
      // it's now a required field.
      parent_phone: normalizePhone(phone) ?? phone,
      player_phone: playerPhone ? normalizePhone(playerPhone) ?? playerPhone : null,
      subscription_status: "none",
      current_week: 1,
      today_focus: "Welcome to Strive Elite. Your coach will set your first focus.",
    })
    .select("id")
    .single();

  // 5) burn the code
  await admin
    .from("elite_invite_codes")
    .update({ used_by: userId, used_at: new Date().toISOString() })
    .eq("id", invite.id);

  // 6) welcome the new member - in-app notification + GHL welcome
  //    email/SMS. Both best-effort; signup never fails because of them.
  if (playerRow?.id) {
    await admin
      .from("elite_notifications")
      .insert({
        player_id: playerRow.id,
        kind: "welcome",
        title: "Welcome to Strive Elite",
        body: "You're in. Complete your profile so your coach can build your first training week around you.",
      })
      .then(
        () => undefined,
        () => undefined
      );
    await sendPlayerEmail(playerRow.id, {
      event: "player_signed_up",
      subject: "Welcome to Strive Elite",
      body: `${fullName} is officially in the Strive Elite program.\n\nNext step: open the app and complete the quick player profile. Your coach uses it to build the first training week. A new week every Monday, every session starting with an explosive plyometric warm-up. Let's get to work.`,
    }).catch(() => undefined);
  }

  return NextResponse.json({ ok: true, role });
}
