"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { GUARDIAN_STATEMENT } from "@/lib/elite/legal";
import { checkJoinAge } from "@/lib/elite/tracker-actions";
import { FREE_AGREEMENT_POINTS, FREE_QUIZ, MONTH_NAMES } from "@/lib/elite/tracker";
import { AppLink } from "./AppLink";
import { UnderAge } from "./UnderAge";

// Create a free account (migration 069). The month and year of birth come
// first, before anything else is typed: the free app is for players 13 and
// older, and an answer under 13 ends the visit on one plain screen with
// nothing stored. Then the server creates the account and signs the person
// in (the session cookie is one the server set, lib/elite/session-start.ts);
// this form only collects the fields and the two ticked boxes. Nothing
// here signs anyone in.
export function JoinForm({
  configured,
  referral,
  years,
}: {
  configured: boolean;
  referral: string;
  years: number[]; // the birth years offered, newest first
}) {
  const router = useRouter();
  const [step, setStep] = useState<"age" | "form" | "young">("age");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
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
          birth: { month: Number(month), year: Number(year) },
          agreed: { guardian, terms },
        }),
      });
    } catch {
      setError("We could not reach the server. Check your connection and try again.");
      setLoading(false);
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (data.reason === "age") {
      setLoading(false);
      setStep("young");
      return;
    }
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

  async function checkAge(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await checkJoinAge(Number(month), Number(year)).catch(() => null);
    setLoading(false);
    if (!res) return setError("We could not reach the server. Check your connection and try again.");
    if (!res.ok) return setError(res.error);
    setStep(res.allowed ? "form" : "young");
  }

  if (step === "young") return <UnderAge />;

  if (step === "age") {
    return (
      <div className="elite-card p-7 sm:p-8">
        <h1 className="font-display text-3xl font-black uppercase tracking-tight">When were you born?</h1>
        <p className="mt-1.5 text-[15px] leading-relaxed text-white/70">
          The free app is for players 13 and older. We keep the month and year only.
        </p>
        <form onSubmit={checkAge} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-white/70">Month</span>
              <select
                required
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="h-12 w-full rounded-xl border border-white/10 bg-[#101010] px-3 text-[16px] text-bone focus:border-accent/40 focus:outline-none"
              >
                <option value="">Month</option>
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-white/70">Year</span>
              <select
                required
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="h-12 w-full rounded-xl border border-white/10 bg-[#101010] px-3 text-[16px] text-bone focus:border-accent/40 focus:outline-none"
              >
                <option value="">Year</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={loading} className="btn-accent w-full px-6 py-3.5 text-base">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
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

  return (
    <div className="elite-card p-7 sm:p-8">
      <h1 className="font-display text-3xl font-black uppercase tracking-tight">
        Join your friends
      </h1>
      <p className="mt-1.5 text-[15px] leading-relaxed text-white/70">
        Post your training, see your friends post theirs, and keep your week on track.
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
