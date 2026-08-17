import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/elite/supabase/server";
import { sendPlayerEmail } from "@/lib/elite/email";

export const runtime = "nodejs";

// Redeem an invite code and create a fully-provisioned, active player.
// Uses the service role so the new user is email-confirmed immediately
// (no confirmation link) and the invite is validated server-side.
//
// POST { code, fullName, email, password } -> { ok } | { error }
export async function POST(req: Request) {
  let body: {
    code?: string;
    fullName?: string;
    email?: string;
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
  const password = body.password ?? "";

  if (!code) return NextResponse.json({ error: "An invite code is required." }, { status: 400 });
  if (!fullName || !email || password.length < 8) {
    return NextResponse.json(
      { error: "Enter your name, email, and a password of at least 8 characters." },
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
    .select("id, created_by, used_by, expires_at")
    .eq("code", code)
    .maybeSingle();

  if (!invite || invite.used_by) {
    return NextResponse.json(
      { error: "That invite code is invalid or has already been used." },
      { status: 400 }
    );
  }
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "That invite code has expired." }, { status: 400 });
  }

  // 2) create the auth user (email pre-confirmed)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: "player" },
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
    role: "player",
    full_name: fullName,
    email,
  });

  // 4) provision an active player linked to the inviting coach
  const { data: playerRow } = await admin
    .from("elite_players")
    .insert({
      profile_id: userId,
      coach_id: invite.created_by,
      full_name: fullName,
      parent_email: email,
      parent_name: fullName,
      subscription_status: "active",
      current_week: 1,
      today_focus: "Welcome to Strive Elite — your coach will set your first focus.",
    })
    .select("id")
    .single();

  // 5) burn the code
  await admin
    .from("elite_invite_codes")
    .update({ used_by: userId, used_at: new Date().toISOString() })
    .eq("id", invite.id);

  // 6) welcome the new member — in-app notification + GHL welcome
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
      body: `${fullName} is officially in the Strive Elite program.\n\nNext step: open the app and complete the quick player profile — your coach uses it to build the first training week. Four sessions a week, every one starting with an explosive plyometric warm-up. Let's get to work.`,
    }).catch(() => undefined);
  }

  return NextResponse.json({ ok: true });
}
