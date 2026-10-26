import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import { getViewer } from "@/lib/elite/session";
import { getCourses } from "@/lib/elite/data";
import { levelsOf, visibleCourses } from "@/lib/elite/courses";

export const metadata = { title: "Courses · Strive Elite" };

// The Courses tab (041): a library every member sees. Nothing is ticked
// or tracked here; the week is where training is counted.
export default async function CoursesPage() {
  const viewer = await getViewer();
  if (!viewer?.playerId) return null;
  const courses = visibleCourses(await getCourses());

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Library</div>
        <h1 className="mt-1 flex items-center gap-2.5 font-display text-3xl font-black sm:text-4xl">
          <BookOpen className="h-7 w-7 text-accent" /> Courses
        </h1>
        <p className="mt-2 text-white/50">
          Ladders and guides from Coach Yinka and Coach Gary. Open one, watch the step,
          go do it. More land as they are filmed.
        </p>
      </header>

      {courses.length === 0 ? (
        <div className="elite-card p-6 text-sm text-white/45">The first course is on its way.</div>
      ) : (
        <div className="space-y-2.5">
          {courses.map((c) => {
            const levels = levelsOf(c.steps).length;
            return (
              <Link
                key={c.id}
                href={`/courses/${c.slug}`}
                className="elite-card flex items-center justify-between gap-4 p-5 transition-colors hover:border-accent/40"
              >
                <div className="min-w-0">
                  <div className="font-display text-xl font-bold uppercase tracking-tight">{c.name}</div>
                  {c.subtitle && <div className="mt-0.5 text-sm text-white/55">{c.subtitle}</div>}
                  <div className="mt-1.5 text-xs text-white/35">
                    {c.kind === "drill"
                      ? `${levels} level${levels === 1 ? "" : "s"} · ${c.steps.length} drill${c.steps.length === 1 ? "" : "s"}, every one on video`
                      : `${c.steps.length} lesson${c.steps.length === 1 ? "" : "s"}`}
                  </div>
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
