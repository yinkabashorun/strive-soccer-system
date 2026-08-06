"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, User, Users } from "lucide-react";
import { createClient } from "@/lib/elite/supabase/client";
import { enterDemoPlayer, enterDemoCoach } from "@/lib/elite/auth-actions";
import { cn } from "@/lib/utils";

type Role = "player" | "coach";

export function SignupForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>("player");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();
    if (!supabase) {
      setError("Sign-up isn't configured yet. Try a demo account below.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/login`
            : undefined,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    // If email confirmation is off, a session is returned immediately.
    if (data.session) {
      router.push(role === "coach" ? "/coach" : "/dashboard");
      router.refresh();
      return;
    }
    setDone(true);
    setLoading(false);
  }

  if (done) {
    return (
      <div className="elite-card p-8 text-center">
        <h1 className="font-display text-3xl font-black uppercase tracking-tight">
          Check your email
        </h1>
        <p className="mt-3 text-white/55">
          We sent a confirmation link to{" "}
          <span className="text-bone">{email}</span>. Confirm it, then sign in
          to start the program.
        </p>
        <Link href="/login" className="btn-accent mt-7 inline-flex px-6 py-3">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="elite-card p-7 sm:p-8">
      <h1 className="font-display text-3xl font-black uppercase tracking-tight">
        Join Strive Elite
      </h1>
      <p className="mt-1.5 text-sm text-white/50">
        Create your account and start developing.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <RoleTab
          active={role === "player"}
          onClick={() => setRole("player")}
          icon={<User className="h-4 w-4" />}
          label="I'm a Player / Parent"
        />
        <RoleTab
          active={role === "coach"}
          onClick={() => setRole("coach")}
          icon={<Users className="h-4 w-4" />}
          label="I'm a Coach"
        />
      </div>

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <Input
          label="Full name"
          value={fullName}
          onChange={setFullName}
          placeholder={role === "coach" ? "Coach name" : "Player name"}
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
            "Create account"
          )}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-white/50">
        Already have an account?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Sign in
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

function RoleTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all",
        active
          ? "border-accent/40 bg-accent/[0.06] text-bone"
          : "border-white/10 bg-white/[0.02] text-white/50 hover:border-white/20"
      )}
    >
      <span className={active ? "text-accent" : "text-white/40"}>{icon}</span>
      <span className="text-xs font-medium leading-tight">{label}</span>
    </button>
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
