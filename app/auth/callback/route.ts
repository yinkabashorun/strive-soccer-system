import { NextResponse } from "next/server";
import { createClient } from "@/lib/elite/supabase/server";

// Handles the Supabase email-confirmation / magic-link redirect. Supabase
// sends the user here with a one-time `code`; we exchange it for a session
// (setting the auth cookies) and route them into the app. Errors from the
// link (expired / already used) are surfaced on the login screen.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        errorDescription || "That link is invalid or has expired. Please sign in."
      )}`
    );
  }

  if (code) {
    const supabase = createClient();
    if (supabase) {
      const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);
      if (!exchangeError) {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(
      "We couldn't complete sign-in. Please try again."
    )}`
  );
}
