"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, BookOpen, ChevronDown, ChevronRight, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Course, CourseKind, CourseStep, CourseTag, Drill } from "@/lib/elite/types";
import { COURSE_TAGS, levelsOf, stepIsUsable, stepTitle, type StepInput } from "@/lib/elite/courses";
import {
  deleteCourse,
  deleteCourseStep,
  moveCourseStep,
  saveCourse,
  saveCourseStep,
  setCourseActive,
} from "@/lib/elite/course-actions";
import { cn } from "@/lib/utils";

// Courses (041): the coach builds a course as levels of steps. A drill
// course's step is a bank drill (the video and reps follow the drill); a
// lesson course's step is a page. Every member sees every course that is
// switched on, as a library. Nothing here touches anyone's week: whether
// a drill enters a week is the drill's own course tick plus the player's
// picks (040).
const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-bone placeholder:text-white/25 focus:border-accent/40 focus:outline-none";
const labelCls = "mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35";

type CourseDraft = { id?: string; name: string; subtitle: string; intro: string; kind: CourseKind };
type StepDraft = {
  id?: string;
  course_id: string;
  level_no: string;
  level_name: string;
  tag: CourseTag | "";
  drill_id: string;
  title: string;
  body: string;
  video_url: string;
  download_url: string;
  cue: string;
  pass_mark: string;
};

const emptyStep = (course: Course, level_no = 1): StepDraft => ({
  course_id: course.id,
  level_no: String(level_no),
  level_name: "",
  tag: "",
  drill_id: "",
  title: "",
  body: "",
  video_url: "",
  download_url: "",
  cue: "",
  pass_mark: "",
});

const toDraft = (s: CourseStep): StepDraft => ({
  id: s.id,
  course_id: s.course_id,
  level_no: String(s.level_no),
  level_name: s.level_name ?? "",
  tag: s.tag ?? "",
  drill_id: s.drill_id ?? "",
  title: s.title ?? "",
  body: s.body ?? "",
  video_url: s.video_url ?? "",
  download_url: s.download_url ?? "",
  cue: s.cue ?? "",
  pass_mark: s.pass_mark ?? "",
});

