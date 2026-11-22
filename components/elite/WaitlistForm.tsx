"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { checkJoinAge } from "@/lib/elite/tracker-actions";
import { MONTH_NAMES } from "@/lib/elite/tracker";
import { waitlistProblem, type WaitlistStep } from "@/lib/elite/waitlist";
import { Foot, Input, Question, Screen } from "./JoinForm";
import { JoinLanding, type JoinInvite } from "./JoinLanding";
import { UnderAge } from "./UnderAge";
import { Wheel, WheelColumn } from "./WheelPicker";

type Step = "landing" | "age" | "name" | "phone" | "young";
const STEPS = ["age", "name", "phone"] as const;

// The waitlist for the free app (migration 075), shown on /join while free
// sign-up is closed. The free app's own look and order: the welcome, the
// month and year of birth first (13 and older, nothing stored for anyone
// younger), the name, then the phone and who they play for. The server
// saves the row and texts their link; the page then shows their status.
export function WaitlistForm({
  configured,
  referral,
  source,
  years,
  invite,
}: {
  configured: boolean;
  referral: string; // the waitlist code of whoever sent the link
  source: string;
  years: number[];
  invite: JoinInvite;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("landing");
  const oldestFirst = [...years].sort((a, b) => a - b);
  const [month, setMonth] = useState(1);
  const [year, setYear] = useState(years.includes(years[0] - 10) ? years[0] - 10 : years[0]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [team, setTeam] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function next(to: Step) {
    setError(null);
    setStep(to);
  }

  function nextIfValid(e: React.FormEvent, here: WaitlistStep, to: Step) {
    e.preventDefault();
    const problem = waitlistProblem({ firstName, lastName, phone, team }, here);
    if (problem) return setError(problem.message);
    next(to);
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const problem = waitlistProblem({ firstName, lastName, phone, team });
    if (problem) {
      setStep(problem.step === "name" ? "name" : "phone");
      return setError(problem.message);
    }
    if (!configured) return setError("The waitlist isn't set up here.");
    setLoading(true);
    let res: Response;
    try {
      res = await fetch("/api/elite/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          birth: { month: Number(month), year: Number(year) },
          firstName,
          lastName,
          phone,
          team,
          ref: referral,
          source,
        }),
      });
    } catch {
      setLoading(false);
      return setError("We could not reach the server. Check your connection and try again.");
    }
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (data.reason === "age") return setStep("young");
    if (data.reason === "open") {
      router.refresh();
      return;
    }
    if (data.reason === "field" && typeof data.step === "string") {
      setStep(data.step === "name" ? "name" : data.step === "age" ? "age" : "phone");
      return setError(data.error || "Check this and try again.");
    }
    if (!res.ok) return setError(data.error || "Something went wrong. Please try again.");
    router.refresh(); // the page now shows their link and their teammates
  }

  if (step === "young") return <UnderAge />;

  if (step === "landing") return <JoinLanding invite={invite} waitlist onJoin={() => next("age")} />;

  if (step === "age") {
    return (
      <Screen step="age" steps={STEPS} onBack={() => next("landing")} onSubmit={checkAge}>
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
      <Screen step="name" steps={STEPS} onBack={() => next("age")} onSubmit={(e) => nextIfValid(e, "name", "phone")}>
        <Question title="What's your name?" line="So your teammates know it's you." />
        <div className="mt-8 space-y-3 px-[22px]">
          <Input label="First name" value={firstName} onChange={setFirstName} autoComplete="given-name" />
          <Input label="Last name" value={lastName} onChange={setLastName} autoComplete="family-name" />
        </div>
        <Foot loading={false} label="Next" error={error} />
      </Screen>
    );
  }

  return (
    <Screen step="phone" steps={STEPS} onBack={() => next("name")} onSubmit={onSubmit}>
      <Question
        title="Where do we text you?"
        line="We text you your link now, and once more when the app opens. Reply STOP anytime."
      />
      <div className="mt-8 space-y-3 px-[22px]">
        <Input
          label="Phone"
          type="tel"
          value={phone}
          onChange={setPhone}
          placeholder="(703) 555-0100"
          autoComplete="tel"
        />
        <Input
          label="Who do you play for? (optional)"
          value={team}
          onChange={setTeam}
          placeholder="Your club or school team"
          required={false}
        />
      </div>
      <Foot loading={loading} label="Get on the list" error={error} />
    </Screen>
  );
}
