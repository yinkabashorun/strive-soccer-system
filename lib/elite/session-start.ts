import { createClient } from "./supabase/server";

// Signs a brand-new account in HERE, on the server, so the session comes
// back in a cookie the server sets (lib/elite/sign-in.ts: a cookie the
// browser writes itself is capped at 7 days on an iPhone). Used by both
// routes that create an account: an invite being redeemed, and a free
// training log account being made. Returns whether it worked; when it did
// not, the account still exists and the form sends the person to the
// sign-in screen.
export async function establishSession(email: string, password: string): Promise<boolean> {
  try {
    const supabase = createClient();
    if (!supabase) return false;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return !error && Boolean(data.session);
  } catch {
    return false;
  }
}
