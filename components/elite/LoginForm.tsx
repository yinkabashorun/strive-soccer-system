"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, Lock, Mail } from "lucide-react";
import { enterDemoPlayer, enterDemoCoach, signIn } from "@/lib/elite/auth-actions";
import { INVITE_USED_MESSAGE, INVITE_USED_NOTICE } from "@/lib/elite/invite-link";
import { ACCOUNT_DELETED_MESSAGE, ACCOUNT_DELETED_NOTICE } from "@/lib/elite/account";

// The sign-in screen. The form posts to a server action (signIn in
// auth-actions.ts): the server signs in and sends the session back in a
// cookie it sets itself, which is the kind the iPhone keeps. Nothing here
// talks to the sign-in service from the browser (lib/elite/sign-in.ts).
export function LoginForm({
  configured,
  native = false,
}: {
  configured: boolean;
  native?: boolean; // inside the App Store app: sign-in only
}) {
  const params = useSearchParams();
  const next = params.get("next");
  // A used invite link lands here with a plain explanation, not an error.
  const noticeKey = params.get("notice");
  const notice =
    noticeKey === INVITE_USED_NOTICE
      ? INVITE_USED_MESSAGE
      : noticeKey === ACCOUNT_DELETED_NOTICE
        ? ACCOUNT_DELETED_MESSAGE
        : null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // An error an auth link brought with it shows until the first try.
  const [state, action] = useFormState(signIn, { error: params.get("error") });
  const error = state.error;

  return (
    <div className="elite-card p-7 sm:p-8">
      <h1 className="font-display text-3xl font-black uppercase tracking-tight">
        Welcome back
      </h1>
      <p className="mt-1.5 text-sm text-white/50">
        Sign in to your Strive Elite account.
      </p>
      {notice && (
        <p className="mt-4 rounded-xl border border-accent/30 bg-accent/[0.06] px-4 py-3 text-sm text-bone">
          {notice}
        </p>
      )}

      <form action={action} className="mt-7 space-y-4">
        {next && <input type="hidden" name="next" value={next} />}
        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-sm font-medium text-white/70">
            <Mail className="h-4 w-4" /> Email
          </span>
          {/* autoComplete "username" on an email field is what lets the
              iPhone offer the saved password (Apple's own guidance). */}
          <input
            type="email"
            name="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="you@example.com"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-bone placeholder:text-white/30 focus:border-accent/40 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-sm font-medium text-white/70">
            <Lock className="h-4 w-4" /> Password
          </span>
          <input
            type="password"
            name="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-bone placeholder:text-white/30 focus:border-accent/40 focus:outline-none"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <SignInButton />

        <p className="text-center text-[13px]">
          <Link href="/forgot" className="tap text-white/60 hover:text-accent">
            Forgot your password?
          </Link>
        </p>
      </form>

      {!native && (
        <p className="mt-5 text-center text-sm text-white/50">
          New here?{" "}
          <Link href="/signup" className="tap text-accent hover:underline">
            Create an account
          </Link>
        </p>
      )}

      {/* The sales door: anyone can walk through a fully-loaded player
          experience - no account, no friction. */}
      <form action={enterDemoPlayer} className="mt-6 border-t border-white/8 pt-5">
        <button className="btn min-h-[48px] w-full py-3 text-sm">
          See the app as a player →
        </button>
        <p className="mt-2 text-center text-[13px] text-white/60">
          No account needed.
        </p>
      </form>

      {/* Local set-up only (no database configured). Inside the App Store
          app the example tour is offered once, above, and there is no
          coach tour. */}
      {!configured && !native && (
        <div className="mt-7 border-t border-white/8 pt-6">
          <div className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
            Explore the demo
          </div>
          <div className="grid grid-cols-2 gap-3">
            <form action={enterDemoPlayer}>
              <button className="btn w-full py-3">Enter as Player</button>
            </form>
            <form action={enterDemoCoach}>
              <button className="btn w-full py-3">Enter as Coach</button>
            </form>
          </div>
          <p className="mt-3 text-center text-[13px] text-white/50">
            No account needed. Tour the full experience.
          </p>
        </div>
      )}
    </div>
  );
}

function SignInButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={pending ? "Signing in" : undefined}
      className="btn-accent w-full px-6 py-3.5 text-base"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
    </button>
  );
}
