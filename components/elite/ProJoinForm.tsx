"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { MONTH_NAMES, cleanBirth, joinProblem } from "@/lib/elite/tracker";
import {
  PAYMENTS_OFF_MESSAGE,
  PRO_AGREEMENT_POINTS,
  PRO_PRICE_LINE,
  PRO_UNDER_13_LINE,
  PRO_UNDER_18_LINE,
  proAgeStatement,
} from "@/lib/elite/pro";
import { FREE_AGE_STATEMENT } from "@/lib/elite/tracker";
import { AppLink } from "./AppLink";
import { openProCheckout } from "./ProCheckoutButton";

// Strive Pro sign-up (074): one screen. The player's birth month and year
// come first, because they decide which words the first agreement box
// carries (lib/elite/pro.ts proAgeStatement). The server checks every
// field again (app/api/elite/pro/signup) and creates nothing while
// payments are off. On success the account is signed in on the server
// and the card checkout opens.
export function ProJoinForm({
  configured,
  payments,
  today,
  years,
}: {
  configured: boolean;
  payments: boolean;
  today: string; // NY date, YYYY-MM-DD
  years: number[];
}) {
  const router = useRouter();
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [guardian, setGuardian] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signIn, setSignIn] = useState(false);

  const birth = cleanBirth({ month, year }, today);
  const ageStatement = birth ? proAgeStatement(birth, today) : null;
  const under13 = Boolean(ageStatement && ageStatement !== FREE_AGE_STATEMENT);
  const open = configured && payments;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSignIn(false);
    if (!open) {
      setError(PAYMENTS_OFF_MESSAGE);
      return;
    }
    if (!birth) {
      setError("Pick the month and year the player was born.");
      return;
    }
    const problem = joinProblem({ firstName, lastName, email, phone, password });
    if (problem) {
      setError(problem.message);
      return;
    }
    setBusy(true);
    const res = await fetch("/api/elite/pro/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        birth,
        firstName,
        lastName,
        email,
        phone,
        password,
        agreed: { guardian, terms },
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; reason?: string; signedIn?: boolean };
    if (!res.ok) {
      setError(data.error || "Something went wrong. Please try again.");
      setSignIn(data.reason === "exists");
      setBusy(false);
      return;
    }
    if (!data.signedIn) {
      router.push("/login?next=/dashboard");
      return;
    }
    // Signed in: straight to the card checkout. If it cannot open, Home
    // shows the same Start button with the reason.
    const checkout = await openProCheckout();
    if (checkout.error) router.push("/dashboard");
  }

  return (
    <div className="elite-card p-6 sm:p-8">
      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">Strive Pro · {PRO_PRICE_LINE}</div>
      <h1 className="mt-2 font-display text-3xl font-black uppercase tracking-tight">Create your account</h1>
      <p className="mt-1.5 text-[15px] text-white/60">
        Next you start your membership, then you answer a few questions and your first week is built
        around your answers.
      </p>

      {!open && (
        <p role="status" className="mt-5 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-[15px] text-bone">
          {PAYMENTS_OFF_MESSAGE}
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-white/70">When was the player born?</legend>
          <div className="grid grid-cols-2 gap-3">
            <select
              aria-label="Birth month"
              required
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-[16px] text-bone focus:border-accent/40 focus:outline-none"
            >
              <option value="">Month</option>
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
            <select
              aria-label="Birth year"
              required
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-[16px] text-bone focus:border-accent/40 focus:outline-none"
            >
              <option value="">Year</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          {under13 && <p className="mt-2 text-[13px] text-white/60">{PRO_UNDER_13_LINE}</p>}
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Player's first name" value={firstName} onChange={setFirstName} autoComplete="given-name" />
          <Field label="Last name" value={lastName} onChange={setLastName} autoComplete="family-name" />
        </div>
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="you@example.com" />
        <Field
          label={under13 ? "Parent's phone (for training texts)" : "Phone (a parent's for a younger player)"}
          type="tel"
          value={phone}
          onChange={setPhone}
          autoComplete="tel"
          placeholder="(703) 555-0100"
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />

        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
            {signIn && (
              <>
                {" "}
                <Link href="/login" className="tap font-semibold text-accent underline-offset-2 hover:underline">
                  Sign in
                </Link>
              </>
            )}
          </p>
        )}

        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <ul className="space-y-2">
            {PRO_AGREEMENT_POINTS.map((point) => (
              <li key={point} className="flex gap-2.5 text-[13px] leading-relaxed text-white/60">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                {point}
              </li>
            ))}
            {!under13 && (
              <li className="flex gap-2.5 text-[13px] leading-relaxed text-white/60">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                {PRO_UNDER_18_LINE}
              </li>
            )}
          </ul>
          <label className="flex min-h-[44px] items-start gap-3 py-1 text-sm leading-snug text-bone">
            <input
              type="checkbox"
              required
              checked={guardian}
              onChange={(e) => setGuardian(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-white"
            />
            <span>{ageStatement ?? FREE_AGE_STATEMENT}</span>
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

        <button
          type="submit"
          disabled={busy}
          aria-label={busy ? "Creating your account" : undefined}
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-white font-display text-xl font-black uppercase tracking-wide text-black disabled:opacity-70"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continue to payment"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-white/55">
        Already have an account?{" "}
        <Link href="/login" className="tap text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

function Field({
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
        className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-[16px] text-bone placeholder:text-white/30 focus:border-accent/40 focus:outline-none"
      />
    </label>
  );
}
