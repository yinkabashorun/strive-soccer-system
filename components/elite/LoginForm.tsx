"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock, Mail } from "lucide-react";
import { createClient } from "@/lib/elite/supabase/client";
import { enterDemoPlayer, enterDemoCoach } from "@/lib/elite/auth-actions";

export function LoginForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error"));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();
    if (!supabase) {
      setError("Sign-in isn't configured yet. Try a demo account below.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    // Route by role — coaches and admins go to the coach app.
    const { data: profile } = await supabase
      .from("elite_profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();
    const isStaff = profile?.role === "coach" || profile?.role === "admin";
    const dest = next || (isStaff ? "/coach" : "/dashboard");
    router.push(dest);
    router.refresh();
  }

  return (
    <div className="elite-card p-7 sm:p-8">
      <h1 className="font-display text-3xl font-black uppercase tracking-tight">
        Welcome back
      </h1>
      <p className="mt-1.5 text-sm text-white/50">
        Sign in to your Strive Elite account.
      </p>

      <form onSubmit={onSubmit} className="mt-7 space-y-4">
        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-sm font-medium text-white/70">
            <Mail className="h-4 w-4" /> Email
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
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
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-bone placeholder:text-white/30 focus:border-accent/40 focus:outline-none"
          />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="btn-accent w-full px-6 py-3.5 text-base"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
        </button>

        <p className="text-center text-xs">
          <Link href="/forgot" className="text-white/40 hover:text-accent">
            Forgot your password?
          </Link>
        </p>
      </form>

      <p className="mt-5 text-center text-sm text-white/50">
        New here?{" "}
        <Link href="/signup" className="text-accent hover:underline">
          Create an account
        </Link>
      </p>

      {!configured && (
        <div className="mt-7 border-t border-white/8 pt-6">
          <div className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
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
          <p className="mt-3 text-center text-xs text-white/30">
            No account needed — tour the full experience.
          </p>
        </div>
      )}
    </div>
  );
}
