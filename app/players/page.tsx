import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { players } from "@/lib/data";
import { UserRoundPlus } from "lucide-react";

export default function PlayersPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Players"
        title="Every player on the roster."
        subtitle="Track packages, sessions remaining, payment status, and progress."
        actions={
          <button className="btn-accent">
            <UserRoundPlus className="h-4 w-4" />
            Add player
          </button>
        }
      />

      <div className="card overflow-hidden">
        <div className="hidden grid-cols-12 gap-3 border-b border-white/5 px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-muted md:grid">
          <div className="col-span-4">Player</div>
          <div className="col-span-2">Package</div>
          <div className="col-span-2">Sessions left</div>
          <div className="col-span-2">Payment</div>
          <div className="col-span-2">Coach</div>
        </div>
        {players.map((p) => {
          const pct = p.sessionsTotal
            ? (p.sessionsRemaining / p.sessionsTotal) * 100
            : 0;
          return (
            <Link
              href={`/portal?player=${p.id}`}
              key={p.id}
              className="grid grid-cols-1 gap-3 border-b border-white/5 px-5 py-4 transition-colors last:border-b-0 hover:bg-white/[0.02] md:grid-cols-12"
            >
              <div className="col-span-4 flex items-center gap-3">
                <Avatar name={p.name} color={p.avatarColor} />
                <div className="min-w-0">
                  <div className="truncate font-semibold">{p.name}</div>
                  <div className="text-xs text-muted">
                    Age {p.age} · {p.level}
                  </div>
                </div>
              </div>
              <div className="col-span-2 flex items-center">
                <span className="chip">{p.package}</span>
              </div>
              <div className="col-span-2 flex items-center gap-3">
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.04]">
                  <div
                    className="h-full bg-accent"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums">
                  {p.sessionsRemaining}/{p.sessionsTotal}
                </span>
              </div>
              <div className="col-span-2 flex items-center">
                <span
                  className={
                    p.paymentStatus === "Paid"
                      ? "chip-accent"
                      : "chip border-red-500/20 bg-red-500/10 text-red-300"
                  }
                >
                  {p.paymentStatus}
                </span>
              </div>
              <div className="col-span-2 flex items-center text-xs text-muted">
                {p.coach}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
