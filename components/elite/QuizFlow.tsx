"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft } from "lucide-react";
import { completeOnboarding } from "@/lib/elite/player-actions";
import { buildMyFirstWeek } from "@/lib/elite/first-week-actions";
import {
  AGES,
  FEET,
  LEVELS,
  POSITIONS,
  QUIZ_STEPS,
  SPACES,
  RATING_MAX,
  RATING_MIN,
  RATING_WORDS,
  TEAM_TRAINING,
  attributesIn,
  emptyAnswers,
  lowestAttributes,
  firstUnanswered,
  quizInput,
  stepReady,
  stillToRate,
  QUIZ_QUESTIONS,
  type QuizAnswers,
  canSkip,
} from "@/lib/elite/quiz";
import {
  FIRST_WEEK_LINE,
  FIRST_WEEK_WAIT_MS,
  weakSpotPhrase,
  type FirstWeekStatus,
  buildingLines,
} from "@/lib/elite/experience";
import { sessionsFor, sessionsWord } from "@/lib/elite/training";
import { feel } from "@/lib/elite/native";
import { MemberCard } from "./MemberCard";
import { ProfileSetup } from "./ProfileSetup";
import { useKeyboardInset } from "./OnboardingShell";
import type { SetupStep } from "@/lib/elite/account-profile";
import { cn } from "@/lib/utils";

type Stage = "door" | "quiz" | "profile" | "building";

