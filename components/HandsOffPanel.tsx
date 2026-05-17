import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  Radio,
  RefreshCw,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { timeAgo } from "@/lib/utils";

// Server-side panel that shows the user "this is what ran while you were
// away." Everything here comes from data already in Supabase plus the
// known cron schedules — no extra services.

type Activity = {
  leads24h: number;
  wonAdded24h: number;
  webhookEvents24h: number;
  webhookErrors24h: number;
  lastSyncAt: string | null;
  lastWebhookAt: string | null;
};

const EMPTY: Activity = {
  leads24h: 0,
  wonAdded24h: 0,
  webhookEvents24h: 0,
  webhookErrors24h: 0,
  lastSyncAt: null,
  lastWebhookAt: null,
};

async function load24hActivity(): Promise<Activity> {
  if (!isSupabaseConfigured()) return EMPTY;
  try {
    const db = supabase();
    const since = new Date(
      Date.now() - 24 * 60 * 60 * 1000,
    ).toISOString();

    const [
      leadsRes,
      wonRes,
      eventsRes,
      errorsRes,
      lastSyncRes,
      lastWebhookRes,
    ] = await Promise.all([
      db
        .from("leads")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since),
      db
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("status", "Won")
        .gte("created_at", since),
      db
        .from("ghl_sync_log")
        .select("id", { count: "exact", head: true })
        .gte("received_at", since),
      db
        .from("ghl_sync_log")
        .select("id", { count: "exact", head: true })
        .eq("status", "error")
        .gte("received_at", since),
      db
        .from("ghl_sync_log")
        .select("received_at")
        .ilike("event", "cron.sync%")
        .order("received_at", { ascending: false })
        .limit(1),
      db
        .from("ghl_sync_log")
        .select("received_at")
        .order("received_at", { ascending: false })
        .limit(1),
    ]);

    return {
      leads24h: leadsRes.count ?? 0,
      wonAdded24h: wonRes.count ?? 0,
      webhookEvents24h: eventsRes.count ?? 0,
      webhookErrors24h: errorsRes.count ?? 0,
      lastSyncAt:
        (lastSyncRes.data?.[0] as { received_at?: string } | undefined)
          ?.received_at ?? null,
      lastWebhookAt:
        (lastWebhookRes.data?.[0] as { received_at?: string } | undefined)
          ?.received_at ?? null,
    };
  } catch {
    return EMPTY;
  }
}

function nextDailyAt(hourUTC: number): Date {
  const d = new Date();
  d.setUTCHours(hourUTC, 0, 0, 0);
  if (d.getTime() <= Date.now()) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function nextWeeklyAt(hourUTC: number, dayOfWeek: number): Date {
  const d = new Date();
  d.setUTCHours(hourUTC, 0, 0, 0);
  const delta = (dayOfWeek - d.getUTCDay() + 7) % 7;
  if (delta === 0 && d.getTime() <= Date.now()) {
    d.setUTCDate(d.getUTCDate() + 7);
  } else {
    d.setUTCDate(d.getUTCDate() + delta);
  }
  return d;
}

function whenLabel(d: Date): string {
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function HandsOffPanel() {
  const a = await load24hActivity();
  const nextSync = nextDailyAt(6);
  const nextContentDrop = nextWeeklyAt(8, 1); // Monday 08:00 UTC

  return (
    <section className="card relative overflow-hidden p-6">
      <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <div className="flex items-center gap-2">
              <div className="chip-accent">
                <Radio className="h-3 w-3 animate-pulse-soft" />
                On autopilot
              </div>
              <div className="chip text-[10px]">
                <CheckCircle2 className="h-3 w-3 text-accent" />
                Always on
              </div>
            </div>
            <h2 className="h-display mt-3 text-2xl font-semibold leading-tight">
              The OS ran itself in the last 24 hours.
            </h2>
            <p className="mt-2 text-sm text-muted">
              GHL contacts sync at 06:00 UTC daily. Content autopilot ships 14
              posts every Monday at 08:00 UTC. Won-tagged contacts get
              auto-promoted to Active Clients on every ingest. You stay on the
              pitch.
            </p>
          </div>

          <div className="flex flex-col items-end gap-1 text-right">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
              Last activity
            </div>
            <div className="text-sm font-semibold">
              {a.lastWebhookAt ? timeAgo(a.lastWebhookAt) : "—"}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile
            label="New leads · 24h"
            value={String(a.leads24h)}
            hint={a.leads24h > 0 ? "from GHL" : "quiet"}
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            href="/leads"
          />
          <Tile
            label="Won · 24h"
            value={String(a.wonAdded24h)}
            hint="auto-promoted"
            icon={<Star className="h-3.5 w-3.5" />}
            href="/clients"
            accent
          />
          <Tile
            label="Webhook events · 24h"
            value={String(a.webhookEvents24h)}
            hint={
              a.webhookErrors24h > 0
                ? `${a.webhookErrors24h} error${a.webhookErrors24h === 1 ? "" : "s"}`
                : "all clean"
            }
            icon={<Radio className="h-3.5 w-3.5" />}
            href="/integrations"
            warn={a.webhookErrors24h > 0}
          />
          <Tile
            label="Last sync"
            value={a.lastSyncAt ? timeAgo(a.lastSyncAt) : "—"}
            hint="daily · 06:00 UTC"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            href="/integrations"
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <NextRun
            icon={<RefreshCw className="h-4 w-4 text-accent" />}
            label="Next GHL sync"
            when={whenLabel(nextSync)}
            detail="Pulls every contact · auto-promotes Won tags"
          />
          <NextRun
            icon={<Sparkles className="h-4 w-4 text-accent" />}
            label="Next content drop"
            when={whenLabel(nextContentDrop)}
            detail="14 posts · 2 / day for the week"
          />
        </div>
      </div>
    </section>
  );
}

function Tile({
  label,
  value,
  hint,
  icon,
  href,
  accent,
  warn,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  href: string;
  accent?: boolean;
  warn?: boolean;
}) {
  const cls = warn
    ? "rounded-2xl border border-red-500/20 bg-red-500/[0.05] p-4 hover:border-red-500/40"
    : accent
      ? "rounded-2xl border border-accent/30 bg-accent/[0.05] p-4 hover:border-accent/50"
      : "rounded-2xl border border-white/5 bg-black/30 p-4 hover:border-white/15";
  return (
    <Link href={href} className={`${cls} block transition-colors`}>
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
        <span className={accent || warn ? "text-bone" : "text-accent"}>
          {icon}
        </span>
        {label}
      </div>
      <div className="h-display mt-2 text-2xl font-semibold tabular-nums">
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-muted">{hint}</div>
    </Link>
  );
}

function NextRun({
  icon,
  label,
  when,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  when: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-black/30 p-4">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
        <CalendarClock className="h-3.5 w-3.5 text-accent" />
        {label}
      </div>
      <div className="mt-2 flex items-center gap-2 text-lg font-semibold">
        {icon}
        {when}
      </div>
      <div className="mt-1 text-[11px] text-muted">{detail}</div>
    </div>
  );
}
