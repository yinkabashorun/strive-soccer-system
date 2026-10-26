import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { getViewer } from "@/lib/elite/session";
import { getCourse } from "@/lib/elite/data";
import { levelsOf, stepIsUsable, stepTitle, stepVideo } from "@/lib/elite/courses";
import { DrillVideo } from "@/components/elite/DrillVideo";
import { cn } from "@/lib/utils";

// One course (041): the ladder, level by level. A drill step is the
// drill's own video plus one cue and, on a beginner step, the pass mark
// (Coach Yinka's copy rule: the video explains, words only where they add
// something). A lesson step is a page.
export default async function CoursePage({ params }: { params: { slug: string } }) {
  const viewer = await getViewer();
  if (!viewer?.playerId) return null;
  const course = await getCourse(params.slug);
  if (!course || !course.active) notFound();
  const steps = course.steps.filter(stepIsUsable);
  if (steps.length === 0) notFound();
  const levels = levelsOf(steps);
  const intro = (course.intro ?? "").split("\n").map((l) => l.trim()).filter(Boolean);

  return (
    <div className="space-y-7">
      <Link href="/courses" className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/40 hover:text-bone">
        <ArrowLeft className="h-3.5 w-3.5" /> Courses
      </Link>

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