export function CourseEditor({ courses, bank }: { courses: Course[]; bank: Drill[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [courseDraft, setCourseDraft] = useState<CourseDraft | null>(null);
  const [stepDraft, setStepDraft] = useState<StepDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Any filmed drill can be a course step, course drills included (that
  // is what they are for). Paused or unfilmed drills are not offered.
  const pickable = useMemo(
    () => bank.filter((d) => d.active !== false && Boolean(d.video_url)),
    [bank]
  );
  const byId = useMemo(() => new Map(pickable.map((d) => [d.id, d])), [pickable]);

  function saveC() {
    if (!courseDraft) return;
    setError(null);
    start(async () => {
      const res = await saveCourse(courseDraft);
      if (!res.ok) setError(res.error ?? "Couldn't save.");
      else {
        setCourseDraft(null);
        if ("id" in res && res.id) setOpen(res.id);
      }
    });
  }
  function saveS() {
    if (!stepDraft) return;
    setError(null);
    const input: StepInput = {
      id: stepDraft.id,
      course_id: stepDraft.course_id,
      level_no: Number(stepDraft.level_no),
      level_name: stepDraft.level_name,
      tag: stepDraft.tag || null,
      drill_id: stepDraft.drill_id || null,
      title: stepDraft.title,
      body: stepDraft.body,
      video_url: stepDraft.video_url,
      download_url: stepDraft.download_url,
      cue: stepDraft.cue,
      pass_mark: stepDraft.pass_mark,
    };
    start(async () => {
      const res = await saveCourseStep(input);
      if (!res.ok) setError(res.error ?? "Couldn't save.");
      else setStepDraft(null);
    });
  }

  const live = courses.filter((c) => c.active).length;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-tight">
            <BookOpen className="h-4 w-4 text-accent" /> Courses
            <span className="text-sm font-normal normal-case text-white/35">
              {live} on the Courses tab
            </span>
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-white/50">
            A course is levels of steps. A drill course&apos;s steps are bank drills (the
            video follows the drill); a lesson course&apos;s steps are pages. Every member
            sees every course that is on. A course never changes anyone&apos;s week.
          </p>
        </div>
        <button
          onClick={() => setCourseDraft({ name: "", subtitle: "", intro: "", kind: "drill" })}
          className="btn-accent shrink-0 px-4 py-2.5 text-sm"
        >
          <Plus className="h-4 w-4" /> New course
        </button>
      </div>

      {courseDraft && (
        <div className="elite-card space-y-3 p-5">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
              {courseDraft.id ? "Edit course" : "New course"}
            </div>
            <button onClick={() => setCourseDraft(null)} className="rounded-lg p-1.5 text-white/40 hover:text-bone">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Name</label>
              <input value={courseDraft.name} onChange={(e) => setCourseDraft({ ...courseDraft, name: e.target.value })} placeholder="Keep It Up" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Subtitle</label>
              <input value={courseDraft.subtitle} onChange={(e) => setCourseDraft({ ...courseDraft, subtitle: e.target.value })} placeholder="The Juggling Ladder" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Intro (one rule per line)</label>
            <textarea value={courseDraft.intro} onChange={(e) => setCourseDraft({ ...courseDraft, intro: e.target.value })} rows={3} className={inputCls} />
          </div>
          {!courseDraft.id && (
            <div className="flex flex-wrap gap-2">
              {(["drill", "lesson"] as CourseKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setCourseDraft({ ...courseDraft, kind: k })}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider",
                    courseDraft.kind === k ? "border-accent bg-accent/15 text-accent" : "border-white/15 text-white/50"
                  )}
                >
                  {k === "drill" ? "Drill course (steps are bank drills)" : "Lesson course (steps are pages)"}
                </button>
              ))}
            </div>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button onClick={saveC} disabled={pending} className="btn-accent px-5 py-2.5 text-sm">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save course"}
          </button>
        </div>
      )}

      {courses.length === 0 && !courseDraft ? (
        <div className="elite-card p-6 text-sm text-white/45">
          No courses yet. Build one from filmed bank drills, or write a lesson course.
        </div>
      ) : (
        <div className="space-y-2">
          {courses.map((c) => {
            const isOpen = open === c.id;
            const usable = c.steps.filter(stepIsUsable).length;
            return (
              <div key={c.id} className={cn("elite-card p-4", !c.active && "opacity-60")}>
                <div className="flex items-start gap-3">
                  <button onClick={() => setOpen(isOpen ? null : c.id)} className="mt-0.5 rounded p-1 text-white/40 hover:text-bone" title={isOpen ? "Collapse" : "Expand"}>
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-bone">{c.name}</span>
                      {c.subtitle && <span className="text-sm text-white/45">{c.subtitle}</span>}
                      <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/45">
                        {c.kind === "drill" ? "drills" : "lessons"}
                      </span>
                      {!c.active && (
                        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/45">off</span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-white/45">
                      {levelsOf(c.steps).length} level{levelsOf(c.steps).length === 1 ? "" : "s"} · {c.steps.length} step{c.steps.length === 1 ? "" : "s"}
                      {usable < c.steps.length && <span className="text-amber-300"> · {c.steps.length - usable} hidden (unfilmed or paused)</span>}
                      {c.active && usable === 0 && <span className="text-amber-300"> · nothing to show yet</span>}
                    </div>
                  </div>
                  <div className={cn("flex shrink-0 gap-1", pending && "opacity-40")}>
                    <button
                      onClick={() => setCourseDraft({ id: c.id, name: c.name, subtitle: c.subtitle ?? "", intro: c.intro ?? "", kind: c.kind })}
                      className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-bone"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => start(async () => { await setCourseActive(c.id, !c.active); })}
                      className="rounded-lg px-2 py-1 text-xs text-white/40 hover:bg-white/5 hover:text-bone"
                      title={c.active ? "Take off the tab" : "Put on the tab"}
                    >
                      {c.active ? "Off" : "On"}
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete "${c.name}" and all its steps? Bank drills are not touched.`)) start(async () => { await deleteCourse(c.id); }); }}
                      className="rounded-lg p-2 text-white/40 hover:bg-red-500/10 hover:text-red-300"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-4 space-y-3 border-t border-white/8 pt-4">
                    {levelsOf(c.steps).map((lvl) => (
                      <div key={lvl.no}>
                        <div className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
                          <span className="font-display text-sm text-accent">{lvl.no}</span>
                          {lvl.name ?? "Level"}
                        </div>
                        <ol className="space-y-1.5">
                          {lvl.steps.map((s, i) => (
                            <li key={s.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm">
                              {s.tag && (
                                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", s.tag === "beginner" ? "bg-white/10 text-white/70" : "bg-accent/15 text-accent")}>
                                  {s.tag}
                                </span>
                              )}
                              <span className="flex-1 truncate text-bone">{stepTitle(s) || "Untitled"}</span>
                              {!stepIsUsable(s) && <span className="text-[10px] uppercase tracking-wider text-amber-300">hidden</span>}
                              {s.pass_mark && <span className="text-xs text-white/35">Pass {s.pass_mark}</span>}
                              <button onClick={() => start(async () => { await moveCourseStep(s.id, -1); })} disabled={i === 0} className="rounded p-1 text-white/40 hover:text-bone disabled:opacity-30" title="Up">
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => start(async () => { await moveCourseStep(s.id, 1); })} disabled={i === lvl.steps.length - 1} className="rounded p-1 text-white/40 hover:text-bone disabled:opacity-30" title="Down">
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => { setError(null); setStepDraft(toDraft(s)); }} className="rounded p-1 text-white/40 hover:text-bone" title="Edit">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => start(async () => { await deleteCourseStep(s.id); })} className="rounded p-1 text-white/40 hover:text-red-300" title="Remove">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ))}
                    {!stepDraft && (
                      <button
                        onClick={() => { setError(null); setStepDraft(emptyStep(c, (levelsOf(c.steps).at(-1)?.no ?? 0) + (c.steps.length ? 0 : 1) || 1)); }}
                        className="btn px-4 py-2 text-sm"
                      >
                        <Plus className="h-4 w-4" /> Add a step
                      </button>
                    )}

                    {stepDraft && stepDraft.course_id === c.id && (
                      <div className="space-y-3 rounded-2xl border border-accent/30 bg-accent/[0.04] p-4">
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
                            {stepDraft.id ? "Edit step" : "New step"}
                          </div>
                          <button onClick={() => setStepDraft(null)} className="rounded-lg p-1.5 text-white/40 hover:text-bone">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div>
                            <label className={labelCls}>Level</label>
                            <input type="number" min={1} max={99} value={stepDraft.level_no} onChange={(e) => setStepDraft({ ...stepDraft, level_no: e.target.value })} className={inputCls} />
                          </div>
                          <div>
                            <label className={labelCls}>Level name</label>
                            <input value={stepDraft.level_name} onChange={(e) => setStepDraft({ ...stepDraft, level_name: e.target.value })} placeholder="One touch" className={inputCls} />
                          </div>
                          <div>
                            <label className={labelCls}>Tag</label>
                            <select value={stepDraft.tag} onChange={(e) => setStepDraft({ ...stepDraft, tag: e.target.value as CourseTag | "" })} className={inputCls}>
                              <option value="">None</option>
                              {COURSE_TAGS.map((t) => (
                                <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {c.kind === "drill" ? (
                          <div>
                            <label className={labelCls}>Bank drill</label>
                            <select value={stepDraft.drill_id} onChange={(e) => setStepDraft({ ...stepDraft, drill_id: e.target.value })} className={inputCls}>
                              <option value="">Pick a filmed drill</option>
                              {pickable.map((d) => (
                                <option key={d.id} value={d.id}>{d.title} ({d.pillar})</option>
                              ))}
                            </select>
                            {stepDraft.drill_id && byId.get(stepDraft.drill_id)?.opt_in && (
                              <p className="mt-1 text-xs text-white/40">A course drill: it goes in a player&apos;s week only when you offer it to them on their page.</p>
                            )}
                          </div>
                        ) : (
                          <>
                            <div>
                              <label className={labelCls}>Title</label>
                              <input value={stepDraft.title} onChange={(e) => setStepDraft({ ...stepDraft, title: e.target.value })} placeholder="The highlight tape" className={inputCls} />
                            </div>
                            <div>
                              <label className={labelCls}>The lesson</label>
                              <textarea value={stepDraft.body} onChange={(e) => setStepDraft({ ...stepDraft, body: e.target.value })} rows={8} placeholder="Plain paragraphs. A blank line starts a new one." className={inputCls} />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <label className={labelCls}>Video link (optional)</label>
                                <input value={stepDraft.video_url} onChange={(e) => setStepDraft({ ...stepDraft, video_url: e.target.value })} placeholder="https://" className={inputCls} />
                              </div>
                              <div>
                                <label className={labelCls}>Download link (optional)</label>
                                <input value={stepDraft.download_url} onChange={(e) => setStepDraft({ ...stepDraft, download_url: e.target.value })} placeholder="https://" className={inputCls} />
                              </div>
                            </div>
                          </>
                        )}

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className={labelCls}>Cue (one line, only if the video does not show it)</label>
                            <input value={stepDraft.cue} onChange={(e) => setStepDraft({ ...stepDraft, cue: e.target.value })} className={inputCls} />
                          </div>
                          <div>
                            <label className={labelCls}>Pass mark (optional)</label>
                            <input value={stepDraft.pass_mark} onChange={(e) => setStepDraft({ ...stepDraft, pass_mark: e.target.value })} placeholder="10 in a row" className={inputCls} />
                          </div>
                        </div>
                        {error && <p className="text-sm text-red-400">{error}</p>}
                        <button onClick={saveS} disabled={pending} className="btn-accent px-5 py-2.5 text-sm">
                          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save step"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
