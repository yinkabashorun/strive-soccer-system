"use client";

import { useMemo, useState, useTransition } from "react";
import { Dumbbell, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { PROGRESS_METRICS, type Drill } from "@/lib/elite/types";
import { saveDrill, deleteDrill, type DrillInput } from "@/lib/elite/drill-actions";
import { cn } from "@/lib/utils";

// The coach's drill bank. Everything the AI is allowed to prescribe lives
// here: edit a drill once and every future plan uses the fixed version.

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-bone placeholder:text-white/25 focus:border-accent/40 focus:outline-none";

const EMPTY: DrillInput = {
  pillar: "Ball Mastery",
  title: "",
  how: "",
  reps: "",
  minutes: 10,
  cues: "",
  needs_wall: false,
};

export function DrillBank({
  initial,
  fromDb,
}: {
  initial: Drill[];
  fromDb: boolean;
}) {
  const [editing, setEditing] = useState<DrillInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const byPillar = useMemo(() => {
    const m = new Map<string, Drill[]>();
    for (const p of PROGRESS_METRICS) m.set(p, []);
    for (const d of initial) m.get(d.pillar)?.push(d);
    return m;
  }, [initial]);

  function submit() {
    if (!editing) return;
    setError(null);
    startTransition(async () => {
      const res = await saveDrill(editing);
      if (!res.ok) setError(res.error ?? "Couldn't save.");
      else setEditing(null);
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteDrill(id);
    });
  }

  return (
    <div className="space-y-6">
      {!fromDb && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] p-4 text-sm text-amber-200">
          Showing the built-in Strive library. Run database migration 020 to
          make the bank yours: after that, every edit here changes what the
          AI can prescribe.
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-white/50">
          The AI builds every week from these drills and only these. Fix a
          drill once, it&apos;s fixed in every future plan.
        </p>
        <button
          onClick={() => setEditing({ ...EMPTY })}
          className="btn-accent shrink-0 px-4 py-2.5 text-sm"
        >
          <Plus className="h-4 w-4" /> New drill
        </button>
      </div>

      {editing && (
        <div className="elite-card space-y-3 border-accent/25 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold uppercase tracking-tight">
              {editing.id ? "Edit drill" : "New drill"}
            </h3>
            <button onClick={() => setEditing(null)} className="text-white/40 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              placeholder="Drill name (e.g. La Croqueta cone weave)"
              className={inputCls}
            />
            <select
              value={editing.pillar}
              onChange={(e) => setEditing({ ...editing, pillar: e.target.value })}
              className={inputCls}
            >
              {PROGRESS_METRICS.map((p) => (
                <option key={p} value={p} className="bg-black">
                  {p}
                </option>
              ))}
            </select>
          </div>
          <textarea
            rows={3}
            value={editing.how}
            onChange={(e) => setEditing({ ...editing, how: e.target.value })}
            placeholder="Setup first, then execution: 'Line of 5 cones a yard apart. Weave through with inside and outside of the foot only.'"
            className={inputCls}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              value={editing.reps}
              onChange={(e) => setEditing({ ...editing, reps: e.target.value })}
              placeholder="Sets and reps: 6 x 45 sec on, 45 sec off"
              className={inputCls}
            />
            <input
              type="number"
              min={3}
              max={30}
              value={editing.minutes}
              onChange={(e) =>
                setEditing({ ...editing, minutes: parseInt(e.target.value, 10) || 10 })
              }
              placeholder="Minutes"
              className={inputCls}
            />
            <label className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 text-sm text-white/70">
              <input
                type="checkbox"
                checked={editing.needs_wall}
                onChange={(e) => setEditing({ ...editing, needs_wall: e.target.checked })}
                className="h-4 w-4 accent-accent"
              />
              Needs a wall
            </label>
          </div>
          <input
            value={editing.cues}
            onChange={(e) => setEditing({ ...editing, cues: e.target.value })}
            placeholder="Key cues: Sell the fake, drop the shoulder, explode out"
            className={inputCls}
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button onClick={submit} disabled={pending} className="btn-accent px-5 py-2.5 text-sm">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save drill"}
          </button>
        </div>
      )}

      {Array.from(byPillar.entries()).map(([pillar, drills]) =>
        drills.length === 0 ? null : (
          <section key={pillar}>
            <h2 className="mb-2.5 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-tight">
              <Dumbbell className="h-4 w-4 text-accent" /> {pillar}
              <span className="text-sm font-normal normal-case text-white/35">
                {drills.length} drills
              </span>
            </h2>
            <div className="space-y-2">
              {drills.map((d) => (
                <div
                  key={d.id}
                  className="elite-card flex items-start gap-3 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-bone">{d.title}</span>
                      {d.reps && <span className="chip">{d.reps}</span>}
                      <span className="chip">{d.minutes} min</span>
                      {d.needs_wall && (
                        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/45">
                          wall
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm leading-snug text-white/55">{d.how}</p>
                    {d.cues && (
                      <p className="mt-1 text-xs text-white/40">Cues: {d.cues}</p>
                    )}
                  </div>
                  <div className={cn("flex shrink-0 gap-1", pending && "opacity-40")}>
                    <button
                      onClick={() =>
                        setEditing({
                          id: d.id,
                          pillar: d.pillar,
                          title: d.title,
                          how: d.how,
                          reps: d.reps,
                          minutes: d.minutes,
                          cues: d.cues,
                          needs_wall: d.needs_wall,
                        })
                      }
                      className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-bone"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(d.id)}
                      className="rounded-lg p-2 text-white/40 hover:bg-red-500/10 hover:text-red-300"
                      title="Remove from bank"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      )}
    </div>
  );
}
