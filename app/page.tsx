import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  CircleOff,
  CreditCard,
  DollarSign,
  Eye,
  Film,
  MousePointerClick,
  Receipt,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Webhook,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { isAnthropicConfigured } from "@/lib/ai";
import { isElevenLabsConfigured } from "@/lib/elevenlabs";
import { isFalConfigured } from "@/lib/fal";
import { isGHLConfigured } from "@/lib/ghl";
import { isStripeConfigured } from "@/lib/stripe";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { formatCurrency, timeAgo } from "@/lib/utils";

export const revalidate = 0;
export const dynamic = "force-dynamic";

type Dash = {
  revenueAllCents: number;
  revenue30Cents: number;
  salesCount: number;
  sales30Count: number;
  leadsCount: number;
  leads7d: number;
  vslViews7d: number;
  ugcGenerated: number;
  postsReady: number;
  followUpsNeeded: number;
  recentSales: Array<{
    id: string;
    buyer_email: string | null;
    buyer_name: string | null;
    amount_cents: number;
    created_at: string;
  }>;
  recentCreatives: Array<{
    id: string;
    hook: string | null;
    status: string;
    platform: string | null;
    created_at: string;
  }>;
  recentLeads: Array<{
    id: string;
    email: string | null;
    name: string | null;
    source: string | null;
    created_at: string;
  }>;
};

const EMPTY: Dash = {
  revenueAllCents: 0,
  revenue30Cents: 0,
  salesCount: 0,
  sales30Count: 0,
  leadsCount: 0,
  leads7d: 0,
  vslViews7d: 0,
  ugcGenerated: 0,
  postsReady: 0,
  followUpsNeeded: 0,
  recentSales: [],
  recentCreatives: [],
  recentLeads: [],
};

