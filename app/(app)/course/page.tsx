import { PageHeader } from "@/components/PageHeader";
import { ArrowUpRight, ExternalLink, Settings2 } from "lucide-react";

const COURSE_URL = process.env.NEXT_PUBLIC_COURSE_URL || "#";

export default function CoursePage() {
  return (
    <div>
      <PageHeader
        eyebrow="$67 · Ball Mastery Method"
        title="The course lives outside the OS."
        subtitle="The Ball Mastery Course is already published and live on its own URL. Strive OS treats it as a synced product — track sales, students, and access from here, deliver the experience there."
        actions={
          <a
            href={COURSE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-accent"
          >
            <ExternalLink className="h-4 w-4" />
            Open live course
          </a>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <a
          href={COURSE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="card card-hover group relative overflow-hidden p-6 lg:col-span-2"
        >
          <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-accent/15 blur-3xl" />
          <div className="relative">
            <div className="chip-accent">Live</div>
            <h2 className="h-display mt-3 text-3xl font-semibold leading-tight md:text-4xl">
              Ball Mastery Method
            </h2>
            <p className="mt-2 max-w-lg text-sm text-muted">
              The hosted course experience — videos, drills, challenges,
              streaks. Built and maintained on its own platform.
            </p>
            <div className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
              Open live course
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </div>
          </div>
        </a>

        <div className="card p-6">
          <div className="chip">Sync settings</div>
          <h3 className="h-display mt-2 text-xl font-semibold">
            Course URL
          </h3>
          <p className="mt-1 text-xs text-muted">
            Set <code className="kbd">NEXT_PUBLIC_COURSE_URL</code> in env to
            wire the launch button.
          </p>
          <div className="mt-4 rounded-xl border border-white/5 bg-black/40 p-3 font-mono text-[11px] text-muted">
            {COURSE_URL === "#" ? "Not configured" : COURSE_URL}
          </div>
          <button className="btn mt-4 w-full">
            <Settings2 className="h-4 w-4" />
            Configure sync
          </button>
        </div>
      </div>

      {/* Course commerce — what the OS DOES own */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Course sales · 30d" value="132" delta="+21%" />
        <Stat label="Revenue · 30d" value="$8,844" delta="+19%" />
        <Stat label="Students enrolled" value="412" delta="+8%" />
        <Stat label="Refund rate" value="0.7%" delta="-0.3%" />
      </div>

      <div className="mt-4 card p-5">
        <div className="chip">How this connects</div>
        <h3 className="h-display mt-2 text-lg font-semibold">
          Strive OS handles the business. The course handles the experience.
        </h3>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          <li>
            <span className="text-bone">→</span> Sales sync via Stripe / GHL
            webhook into <code className="kbd">/api/ghl/webhook</code>
          </li>
          <li>
            <span className="text-bone">→</span> New students auto-flagged as{" "}
            <span className="chip-accent inline-flex">Course</span> package in
            Players
          </li>
          <li>
            <span className="text-bone">→</span> Launch button deep-links into
            the hosted course player
          </li>
        </ul>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: string;
}) {
  return (
    <div className="card p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
        {label}
      </div>
      <div className="mt-2 flex items-end gap-2">
        <div className="h-display text-2xl font-semibold">{value}</div>
        <div className="mb-0.5 text-[11px] font-medium text-accent">{delta}</div>
      </div>
    </div>
  );
}
