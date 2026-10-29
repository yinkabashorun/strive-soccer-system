import Link from "next/link";
import { ArrowLeft, BookOpen, ChevronRight, Download, PencilLine } from "lucide-react";
import type { Course } from "@/lib/elite/types";
import { courseNotice, levelsOf, stepTitle, stepVideo } from "@/lib/elite/courses";
import { DrillVideo } from "@/components/elite/DrillVideo";
import { cn } from "@/lib/utils";

// The Courses library (041), one rendering for everyone. Members reach it
// from the Courses tab (/courses); coaches and the admin reach the same
// pages from the coach shell (/coach/courses, Oct 29 2026) so what they
// see is exactly what a member sees, plus a notice on any course a member
// cannot see yet. basePath is where the links point; staff turns the
// notices and the edit link on.

export function CourseList({
  courses,
  basePath,
  staff = false,
}: {
  courses: Course[];
  basePath: string;
  staff?: boolean;
}) {
  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Library</div>
        <h1 className="mt-1 flex items-center gap-2.5 font-display text-3xl font-black sm:text-4xl">
          <BookOpen className="h-7 w-7 text-accent" /> Courses
        </h1>
        <p className="mt-2 text-white/50">
          {staff
            ? "What every member sees on their Courses tab, course by course. Edit any of them in the drill bank."
            : "Ladders and guides from Coach Yinka and Coach Gary. Open one, watch the step, go do it. More land as they are filmed."}
        </p>
        {staff && (
          <Link
            href="/coach/drills"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent hover:underline"
          >
            <PencilLine className="h-3.5 w-3.5" /> Edit courses
          </Link>
        )}
      </header>

      {courses.length === 0 ? (
        <div className="elite-card p-6 text-sm text-white/45">The first course is on its way.</div>
      ) : (
        <div className="space-y-2.5">
          {courses.map((c) => {
            const levels = levelsOf(c.steps).length;
            const notice = staff ? courseNotice(c) : null;
            return (
              <Link
                key={c.id}
                href={`${basePath}/${c.slug}`}
                className={cn(
                  "elite-card flex items-center justify-between gap-4 p-5 transition-colors hover:border-accent/40",
                  notice && "opacity-70"
                )}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-display text-xl font-bold uppercase tracking-tight">{c.name}</div>
                    {staff && !c.active && (
                      <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">
                        Off
                      </span>
                    )}
                  </div>
                  {c.subtitle && <div className="mt-0.5 text-sm text-white/55">{c.subtitle}</div>}
                  <div className="mt-1.5 text-xs text-white/35">
                    {c.kind === "drill"
                      ? `${levels} level${levels === 1 ? "" : "s"} · ${c.steps.length} drill${c.steps.length === 1 ? "" : "s"}, every one on video`
                      : `${c.steps.length} lesson${c.steps.length === 1 ? "" : "s"}`}
                  </div>
                  {notice && <div className="mt-1.5 text-xs text-amber-300/80">{notice}</div>}
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-white/30" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// One course: the ladder, level by level. A drill step is the drill's own
// video plus one cue and, on a beginner step, the pass mark (Coach Yinka's
// copy rule: the video explains, words only where they add something). A
// lesson step is a page. `steps` are the usable steps only.
export function CourseView({
  course,
  basePath,
  staff = false,
}: {
  course: Course;
  basePath: string;
  staff?: boolean;
}) {
  const levels = levelsOf(course.steps);
  const intro = (course.intro ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const notice = staff ? courseNotice(course) : null;

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={basePath}
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/40 hover:text-bone"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Courses
        </Link>
        {staff && (
          <Link
            href="/coach/drills"
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent hover:underline"
          >
            <PencilLine className="h-3.5 w-3.5" /> Edit in the drill bank
          </Link>
        )}
      </div>

      {notice && (
        <div className="rounded-xl border border-amber-300/30 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-200/90">
          {notice}
        </div>
      )}

      <header className="animate-fade-up">
        {course.subtitle && (
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">{course.subtitle}</div>
        )}
        <h1 className="mt-1 font-display text-3xl font-black uppercase tracking-tight sm:text-4xl">{course.name}</h1>
        {intro.length > 0 && (
          <ol className="mt-4 space-y-1.5 text-sm text-white/60">
            {intro.map((line, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-display font-bold text-accent">{i + 1}</span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
        )}
      </header>

      <div className="space-y-8">
        {levels.map((lvl) => (
          <section key={lvl.no}>
            <div className="mb-3 flex items-baseline gap-3">
              <span className="font-display text-3xl font-black text-accent">{lvl.no}</span>
              <h2 className="font-display text-xl font-bold uppercase tracking-tight">{lvl.name ?? `Level ${lvl.no}`}</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {lvl.steps.map((s) => {
                const video = stepVideo(s);
                const paragraphs = (s.body ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
                return (
                  <article key={s.id} className="elite-card p-4">
                    {s.tag && (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]",
                          s.tag === "beginner" ? "border border-white/15 text-white/60" : "border border-accent/40 text-accent"
                        )}
                      >
                        {s.tag}
                      </span>
                    )}
                    <h3 className="mt-2 font-semibold leading-snug text-bone">{stepTitle(s)}</h3>
                    {video && <DrillVideo src={video} label="Watch" />}
                    {s.cue && <p className="mt-2.5 text-sm leading-relaxed text-white/60">{s.cue}</p>}
                    {s.pass_mark && (
                      <p className="mt-1.5 text-sm text-white/80">
                        Pass: <b>{s.pass_mark}</b>
                      </p>
                    )}
                    {paragraphs.length > 0 && (
                      <div className="mt-2.5 space-y-2.5 text-sm leading-relaxed text-white/70">
                        {paragraphs.map((p, i) => (
                          <p key={i}>{p}</p>
                        ))}
                      </div>
                    )}
                    {s.download_url && (
                      <a
                        href={s.download_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" /> Download
                      </a>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
