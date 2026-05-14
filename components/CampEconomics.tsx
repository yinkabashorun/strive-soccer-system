import type { Session } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { DollarSign, TrendingUp, Users } from "lucide-react";

export function CampEconomics({ session }: { session: Session }) {
  if (!session.pricing && !session.revenueShare) return null;

  const share = session.revenueShare;
  const minRev = share ? share.perPlayer * share.targetMin : 0;
  const maxRev = share ? share.perPlayer * share.targetMax : 0;

  return (
    <div className="card relative overflow-hidden p-5">
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-accent/15 blur-3xl" />
      <div className="relative">
        <div className="chip-accent">
          <DollarSign className="h-3 w-3" /> Camp economics
        </div>

        {session.pricing && (
          <>
            <h3 className="h-display mt-3 text-lg font-semibold">
              Pricing tiers
            </h3>
            <div className="mt-3 space-y-2">
              {session.pricing.map((tier) => (
                <div
                  key={tier.label}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-black/30 px-3 py-2.5"
                >
                  <span className="text-sm text-bone/90">{tier.label}</span>
                  <span className="h-display text-base font-semibold text-accent tabular-nums">
                    {formatCurrency(tier.price)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {share && (
          <>
            <div className="divider my-4" />
            <h3 className="h-display text-lg font-semibold">Strive's split</h3>
            <p className="mt-1 text-xs text-muted">
              {formatCurrency(share.perPlayer)} per player Strive brings ·
              target {share.targetMin}–{share.targetMax} players.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/5 bg-black/40 p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted">
                  <Users className="h-3 w-3" /> Min projection
                </div>
                <div className="h-display mt-1 text-xl font-semibold tabular-nums">
                  {formatCurrency(minRev)}
                </div>
                <div className="text-[10px] text-muted">
                  {share.targetMin} players × {formatCurrency(share.perPlayer)}
                </div>
              </div>
              <div className="rounded-xl border border-accent/30 bg-accent/[0.06] p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-accent">
                  <TrendingUp className="h-3 w-3" /> Max projection
                </div>
                <div className="h-display mt-1 text-xl font-semibold tabular-nums text-accent">
                  {formatCurrency(maxRev)}
                </div>
                <div className="text-[10px] text-muted">
                  {share.targetMax} players × {formatCurrency(share.perPlayer)}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