// The first minutes of membership (Nov 21 2026, experience.md): the door
// ("You're in." and the member card rising), the quiz (one question a
// screen, tap and it moves on), then building, which waits for the real
// first week (lib/elite/first-week-actions.ts) and says plainly where it is.
// A week that is built and open goes straight to Home, where the drop shows
// it landing; anything else is said as it is, never faked.
export function QuizFlow({
  firstName,
  cardName,
  since,
  tier,
  knownParentPhone = "",
  setup = { steps: [], ideas: [], initials: "" },
}: {
  firstName: string;
  cardName: string;
  since: string | null;
  tier: string;
  knownParentPhone?: string;
  // the @username and the profile photo still owed (081): the last screens
  // of the quiz, both required, before the answers are saved
  setup?: { steps: SetupStep[]; ideas: string[]; initials: string };
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("door");
  const [step, setStep] = useState(0);
  const [a, setA] = useState<QuizAnswers>(() => emptyAnswers(knownParentPhone));
  const [picked, setPicked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingPhone, setEditingPhone] = useState(false);
  const advance = useRef<ReturnType<typeof setTimeout> | null>(null);
  const kb = useKeyboardInset();

  useEffect(() => () => {
    if (advance.current) clearTimeout(advance.current);
  }, []);

  const total = QUIZ_STEPS.length;
  const current = QUIZ_STEPS[step];
  // the progress line runs through the photo and username screens too
  const overall = total + setup.steps.length;

  function next() {
    setPicked(null);
    setError(null);
    setStep((s) => Math.min(total - 1, s + 1));
  }
  function back() {
    if (advance.current) clearTimeout(advance.current);
    setPicked(null);
    setError(null);
    if (step === 0) setStage("door");
    else setStep((s) => s - 1);
  }

  // A tap is the answer: a check pops and the next question comes up.
  function choose(key: string, patch: Partial<QuizAnswers>) {
    if (advance.current) clearTimeout(advance.current);
    feel("drill");
    setA((prev) => ({ ...prev, ...patch }));
    setPicked(key);
    advance.current = setTimeout(next, 460);
  }

  async function finish() {
    const missing = firstUnanswered(a);
    if (missing !== -1) {
      setStep(missing);
      setError(missing === total - 1 ? "Enter a parent or guardian name so we know who to text." : "Answer this one first.");
      return;
    }
    setError(null);
    // the username and the photo come last, then everything is saved
    if (setup.steps.length > 0) {
      feel("drill");
      setStage("profile");
      return;
    }
    await save();
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await completeOnboarding(quizInput(a));
    if (!res.ok) {
      setSaving(false);
      // the server checks the photo and username itself (SETUP_REFUSED)
      if ("needsSetup" in res && res.needsSetup && setup.steps.length > 0) {
        setStage("profile");
        return;
      }
      setStage("quiz");
      setError("Something went wrong saving your answers. Please try again.");
      return;
    }
    setStage("building");
  }

  if (stage === "profile") {
    return (
      <ProfileSetup
        steps={setup.steps}
        ideas={setup.ideas}
        initials={setup.initials}
        seenBy="your coaches"
        progressBase={{ before: total, total: overall }}
        onBackFromFirst={() => {
          setStage("quiz");
          setStep(total - 1);
        }}
        onDone={save}
      />
    );
  }

  if (stage === "door") {
    return (
      <Door
        firstName={firstName}
        cardName={cardName}
        since={since}
        tier={tier}
        onGo={() => {
          feel("drill");
          setStage("quiz");
        }}
      />
    );
  }

  if (stage === "building") {
    const team = TEAM_TRAINING.find((t) => t.id === a.team);
    return (
      <Building
        weakSpot={weakSpotPhrase(lowestAttributes(a.attrs)) ?? "you"}
        sessions={sessionsWord(sessionsFor(team?.load))}
        onLive={() => {
          router.replace("/dashboard");
          router.refresh();
        }}
        onHome={() => {
          router.replace("/dashboard");
          router.refresh();
        }}
      />
    );
  }

  const ready = stepReady(current.id, a);

  return (
    <div className="flex min-h-[100svh] flex-col">
      <div className="px-5 pt-[calc(env(safe-area-inset-top)+12px)]">
        <div className="flex items-center gap-2">
          <button
            onClick={back}
            aria-label="Back"
            className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/80 active:scale-95"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="flex flex-1 gap-[3px]" aria-hidden>
            {Array.from({ length: overall }, (_, i) => (
              <i key={i} className={cn("h-1 flex-1 rounded-full transition-colors duration-300", i <= step ? "bg-bone" : "bg-fill-2")} />
            ))}
          </div>
        </div>
      </div>

      <div key={current.id} className="flex min-h-0 flex-1 flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-5 animate-step-in">
        <div className="m-eyebrow">
          {current.section} · {step + 1} of {overall}
        </div>
        <Question id={current.id} />

        <div className="mt-6 flex-1">
          {current.id === "gender" && (
            <Rows
              options={[
                { key: "boy", label: "Boy" },
                { key: "girl", label: "Girl" },
              ]}
              value={picked ?? a.gender ?? null}
              onPick={(k) => choose(k, { gender: k as "boy" | "girl" })}
            />
          )}
          {current.id === "team" && (
            <Rows
              options={TEAM_TRAINING.map((t) => ({ key: t.id, label: t.label }))}
              value={picked ?? a.team ?? null}
              onPick={(k) => choose(k, { team: k as QuizAnswers["team"] })}
            />
          )}
          {current.id === "age" && (
            <div className="grid grid-cols-4 gap-2.5" role="group" aria-label="Age">
              {AGES.map((n) => {
                const on = (picked ?? String(a.age ?? "")) === String(n);
                return (
                  <button
                    key={n}
                    onClick={() => choose(String(n), { age: n })}
                    aria-pressed={on}
                    className={cn(
                      "press h-16 rounded-[18px] m-head text-[26px] transition-colors",
                      on ? "bg-bone text-black" : "bg-fill text-bone shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]"
                    )}
                  >
                    {n === 19 ? "19+" : n}
                  </button>
                );
              })}
            </div>
          )}
          {current.id === "position" && (
            <Rows
              grid
              options={POSITIONS.map((p) => ({ key: p, label: p }))}
              value={picked ?? a.position ?? null}
              onPick={(k) => choose(k, { position: k })}
            />
          )}
          {current.id === "foot" && (
            <Rows
              options={FEET.map((f) => ({ key: f, label: f === "Both" ? "Both, equally" : `${f} foot` }))}
              value={picked ?? a.foot ?? null}
              onPick={(k) => choose(k, { foot: k as QuizAnswers["foot"] })}
            />
          )}
          {current.id === "level" && (
            <Rows
              options={LEVELS.map((l) => ({ key: l, label: l }))}
              value={picked ?? a.level ?? null}
              onPick={(k) => choose(k, { level: k as QuizAnswers["level"] })}
            />
          )}
          {current.id === "space" && (
            <Tiles
              options={SPACES.map((sp) => ({ key: sp.id, label: sp.label, line: sp.line, image: sp.image }))}
              value={picked ?? a.space ?? null}
              onPick={(k) => choose(k, { space: k as QuizAnswers["space"] })}
            />
          )}
          {current.id === "nearby" && (
            <div className="space-y-3" role="group" aria-label="What is near where you train">
              <Toggle label="A wall I can pass against" line="A garage door, a brick wall, a fence." on={a.wall} onChange={(v) => setA((p) => ({ ...p, wall: v }))} />
              <Toggle label="A goal I can shoot at" line="Any size." on={a.goal} onChange={(v) => setA((p) => ({ ...p, goal: v }))} />
            </div>
          )}
          {current.id === "club" && (
            <input
              value={a.club}
              onChange={(e) => setA((p) => ({ ...p, club: e.target.value }))}
              placeholder="Riverside United U14"
              aria-label="Your club or team"
              autoFocus
              enterKeyHint="next"
              className={fieldCls}
            />
          )}
          {current.id === "goals" && (
            <textarea
              rows={4}
              value={a.goals}
              onChange={(e) => setA((p) => ({ ...p, goals: e.target.value }))}
              placeholder={"Make the regional squad\nStart every game this season"}
              aria-label="Your goals, one per line"
              autoFocus
              className={fieldCls}
            />
          )}
          {(current.id === "onBall" || current.id === "offBall") && (
            <RatePage
              group={current.id === "onBall" ? "on" : "off"}
              attrs={a.attrs}
              onRate={(id, v) => {
                feel("drill");
                setA((p) => ({ ...p, attrs: { ...p.attrs, [id]: v } }));
              }}
            />
          )}
          {current.id === "parent" && (
            <div className="space-y-3">
              <input
                value={a.parentName}
                onChange={(e) => setA((p) => ({ ...p, parentName: e.target.value }))}
                placeholder="Parent or guardian, full name"
                aria-label="Parent or guardian name"
                autoFocus
                autoComplete="off"
                enterKeyHint="next"
                className={fieldCls}
              />
              <input
                type="email"
                value={a.parentEmail}
                onChange={(e) => setA((p) => ({ ...p, parentEmail: e.target.value }))}
                placeholder="Their email (optional)"
                aria-label="Parent email"
                className={fieldCls}
              />
              {knownParentPhone && !editingPhone ? (
                <div className="m-card flex items-center justify-between px-4 py-3 text-[14px]">
                  <span className="text-white/70">
                    Texts go to <span className="text-bone">{knownParentPhone}</span>
                  </span>
                  <button type="button" onClick={() => setEditingPhone(true)} className="tap text-[13px] font-semibold text-bone underline-offset-4 hover:underline">
                    Change
                  </button>
                </div>
              ) : (
                <input
                  type="tel"
                  value={a.parentPhone}
                  onChange={(e) => setA((p) => ({ ...p, parentPhone: e.target.value }))}
                  placeholder="Their phone, for texts"
                  aria-label="Parent phone"
                  className={fieldCls}
                />
              )}
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-[14px] text-red-200">
            {error}
          </p>
        )}

        {!current.autoAdvance && (
          // pinned to the bottom, riding above the keyboard when it is up
          <div className="sticky z-10 -mx-5 mt-5 bg-black px-5 pb-1 pt-3" style={{ bottom: kb }}>
          {(current.id === "onBall" || current.id === "offBall") && stillToRate(current.id === "onBall" ? "on" : "off", a.attrs) ? (
            <p className="mb-2 text-center text-[13px] text-white/60" role="status">
              {stillToRate(current.id === "onBall" ? "on" : "off", a.attrs)}
            </p>
          ) : null}
          <button
            onClick={current.id === "parent" ? finish : next}
            disabled={saving || (current.id === "nearby" ? false : !ready)}
            className="m-button disabled:opacity-40"
            onClickCapture={() => {
              if (current.id === "nearby") setA((p) => ({ ...p, nearbyAnswered: true }));
            }}
          >
            {saving ? (
              "Saving your answers"
            ) : current.id === "parent" && setup.steps.length === 0 ? (
              "Build my week"
            ) : canSkip(current.id, a) ? (
              "Skip"
            ) : (
              "Next"
            )}
          </button>
          </div>
        )}
      </div>
    </div>
  );
}

// One rating page: every attribute in the group, its line, and five
// buttons, 1 to 5. The scale's words sit once at the top.
function RatePage({
  group,
  attrs,
  onRate,
}: {
  group: "on" | "off";
  attrs: QuizAnswers["attrs"];
  onRate: (id: string, v: number) => void;
}) {
  const scale = Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, i) => RATING_MIN + i);
  return (
    <div>
      <div className="mb-3 flex justify-between text-[12px] font-semibold uppercase tracking-[0.12em] text-white/50" aria-hidden>
        <span>1 · {RATING_WORDS[1]}</span>
        <span>3 · {RATING_WORDS[3]}</span>
        <span>5 · {RATING_WORDS[5]}</span>
      </div>
      <div className="space-y-2.5">
        {attributesIn(group).map((x) => {
          const v = attrs[x.id];
          return (
            <div key={x.id} className="m-card px-4 py-3.5" role="group" aria-label={`${x.label}, 1 to 5`}>
              <div className="text-[16px] font-semibold text-bone">{x.label}</div>
              <div className="mt-0.5 text-[13px] leading-snug text-white/60">{x.line}</div>
              <div className="mt-3 grid grid-cols-5 gap-2">
                {scale.map((n) => {
                  const on = v === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => onRate(x.id, n)}
                      aria-pressed={on}
                      aria-label={`${x.label}: ${n}`}
                      className={cn(
                        "press h-11 rounded-[14px] m-num text-[17px] tabular-nums transition-colors",
                        on ? "bg-bone text-black" : "bg-fill-2 text-white/80"
                      )}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const fieldCls =
  "w-full rounded-[18px] bg-fill px-4 py-4 text-bone shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)] placeholder:text-white/35 focus:shadow-[inset_0_0_0_1.5px_rgba(245,244,239,0.5)] focus:outline-none";

function Question({ id }: { id: string }) {
  const q = QUIZ_QUESTIONS[id as keyof typeof QUIZ_QUESTIONS];
  return (
    <>
      <h1 className="mt-2.5 m-head text-[36px] leading-[1.04] text-balance">{q.title}</h1>
      {q.sub && <p className="mt-2.5 text-[15px] leading-snug text-white/60">{q.sub}</p>}
    </>
  );
}

function Pop() {
  return (
    <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-bone text-black animate-check-pop" aria-hidden>
      <Check className="h-4 w-4" strokeWidth={3} />
    </span>
  );
}

function Rows({
  options,
  value,
  onPick,
  grid = false,
}: {
  options: { key: string; label: string }[];
  value: string | null;
  onPick: (key: string) => void;
  grid?: boolean;
}) {
  return (
    <div className={grid ? "grid grid-cols-2 gap-2.5" : "flex flex-col gap-3"} role="group">
      {options.map((o) => {
        const on = value === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onPick(o.key)}
            aria-pressed={on}
            className={cn(
              "press relative flex items-center rounded-[20px] bg-fill text-left transition-[box-shadow,opacity] duration-300",
              grid ? "min-h-[64px] px-4 py-3 text-[15px]" : "h-[68px] px-5 text-[17px]",
              "font-semibold",
              on ? "shadow-[inset_0_0_0_2px_#F5F4EF]" : "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]",
              value !== null && !on && "opacity-50"
            )}
          >
            <span className="min-w-0 flex-1">{o.label}</span>
            {on && <Pop />}
          </button>
        );
      })}
    </div>
  );
}

function Tiles({
  options,
  value,
  onPick,
}: {
  options: { key: string; label: string; line: string; image: string }[];
  value: string | null;
  onPick: (key: string) => void;
}) {
  return (
    <div className="-mx-1.5 grid grid-cols-2 gap-2.5" role="group">
      {options.map((o) => {
        const on = value === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onPick(o.key)}
            aria-pressed={on}
            aria-label={`${o.label}. ${o.line}`}
            className={cn(
              "relative h-[min(222px,28svh)] min-h-[160px] overflow-hidden rounded-[24px] bg-fill text-left transition-[box-shadow,opacity,transform] duration-300",
              on && "shadow-[0_0_0_2.5px_#F5F4EF]",
              value !== null && !on && "scale-[0.97] opacity-30"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={o.image} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover brightness-[0.62]" />
            <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_40%,rgba(0,0,0,0.75))]" aria-hidden />
            <span className="absolute inset-x-3.5 bottom-3.5">
              <span className="block m-head text-[22px] leading-[1.02]">{o.label}</span>
              <span className="mt-1 block text-[12.5px] leading-snug text-white/85">{o.line}</span>
            </span>
            {on && (
              <span className="absolute right-3 top-3">
                <Pop />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ label, line, on, onChange }: { label: string; line: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => {
        feel("drill");
        onChange(!on);
      }}
      className={cn(
        "press flex min-h-[72px] w-full items-center gap-3 rounded-[20px] bg-fill px-5 py-3 text-left",
        on ? "shadow-[inset_0_0_0_2px_#F5F4EF]" : "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]"
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold">{label}</span>
        <span className="mt-0.5 block text-[13px] text-white/60">{line}</span>
      </span>
      <span
        className={cn(
          "grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full",
          on ? "bg-bone text-black" : "shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.25)]"
        )}
        aria-hidden
      >
        {on && <Check className="h-4 w-4" strokeWidth={3} />}
      </span>
    </button>
  );
}

// The door: the mark, a gold line drawing, "You're in." and the member
// card rising with a light across it. One button.
function Door({
  firstName,
  cardName,
  since,
  tier,
  onGo,
}: {
  firstName: string;
  cardName: string;
  since: string | null;
  tier: string;
  onGo: () => void;
}) {
  return (
    <div className="flex min-h-[100svh] flex-col px-6 pb-[calc(env(safe-area-inset-bottom)+28px)] pt-[calc(env(safe-area-inset-top)+64px)] text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/strive-logo-512.png" alt="Strive Soccer" className="mx-auto h-24 w-24 invert animate-fade-in" />
      <div className="mx-auto mt-5 h-[1.5px] w-16 origin-center bg-metal animate-bar-fill [animation-delay:400ms]" aria-hidden />
      <h1 className="mt-6 m-head text-[44px] leading-none animate-rise [animation-delay:650ms]">You&apos;re in.</h1>
      <p className="mt-3 text-[15.5px] text-white/65 animate-rise [animation-delay:780ms]">
        Welcome to Strive Elite, {firstName}.
      </p>
      <MemberCard name={cardName} since={since} tier={tier} rise className="mx-auto mt-10 w-full max-w-sm text-left" />
      <div className="flex-1" />
      <button onClick={onGo} className="m-button mx-auto mt-8 max-w-sm animate-rise [animation-delay:1500ms]">
        Build my week
      </button>
    </div>
  );
}

// Building: three lines tick off. The first two are true the moment the
// answers are saved; the third ticks only when the week really is built.
// Then: a built, open week goes to Home (the drop); anything else is said.
function Building({
  weakSpot,
  sessions,
  onLive,
  onHome,
}: {
  weakSpot: string;
  sessions: string;
  onLive: () => void;
  onHome: () => void;
}) {
  const [ticks, setTicks] = useState(0);
  const [status, setStatus] = useState<FirstWeekStatus | null>(null);

  useEffect(() => {
    let alive = true;
    const t1 = setTimeout(() => {
      setTicks((n) => Math.max(n, 1));
      feel("drill");
    }, 650);
    const t2 = setTimeout(() => {
      setTicks((n) => Math.max(n, 2));
      feel("drill");
    }, 1300);
    const wait = new Promise<{ status: FirstWeekStatus }>((resolve) =>
      setTimeout(() => resolve({ status: "waiting" }), FIRST_WEEK_WAIT_MS)
    );
    const started = Date.now();
    Promise.race([buildMyFirstWeek().catch(() => ({ status: "waiting" as FirstWeekStatus })), wait]).then((res) => {
      if (!alive) return;
      // The first two lines always get their moment.
      const hold = Math.max(0, 1500 - (Date.now() - started));
      setTimeout(() => {
        if (!alive) return;
        if (res.status === "live") {
          setTicks(3);
          feel("session");
          setTimeout(() => alive && onLive(), 700);
        } else {
          setStatus(res.status);
        }
      }, hold);
    });
    return () => {
      alive = false;
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // Runs once, when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lines = buildingLines(weakSpot, sessions);
  const said = status && status !== "live" ? FIRST_WEEK_LINE[status] : null;

  return (
    <div className="flex min-h-[100svh] flex-col px-9 pb-[calc(env(safe-area-inset-bottom)+28px)] pt-[calc(env(safe-area-inset-top)+180px)]">
      <div className="m-eyebrow animate-rise">Week 1</div>
      <h1 className="mt-2.5 m-head text-[34px] leading-[1.04] animate-rise [animation-delay:60ms]">
        Building
        <br />
        your week
      </h1>
      <ol className="mt-7 space-y-[18px]" aria-live="polite">
        {lines.map((l, i) => {
          const ok = ticks > i;
          return (
            <li key={l} className={cn("flex items-center gap-3.5 text-[16px] transition-colors duration-300", ok ? "text-bone" : "text-white/50")}>
              <span
                className={cn(
                  "grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full transition-colors duration-300",
                  ok ? "metal-disc" : "shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.12)]"
                )}
                aria-hidden
              >
                {ok ? (
                  <Check className="h-[15px] w-[15px] animate-check-pop" strokeWidth={3} />
                ) : i === ticks && !said ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-white/60 animate-pulse-soft" />
                ) : null}
              </span>
              {l}
              <span className="sr-only">{ok ? ", done" : ""}</span>
            </li>
          );
        })}
      </ol>
      {said && (
        <div className="mt-10 animate-rise">
          <p className="m-head text-[26px] leading-[1.05]">{said.title}</p>
          <p className="mt-2 text-[15px] leading-relaxed text-white/65">{said.body}</p>
        </div>
      )}
      <div className="flex-1" />
      {said && (
        <button onClick={onHome} className="m-button animate-rise">
          Go to Home
        </button>
      )}
    </div>
  );
}
