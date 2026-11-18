"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { DEMO_COOKIE } from "./session";
import type { Role } from "./types";
import { rateLimit } from "@/lib/rate-limit";
import {
  NEW_PASSWORD_FAILED,
  NEW_PASSWORD_NO_SESSION,
  NEW_PASSWORD_UNREACHABLE,
  SIGN_IN_MESSAGES,
  newPasswordProblem,
  signInLanding,
  signInProblem,
} from "./sign-in";

// Enter demo mode as a given role (no Supabase required). Sets a cookie the
// middleware + session resolver read, then routes to the right home.
export async function enterDemo(role: Role, next?: string) {
  cookies().set(DEMO_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect(next || (role === "coach" ? "/coach" : "/dashboard"));
}

// Convenience wrappers usable directly as <form action={...}> handlers.
export async function enterDemoPlayer() {
  await enterDemo("player");
}
export async function enterDemoCoach() {
  await enterDemo("coach");
}

export async function signOut() {
  const supabase = createClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  cookies().delete(DEMO_COOKIE);
  redirect("/login");
}

// Who is asking, for the sign-in throttle. Best effort behind the proxy.
function callerIp(): string {
  try {
    const h = headers();
    const fwd = h.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0].trim();
    return h.get("x-real-ip") || "unknown";
  } catch {
    return "unknown";
  }
}

// The role decides where a person lands. Read with the client that has
// just signed in, so it is that person's own row.
async function roleOf(
  supabase: NonNullable<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("elite_profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    return (data?.role as string | undefined) ?? null;
  } catch {
    return null;
  }
}

export type SignInState = { error: string | null };

// Sign in with email and password, ON THE SERVER (lib/elite/sign-in.ts
// says why). The server client writes the session into the response's
// Set-Cookie, which the iPhone keeps; the browser never signs in itself.
// Every failure comes back as one plain line. Used by LoginForm through
// useFormState.
export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "") || null;
  if (!email || !password) return { error: SIGN_IN_MESSAGES.missing };

  // 20 tries in 10 minutes from one place is a script, not a person.
  if (!rateLimit(`signin:${callerIp()}`, 20, 10 * 60_000)) {
    return { error: SIGN_IN_MESSAGES.too_many };
  }

  const supabase = createClient();
  if (!supabase) return { error: SIGN_IN_MESSAGES.not_configured };

  let userId: string | null = null;
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: SIGN_IN_MESSAGES[signInProblem(error)] };
    userId = data.user?.id ?? null;
  } catch (thrown) {
    const problem = signInProblem(thrown);
    return { error: SIGN_IN_MESSAGES[problem === "unknown" ? "unreachable" : problem] };
  }
  if (!userId) return { error: SIGN_IN_MESSAGES.unknown };

  const role = await roleOf(supabase, userId);
  // A person who signs in for real is no longer on the example tour.
  cookies().delete(DEMO_COOKIE);
  redirect(signInLanding({ role, next }));
}

export type NewPasswordState = { error: string | null };

// Set a new password from the reset link, on the server. The recovery
// session was set by /auth/confirm (or /auth/callback), so the server
// client already knows who this is; the refreshed session goes back by
// Set-Cookie like every other.
export async function setNewPassword(
  _prev: NewPasswordState,
  formData: FormData
): Promise<NewPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const problem = newPasswordProblem({ password, confirm });
  if (problem) return { error: problem };

  const supabase = createClient();
  if (!supabase) return { error: NEW_PASSWORD_UNREACHABLE };

  let userId: string | null = null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: NEW_PASSWORD_NO_SESSION };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      return {
        error: signInProblem(error) === "unreachable" ? NEW_PASSWORD_UNREACHABLE : NEW_PASSWORD_FAILED,
      };
    }
    userId = user.id;
  } catch {
    return { error: NEW_PASSWORD_UNREACHABLE };
  }

  const role = await roleOf(supabase, userId);
  redirect(signInLanding({ role }));
}
