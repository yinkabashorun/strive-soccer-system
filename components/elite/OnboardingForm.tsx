"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PROGRESS_METRICS, type ProgressMetric } from "@/lib/elite/types";
import { completeOnboarding } from "@/lib/elite/player-actions";

const LEVELS = ["Developing", "Competitive", "Advanced", "Elite"];
const FEET = ["Right", "Left", "Both"];
const YES_NO = ["Yes", "No"];
// 033: training space and load, picked by the family, coach can override.
const SPACE_OPTIONS = ["Yard, driveway, park or garage", "A ball and a few yards"];
const LOAD_OPTIONS = ["3 to 4 times a week or more", "Less than that, or off season"];
const GENDERS = ["Boy", "Girl"];

export function OnboardingForm({
  defaultName,
  knownParentPhone = "",
}: {
  defaultName: string;
  // The parent phone is REQUIRED at signup (SignupForm -> redeem route),
  // so by the time a family reaches this form we already have it. Show it
  // as a confirmed line with a "change" link rather than an empty field -
  // asking for the same number twice reads as sloppy (Coach Yinka, Oct 3
  // 2026). A blank here means a pre-Sept-26 signup, and then we do ask.
  knownParentPhone?: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingPhone, setEditingPhone] = useState(false);

  const [age, setAge] = useState("");
  const [position, setPosition] = useState("");
  const [level, setLevel] = useState("Developing");
  const [club, setClub] = useState("");
  const [foot, setFoot] = useState("Right");
  const [gender, setGender] = useState("");
  const [goals, setGoals] = useState("");
  const [weaknesses, setWeaknesses] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState(knownParentPhone);
  const [hasWall, setHasWall] = useState("No");
  const [hasGoal, setHasGoal] = useState("No");
  const [load, setLoad] = useState(LOAD_OPTIONS[0]);
  const [space, setSpace] = useState(SPACE_OPTIONS[0]);
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
    if (!gender) {
      setError("Select Boy or Girl so we get pronouns right in your training updates.");
      return;
    }
    if (!parentName.trim()) {
      setError("Enter a parent or guardian name so we know who to text.");
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
      gender: gender.toLowerCase() as "boy" | "girl", // Segmented stores the display label ("Boy"/"Girl")
      goals: splitLines(goals),
      weaknesses: splitLines(weaknesses),
      self_assessment,
      parent_name: parentName,
      parent_email: parentEmail,
      parent_phone: parentPhone,
      has_wall: hasWall === "Yes",
      has_goal: hasGoal === "Yes",
      training_load: load === LOAD_OPTIONS[1] ? "off_season" : "in_season",
      space: space === SPACE_OPTIONS[1] ? "tight" : "open",
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
          <Field label="Dominant foot" group>
            <Segmented options={FEET} value={foot} onChange={setFoot} />
          </Field>
          <Field label="Boy or girl" group>
            <Segmented options={GENDERS} value={gender} onChange={setGender} />
          </Field>
          <Field label="Level" full group>
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
        <p className="-mt-2 mb-4 text-sm text-white/50">
          Be honest. This is your starting line. Your coach will re-rate you as
          you grow, and you&apos;ll watch these climb.
        </p>
        <div className="space-y-4">
          {PROGRESS_METRICS.map((m) => (
            <div key={m}>
              <div className="flex items-center justify-between text-sm">
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
                aria-label={`${m}, out of 100`}
                className="h-11 w-full accent-accent"
              />
            </div>
          ))}
        </div>
      </Section>

      {/* Training space */}
      <Section title="Your training space" step="4">
        <p className="-mt-2 mb-4 text-sm text-white/50">
          Your plan only uses what you actually have. Answer honestly and
          every drill will make sense.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Wall you can pass against nearby? (garage door, brick wall, fence)" group>
            <Segmented options={YES_NO} value={hasWall} onChange={setHasWall} />
          </Field>
          <Field label="Goal you can shoot at nearby?" group>
            <Segmented options={YES_NO} value={hasGoal} onChange={setHasGoal} />
          </Field>
        </div>
        <div className="mt-4 grid gap-4">
          <Field label="Where will you train most days?" group>
            <Segmented options={SPACE_OPTIONS} value={space} onChange={setSpace} />
            <p className="mt-1.5 text-[13px] text-white/50">
              A ball and a few yards is enough. Pick that and every drill you get fits the space.
            </p>
          </Field>
          <Field label="How much are you training with a team right now?" group>
            <Segmented options={LOAD_OPTIONS} value={load} onChange={setLoad} />
            <p className="mt-1.5 text-[13px] text-white/50">
              {load === LOAD_OPTIONS[1]
                ? "Off-Season plan: 6 sessions a week, about 40 minutes each."
                : "In-Season plan: 4 sessions a week, about 40 minutes each, on top of team practice."}
            </p>
          </Field>
        </div>
      </Section>

      {/* Parent */}
      <Section title="Parent / guardian" step="5">
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
          {knownParentPhone && !editingPhone ? (
            <div className="sm:col-span-2 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm">
              <span className="text-white/70">
                Text updates go to <span className="text-bone">{knownParentPhone}</span>
              </span>
              <button
                type="button"
                onClick={() => setEditingPhone(true)}
                className="tap text-[13px] font-semibold text-accent hover:underline"
              >
                Change
              </button>
            </div>
          ) : (
            <Field label="Parent contact phone (for text updates)" full>
              <input
                type="tel"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                placeholder="(703) 555-0100"
                className={inputCls}
              />
            </Field>
          )}
        </div>
      </Section>

      {error && (
        <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

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
      <p className="pb-8 text-center text-[13px] text-white/50">
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
  group,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
  // A set of choice buttons rather than one field: a named group, so a
  // tap on the question does not press the first answer.
  group?: boolean;
}) {
  const cls = "block" + (full ? " sm:col-span-2" : "");
  const title = <span className="mb-2 block text-sm font-medium text-white/70">{label}</span>;
  if (group) {
    return (
      <div role="group" aria-label={label} className={cls}>
        {title}
        {children}
      </div>
    );
  }
  return (
    <label className={cls}>
      {title}
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
          aria-pressed={value === o}
          className={
            "min-h-[44px] rounded-xl border px-3.5 py-2 text-sm font-medium transition-all " +
            (value === o
              ? "border-accent/40 bg-accent/[0.08] text-accent"
              : "border-white/10 bg-white/[0.02] text-white/60 hover:border-white/20")
          }
        >
          {o}
        </button>
      ))}
    </div>
  );
}
