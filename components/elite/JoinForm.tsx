"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { checkJoinAge } from "@/lib/elite/tracker-actions";
import { FREE_AGE_STATEMENT, FREE_AGREEMENT_POINTS, FREE_QUIZ, MONTH_NAMES, joinProblem, type JoinStep } from "@/lib/elite/tracker";
import { AppLink } from "./AppLink";
import { IconBack, IconLock } from "./FreeIcons";
import { JoinLanding, type JoinInvite } from "./JoinLanding";
import { UnderAge } from "./UnderAge";
import { Wheel, WheelColumn } from "./WheelPicker";

type Step = "landing" | "age" | "name" | "contact" | "password" | "agree" | "young";
const STEPS: Step[] = ["age", "name", "contact", "password", "agree"];

// Create a free account (migration 069), one question a screen (the mock,
// screens 9 and 10). The invite opens it; then the month and year of birth
// come first, before anything else is typed: the free app is for players
// 13 and older, and an answer under 13 ends the visit on one plain screen
// with nothing stored. Then the server creates the account and signs the
// person in (the session cookie is one the server set,
// lib/elite/session-start.ts); this form only collects the fields and the
// two ticked boxes. Nothing here signs anyone in.
export function JoinForm({
  configured,
  referral,
  source = "",
  club,
  years,
  invite,
}: {
  configured: boolean;
  referral: string;
  source?: string; // where the link came from ("share", 078), for the coach
  club: string; // a club's link code, joined with the account
  years: number[]; // the birth years offered, newest first
  invite: JoinInvite;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("landing");
  const oldestFirst = [...years].sort((a, b) => a - b);
  const [month, setMonth] = useState(1);
  // The wheel starts on a typical age (15); the player turns it to their own.
  const [year, setYear] = useState(years.includes(years[0] - 10) ? years[0] - 10 : years[0]);
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

  function next(to: Step) {
    setError(null);
    setStep(to);
  }

  // Next on a typed screen: check that screen's details with the server's
  // own rule first, so a problem shows here, on the screen it belongs to.
  function nextIfValid(e: React.FormEvent, here: JoinStep, to: Step) {
    e.preventDefault();
    const problem = joinProblem({ firstName, lastName, email, phone, password }, here);
    if (problem) return setError(problem.message);
    next(to);
  }

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
          club,
          src: source,
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
    if (data.reason === "field" && typeof data.step === "string" && STEPS.includes(data.step as Step)) {
      // A typed detail was turned down: back to the screen it is on.
      setLoading(false);
      setStep(data.step as Step);
      setError(data.error || "Check this and try again.");
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
    setStep(res.allowed ? "name" : "young");
  }

  if (step === "young") return <UnderAge />;

  if (step === "landing") return <JoinLanding invite={invite} onJoin={() => next("age")} />;

  if (step === "age") {
    return (
      <Screen step="age" onBack={() => next("landing")} onSubmit={checkAge}>
        <Question title="When were you born?" line="Month and year only. It's never shown to anyone." />
        <Wheel>
          <WheelColumn
            label="Month"
            options={MONTH_NAMES.map((_, i) => i + 1)}
            value={month}
            onChange={setMonth}
            render={(m) => MONTH_NAMES[m - 1]}
            className="flex-1"
          />
          <WheelColumn label="Year" options={oldestFirst} value={year} onChange={setYear} className="flex-[0.7]" />
        </Wheel>
        <Foot loading={loading} label="Next" note="For players 13 and older" error={error} />
      </Screen>
    );
  }

  if (step === "name") {
    return (
      <Screen step="name" onBack={() => next("age")} onSubmit={(e) => nextIfValid(e, "name", "contact")}>
        <Question title="What's your name?" line="Your friends see your first name and last initial." />
        <div className="mt-8 space-y-3 px-[22px]">
          <Input label="First name" value={firstName} onChange={setFirstName} autoComplete="given-name" />
          <Input label="Last name" value={lastName} onChange={setLastName} autoComplete="family-name" />
        </div>
        <Foot loading={false} label="Next" error={error} />
      </Screen>
    );
  }

  if (step === "contact") {
    return (
      <Screen step="contact" onBack={() => next("name")} onSubmit={(e) => nextIfValid(e, "contact", "password")}>
        <Question title="How do we reach you?" line="Your email signs you in. Your friends never see either." />
        <div className="mt-8 space-y-3 px-[22px]">
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
        </div>
        <Foot loading={false} label="Next" error={error} />
      </Screen>
    );
  }

  if (step === "password") {
    return (
      <Screen step="password" onBack={() => next("contact")} onSubmit={(e) => nextIfValid(e, "password", "agree")}>
        <Question title="Make a password" line="At least 8 characters." />
        <div className="mt-8 px-[22px]">
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            minLength={8}
          />
        </div>
        <Foot loading={false} label="Next" error={error} />
      </Screen>
    );
  }

  return (
    <Screen step="agree" onBack={() => next("password")} onSubmit={onSubmit}>
      <Question title="One last thing" line="Read these, then tick both boxes." />
      <div className="mt-6 space-y-3 px-[22px]">
        <ul className="space-y-2">
          {FREE_AGREEMENT_POINTS.map((line) => (
            <li key={line} className="flex gap-2.5 text-[14px] leading-relaxed text-white/70">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-bone" />
              {line}
            </li>
          ))}
        </ul>
        <label className="flex min-h-[44px] items-start gap-3 rounded-2xl bg-[#141414] p-4 text-[15px] leading-snug text-bone">
          <input
            type="checkbox"
            required
            checked={guardian}
            onChange={(e) => setGuardian(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-white"
          />
          <span>{FREE_AGE_STATEMENT}</span>
        </label>
        <label className="flex min-h-[44px] items-start gap-3 rounded-2xl bg-[#141414] p-4 text-[15px] leading-snug text-bone">
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
      <Foot loading={loading} label="Create my account" error={error} />
    </Screen>
  );
}

// One question a screen: the back arrow, the step bar, the question, and
// the white button pinned to the bottom.
export function Screen({
  step,
  steps = STEPS,
  onBack,
  onSubmit,
  children,
}: {
  step: string;
  steps?: readonly string[]; // the step bar; the waitlist has its own
  onBack: () => void;
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
}) {
  const at = steps.indexOf(step);
  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto flex min-h-[100svh] w-full max-w-md flex-col pb-[calc(32px+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]"
    >
      <div className="mt-[26px] flex h-11 items-center px-[10px]">
        <button type="button" onClick={onBack} aria-label="Back" className="grid h-11 w-11 place-items-center text-bone">
          <IconBack />
        </button>
      </div>
      <div className="flex gap-1.5 px-[18px]" aria-label={`Step ${at + 1} of ${steps.length}`}>
        {steps.map((s, i) => (
          <i key={s} className={"h-1 flex-1 rounded-sm " + (i <= at ? "bg-bone" : "bg-[#262626]")} />
        ))}
      </div>
      {children}
    </form>
  );
}

export function Question({ title, line }: { title: string; line: string }) {
  return (
    <div className="px-[22px] pt-[30px]">
      <h1 className="font-display text-[46px] font-black uppercase leading-[0.9]">{title}</h1>
      <p className="mt-3 text-[15.5px] leading-[1.4] text-white/60">{line}</p>
    </div>
  );
}

export function Foot({
  loading,
  label,
  note,
  error,
}: {
  loading: boolean;
  label: string;
  note?: string;
  error?: string | null;
}) {
  return (
    <div className="mt-auto px-[22px] pt-8">
      {error && (
        <p role="alert" className="mb-3.5 rounded-2xl bg-red-500/10 px-4 py-3 text-[15px] leading-snug text-red-300">
          {error}
        </p>
      )}
      {note && (
        <p className="mb-3.5 flex items-center justify-center gap-2 text-[13px] text-white/60">
          <IconLock size={16} />
          {note}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="flex h-[58px] w-full items-center justify-center rounded-[18px] bg-bone font-display text-[23px] font-black uppercase tracking-[0.5px] text-black disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : label}
      </button>
      <p className="mt-3 text-center text-[14px] text-white/60">
        Already have an account?{" "}
        <Link href="/login" className="tap font-semibold text-bone">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  minLength,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[14px] font-semibold text-white/70">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        minLength={minLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="h-14 w-full rounded-2xl border border-white/10 bg-[#141414] px-4 text-[17px] text-bone placeholder:text-white/50 focus:border-white/30 focus:outline-none"
      />
    </label>
  );
}
