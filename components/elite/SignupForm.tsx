"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { createClient } from "@/lib/elite/supabase/client";
import { enterDemoPlayer, enterDemoCoach } from "@/lib/elite/auth-actions";

// Player-only signup gated by a single-use invite code. Coaches are
// provisioned separately (seed script / admin) — there is deliberately no
// public path to a coach account.
export function SignupForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!configured) {
      setError("Sign-up isn't configured yet. Try a demo account below.");
      return;
    }
    setLoading(true);

    // 1) redeem the invite code + create a provisioned, active account
    const res = await fetch("/api/elite/auth/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, fullName, email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    // 2) sign in to establish the session, then into the app
    const supabase = createClient();
    if (supabase) {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInErr) {
        setError("Account created. Please sign in.");
        setLoading(false);
        router.push("/login");
        return;
      }
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="elite-card p-7 sm:p-8">
      <div className="chip-accent mb-3 inline-flex">
        <KeyRound className="h-3.5 w-3.5" /> Invite only
      </div>
      <h1 className="font-display text-3xl font-black uppercase tracking-tight">
        Activate your membership
      </h1>
      <p className="mt-1.5 text-sm text-white/50">
        Enter the invite code your coach sent you to create your Strive Elite
        account.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Input
          label="Invite code"
          value={code}
          onChange={(v) => setCode(v.toUpperCase())}
          placeholder="STRIVE-XXXXXX"
          autoComplete="off"
        />
        <Input
          label="Player name"
          value={fullName}
          onChange={setFullName}
          placeholder="Player's full name"
          autoComplete="name"
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="At least 8 characters"
          autoComplete="new-password"
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
            "Create my account"
          )}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-white/50">
        Already have an account?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-white/30">
        Don&apos;t have a code?{" "}
        <Link href="/pricing" className="text-white/50 hover:text-accent">
          See membership options
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
        </div>
      )}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-white/70">
        {label}
      </span>
      <input
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-bone placeholder:text-white/30 focus:border-accent/40 focus:outline-none"
      />
    </label>
  );
}
