import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { todaySessions, upcomingSessions } from "@/lib/data";
import { CalendarPlus, ChevronRight, MapPin, Users } from "lucide-react";

export default function SessionsIndex() {
  const all = [...todaySessions, ...upcomingSessions];

  return (
    <div>
      <PageHeader
        eyebrow="Sessions"
        title="Every rep. Every roster. Every coach."
        subtitle="Group and private sessions across Haymarket, Gainesville, and Ashburn. Mobile-first check-in built for the sideline."
        actions={
          <button className="btn-accent">
            <CalendarPlus className="h-4 w-4" />
            New session
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {all.map((s) => {
          const fillPct = (s.enrolled.length / s.capacity) * 100;
          return (
            <Link
              key={s.id}
              href={`/sessions/${s.id}`}
              className="card card-hover group relative overflow-hidden p-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={s.type === "Camp" ? "chip-accent" : "chip"}>
                    {s.type}
                  </span>
                  {s.partner && (
                    <span className="chip-accent">× {s.partner}</span>
                  )}
                </div>
                <span className="text-[11px] text-muted">{s.date}</span>
              </div>

              <h3 className="h-display mt-3 text-lg font-semibold leading-snug">
                {s.title}
              </h3>

              <div className="mt-1 text-sm text-muted">
                {s.startTime} – {s.endTime}
              </div>

              <div className="mt-4 flex items-center gap-1.5 text-xs text-muted">
                <MapPin className="h-3.5 w-3.5" />
                {s.location}
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs text-muted">
                <Users className="h-3.5 w-3.5" />
                {s.enrolled.length} / {s.capacity} enrolled · {s.coach}
              </div>

              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent-deep to-accent"
                  style={{ width: `${fillPct}%` }}
                />
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.18em] text-muted">
                  Tap to check in
                </span>
                <ChevronRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-1 group-hover:text-bone" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
