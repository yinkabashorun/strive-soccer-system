import {
  CalendarRange,
  CircleDollarSign,
  Flame,
  GraduationCap,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Avatar } from "@/components/Avatar";
import {
  coachTasks,
  contentItems,
  leads,
  stats,
  todaySessions,
  unpaidPlayers,
} from "@/lib/data";
import { formatCompact, formatCurrency, formatPct, timeAgo } from "@/lib/utils";
import Link from "next/link";

export default function CommandCenter() {
  const unpaid = unpaidPlayers();
  const viral = contentItems.filter((c) => c.status === "Viral");
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div>
      <PageHeader
        eyebrow={`Command Center · ${today}`}
        title="Run the entire operation from one screen."
        subtitle="Every session, lead, payment, and viral post in one place. Built for speed."
        actions={
          <>
            <button className="btn">
              <CalendarRange className="h-4 w-4" />
              Schedule session
            </button>
            <button className="btn-accent">
              <Sparkles className="h-4 w-4" />
              New TikTok idea
            </button>
          </>
        }
      />

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          index={0}
          label="MRR"
          value={formatCurrency(stats.monthlyRevenue)}
          delta={stats.revenueDelta}
          icon={<CircleDollarSign className="h-4 w-4" />}
          hint="vs. last month"
          accent
        />
        <StatCard
          index={1}
          label="Active clients"
          value={String(stats.activeClients)}
          delta={stats.activeClientsDelta}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          index={2}
          label="Course sales"
          value={String(stats.courseSales)}
          delta={stats.courseSalesDelta}
          icon={<GraduationCap className="h-4 w-4" />}
          hint="Ball Mastery · $67"
        />
        <StatCard
          index={3}
          label="Leads · 7d"
          value={String(stats.newLeads7d)}
          delta={stats.leadsDelta}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          index={4}
          label="Sessions · week"
          value={String(stats.sessionsThisWeek)}
          icon={<CalendarRange className="h-4 w-4" />}
          hint={`${formatPct(stats.attendanceRate)} attendance`}
        />
        <StatCard
          index={5}
          label="Reach · 30d"
          value={formatCompact(stats.contentReachLast30)}
          delta={0.42}
          icon={<Flame className="h-4 w-4" />}
          hint={`${stats.viralPostsLast30} viral posts`}
        />
      </div>

      {/* Main grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Today's schedule */}
        <section className="card p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="chip">Today</div>
              <h2 className="h-display mt-2 text-2xl font-semibold">
                Daily schedule
              </h2>
            </div>
            <Link href="/sessions" className="btn-ghost text-xs">
              View all sessions →
            </Link>
          </div>

          <div className="space-y-2">
            {todaySessions.map((s) => (
              <div
                key={s.id}
                className="group flex items-center gap-4 rounded-xl border border-white/5 bg-ink-200/40 p-4 transition-all hover:border-white/10 hover:bg-ink-200"
              >
                <div className="w-16 shrink-0 border-r border-white/5 pr-4 text-center">
                  <div className="h-display text-xl font-semibold">
                    {s.startTime}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
                    {s.endTime}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="chip text-[10px]">{s.type}</span>
                    <div className="truncate text-sm font-semibold">
                      {s.title}
                    </div>
                  </div>
                  <div className="mt-1 truncate text-xs text-muted">
                    {s.location} · {s.coach}
                  </div>
                </div>
                <div className="hidden items-center gap-3 sm:flex">
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums">
                      {s.enrolled.length}/{s.capacity}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
                      Enrolled
                    </div>
                  </div>
                  <Link
                    href={`/sessions/${s.id}`}
                    className="btn opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    Check in →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* New leads */}
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="chip">Live · GHL</div>
              <h2 className="h-display mt-2 text-2xl font-semibold">
                New leads
              </h2>
            </div>
          </div>
          <div className="space-y-2">
            {leads.slice(0, 4).map((l) => (
              <div
                key={l.id}
                className="flex items-center gap-3 rounded-xl border border-white/5 bg-ink-200/40 p-3"
              >
                <Avatar name={l.name} color="#2a2a2f" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {l.name}
                  </div>
                  <div className="truncate text-[11px] text-muted">
                    {l.interest} · {l.source} · {timeAgo(l.createdAt)}
                  </div>
                </div>
                <span
                  className={
                    l.status === "New"
                      ? "chip-accent"
                      : l.status === "Trial Booked"
                      ? "chip text-bone"
                      : "chip"
                  }
                >
                  {l.status}
                </span>
              </div>
            ))}
          </div>
          <Link
            href="/integrations"
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 py-2.5 text-xs text-muted hover:border-white/20 hover:text-bone"
          >
            Syncing from GoHighLevel → Strive OS
          </Link>
        </section>
      </div>

      {/* Row 2 */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Unpaid players */}
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="chip">Action required</div>
              <h2 className="h-display mt-2 text-2xl font-semibold">
                Unpaid players
              </h2>
            </div>
            <span className="text-xs text-muted">{unpaid.length} flagged</span>
          </div>
          <div className="space-y-2">
            {unpaid.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-white/5 bg-ink-200/40 p-3"
              >
                <Avatar name={p.name} color={p.avatarColor} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {p.name}
                  </div>
                  <div className="text-[11px] text-muted">
                    {p.sessionsRemaining} / {p.sessionsTotal} sessions left
                  </div>
                </div>
                <span className="chip text-red-300 border-red-500/20 bg-red-500/10">
                  {p.paymentStatus}
                </span>
              </div>
            ))}
            {unpaid.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-muted">
                All players are paid. Clean books.
              </div>
            )}
          </div>
        </section>

        {/* Coach tasks */}
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="chip">Today</div>
              <h2 className="h-display mt-2 text-2xl font-semibold">
                Coach tasks
              </h2>
            </div>
          </div>
          <div className="space-y-2">
            {coachTasks.map((t) => (
              <label
                key={t.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/5 bg-ink-200/40 p-3 transition-colors hover:bg-ink-200"
              >
                <input
                  type="checkbox"
                  defaultChecked={t.done}
                  className="peer h-4 w-4 cursor-pointer accent-accent"
                />
                <div className="min-w-0 flex-1 peer-checked:line-through peer-checked:opacity-50">
                  <div className="truncate text-sm font-medium">{t.title}</div>
                  <div className="text-[11px] text-muted">
                    {t.owner} · {t.due}
                  </div>
                </div>
                <span
                  className={
                    t.priority === "High"
                      ? "chip border-red-500/20 bg-red-500/10 text-red-300"
                      : t.priority === "Med"
                      ? "chip-accent"
                      : "chip"
                  }
                >
                  {t.priority}
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* Content performance */}
        <section className="card relative overflow-hidden p-5">
          <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-accent/15 blur-3xl" />
          <div className="relative">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="chip-accent">Viral · last 30d</div>
                <h2 className="h-display mt-2 text-2xl font-semibold">
                  Content engine
                </h2>
              </div>
              <Link href="/content" className="btn-ghost text-xs">
                Open →
              </Link>
            </div>
            {viral.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-accent/20 bg-accent/[0.04] p-4"
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                  {c.platform} · {c.pillar}
                </div>
                <div className="mt-1 text-sm font-semibold leading-snug">
                  {c.title}
                </div>
                <p className="mt-1 text-xs italic text-muted">"{c.hook}"</p>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  <Metric label="Views" value={formatCompact(c.views ?? 0)} />
                  <Metric label="Likes" value={formatCompact(c.likes ?? 0)} />
                  <Metric label="Shares" value={formatCompact(c.shares ?? 0)} />
                  <Metric label="Saves" value={formatCompact(c.saves ?? 0)} />
                </div>
              </div>
            ))}
            <div className="mt-3 rounded-xl border border-dashed border-white/10 p-4 text-xs text-muted">
              <span className="text-bone">Pipeline:</span>{" "}
              {contentItems.filter((c) => c.status === "Idea").length} ideas ·{" "}
              {contentItems.filter((c) => c.status === "Scripted").length}{" "}
              scripted ·{" "}
              {contentItems.filter((c) => c.status === "Edited").length} edited
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/40 px-2 py-1.5">
      <div className="h-display text-sm font-semibold">{value}</div>
      <div className="text-[9px] uppercase tracking-[0.18em] text-muted">
        {label}
      </div>
    </div>
  );
}
