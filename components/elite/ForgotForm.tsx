"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, Loader2, MailCheck } from "lucide-react";
import { createClient } from "@/lib/elite/supabase/client";

// Self-serve password reset. Sends a recovery email whose link lands on
// /auth/callback?next=/reset - the callback exchanges the code for a
// session, then /reset lets the user set a new password.
export function ForgotForm({ configured }: { configured: boolean }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();
    if (!supabase || !configured) {
      setError("Password reset isn't configured yet. Contact your coach.");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset`,
    });
    setLoading(false);
    if (err) {
      setError("We couldn't send the reset email. Check the address and try again.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="elite-card p-7 text-center sm:p-8">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent">
          <MailCheck className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-black uppercase tracking-tight">
          Check your email
        </h1>
        <p className="mt-2 text-sm text-white/55">
          If an account exists for <span className="text-white/80">{email}</span>,
          a reset link is on its way. Open it on this device and set your new
          password.
        </p>
        <Link href="/login" className="btn mt-6 inline-flex px-6 py-3">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="elite-card p-7 sm:p-8">
      <div className="chip-accent mb-3 inline-flex">
        <KeyRound className="h-3.5 w-3.5" /> Password reset
      </div>
      <h1 className="font-display text-3xl font-black uppercase tracking-tight">
        Forgot your password?
      </h1>
      <p className="mt-1.5 text-sm text-white/50">
        Enter your account email and we&apos;ll send you a link to set a new one.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-bone placeholder:text-white/30 focus:border-accent/40 focus:outline-none"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="btn-accent w-full px-6 py-3.5 text-base"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Send reset link"
          )}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-white/50">
        Remembered it?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
