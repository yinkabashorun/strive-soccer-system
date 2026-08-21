"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PROGRESS_METRICS, type ProgressMetric } from "@/lib/elite/types";
import { completeOnboarding } from "@/lib/elite/player-actions";

const LEVELS = ["Developing", "Competitive", "Advanced", "Elite"];
const FEET = ["Right", "Left", "Both"];

export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [age, setAge] = useState("");
  const [position, setPosition] = useState("");
  const [level, setLevel] = useState("Developing");
  const [club, setClub] = useState("");
  const [foot, setFoot] = useState("Right");
  const [goals, setGoals] = useState("");
  const [weaknesses, setWeaknesses] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [assessment, setAssessment] = useState<Record<string, number>>(
    Object.fromEntries(PROGRESS_METRICS.map((m) => [m, 50]))
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!position.trim()) {
      setError("Tell us your position so we can tailor your training.");
      return;
    }
    setSaving(true);
    const self_assessment = Object.fromEntries(
      PROGRESS_METRICS.map((m) => [m, assessment[m]])
    ) as Partial<Record<ProgressMetric, number>>;

    const res = await completeOnboarding({
      age: parseInt(age, 10) || 0,
      position,
      level,
      club,
      dominant_foot: foot,
      goals: splitLines(goals),
      weaknesses: splitLines(weaknesses),
      self_assessment,
      parent_name: parentName,
      parent_email: parentEmail,
    });
    if (!res.ok) {
      setError("Something went wrong saving your profile. Please try again.");
      setSaving(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* About you */}
      <Section title="About you" step="1">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Age">
            <input
              type="number"
              min={5}
              max={25}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="13"
              className={inputCls}
            />
          </Field>
          <Field label="Main position">
            <input
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="Attacking Midfield"
              className={inputCls}
            />
          </Field>
          <Field label="Current club / team">
            <input
              value={club}
              onChange={(e) => setClub(e.target.value)}
              placeholder="Riverside United U14"
              className={inputCls}
            />
          </Field>
          <Field label="Dominant foot">
            <Segmented options={FEET} value={foot} onChange={setFoot} />
          </Field>
          <Field label="Level" full>
            <Segmented options={LEVELS} value={level} onChange={setLevel} />
          </Field>
        </div>
      </Section>

      {/* Goals + weaknesses */}
      <Section title="What you're chasing" step="2">
        <Field label="Your goals (one per line)">
          <textarea
            rows={3}
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            placeholder={"Make the regional squad\nStronger weak foot\nMore composure under pressure"}
            className={inputCls}
          />
        </Field>
        <Field label="Where you struggle most (one per line)">
          <textarea
            rows={3}
            value={weaknesses}
            onChange={(e) => setWeaknesses(e.target.value)}
            placeholder={"Weak-foot finishing\nSlows down under a press"}
            className={inputCls}
          />
        </Field>
      </Section>

      {/* Self assessment */}
      <Section title="Rate yourself" step="3">
        <p className="-mt-2 mb-4 text-sm text-white/45">
          Be honest. This is your starting line. Your coach will re-rate you as
          you grow, and you&apos;ll watch these climb.
        </p>
        <div className="space-y-4">
          {PROGRESS_METRICS.map((m) => (
            <div key={m}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-medium text-white/80">{m}</span>
                <span className="font-display font-bold text-accent">
                  {assessment[m]}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={assessment[m]}
                onChange={(e) =>
                  setAssessment((a) => ({ ...a, [m]: Number(e.target.value) }))
                }
                className="w-full accent-accent"
              />
            </div>
          ))}
        </div>
      </Section>

      {/* Parent */}
      <Section title="Parent / guardian" step="4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Parent or guardian name">
            <input
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              placeholder="Full name"
              className={inputCls}
            />
          </Field>
          <Field label="Parent contact email">
            <input
              type="email"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
              placeholder="parent@example.com"
              className={inputCls}
            />
          </Field>
        </div>
      </Section>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="btn-accent w-full px-6 py-4 text-base"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          "Finish & enter my dashboard"
        )}
      </button>
      <p className="pb-8 text-center text-xs text-white/30">
        Signed in as {defaultName}
      </p>
    </form>
  );
}

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-bone placeholder:text-white/25 focus:border-accent/40 focus:outline-none";

function splitLines(s: string): string[] {
  return s
    .split(/\n|,/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function Section({
  title,
  step,
  children,
}: {
  title: string;
  step: string;
  children: React.ReactNode;
}) {
  return (
    <div className="elite-card p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/15 font-display text-sm font-bold text-accent">
          {step}
        </span>
        <h2 className="font-display text-lg font-bold uppercase tracking-tight">
          {title}
        </h2>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={"block" + (full ? " sm:col-span-2" : "")}>
      <span className="mb-2 block text-sm font-medium text-white/70">
        {label}
      </span>
      {children}
    </label>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={
            "rounded-xl border px-3 py-2 text-sm font-medium transition-all " +
            (value === o
              ? "border-accent/40 bg-accent/[0.08] text-accent"
              : "border-white/10 bg-white/[0.02] text-white/50 hover:border-white/20")
          }
        >
          {o}
        </button>
      ))}
    </div>
  );
}
