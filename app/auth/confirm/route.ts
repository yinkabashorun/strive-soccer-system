import { NextResponse } from "next/server";
import { createClient } from "@/lib/elite/supabase/server";
import { confirmTarget } from "@/lib/elite/auth-links";

// GET /auth/confirm?token_hash=...&type=recovery&next=/reset
//
// The token_hash flow for auth emails. Unlike /auth/callback (PKCE), the
// link carries everything needed and is verified here on the server, so
// it works no matter which browser or mail app opens it. See
// lib/elite/auth-links.ts for why this exists (Bryan, Oct 19 2026).
//
// Supabase "Reset password" email template body link:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset
// with Site URL set to https://thestriveapp.com.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const target = confirmTarget({
    token_hash: searchParams.get("token_hash"),
    type: searchParams.get("type"),
    next: searchParams.get("next"),
  });

  if (target) {
    const supabase = createClient();
    if (supabase) {
      const { error } = await supabase.auth.verifyOtp({
        type: target.type,
        token_hash: target.tokenHash,
      });
      if (!error) return NextResponse.redirect(`${origin}${target.next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(
      "That link is invalid or has expired. Request a fresh one from Forgot your password."
    )}`
  );
}
