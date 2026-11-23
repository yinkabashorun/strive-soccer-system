"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MONTH_NAMES, cleanBirth, joinProblem, type JoinStep } from "@/lib/elite/tracker";
import {
  PAYMENTS_OFF_MESSAGE,
  PRO_AGREEMENT_POINTS,
  PRO_PAGE,
  PRO_PRICE_LINE,
  PRO_UNDER_13_LINE,
  PRO_UNDER_18_LINE,
  proAgeStatement,
} from "@/lib/elite/pro";
import { FREE_AGE_STATEMENT } from "@/lib/elite/tracker";
import { AppLink } from "./AppLink";
import { openProCheckout } from "./ProCheckoutButton";
import { Foot, Input, Question, Screen, TICK_BOTH } from "./JoinForm";
import { Wheel, WheelColumn } from "./WheelPicker";

// Strive Pro sign-up (074), one thing a screen the way Instagram does it
// (Nov 23 2026): the back arrow, the step bar, one question, the main
// button pinned to the bottom above the keyboard, the first field already
// focused, and each screen checked with the server's own rule before Next
// (lib/elite/tracker.ts joinProblem), so a problem shows on the screen it
// belongs to. The same pieces as the free app's sign-up (JoinForm), not a
// second set. The birth month and year come first: they decide which
// words the first agreement box carries (proAgeStatement). The server
// checks every field again (app/api/elite/pro/signup) and creates nothing
// while payments are off. On success the account is signed in on the
// server and the card checkout opens.
type Step = "age" | "name" | "contact" | "password" | "agree";
const STEPS: Step[] = ["age", "name", "contact", "password", "agree"];

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
  const oldestFirst = [...years].sort((a, b) => a - b);
  const [step, setStep] = useState<Step>("age");
  const [month, setMonth] = useState(1);
  // the wheel starts on a typical member's age; they turn it to their own
  const [year, setYear] = useState(years.includes(years[0] - 8) ? years[0] - 8 : years[0]);
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

  const birth = cleanBirth({ month: String(month), year: String(year) }, today);
  const ageStatement = birth ? proAgeStatement(birth, today) : null;
  const under13 = Boolean(ageStatement && ageStatement !== FREE_AGE_STATEMENT);
  const open = configured && payments;

  function go(to: Step) {
    setError(null);
    setSignIn(false);
    setStep(to);
  }

  function nextIfValid(e: React.FormEvent, here: JoinStep, to: Step) {
    e.preventDefault();
    const problem = joinProblem({ firstName, lastName, email, phone, password }, here);
    if (problem) return setError(problem.message);
    go(to);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSignIn(false);
    if (!open) return setError(PAYMENTS_OFF_MESSAGE);
    if (!guardian || !terms) return setError(TICK_BOTH);
    if (!birth) {
      go("age");
      return setError("Pick the month and year the player was born.");
    }
    const problem = joinProblem({ firstName, lastName, email, phone, password });
    if (problem) {
      go(problem.step as Step);
      return setError(problem.message);
    }
    setBusy(true);
    const res = await fetch("/api/elite/pro/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ birth, firstName, lastName, email, phone, password, agreed: { guardian, terms } }),
    }).catch(() => null);
    const data = ((await res?.json().catch(() => ({}))) ?? {}) as { error?: string; reason?: string; signedIn?: boolean };
    if (!res || !res.ok) {
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

  const closed = !open && (
    <p role="status" className="mx-[22px] mt-5 rounded-2xl bg-white/[0.05] px-4 py-3 text-[15px] text-bone">
      {PAYMENTS_OFF_MESSAGE}
    </p>
  );

  if (step === "age") {
    return (
      <Screen step="age" steps={STEPS} onBack={() => router.push(PRO_PAGE)} onSubmit={(e) => (e.preventDefault(), go("name"))}>
        <p className="px-[22px] pt-[26px] text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60">Strive Pro · {PRO_PRICE_LINE}</p>
        <Question title="When was the player born?" line="Your first week is built around the answers you give after this." />
        {closed}
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
        {under13 && <p className="px-[22px] pt-4 text-[14px] text-white/60">{PRO_UNDER_13_LINE}</p>}
        <Foot loading={false} label="Next" error={error} />
      </Screen>
    );
  }

  if (step === "name") {
    return (
      <Screen step="name" steps={STEPS} onBack={() => go("age")} onSubmit={(e) => nextIfValid(e, "name", "contact")}>
        <Question title="The player's name?" line="As it should read on their member card." />
        <div className="mt-8 space-y-3 px-[22px]">
          <Input label="First name" value={firstName} onChange={setFirstName} autoComplete="given-name" autoFocus />
          <Input label="Last name" value={lastName} onChange={setLastName} autoComplete="family-name" />
        </div>
        <Foot loading={false} label="Next" error={error} />
      </Screen>
    );
  }

  if (step === "contact") {
    return (
      <Screen step="contact" steps={STEPS} onBack={() => go("name")} onSubmit={(e) => nextIfValid(e, "contact", "password")}>
        <Question title="How do we reach you?" line="The email signs you in. The phone gets the training texts." />
        <div className="mt-8 space-y-3 px-[22px]">
          <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" autoFocus />
          <Input
            label={under13 ? "Parent's phone (for training texts)" : "Phone (a parent's for a younger player)"}
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
      <Screen step="password" steps={STEPS} onBack={() => go("contact")} onSubmit={(e) => nextIfValid(e, "password", "agree")}>
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
            autoFocus
          />
        </div>
        <Foot loading={false} label="Next" error={error} />
      </Screen>
    );
  }

  return (
    <Screen step="agree" steps={STEPS} onBack={() => go("password")} onSubmit={onSubmit}>
      <Question title="One last thing" line="Read these, then tick both boxes." />
      {closed}
      <div className="mt-6 space-y-3 px-[22px]">
        <ul className="space-y-2">
          {PRO_AGREEMENT_POINTS.map((point) => (
            <li key={point} className="flex gap-2.5 text-[14px] leading-relaxed text-white/70">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-bone" />
              {point}
            </li>
          ))}
          {!under13 && (
            <li className="flex gap-2.5 text-[14px] leading-relaxed text-white/70">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-bone" />
              {PRO_UNDER_18_LINE}
            </li>
          )}
        </ul>
        <label className="flex min-h-[44px] items-start gap-3 rounded-2xl bg-[#141414] p-4 text-[15px] leading-snug text-bone">
          <input type="checkbox" required checked={guardian} onChange={(e) => setGuardian(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-white" />
          <span>{ageStatement ?? FREE_AGE_STATEMENT}</span>
        </label>
        <label className="flex min-h-[44px] items-start gap-3 rounded-2xl bg-[#141414] p-4 text-[15px] leading-snug text-bone">
          <input type="checkbox" required checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-white" />
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
        {signIn && (
          <p className="text-[14px] text-white/70">
            <Link href="/login" className="tap font-semibold text-bone underline underline-offset-4">
              Sign in instead
            </Link>
          </p>
        )}
      </div>
      <Foot loading={busy} label="Continue to payment" error={error} />
    </Screen>
  );
}
