"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { createClient } from "@/lib/elite/supabase/client";

// Sets a new password for the recovery session established by
// /auth/callback. If no session is present (expired / reused link), the
// user is pointed back to /forgot for a fresh one.
export function ResetForm() {
  const router = useRouter();
  const [ready, setReady] = useState<"checking" | "ok" | "no-session">(
    "checking"
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setReady("no-session");
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      setReady(data.user ? "ok" : "no-session");
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError("Couldn't update the password. Request a fresh link and try again.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  if (ready === "checking") {
    return (
      <div className="elite-card grid place-items-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-white/40" />
      </div>
    );
  }

  if (ready === "no-session") {
    return (
      <div className="elite-card p-7 text-center sm:p-8">
        <h1 className="font-display text-2xl font-black uppercase tracking-tight">
          That link has expired
        </h1>
        <p className="mt-2 text-sm text-white/55">
          Reset links are single-use. Request a fresh one and open it right
          away.
        </p>
        <Link href="/forgot" className="btn-accent mt-6 inline-flex px-6 py-3">
          Send a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="elite-card p-7 sm:p-8">
      <h1 className="font-display text-3xl font-black uppercase tracking-tight">
        Set a new password
      </h1>
      <p className="mt-1.5 text-sm text-white/50">
        You&apos;re verified — choose a new password for your account.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-sm font-medium text-white/70">
            <Lock className="h-4 w-4" /> New password
          </span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-bone placeholder:text-white/30 focus:border-accent/40 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-sm font-medium text-white/70">
            <Lock className="h-4 w-4" /> Confirm it
          </span>
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            placeholder="Same password again"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-bone placeholder:text-white/30 focus:border-accent/40 focus:outline-none"
          />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="btn-accent w-full px-6 py-3.5 text-base"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Save new password"
          )}
        </button>
      </form>
    </div>
  );
}
