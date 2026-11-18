"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { GUARDIAN_STATEMENT } from "@/lib/elite/legal";
import { FREE_AGREEMENT_POINTS, FREE_QUIZ } from "@/lib/elite/tracker";
import { AppLink } from "./AppLink";

// Create a free account: the training log (migration 069). The server
// creates the account and signs the person in (the session cookie is one
// the server set, lib/elite/session-start.ts); this form only collects
// the fields and the two ticked boxes. Nothing here signs anyone in.
export function JoinForm({ configured, referral }: { configured: boolean; referral: string }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  // The agreement: ticked by the person, never by default (068).
  const [guardian, setGuardian] = useState(false);
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!configured) {
      setError("Sign-up isn't configured yet.");
      return;
    }
    setLoading(true);
    let res: Response;
    try {
      res = await fetch("/api/elite/auth/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          password,
          ref: referral,
          agreed: { guardian, terms },
        }),
      });
    } catch {
      setError("We could not reach the server. Check your connection and try again.");
      setLoading(false);
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    // The route signed the new account in on the server. If that one step
    // failed the account still exists: send them to sign in.
    if (!data.signedIn) {
      setError("Account created. Please sign in.");
      setLoading(false);
      router.push("/login");
      return;
    }
    router.push(typeof data.next === "string" ? data.next : FREE_QUIZ);
    router.refresh();
  }

  return (
    <div className="elite-card p-7 sm:p-8">
      <h1 className="font-display text-3xl font-black uppercase tracking-tight">
        Start your training log
      </h1>
      <p className="mt-1.5 text-[15px] leading-relaxed text-white/70">
        Log the training you do on your own, watch your week add up, and share it.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" value={firstName} onChange={setFirstName} autoComplete="given-name" />
          <Input label="Last name" value={lastName} onChange={setLastName} autoComplete="family-name" />
        </div>
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          autoComplete="username"
        />
        <Input
          label="Phone, so a coach can reach you"
          type="tel"
          value={phone}
          onChange={setPhone}
          placeholder="(703) 555-0100"
          autoComplete="tel"
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

        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <ul className="space-y-2">
            {FREE_AGREEMENT_POINTS.map((line) => (
              <li key={line} className="flex gap-2.5 text-[13px] leading-relaxed text-white/60">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                {line}
              </li>
            ))}
          </ul>
          <label className="flex min-h-[44px] items-start gap-3 py-1 text-sm leading-snug text-bone">
            <input
              type="checkbox"
              required
              checked={guardian}
              onChange={(e) => setGuardian(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-white"
            />
            <span>{GUARDIAN_STATEMENT}</span>
          </label>
          <label className="flex min-h-[44px] items-start gap-3 py-1 text-sm leading-snug text-bone">
            <input
              type="checkbox"
              required
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-white"
            />
            <span>
              I agree to the{" "}
              <AppLink href="/terms" title="Terms of Service" className="tap underline underline-offset-2">
                Terms of Service
              </AppLink>{" "}
              and the{" "}
              <AppLink href="/privacy" title="Privacy Policy" className="tap underline underline-offset-2">
                Privacy Policy
              </AppLink>
              .
            </span>
          </label>
        </div>

        <button type="submit" disabled={loading} className="btn-accent w-full px-6 py-3.5 text-base">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create my account"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-white/60">
        Already have an account?{" "}
        <Link href="/login" className="tap text-accent hover:underline">
          Sign in
        </Link>
      </p>
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
      <span className="mb-2 block text-sm font-medium text-white/70">{label}</span>
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
