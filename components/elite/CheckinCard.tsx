"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, ClipboardCheck, Loader2 } from "lucide-react";
import { submitCheckin } from "@/lib/elite/player-actions";
import { cn } from "@/lib/utils";

// Player's structured weekly check-in. Shows a "done" state once submitted
// for the current week so they don't double-submit.
export function CheckinCard({
  week,
  alreadyDone,
  firstName,
}: {
  week: number;
  alreadyDone: boolean;
  firstName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(alreadyDone);
  const [rating, setRating] = useState(0);
  const [energy, setEnergy] = useState(0);
  const [wentWell, setWentWell] = useState("");
  const [struggled, setStruggled] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    start(async () => {
      await submitCheckin({
        rating,
        energy,
        went_well: wentWell,
        struggled,
        note,
      });
      setDone(true);
    });
  }

  if (done) {
    return (
      <section className="rounded-3xl border border-accent/20 bg-accent/[0.05] p-5">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
          <CheckCircle2 className="h-3.5 w-3.5" /> Checked in
        </div>
        <p className="mt-2 text-sm text-white/70">
          Week {week} check-in submitted. Your coach will read it and factor it
          into your next plan.
        </p>
      </section>
    );
  }

  return (
    <section className="elite-card p-5">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
        <ClipboardCheck className="h-3.5 w-3.5 text-accent" /> Weekly check-in
      </div>
      {!open ? (
        <>
          <p className="mt-2 text-sm text-white/60">
            {firstName ? `${firstName}, how` : "How"} did week {week} really
            go? Two minutes for your coach. It shapes your next plan.
          </p>
          <button onClick={() => setOpen(true)} className="btn mt-3 w-full py-2.5">
            Start check-in
          </button>
        </>
      ) : (
        <div className="mt-4 space-y-4">
          <Scale label="How did the week go?" value={rating} onChange={setRating} />
          <Scale label="Energy this week" value={energy} onChange={setEnergy} />
          <TextArea
            label="What went well?"
            value={wentWell}
            onChange={setWentWell}
            placeholder="A win, a breakthrough, something that clicked…"
          />
          <TextArea
            label="What did you struggle with?"
            value={struggled}
            onChange={setStruggled}
            placeholder="Be honest. This is how your coach helps."
          />
          <TextArea
            label="Anything else? (optional)"
            value={note}
            onChange={setNote}
            placeholder="Injuries, schedule, how you're feeling…"
          />
          <button
            onClick={submit}
            disabled={pending}
            className="btn-accent w-full py-3"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Submit check-in"
            )}
          </button>
        </div>
      )}
    </section>
  );
}

function Scale({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-sm font-medium text-white/70">{label}</div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              "h-10 flex-1 rounded-xl border font-display text-lg font-bold transition-all",
              value >= n
                ? "border-accent/40 bg-accent/[0.1] text-accent"
                : "border-white/10 bg-white/[0.02] text-white/40 hover:border-white/20"
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-white/70">
        {label}
      </span>
      <textarea
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-bone placeholder:text-white/25 focus:border-accent/40 focus:outline-none"
      />
    </label>
  );
}
