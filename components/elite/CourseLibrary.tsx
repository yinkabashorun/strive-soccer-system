import Link from "next/link";
import { ArrowLeft, BookOpen, ChevronRight, Download, ExternalLink, PencilLine } from "lucide-react";
import type { Course } from "@/lib/elite/types";
import { courseCover, courseNotice, externalHref, isInternalHref, levelsOf, stepTitle, stepVideo } from "@/lib/elite/courses";
import { AppLink } from "@/components/elite/AppLink";
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
  // The shelf (approved mock v4, Nov 20 2026): the first course as one big
  // photo card, every other one in a row of tall cards under it. The
  // pictures are stills of the course's own drill clips; a course of
  // written pages has none and shows as type on black.
  const [featured, ...rest] = courses;
  return (
    <div className="space-y-5">
      <header className="pr-24">
        <h1 className="m-head text-[40px] leading-none">Courses</h1>
        <p className="mt-2 text-[14px] leading-snug text-white/60">
          {staff
            ? "What every member sees on their Courses tab, course by course. Edit any of them in the drill bank."
            : "On top of your week. Open one, watch the step, go do it."}
        </p>
        {staff && (
          <Link
            href="/coach/drills"
            className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wider text-accent hover:underline"
          >
            <PencilLine className="h-3.5 w-3.5" /> Edit courses
          </Link>
        )}
      </header>

      {courses.length === 0 ? (
        <div className="m-card p-6 text-[15px] leading-relaxed text-white/65">
          The first course is on its way. It shows up here the moment it is ready.
        </div>
      ) : (
        <>
          <CourseCard course={featured} basePath={basePath} staff={staff} featured />
          {rest.length > 0 && (
            <section aria-label="All courses">
              <div className="mb-2.5 flex items-baseline justify-between">
                <h2 className="text-[17px] font-semibold">All courses</h2>
                <span className="text-[13px] text-white/60">{courses.length}</span>
              </div>
              <ul className="no-scrollbar -mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
                {rest.map((c) => (
                  <li key={c.id} className="w-[150px] shrink-0 snap-start">
                    <CourseCard course={c} basePath={basePath} staff={staff} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function CourseCard({
  course: c,
  basePath,
  staff,
  featured = false,
}: {
  course: Course;
  basePath: string;
  staff: boolean;
  featured?: boolean;
}) {
  const notice = staff ? courseNotice(c) : null;
  const cover = courseCover(c);
  const levels = levelsOf(c.steps).length;
  const out = externalHref(c);
  const outside = Boolean(out && !isInternalHref(out));
  // Every course opens its page in the app first. A link course's page is
  // the gate (LinkCourseGate) that shows the course's password before the
  // button to its own site (Nov 5 2026).
  const meta =
    c.kind === "link"
      ? "Opens the course site"
      : c.kind === "drill"
        ? `${levels} level${levels === 1 ? "" : "s"} · ${c.steps.length} drill${c.steps.length === 1 ? "" : "s"}`
        : `${c.steps.length} lesson${c.steps.length === 1 ? "" : "s"}`;
  return (
    <div className={cn(notice && "opacity-70")}>
      <Link
        href={`${basePath}/${c.slug}`}
        className={cn(
          "press relative block overflow-hidden bg-fill",
          featured ? "-mx-1.5 h-[300px] rounded-[30px]" : "h-[200px] rounded-[22px]"
        )}
      >
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="absolute inset-0 bg-[radial-gradient(90%_70%_at_20%_0%,#1d1a12_0%,#0e0e0e_60%)]" aria-hidden />
        )}
        <span
          className={cn(
            "absolute inset-0",
            featured
              ? "bg-[linear-gradient(180deg,rgba(0,0,0,0)_30%,rgba(0,0,0,0.92))]"
              : "bg-[linear-gradient(180deg,rgba(0,0,0,0)_45%,rgba(0,0,0,0.85))]"
          )}
          aria-hidden
        />
        <span className={cn("absolute", featured ? "inset-x-[18px] bottom-[18px]" : "inset-x-3 bottom-3")}>
          {featured && <span className="m-eyebrow block">Start here</span>}
          <span
            className={cn(
              "block m-head [overflow-wrap:anywhere]",
              featured ? "mt-1.5 text-[32px] leading-[1.02]" : "text-[19px] leading-[1.05]"
            )}
          >
            {c.name}
          </span>
          {featured && c.subtitle && <span className="mt-1.5 block text-[14px] text-white/80">{c.subtitle}</span>}
        </span>
        {outside && <ExternalLink className="absolute right-3 top-3 h-4 w-4 text-white/70" aria-hidden />}
        {staff && !c.active && (
          <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/70">
            Off
          </span>
        )}
      </Link>
      {!featured && c.subtitle && <p className="mt-1.5 line-clamp-2 px-0.5 text-[12.5px] text-white/60">{c.subtitle}</p>}
      {featured && <p className="mt-2 px-0.5 text-[12.5px] text-white/60">{meta}</p>}
      {notice && <p className="mt-1 px-0.5 text-[12px] text-amber-300/80">{notice}</p>}
    </div>
  );
}

// A link course (058): its page in the app shows the course's own lines
// (the password, written in the course intro by the coach) and then the
// button to its site, which opens in a new tab. An address on our own
// domain opens in the same tab. The password is content in the database,
// never in the code.
export function LinkCourseGate({
  course,
  basePath,
  staff = false,
}: {
  course: Course;
  basePath: string;
  staff?: boolean;
}) {
  const out = externalHref(course);
  const lines = (course.intro ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const notice = staff ? courseNotice(course) : null;
  const sameTab = out ? isInternalHref(out) : false;

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={basePath}
          className="inline-flex min-h-[44px] items-center gap-1.5 pr-3 text-xs font-semibold uppercase tracking-wider text-white/60 hover:text-bone"
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
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">{course.subtitle}</div>
        )}
        <h1 className="mt-1 font-display text-3xl font-black uppercase tracking-tight sm:text-4xl">{course.name}</h1>
      </header>

      {lines.length > 0 && (
        <div className="elite-card space-y-2 p-5">
          {lines.map((l, i) => (
            <p key={i} className={i === 0 ? "font-display text-2xl font-bold tracking-tight text-bone" : "text-sm text-white/60"}>
              {l}
            </p>
          ))}
        </div>
      )}

      {out &&
        (sameTab ? (
          <a
            href={out}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold uppercase tracking-wider text-ink hover:opacity-90"
          >
            Open the course <ExternalLink className="h-4 w-4" />
          </a>
        ) : (
          // Another site: a new tab on the website. Inside the iPhone app
          // a course with an outside address is shown as its own pages
          // instead (courseForApp), so this button is never drawn there.
          <AppLink
            href={out}
            title={course.name}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold uppercase tracking-wider text-ink hover:opacity-90"
          >
            Open the course <ExternalLink className="h-4 w-4" />
          </AppLink>
        ))}
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
          className="inline-flex min-h-[44px] items-center gap-1.5 pr-3 text-xs font-semibold uppercase tracking-wider text-white/60 hover:text-bone"
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
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">{course.subtitle}</div>
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
                          "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em]",
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
                      <AppLink
                        href={s.download_url}
                        title={stepTitle(s)}
                        className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" /> Download
                      </AppLink>
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
