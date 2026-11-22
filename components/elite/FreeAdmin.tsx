"use client";

import { useState, useTransition } from "react";
import { saveTargetRow, setFreeSignupOpen } from "@/lib/elite/tracker-actions";
import { SEASONS, recommendLine, type Season, type TargetRow } from "@/lib/elite/tracker";

// Coach controls for the free training log: the sign-up switch, the link
// to hand out, and the two recommended weekly targets.
export function FreeAdmin({
  open: initialOpen,
  joinUrl,
  targets,
}: {
  open: boolean;
  joinUrl: string;
  targets: TargetRow[];
}) {
  const [open, setOpen] = useState(initialOpen);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function flip() {
    const next = !open;
    setError(null);
    setOpen(next);
    start(async () => {
      const res = await setFreeSignupOpen(next);
      if (!res.ok) {
        setOpen(!next);
        setError(res.error);
      }
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // the link is on the screen to copy by hand
    }
  }

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <div className="elite-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[15px] font-semibold text-bone">
              Free sign-up: {open ? "open" : "closed"}
            </div>
            <div className="mt-0.5 text-sm text-white/60">
              {open
                ? "Anyone with the link can make a free account."
                : "Nobody can make a free account. The link is the waitlist: players leave their phone and get their own link to send."}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={open}
            aria-label="Free sign-up"
            disabled={pending}
            onClick={flip}
            className={
              "relative h-8 w-14 shrink-0 rounded-full transition-colors " +
              (open ? "bg-white" : "bg-white/15")
            }
          >
            <span
              className={
                "absolute top-1 h-6 w-6 rounded-full transition-all " +
                (open ? "left-7 bg-black" : "left-1 bg-white/70")
              }
            />
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="mt-4 flex items-center gap-3 border-t border-white/[0.07] pt-4">
          <div className="min-w-0 flex-1 truncate text-sm text-white/70 select-all">{joinUrl}</div>
          <button type="button" onClick={copy} className="btn shrink-0">
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      </div>

      <div className="elite-card p-5">
        <div className="text-[15px] font-semibold text-bone">Recommended weekly target</div>
        <div className="mt-0.5 text-sm text-white/60">
          What a player is told after the four questions. Hours, in half-hour steps. Leave
          &quot;up to&quot; empty for a single number.
        </div>
        <div className="mt-4 space-y-4">
          {SEASONS.map((s) => (
            <TargetEditor
              key={s.id}
              season={s.id}
              label={s.label}
              row={targets.find((t) => t.season === s.id) ?? null}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const hours = (minutes: number | null | undefined) => (minutes ? String(minutes / 60) : "");

function TargetEditor({
  season,
  label,
  row,
}: {
  season: Season;
  label: string;
  row: TargetRow | null;
}) {
  const [from, setFrom] = useState(hours(row?.minutes));
  const [to, setTo] = useState(hours(row?.minutes_max));
  const [saved, setSaved] = useState<TargetRow | null>(row);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setNote(null);
    const minutes = Math.round(Number(from) * 60);
    const max = to.trim() === "" ? null : Math.round(Number(to) * 60);
    start(async () => {
      const res = await saveTargetRow({ season, minutes, max });
      if (!res.ok) return setNote(res.error);
      setSaved({ season, minutes, minutes_max: max });
      setNote("Saved.");
    });
  }

  const field =
    "no-spin w-20 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-bone focus:border-accent/40 focus:outline-none";

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-24 pb-2 text-sm font-semibold text-bone">{label}</div>
        <label className="text-xs text-white/50">
          Hours
          <input
            type="number"
            step="0.5"
            min="0.5"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={`mt-1 block ${field}`}
          />
        </label>
        <label className="text-xs text-white/50">
          Up to
          <input
            type="number"
            step="0.5"
            min="0.5"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={`mt-1 block ${field}`}
          />
        </label>
        <button type="button" onClick={save} disabled={pending} className="btn">
          Save
        </button>
      </div>
      <div className="mt-1.5 text-sm text-white/60">
        {note ? `${note} ` : ""}
        {saved ? `Players read: "${recommendLine(saved)}"` : ""}
      </div>
    </div>
  );
}
