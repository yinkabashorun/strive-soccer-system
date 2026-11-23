"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check } from "lucide-react";
import { checkUsername, saveUsername } from "@/lib/elite/profile-actions";
import { USERNAME_MAX, normalizeUsername, usernameProblem, USERNAME_MESSAGES } from "@/lib/elite/username";
import { uploadProfilePhoto } from "@/lib/elite/photo-upload";
import type { SetupStep } from "@/lib/elite/account-profile";
import { feel } from "@/lib/elite/native";
import { OnboardingShell } from "./OnboardingShell";
import { cn } from "@/lib/utils";

// The @username and the profile photo, one screen each, Instagram style
// (Nov 23 2026). Both are required: neither can be passed over. Shown as the last
// steps of a new member's quiz, as the free app's first screens after
// sign-up, and once to every account made before (the gate in the member
// and free layouts). The server refuses a finished onboarding without them
// (lib/elite/account-profile.ts SETUP_REFUSED).

type CheckState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok"; name: string }
  | { kind: "no"; name: string; error: string };

// Answers while they type: the rules at once, the database once the
// typing settles (350 ms), the newest answer only.
export function useUsernameCheck(value: string, current: string | null) {
  const [state, setState] = useState<CheckState>({ kind: "idle" });
  const seq = useRef(0);
  useEffect(() => {
    const name = normalizeUsername(value);
    const mine = ++seq.current;
    if (!name) return setState({ kind: "idle" });
    if (current && name === current) return setState({ kind: "ok", name });
    const problem = usernameProblem(name);
    // too short is not an error while they are still typing it
    if (problem === "short") return setState({ kind: "idle" });
    if (problem) return setState({ kind: "no", name, error: USERNAME_MESSAGES[problem] });
    setState({ kind: "checking" });
    const t = setTimeout(async () => {
      const res = await checkUsername(name).catch(() => null);
      if (mine !== seq.current) return;
      if (!res) return setState({ kind: "no", name, error: USERNAME_MESSAGES.offline });
      setState(res.ok ? { kind: "ok", name: res.name } : { kind: "no", name: res.name, error: res.error });
    }, 350);
    return () => clearTimeout(t);
  }, [value, current]);
  return state;
}

// The field itself: @ in front, the tick or the reason beside and under it.
export function UsernameInput({
  value,
  onChange,
  state,
  autoFocus,
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  state: CheckState;
  autoFocus?: boolean;
  onEnter?: () => void;
}) {
  return (
    <div>
      <label htmlFor="username" className="sr-only">
        Username
      </label>
      <div
        className={cn(
          "flex h-14 items-center rounded-2xl bg-fill px-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] transition-shadow focus-within:shadow-[inset_0_0_0_1.5px_rgba(245,244,239,0.6)]",
          state.kind === "no" && "shadow-[inset_0_0_0_1.5px_rgba(248,113,113,0.7)]"
        )}
      >
        <span className="text-[17px] font-semibold text-white/50" aria-hidden>
          @
        </span>
        <input
          id="username"
          value={value}
          onChange={(e) => onChange(normalizeUsername(e.target.value).replace(/[^a-z0-9._]/g, "").slice(0, USERNAME_MAX))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onEnter) {
              e.preventDefault();
              onEnter();
            }
          }}
          autoFocus={autoFocus}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          spellCheck={false}
          inputMode="text"
          enterKeyHint="next"
          maxLength={USERNAME_MAX}
          placeholder="username"
          aria-invalid={state.kind === "no"}
          aria-describedby="username-status"
          className="ml-0.5 h-full min-w-0 flex-1 bg-transparent text-[17px] font-semibold text-bone outline-none placeholder:text-white/25"
        />
        <span className="ml-2 grid h-7 w-7 shrink-0 place-items-center" aria-hidden>
          {state.kind === "checking" && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />}
          {state.kind === "ok" && (
            <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500 text-black animate-check-pop">
              <Check className="h-4 w-4" strokeWidth={3} />
            </span>
          )}
        </span>
      </div>
      <p id="username-status" aria-live="polite" className={cn("mt-2 min-h-[20px] text-[13px]", state.kind === "no" ? "text-red-400" : "text-white/55")}>
        {state.kind === "no" ? state.error : state.kind === "ok" ? `@${state.name} is yours if you want it.` : "Letters, numbers, dots and underscores."}
      </p>
    </div>
  );
}

