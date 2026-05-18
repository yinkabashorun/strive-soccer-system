import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CreditCard,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { players as mockPlayers } from "@/lib/data";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Player } from "@/lib/types";

export const revalidate = 0;
export const dynamic = "force-dynamic";

async function getPlayer(id: string): Promise<Player | null> {
  if (isSupabaseConfigured()) {
    try {
      const db = supabase();
      const { data, error } = await db
        .from("players")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as Player;
    } catch {
      // fall through to mock
    }
  }
  return mockPlayers.find((p) => p.id === id) ?? null;
}

export default async function PlayerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const player = await getPlayer(params.id);
  if (!player) return notFound();

  const used = Math.max(0, player.sessionsTotal - player.sessionsRemaining);
  const pct = player.sessionsTotal ? Math.round((used / player.sessionsTotal) * 100) : 0;
  const notes = player.progressNotes ?? [];

  return (
    <div>
      <Link
        href="/players"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-bone"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to players
      </Link>

      <PageHeader
        eyebrow={`Player · ${player.package} · ${player.level}`}
        title={player.name}
        subtitle={`Age ${player.age} · ${player.coach} · joined ${player.joinedAt}`}
      />

      {/* Hero */}
      <section className="relative mb-6 overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-ink-200 via-ink-100 to-black p-6 md:p-8">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute inset-0 dot-grid opacity-30" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <Avatar
              name={player.name}
              color={player.avatarColor}
              size={84}
              className="text-base"
            />
            <div>
              <div className="chip-accent">
                <ShieldCheck className="h-3 w-3" /> {player.level}
              </div>
              <h2 className="h-display mt-2 text-3xl font-semibold leading-tight md:text-4xl">
                {player.name}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {player.package} package · coached by {player.coach}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <HeroStat value={`${player.sessionsRemaining}`} label="Left" />
            <HeroStat value={`${used}`} label="Used" />
            <HeroStat value={`${pct}%`} label="Progress" />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Progress notes */}
        <section className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="chip">Coach notes</div>
            <span className="text-[11px] text-muted">{notes.length} entries</span>
          </div>
          <h3 className="h-display mt-2 text-xl font-semibold">
            Progress, every session.
          </h3>
          <div className="mt-4 space-y-2">
            {notes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-muted">
                No progress notes yet.
              </div>
            ) : (
              notes.map((n, i) => (
                <div
                  key={i}
                  className="flex gap-3 rounded-xl border border-white/5 bg-ink-200/40 p-3"
                >
                  <Sparkles className="h-4 w-4 shrink-0 text-accent" />
                  <p className="text-sm text-bone/90">{n}</p>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Side: package, payment, parent */}
        <section className="space-y-4">
          <div
            className={
              player.paymentStatus === "Paid"
                ? "card p-5"
                : "card border-red-500/20 bg-red-500/[0.04] p-5"
            }
          >
            <div className="chip">Account</div>
            <h3 className="h-display mt-2 text-lg font-semibold">
              {player.paymentStatus === "Paid" ? "Paid in full" : "Action needed"}
            </h3>
            <div className="mt-3 space-y-2 text-xs">
              <Row label="Package" value={player.package} />
              <Row
                label="Sessions"
                value={`${player.sessionsRemaining} / ${player.sessionsTotal}`}
              />
              <Row
                label="Payment"
                value={player.paymentStatus}
                accent={player.paymentStatus !== "Paid"}
              />
            </div>
            <button
              className={
                player.paymentStatus === "Paid"
                  ? "btn mt-4 w-full"
                  : "btn-accent mt-4 w-full"
              }
            >
              <CreditCard className="h-4 w-4" />
              {player.paymentStatus === "Paid" ? "Renew or top-up" : "Collect balance"}
            </button>
          </div>

          <div className="card p-5">
            <div className="chip">Parent / guardian</div>
            <div className="mt-3 flex items-center gap-2 text-sm font-semibold">
              <UserRound className="h-4 w-4 text-muted" />
              {player.parentName}
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <a
                href={`mailto:${player.parentEmail}`}
                className="flex items-center gap-2 rounded-lg border border-white/5 bg-ink-200/40 p-2 hover:border-white/10"
              >
                <Mail className="h-3.5 w-3.5 text-muted" />
                <span className="truncate">{player.parentEmail}</span>
              </a>
              <a
                href={`tel:${player.parentPhone}`}
                className="flex items-center gap-2 rounded-lg border border-white/5 bg-ink-200/40 p-2 hover:border-white/10"
              >
                <Phone className="h-3.5 w-3.5 text-muted" />
                <span>{player.parentPhone}</span>
              </a>
            </div>
          </div>

          <div className="card p-5">
            <div className="chip">Timeline</div>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <CalendarDays className="h-4 w-4 text-muted" />
              Joined {player.joinedAt}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-black/40 px-4 py-3">
      <div className="h-display text-2xl font-semibold">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-muted">
        {label}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={accent ? "font-semibold text-red-300" : "font-semibold text-bone"}>
        {value}
      </span>
    </div>
  );
}
