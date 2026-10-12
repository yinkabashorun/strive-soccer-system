"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, LayoutList, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Drill, SessionTemplate } from "@/lib/elite/types";
import { PLYO_PILLAR, STRENGTH_PILLAR } from "@/lib/elite/types";
import {
  deleteSessionTemplate,
  saveSessionTemplate,
  setSessionTemplateActive,
} from "@/lib/elite/template-actions";
import { cn } from "@/lib/utils";

// Few-yards sessions (035): the coach hand-builds complete sessions for
// players with a ball and a few yards. A few-yards player's week is these,
// rotated. Skill drills only here: the plyo warm-up and any required
// strengthening finisher are added by the system, like every session.
const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-bone placeholder:text-white/25 focus:border-accent/40 focus:outline-none";

type Draft = { id?: string; title: string; drill_ids: string[] };

export function SessionTemplates({
  templates,
  bank,
  needed,
}: {
  templates: SessionTemplate[];
  bank: Drill[];
  needed: number; // sessions in a week for the roster's few-yards players (4, or 6 if any is Off-Season)
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Only filmed skill drills can go in a template.
  const pickable = useMemo(
    () =>
      bank.filter(
        (d) => d.active !== false && Boolean(d.video_url) && d.pillar !== PLYO_PILLAR && d.pillar !== STRENGTH_PILLAR
      ),
    [bank]
  );
  const byId = useMemo(() => new Map(pickable.map((d) => [d.id, d])), [pickable]);
  const active = templates.filter((t) => t.active).length;

  function save() {
    if (!draft) return;
    setError(null);
    start(async () => {
      const res = await saveSessionTemplate(draft);
      if (!res.ok) setError(res.error ?? "Couldn't save.");
      else setDraft(null);
    });
  }
  function move(i: number, dir: -1 | 1) {
    if (!draft) return;
    const ids = [...draft.drill_ids];
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setDraft({ ...draft, drill_ids: ids });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-tight">
            <LayoutList className="h-4 w-4 text-accent" /> Few-yards sessions
            <span className="text-sm font-normal normal-case text-white/35">
              {active} built · a few-yards week needs {needed}
            </span>
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-white/50">
            Hand-built sessions for a player with a ball and a few yards. Their week is
            these sessions, rotated, least recently used first. Pick the skill drills in
            order; the warm-up (and a finisher when a note calls for it) is added
            automatically. Any drill you place here is marked &quot;works in a few yards&quot;.
          </p>
        </div>
        <button
          onClick={() => setDraft({ title: "", drill_ids: [] })}
          className="btn-accent shrink-0 px-4 py-2.5 text-sm"
        >
          <Plus className="h-4 w-4" /> New session
        </button>
      </div>

      {active > 0 && active < needed && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] p-4 text-sm text-amber-200">
          {active} session{active === 1 ? "" : "s"} built, a week needs {needed}: a few-yards
          player&apos;s week repeats one until you add more.
        </div>
      )}

      {draft && (
        <div className="elite-card space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
              {draft.id ? "Edit session" : "New few-yards session"}
            </div>
            <button onClick={() => setDraft(null)} className="rounded-lg p-1.5 text-white/40 hover:text-bone">
              <X className="h-4 w-4" />
            </button>
          </div>
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Session name, e.g. Few yards: touches and turns"
            className={inputCls}
          />

          {/* Picked, in order */}
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
              In this session ({draft.drill_ids.length})
            </div>
            {draft.drill_ids.length === 0 ? (
              <p className="text-sm text-white/35">Pick drills from the bank below. Three is a full session.</p>
            ) : (
              <ol className="space-y-1.5">
                {draft.drill_ids.map((id, i) => {
                  const d = byId.get(id);
                  return (
                    <li key={id} className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/[0.05] px-3 py-2 text-sm">
                      <span className="w-5 font-display font-bold text-accent">{i + 1}</span>
                      <span className="flex-1 text-bone">{d?.title ?? "Drill"}</span>
                      <span className="text-xs text-white/35">{d?.pillar}</span>
                      <button onClick={() => move(i, -1)} className="rounded p-1 text-white/40 hover:text-bone" title="Up">
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => move(i, 1)} className="rounded p-1 text-white/40 hover:text-bone" title="Down">
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDraft({ ...draft, drill_ids: draft.drill_ids.filter((x) => x !== id) })}
                        className="rounded p-1 text-white/40 hover:text-red-300"
                        title="Remove"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* The bank to pick from */}
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
              Filmed skill drills
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {pickable
                .filter((d) => !draft.drill_ids.includes(d.id))
                .map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    disabled={draft.drill_ids.length >= 6}
                    onClick={() => setDraft({ ...draft, drill_ids: [...draft.drill_ids, d.id] })}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-left text-sm transition-colors hover:border-accent/40 disabled:opacity-40"
                  >
                    <span className="truncate text-white/80">{d.title}</span>
                    <span className="flex shrink-0 items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/35">
                      {d.needs_wall && <span className="rounded-full border border-white/15 px-1.5">wall</span>}
                      {d.pillar}
                    </span>
                  </button>
                ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          <button onClick={save} disabled={pending} className="btn-accent px-5 py-2.5 text-sm">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save session"}
          </button>
        </div>
      )}

      {templates.length === 0 && !draft ? (
        <div className="elite-card p-6 text-sm text-white/45">
          No few-yards sessions yet. Until there are, a few-yards player&apos;s week is
          composed from drills ticked &quot;works in a few yards&quot;.
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className={cn("elite-card flex items-start gap-3 p-4", !t.active && "opacity-50")}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-bone">{t.title}</span>
                  {!t.active && (
                    <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/45">
                      off
                    </span>
                  )}
                </div>
                <ol className="mt-1.5 flex flex-wrap gap-1.5 text-xs text-white/60">
                  {t.drills.map((d, i) => (
                    <li key={d.id} className="rounded-full border border-white/10 px-2 py-0.5">
                      {i + 1}. {d.title}
                      {!d.video_url && <span className="ml-1 text-white/30">(no video)</span>}
                    </li>
                  ))}
                </ol>
              </div>
              <div className={cn("flex shrink-0 gap-1", pending && "opacity-40")}>
                <button
                  onClick={() => setDraft({ id: t.id, title: t.title, drill_ids: t.drills.map((d) => d.id) })}
                  className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-bone"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => start(async () => { await setSessionTemplateActive(t.id, !t.active); })}
                  className="rounded-lg px-2 py-1 text-xs text-white/40 hover:bg-white/5 hover:text-bone"
                  title={t.active ? "Turn off" : "Turn on"}
                >
                  {t.active ? "Off" : "On"}
                </button>
                <button
                  onClick={() => start(async () => { await deleteSessionTemplate(t.id); })}
                  className="rounded-lg p-2 text-white/40 hover:bg-red-500/10 hover:text-red-300"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
