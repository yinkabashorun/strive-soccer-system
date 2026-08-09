import Link from "next/link";
import {
  CalendarRange,
  ChevronRight,
  MapPin,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Avatar } from "@/components/Avatar";
import { HandsOffPanel } from "@/components/HandsOffPanel";
import { OneClickContent } from "@/components/OneClickContent";
import {
  coachTasks,
  todaySessions as mockTodaySessions,
} from "@/lib/data";
import { timeAgo } from "@/lib/utils";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Session } from "@/lib/types";

export const revalidate = 0;
export const dynamic = "force-dynamic";

type LeadRow = {
  id: string;
  name: string;
  source: string | null;
  status: string;
  created_at: string;
};

type DashboardData = {
  totalLeads: number;
  wonClients: number;
  newLeads7d: number;
  todaySessions: Session[];
  recentLeads: LeadRow[];
  topWon: LeadRow[];
};

async function loadDashboard(): Promise<DashboardData> {
  const empty: DashboardData = {
    totalLeads: 0,
    wonClients: 0,
    newLeads7d: 0,
    todaySessions: [],
    recentLeads: [],
    topWon: [],
  };
  if (!isSupabaseConfigured()) return empty;
  try {
    const db = supabase();
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const todayISO = new Date().toISOString().slice(0, 10);

    const [
      totalRes,
      wonCountRes,
      newRes,
      sessionsRes,
      recentRes,
      topWonRes,
    ] = await Promise.all([
      db.from("leads").select("id", { count: "exact", head: true }),
      db
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("status", "Won"),
      db
        .from("leads")
        .select("id", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo),
      db.from("sessions").select("*").eq("date", todayISO),
      db
        .from("leads")
        .select("id, name, source, status, created_at")
        .order("created_at", { ascending: false })
        .limit(4),
      db
        .from("leads")
        .select("id, name, source, status, created_at")
        .eq("status", "Won")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const todaySessions = (sessionsRes.data as Session[] | null) ?? [];
    return {
      totalLeads: totalRes.count ?? 0,
      wonClients: wonCountRes.count ?? 0,
      newLeads7d: newRes.count ?? 0,
      todaySessions,
      recentLeads: (recentRes.data as LeadRow[] | null) ?? [],
      topWon: (topWonRes.data as LeadRow[] | null) ?? [],
    };
  } catch {
    return empty;
  }
}

export default async function CommandCenter() {
  const data = await loadDashboard();
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const todaySessions =
    data.todaySessions.length > 0 ? data.todaySessions : mockTodaySessions;
  const usingMockSessions = data.todaySessions.length === 0;

  return (
    <div>
      <PageHeader
        eyebrow={`Command Center · ${today}`}
        title="Run Strive Soccer from one screen."
        subtitle="Active clients, today's schedule, fresh leads, and one-tap content. The crons handle the rest — you stay on the pitch."
        actions={
          <>
            <Link href="/clients" className="btn">
              <Star className="h-4 w-4" />
              Active clients
            </Link>
            <Link href="/content" className="btn-accent">
              <Sparkles className="h-4 w-4" />
              Content engine
            </Link>
          </>
        }
      />

      {/* Hands-off automation status — what ran while you were away */}
      <HandsOffPanel />

      {/* Real business stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          index={0}
          label="Active clients"
          value={String(data.wonClients)}
          icon={<Star className="h-4 w-4" />}
          hint="Won in pipeline"
          accent
        />
        <StatCard
          index={1}
          label="Sessions today"
          value={String(data.todaySessions.length)}
          icon={<CalendarRange className="h-4 w-4" />}
          hint={data.todaySessions.length === 0 ? "Nothing booked" : undefined}
        />
        <StatCard
          index={2}
          label="New leads · 7d"
          value={String(data.newLeads7d)}
          icon={<TrendingUp className="h-4 w-4" />}
          hint={`${data.totalLeads} total`}
        />
        <StatCard
          index={3}
          label="Total pipeline"
          value={String(data.totalLeads)}
          icon={<Users className="h-4 w-4" />}
          hint="Across all stages"
        />
      </div>

      {/* One-click content */}
      <div className="mt-6">
        <OneClickContent />
      </div>

      {/* Today's schedule + active clients */}
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
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

          {todaySessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-muted">
              No sessions scheduled today.
            </div>
          ) : (
            <div className="space-y-2">
              {usingMockSessions && (
                <div className="rounded-lg border border-dashed border-white/10 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-muted">
                  Example sessions — connect the sessions table to see your real day.
                </div>
              )}
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
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">
                        {s.location} · {s.coach}
                      </span>
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
                      Open →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="chip-accent">
                <Star className="h-3 w-3" /> Priority
              </div>
              <h2 className="h-display mt-2 text-2xl font-semibold">
                Active clients
              </h2>
            </div>
            <Link href="/clients" className="btn-ghost text-xs">
              View all →
            </Link>
          </div>
          {data.topWon.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-muted">
              No Won contacts yet. The daily sync auto-promotes contacts tagged{" "}
              <code className="kbd">won</code> in GHL — they'll appear here.
            </div>
          ) : (
            <div className="space-y-2">
              {data.topWon.map((c) => (
                <Link
                  key={c.id}
                  href={`/leads/${c.id}`}
                  className="flex items-center gap-3 rounded-xl border border-white/5 bg-ink-200/40 p-3 transition-colors hover:border-white/10 hover:bg-ink-200"
                >
                  <Avatar name={c.name || "?"} color="#2a2a2f" size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {c.name || "Unknown"}
                    </div>
                    <div className="truncate text-[11px] text-muted">
                      {c.source ?? "Direct"} · joined {timeAgo(c.created_at)}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Recent leads + coach tasks */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="card p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="chip">Live · GHL</div>
              <h2 className="h-display mt-2 text-2xl font-semibold">
                Recent leads
              </h2>
            </div>
            <Link href="/leads" className="btn-ghost text-xs">
              View all leads →
            </Link>
          </div>
          {data.recentLeads.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-muted">
              No leads yet. New contacts from GoHighLevel land here in real time.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {data.recentLeads.map((l) => (
                <Link
                  key={l.id}
                  href={`/leads/${l.id}`}
                  className="flex items-center gap-3 rounded-xl border border-white/5 bg-ink-200/40 p-3 hover:border-white/10 hover:bg-ink-200"
                >
                  <Avatar name={l.name || "?"} color="#2a2a2f" size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {l.name || "Unknown"}
                    </div>
                    <div className="truncate text-[11px] text-muted">
                      {l.source ?? "—"} · {timeAgo(l.created_at)}
                    </div>
                  </div>
                  <span
                    className={
                      l.status === "Won"
                        ? "chip-accent"
                        : l.status === "New"
                        ? "chip border-yellow-500/20 bg-yellow-500/10 text-yellow-300"
                        : l.status === "Lost"
                        ? "chip border-red-500/20 bg-red-500/10 text-red-300"
                        : "chip"
                    }
                  >
                    {l.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

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
      </div>
    </div>
  );
}
