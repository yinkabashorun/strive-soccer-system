"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { planGame, planTraining } from "@/lib/elite/club-teams-actions";
import {
  NEEDS_ORGANIZER_OK,
  PLACE_HINT,
  PLACE_MAX,
  PLAN_MINUTES,
  PLAN_MINUTES_DEFAULT,
  PLAN_TIMES,
  PLAN_TIME_DEFAULT,
  PLAN_TITLE_MAX,
  organizedBy,
  timeLabel,
} from "@/lib/elite/club-teams";
import { fmtDuration } from "@/lib/elite/time-trained";
import { Crest } from "./FreeAvatar";
import { FreeTopBar } from "./FreeTopBar";
import { IconPin } from "./FreeIcons";
import { PlayTermsSheet } from "./PlayTermsSheet";

type Kind = "training" | "game";

// Every half hour from 6 AM to 9:30 PM, New York time.
const TIMES = PLAN_TIMES.map((value) => ({ value, label: timeLabel(value) }));

// Plan (the mock, screen 17): club training or a game against a club. The
// club organizes it, never Strive, and the place is a public field or park.
export function PlanForm({
  club,
  opponents,
  days,
  initialVs,
}: {
  club: { id: string; name: string };
  opponents: { id: string; name: string; played: boolean }[];
  days: { value: string; label: string }[];
  initialVs: string | null;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>(initialVs ? "game" : "training");
  const [vs, setVs] = useState<string | null>(initialVs);
  const [day, setDay] = useState(days[1]?.value ?? days[0].value);
  const [time, setTime] = useState<string>(PLAN_TIME_DEFAULT);
  const [minutes, setMinutes] = useState<number>(PLAN_MINUTES_DEFAULT);
  const [place, setPlace] = useState("");
  const [title, setTitle] = useState("");
  const [sheet, setSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const other = opponents.find((o) => o.id === vs) ?? null;

  function send() {
    setError(null);
    start(async () => {
      const input = { day, time, minutes, place, title };
      const res =
        kind === "game"
          ? vs
            ? await planGame(club.id, vs, input)
            : { ok: false as const, error: "Pick the club you want to play." }
          : await planTraining(club.id, input);
      if (!res.ok) return res.error === NEEDS_ORGANIZER_OK ? setSheet(true) : setError(res.error);
      router.push(`/log/club/${club.id}`);
      router.refresh();
    });
  }

  return (
    <div className="pb-6">
      <FreeTopBar back={`/log/club/${club.id}`} title="Plan" />
      <div className="px-[18px] pt-2">
        <div role="radiogroup" aria-label="What you are planning" className="inline-flex rounded-2xl bg-[#161616] p-1">
          {(
            [
              ["training", "Club training"],
              ["game", "Game vs a club"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={"h-11 rounded-xl px-4 text-[15px] font-bold " + (kind === k ? "bg-[#2b2b2b] text-bone" : "text-white/60")}
            >
              {label}
            </button>
          ))}
        </div>

        <h1 className="mt-5 font-display text-[40px] font-black uppercase leading-[0.92]">
          {kind === "training" ? "Club training" : other ? `Game vs ${other.name}` : "Game vs a club"}
        </h1>

        {kind === "game" && (
          <>
            <h2 className="mt-5 text-[11px] font-bold uppercase tracking-[2.4px] text-white/60">Against</h2>
            {opponents.length === 0 ? (
              <p className="mt-2 text-[14px] leading-snug text-white/60">
                No clubs in your county are open to games yet. Set your county and switch on Open to games from the club&apos;s menu,
                and send your link to the captains you know.
              </p>
            ) : (
              <ul className="no-scrollbar -mx-[18px] mt-2 flex gap-2 overflow-x-auto px-[18px]">
                {opponents.map((o) => (
                  <li key={o.id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => setVs(o.id)}
                      aria-pressed={vs === o.id}
                      className={
                        "flex h-12 items-center gap-2 rounded-2xl border px-3 text-[14.5px] font-semibold " +
                        (vs === o.id ? "border-bone bg-[#222] text-bone" : "border-white/10 text-white/70")
                      }
                    >
                      <Crest club={o} size={28} />
                      {o.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <h2 className="mt-5 text-[11px] font-bold uppercase tracking-[2.4px] text-white/60">When</h2>
        <ul className="no-scrollbar -mx-[18px] mt-2 flex gap-2 overflow-x-auto px-[18px]" aria-label="Day">
          {days.map((d) => (
            <li key={d.value} className="shrink-0">
              <button
                type="button"
                onClick={() => setDay(d.value)}
                aria-pressed={day === d.value}
                className={
                  "h-12 rounded-2xl px-4 text-[14.5px] font-bold " +
                  (day === d.value ? "bg-bone text-black" : "border border-white/10 text-white/70")
                }
              >
                {d.label}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2.5 flex gap-2">
          <label className="flex-1">
            <span className="sr-only">Time</span>
            <select
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="h-12 w-full rounded-2xl border border-white/10 bg-black px-3 text-[16px] text-bone focus:border-white/30 focus:outline-none"
            >
              {TIMES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1">
            <span className="sr-only">How long</span>
            <select
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="h-12 w-full rounded-2xl border border-white/10 bg-black px-3 text-[16px] text-bone focus:border-white/30 focus:outline-none"
            >
              {PLAN_MINUTES.map((m) => (
                <option key={m} value={m}>
                  {fmtDuration(m)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <h2 className="mt-5 text-[11px] font-bold uppercase tracking-[2.4px] text-white/60">Where</h2>
        <label className="mt-2 flex h-[54px] items-center gap-3 rounded-2xl border border-white/10 px-4">
          <IconPin size={20} />
          <span className="sr-only">Where</span>
          <input
            value={place}
            onChange={(e) => setPlace(e.target.value.slice(0, PLACE_MAX))}
            maxLength={PLACE_MAX}
            placeholder="Field or park, and the town"
            className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-bone placeholder:text-white/50 focus:outline-none"
          />
        </label>
        <p className="mt-1.5 text-[12.5px] text-white/60">{PLACE_HINT}</p>

        {kind === "training" && (
          <label className="mt-3 flex h-[54px] items-center gap-3 rounded-2xl border border-white/10 px-4">
            <span className="sr-only">What you will work on</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, PLAN_TITLE_MAX))}
              maxLength={PLAN_TITLE_MAX}
              placeholder="What you will work on"
              className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-bone placeholder:text-white/50 focus:outline-none"
            />
            <span className="text-[12px] text-white/60">optional</span>
          </label>
        )}

        <p className="mt-6 text-[13px] leading-snug text-white/60">
          {organizedBy(club.name)}, not by Strive.{" "}
          {kind === "training"
            ? "Only your club's members see it."
            : `${other ? `${other.name}'s` : "Their"} captain accepts or passes. Only the two clubs see it.`}
        </p>
        {error && (
          <p className="mt-2 text-[14px] text-red-400" aria-live="polite">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={busy || !place.trim() || (kind === "game" && !vs)}
          onClick={send}
          className="mt-3 flex h-[60px] w-full items-center justify-center rounded-[20px] bg-bone font-display text-[24px] font-black uppercase tracking-[0.5px] text-black disabled:opacity-50"
        >
          {kind === "game" ? "Send the game" : "Plan it"}
        </button>
      </div>

      {sheet && (
        <PlayTermsSheet
          kind="organizer"
          onClose={() => setSheet(false)}
          then={() => {
            setSheet(false);
            send();
          }}
        />
      )}
    </div>
  );
}
