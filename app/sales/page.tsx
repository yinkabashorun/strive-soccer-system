import Link from "next/link";
import { CreditCard, DollarSign, Receipt, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { isStripeConfigured, isStripeWebhookConfigured } from "@/lib/stripe";
import { formatCurrency, timeAgo } from "@/lib/utils";

export const revalidate = 0;
export const dynamic = "force-dynamic";

type Sale = {
  id: string;
  stripe_session_id: string | null;
  buyer_email: string | null;
  buyer_name: string | null;
  amount_cents: number;
  currency: string;
  product: string;
  status: string;
  ghl_contact_id: string | null;
  created_at: string;
};

type SalesData = {
  sales: Sale[];
  totals: {
    revenueCents: number;
    count: number;
    last30Cents: number;
    last30Count: number;
  };
};

async function loadSales(): Promise<SalesData> {
  const empty: SalesData = {
    sales: [],
    totals: { revenueCents: 0, count: 0, last30Cents: 0, last30Count: 0 },
  };
  if (!isSupabaseConfigured()) return empty;
  try {
    const db = supabase();
    const { data, error } = await db
      .from("course_sales")
      .select("*")
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    const sales = (data as Sale[] | null) ?? [];
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const last30 = sales.filter((s) => new Date(s.created_at).getTime() >= since);
    return {
      sales,
      totals: {
        revenueCents: sales.reduce((sum, s) => sum + (s.amount_cents ?? 0), 0),
        count: sales.length,
        last30Cents: last30.reduce((sum, s) => sum + (s.amount_cents ?? 0), 0),
        last30Count: last30.length,
      },
    };
  } catch {
    return empty;
  }
}

export default async function SalesPage() {
  const data = await loadSales();
  const stripeOk = isStripeConfigured();
  const webhookOk = isStripeWebhookConfigured();

  return (
    <div>
      <PageHeader
        eyebrow="Course Sales · Stripe"
        title="Every $97 sale, live."
        subtitle="Populated automatically by the Stripe webhook on completed checkouts. Buyers are pushed to GHL with the Dribbling Course Buyer tag."
        actions={
          <Link href="/funnel" className="btn">
            <CreditCard className="h-4 w-4" />
            Test checkout
          </Link>
        }
      />

      {/* Stripe status banner */}
      {!stripeOk && (
        <div className="card mb-4 border-amber-500/30 bg-amber-500/[0.04] p-5">
          <div className="chip border-amber-500/40 bg-amber-500/[0.08] text-amber-300">
            Stripe key missing
          </div>
          <h3 className="h-display mt-2 text-lg font-semibold">
            Set STRIPE_SECRET_KEY to start collecting payments.
          </h3>
          <p className="mt-1 text-xs text-muted">
            Set <code className="kbd">STRIPE_SECRET_KEY</code> (live or test)
            and <code className="kbd">STRIPE_WEBHOOK_SECRET</code> in your env.
            Point the Stripe webhook at <code className="kbd">/api/stripe/webhook</code>{" "}
            for the events <code className="kbd">checkout.session.completed</code>.
          </p>
        </div>
      )}
      {stripeOk && !webhookOk && (
        <div className="card mb-4 border-amber-500/20 bg-amber-500/[0.03] p-4">
          <div className="text-xs text-amber-300">
            Stripe is wired, but STRIPE_WEBHOOK_SECRET isn't — the webhook will
            accept any caller. Set the secret in prod.
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="All-time revenue"
          value={formatCurrency(data.totals.revenueCents / 100)}
          icon={<DollarSign className="h-4 w-4" />}
          accent
        />
        <Stat
          label="Sales · all time"
          value={String(data.totals.count)}
          icon={<Receipt className="h-4 w-4" />}
        />
        <Stat
          label="Revenue · 30d"
          value={formatCurrency(data.totals.last30Cents / 100)}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <Stat
          label="Sales · 30d"
          value={String(data.totals.last30Count)}
          icon={<Receipt className="h-4 w-4" />}
        />
      </div>

      {/* Sales table */}
      <div className="mt-6 card overflow-hidden">
        <div className="hidden grid-cols-12 gap-3 border-b border-white/5 px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-muted md:grid">
          <div className="col-span-3">Buyer</div>
          <div className="col-span-3">Email</div>
          <div className="col-span-2">Product</div>
          <div className="col-span-2">Amount</div>
          <div className="col-span-2">When</div>
        </div>
        {data.sales.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted">
            No completed checkouts yet.
            {stripeOk && (
              <>
                {" "}
                Complete a test purchase from the{" "}
                <Link href="/funnel" className="text-accent hover:underline">
                  Funnel page
                </Link>{" "}
                to see it land here.
              </>
            )}
          </div>
        ) : (
          data.sales.map((s) => (
            <div
              key={s.id}
              className="grid grid-cols-1 gap-3 border-b border-white/5 px-5 py-4 last:border-b-0 md:grid-cols-12"
            >
              <div className="col-span-3 truncate text-sm font-semibold">
                {s.buyer_name || "—"}
              </div>
              <div className="col-span-3 truncate text-xs text-muted">
                {s.buyer_email ?? "—"}
              </div>
              <div className="col-span-2 truncate text-xs text-muted">
                {s.product}
              </div>
              <div className="col-span-2 text-sm font-semibold tabular-nums">
                {formatCurrency(s.amount_cents / 100)}
              </div>
              <div className="col-span-2 text-xs text-muted">
                {timeAgo(s.created_at)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={
        accent
          ? "card relative overflow-hidden border-accent/20 bg-gradient-to-br from-accent/[0.05] to-transparent p-5"
          : "card p-5"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          {label}
        </div>
        <div
          className={
            accent
              ? "grid h-8 w-8 place-items-center rounded-lg bg-accent/10 text-accent"
              : "grid h-8 w-8 place-items-center rounded-lg bg-white/[0.04] text-bone"
          }
        >
          {icon}
        </div>
      </div>
      <div className="h-display mt-3 text-3xl font-semibold tracking-tight">
        {value}
      </div>
    </div>
  );
}
