"use client";

import { useState, useTransition } from "react";
import { setNoticeTopic, setReminderTime } from "@/lib/elite/notice-actions";
import { REMINDER_ROW_LABEL, type NoticePrefs } from "@/lib/elite/notice-prefs";
import { cn } from "@/lib/utils";

// What we may tell this person about, as their own choices (lib/elite/
// notice-prefs.ts). One switch per kind of notification the account can
// get, and for a member the time of the one daily reminder. Under the
// on/off for this phone on the Account page, and in the free app's
// Settings.
//
// A switch that is off stops that kind of notification on every phone the
// account uses. The note is still kept in the bell, which is the record.
//
// Every tap saves at once: no Save button. A save that does not go through
// puts the switch back and says so in one line.
export function NoticeChoices({ prefs }: { prefs: NoticePrefs }) {
  const [state, setState] = useState(prefs);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (state.topics.length === 0 && !state.reminder) return null;

  function flip(key: string, on: boolean) {
    const before = state;
    setError(null);
    setState({ ...state, topics: state.topics.map((t) => (t.key === key ? { ...t, on } : t)) });
    start(async () => {
      const saved = await setNoticeTopic(key, on);
      if (saved.ok) setState(saved.prefs);
      else {
        setState(before);
        setError(saved.error);
      }
    });
  }

  function pick(key: string) {
    if (!state.reminder) return;
    const before = state;
    setError(null);
    setState({
      ...state,
      reminder: { ...state.reminder, chosen: key as NonNullable<NoticePrefs["reminder"]>["chosen"] },
    });
    start(async () => {
      const saved = await setReminderTime(key);
      if (saved.ok) setState(saved.prefs);
      else {
        setState(before);
        setError(saved.error);
      }
    });
  }

  return (
    <div className="divide-y divide-white/[0.06]">
      {state.topics.map((t) => (
        <button
          key={t.key}
          role="switch"
          aria-checked={t.on}
          disabled={pending}
          onClick={() => flip(t.key, !t.on)}
          className="flex min-h-[56px] w-full items-center gap-4 p-4 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-bone">{t.label}</span>
            <span className="mt-0.5 block text-sm text-white/60">{t.detail}</span>
          </span>
          <span
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition-colors",
              t.on ? "bg-accent" : "bg-white/15"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
                t.on ? "translate-x-[22px]" : "translate-x-0.5"
              )}
            />
          </span>
        </button>
      ))}

      {state.reminder && (
        <div className="p-4">
          <div className="text-[15px] font-semibold text-bone">{REMINDER_ROW_LABEL}</div>
          <div className="mt-0.5 text-sm text-white/60">{state.reminder.question}</div>
          <ReminderChoices
            choices={state.reminder.choices}
            chosen={state.reminder.chosen}
            disabled={pending}
            onPick={pick}
          />
        </div>
      )}

      {error && (
        <p role="alert" className="p-4 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

// The four answers to "When do you usually train?", one tap each. Used on
// the Account page and on the ask after the first finished session.
export function ReminderChoices({
  choices,
  chosen,
  disabled,
  onPick,
}: {
  choices: { key: string; label: string }[];
  chosen: string | null;
  disabled?: boolean;
  onPick: (key: string) => void;
}) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {choices.map((c) => {
        const on = chosen === c.key;
        return (
          <button
            key={c.key}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onPick(c.key)}
            className={cn(
              "flex min-h-[44px] items-center justify-center rounded-xl border px-3 text-sm font-semibold transition-colors",
              on ? "border-white bg-white text-black" : "border-white/15 text-bone active:bg-white/[0.06]"
            )}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