async function loadDash(): Promise<Dash> {
  if (!isSupabaseConfigured()) return EMPTY;
  try {
    const db = supabase();
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      salesRes,
      sales30Res,
      leadsCountRes,
      leads7Res,
      vsl7Res,
      ugcRes,
      readyRes,
      followUpRes,
      recentSalesRes,
      recentCreativesRes,
      recentLeadsRes,
    ] = await Promise.all([
      db
        .from("course_sales")
        .select("amount_cents", { count: "exact" })
        .eq("status", "paid"),
      db
        .from("course_sales")
        .select("amount_cents", { count: "exact" })
        .eq("status", "paid")
        .gte("created_at", since30d),
      db.from("lead_events").select("id", { count: "exact", head: true }).eq("event_type", "lead_captured"),
      db
        .from("lead_events")
        .select("id", { count: "exact", head: true })
        .eq("event_type", "lead_captured")
        .gte("created_at", since7d),
      db
        .from("lead_events")
        .select("id", { count: "exact", head: true })
        .eq("event_type", "vsl_view")
        .gte("created_at", since7d),
      db.from("creatives").select("id", { count: "exact", head: true }),
      db
        .from("creatives")
        .select("id", { count: "exact", head: true })
        .in("status", ["script_ready", "voiceover_ready", "video_ready"]),
      db
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("status", "Won"),
      db
        .from("course_sales")
        .select("id, buyer_email, buyer_name, amount_cents, created_at")
        .eq("status", "paid")
        .order("created_at", { ascending: false })
        .limit(5),
      db
        .from("creatives")
        .select("id, hook, status, platform, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      db
        .from("lead_events")
        .select("id, email, name, source, created_at")
        .eq("event_type", "lead_captured")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const totalRevenueCents =
      ((salesRes.data as Array<{ amount_cents: number }> | null) ?? []).reduce(
        (sum, r) => sum + (r.amount_cents ?? 0),
        0,
      );
    const revenue30Cents =
      ((sales30Res.data as Array<{ amount_cents: number }> | null) ?? []).reduce(
        (sum, r) => sum + (r.amount_cents ?? 0),
        0,
      );

    return {
      revenueAllCents: totalRevenueCents,
      revenue30Cents,
      salesCount: salesRes.count ?? 0,
      sales30Count: sales30Res.count ?? 0,
      leadsCount: leadsCountRes.count ?? 0,
      leads7d: leads7Res.count ?? 0,
      vslViews7d: vsl7Res.count ?? 0,
      ugcGenerated: ugcRes.count ?? 0,
      postsReady: readyRes.count ?? 0,
      followUpsNeeded: followUpRes.count ?? 0,
      recentSales:
        (recentSalesRes.data as Dash["recentSales"] | null) ?? [],
      recentCreatives:
        (recentCreativesRes.data as Dash["recentCreatives"] | null) ?? [],
      recentLeads:
        (recentLeadsRes.data as Dash["recentLeads"] | null) ?? [],
    };
  } catch {
    return EMPTY;
  }
}

export default async function CommandCenter() {
  const d = await loadDash();
  const stripeOk = isStripeConfigured();
  const supabaseOk = isSupabaseConfigured();
  const ghlOk = isGHLConfigured();
  const anthropicOk = isAnthropicConfigured();
  const falOk = isFalConfigured();
  const elevenOk = isElevenLabsConfigured();

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div>
      <PageHeader
        eyebrow={`Command Center · ${today}`}
        title="Strive OS · the $97 course sales machine."
        subtitle="UGC ads → VSL landing page → Stripe checkout → GHL follow-up. Every number on this page is live."
        actions={
          <>
            <Link href="/ugc" className="btn">
              <Sparkles className="h-4 w-4" />
              New UGC ad
            </Link>
            <Link href="/funnel" className="btn-accent">
              <CreditCard className="h-4 w-4" />
              Edit funnel
            </Link>
          </>
        }
      />

      {/* Revenue + sales row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          index={0}
          label="Revenue · all time"
          value={formatCurrency(d.revenueAllCents / 100)}
          icon={<DollarSign className="h-4 w-4" />}
          hint={`${d.salesCount} sales`}
          accent
        />
        <StatCard
          index={1}
          label="Revenue · 30d"
          value={formatCurrency(d.revenue30Cents / 100)}
          icon={<TrendingUp className="h-4 w-4" />}
          hint={`${d.sales30Count} sales`}
        />
        <StatCard
          index={2}
          label="Leads captured"
          value={String(d.leadsCount)}
          icon={<Users className="h-4 w-4" />}
          hint={`${d.leads7d} in last 7d`}
        />
        <StatCard
          index={3}
          label="VSL views · 7d"
          value={String(d.vslViews7d)}
          icon={<Eye className="h-4 w-4" />}
          hint="Tracked via lead_events"
        />
        <StatCard
          index={4}
          label="UGC ads generated"
          value={String(d.ugcGenerated)}
          icon={<Film className="h-4 w-4" />}
          hint={`${d.postsReady} ready to ship`}
        />
        <StatCard
          index={5}
          label="Active follow-ups"
          value={String(d.followUpsNeeded)}
          icon={<Star className="h-4 w-4" />}
          hint="Won contacts in GHL"
        />
      </div>

      {/* Integration health */}
      <section className="mt-6 card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="chip">System status</div>
            <h2 className="h-display mt-1 text-lg font-semibold">
              Funnel integrations
            </h2>
          </div>
          <Link href="/settings" className="btn-ghost text-xs">
            Open settings →
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <Health label="Supabase" ok={supabaseOk} />
          <Health label="Stripe" ok={stripeOk} />
          <Health label="GoHighLevel" ok={ghlOk} />
          <Health label="Anthropic" ok={anthropicOk} />
          <Health label="Fal.ai" ok={falOk} />
          <Health label="ElevenLabs" ok={elevenOk} />
        </div>
      </section>

      {/* Recent sales + creatives */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="card p-5 xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="chip-accent">
                <Receipt className="h-3 w-3" />
                Money in
              </div>
              <h2 className="h-display mt-1 text-xl font-semibold">
                Recent sales
              </h2>
            </div>
            <Link href="/sales" className="btn-ghost text-xs">
              All sales →
            </Link>
          </div>
          {d.recentSales.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-muted">
              No completed checkouts yet.{" "}
              {!stripeOk && (
                <Link href="/settings" className="text-accent hover:underline">
                  Wire Stripe to start collecting →
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {d.recentSales.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-ink-200/40 p-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {s.buyer_name || s.buyer_email || "Unknown buyer"}
                    </div>
                    <div className="truncate text-[11px] text-muted">
                      {s.buyer_email ?? "—"} · {timeAgo(s.created_at)}
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums">
                    {formatCurrency(s.amount_cents / 100)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="chip">
                <Film className="h-3 w-3" />
                Pipeline
              </div>
              <h2 className="h-display mt-1 text-xl font-semibold">
                Latest UGC
              </h2>
            </div>
            <Link href="/library" className="btn-ghost text-xs">
              Library →
            </Link>
          </div>
          {d.recentCreatives.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-muted">
              No ads yet.{" "}
              <Link href="/ugc" className="text-accent hover:underline">
                Generate your first →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {d.recentCreatives.map((c) => (
                <Link
                  key={c.id}
                  href="/library"
                  className="block rounded-xl border border-white/5 bg-ink-200/40 p-3 hover:border-white/10 hover:bg-ink-200"
                >
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted">
                    {c.platform ?? "—"} · {c.status}
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs">
                    {c.hook ?? "Untitled"}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Recent leads */}
      <div className="mt-4 grid grid-cols-1 gap-4">
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="chip">
                <MousePointerClick className="h-3 w-3" />
                Funnel intake
              </div>
              <h2 className="h-display mt-1 text-xl font-semibold">
                Recent leads
              </h2>
            </div>
            <Link href="/clients" className="btn-ghost text-xs">
              Active clients →
            </Link>
          </div>
          {d.recentLeads.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-muted">
              No funnel leads yet. POST to{" "}
              <code className="kbd">/api/ghl/lead</code> from your VSL form to
              start filling this in.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
              {d.recentLeads.map((l) => (
                <div
                  key={l.id}
                  className="rounded-xl border border-white/5 bg-ink-200/40 p-3"
                >
                  <div className="truncate text-sm font-semibold">
                    {l.name || l.email || "Unknown"}
                  </div>
                  <div className="truncate text-[11px] text-muted">
                    {l.email ?? "—"} · {l.source ?? "Strive OS"} ·{" "}
                    {timeAgo(l.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted">
        <Webhook className="h-3 w-3" />
        Webhook receivers · GHL{" "}
        <code className="kbd">/api/ghl/webhook</code> · Stripe{" "}
        <code className="kbd">/api/stripe/webhook</code>
      </div>
    </div>
  );
}

function Health({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div
      className={
        ok
          ? "flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/[0.05] px-3 py-2"
          : "flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2"
      }
    >
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
      ) : (
        <CircleOff className="h-3.5 w-3.5 text-muted" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium">{label}</div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
          {ok ? "Wired" : "Not set"}
        </div>
      </div>
      {!ok && <AlertTriangle className="h-3 w-3 text-amber-300" />}
    </div>
  );
}
