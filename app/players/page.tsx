import Link from "next/link";
import { UserRoundPlus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { players as mockPlayers } from "@/lib/data";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Player } from "@/lib/types";

export const revalidate = 0;
export const dynamic = "force-dynamic";

async function getPlayers(): Promise<{ players: Player[]; source: "supabase" | "mock" }> {
  if (!isSupabaseConfigured()) return { players: mockPlayers, source: "mock" };
  try {
    const db = supabase();
    const { data, error } = await db
      .from("players")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw error;
    if (!data || data.length === 0) return { players: mockPlayers, source: "mock" };
    return { players: data as Player[], source: "supabase" };
  } catch {
    return { players: mockPlayers, source: "mock" };
  }
}

export default async function PlayersPage() {
  const { players, source } = await getPlayers();

  return (
    <div>
      <PageHeader
        eyebrow={`Players · ${source === "supabase" ? "live" : "mock data"}`}
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

        {players.length === 0 ? (
          <div className="px-5 py-12 text-center text-muted">
            No players yet.
          </div>
        ) : (
          players.map((p) => {
            const pct = p.sessionsTotal
              ? (p.sessionsRemaining / p.sessionsTotal) * 100
              : 0;
            return (
              <Link
                href={`/players/${p.id}`}
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
          })
        )}
      </div>
    </div>
  );
}