export function ProfileSetup({
  steps,
  ideas,
  initials,
  seenBy,
  onDone,
  onBackFromFirst,
  progressBase,
  footer,
}: {
  steps: SetupStep[];
  ideas: string[];
  initials: string;
  // who sees the photo, in a few words ("your coaches", "your friends and the coaches")
  seenBy: string;
  onDone: () => void | Promise<void>;
  // the quiz that came before, if any
  onBackFromFirst?: (() => void) | null;
  // when these steps continue a longer flow: how many came before, and the whole length
  progressBase?: { before: number; total: number } | null;
  footer?: React.ReactNode;
}) {
  const [at, setAt] = useState(0);
  const [name, setName] = useState(ideas[0] ?? "");
  const state = useUsernameCheck(name, null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const step = steps[at];
  const progress = progressBase
    ? { at: progressBase.before + at + 1, of: progressBase.total }
    : steps.length > 1
      ? { at: at + 1, of: steps.length }
      : null;
  const back = at > 0 ? () => (setError(null), setAt(at - 1)) : onBackFromFirst ?? null;

  async function nextFrom(current: SetupStep) {
    setError(null);
    if (at + 1 < steps.length) {
      setAt(at + 1);
      return;
    }
    setSaving(true);
    try {
      await onDone();
    } finally {
      setSaving(false);
    }
    void current;
  }

  async function takeName() {
    if (state.kind !== "ok" || saving) return;
    setSaving(true);
    const res = await saveUsername(state.name).catch(() => null);
    setSaving(false);
    if (!res) return setError(USERNAME_MESSAGES.offline);
    if (!res.ok) return setError(res.error);
    feel("drill");
    await nextFrom("username");
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setSaving(true);
    const res = await uploadProfilePhoto(file);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    feel("drill");
    setPreview(res.preview);
  }

  if (step === "username") {
    return (
      <OnboardingShell
        stepKey="username"
        onBack={back}
        progress={progress}
        title="Pick a username"
        lead="It is how you show up in Strive. You can change it later."
        action={
          <button type="button" onClick={takeName} disabled={state.kind !== "ok" || saving} className="m-button disabled:opacity-40">
            {saving ? "Saving" : "Next"}
          </button>
        }
        footer={footer}
      >
        <UsernameInput value={name} onChange={setName} state={state} autoFocus onEnter={takeName} />
        {error && (
          <p role="alert" className="mt-1 text-[13px] text-red-400">
            {error}
          </p>
        )}
        {ideas.length > 0 && (
          <div className="mt-5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-white/55">Ideas</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {ideas.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  onClick={() => setName(idea)}
                  className={cn(
                    "press min-h-[44px] rounded-full px-4 text-[14px] font-semibold",
                    name === idea ? "bg-bone text-black" : "bg-fill text-bone shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                  )}
                >
                  @{idea}
                </button>
              ))}
            </div>
          </div>
        )}
      </OnboardingShell>
    );
  }

  // the photo
  return (
    <OnboardingShell
      stepKey="photo"
      onBack={back}
      progress={progress}
      title="Add a profile photo"
      lead={`A clear photo of your face, so ${seenBy} know it is you.`}
      action={
        preview ? (
          <div className="space-y-2.5">
            <button type="button" onClick={() => nextFrom("photo")} disabled={saving} className="m-button disabled:opacity-40">
              {saving ? "Saving" : "Done"}
            </button>
            <button type="button" onClick={() => fileInput.current?.click()} disabled={saving} className="m-button-quiet w-full">
              Change photo
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => fileInput.current?.click()} disabled={saving} className="m-button disabled:opacity-40">
            {saving ? "Saving" : "Add a photo"}
          </button>
        )
      }
      footer={footer}
    >
      <div className="flex flex-col items-center pt-6">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={saving}
          aria-label={preview ? "Change your photo" : "Add a photo"}
          className="press relative grid h-[184px] w-[184px] place-items-center rounded-full bg-fill shadow-[inset_0_0_0_2px_rgba(255,255,255,0.12)]"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full rounded-full object-cover animate-check-pop" />
          ) : (
            <span className="flex flex-col items-center text-white/55">
              <Camera className="h-12 w-12" strokeWidth={1.5} />
              <span className="mt-2 text-[13px] font-semibold">{initials}</span>
            </span>
          )}
          {saving && <span className="absolute inset-0 grid place-items-center rounded-full bg-black/55"><span className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/20 border-t-white" /></span>}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <p className="mt-6 max-w-[260px] text-center text-[13px] leading-snug text-white/50">
          Take one now or pick one from your photos. We cut it to a circle.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-center text-[14px] text-red-400">
            {error}
          </p>
        )}
      </div>
    </OnboardingShell>
  );
}
