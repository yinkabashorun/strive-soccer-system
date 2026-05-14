import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { PageHeader } from "@/components/PageHeader";
import { players, upcomingSessions } from "@/lib/data";
import {
  ArrowUpRight,
  CalendarDays,
  CreditCard,
  ExternalLink,
  Flame,
  GraduationCap,
  MessageSquare,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const COURSE_URL = process.env.NEXT_PUBLIC_COURSE_URL || "#";

export default function PortalPage({
  searchParams,
}: {
  searchParams?: { player?: string };
}) {
  const player =
    players.find((p) => p.id === searchParams?.player) ?? players[0];
  const nextSession = upcomingSessions[0];
  const pct =
    player.sessionsTotal > 0
      ? Math.round(
          ((player.sessionsTotal - player.sessionsRemaining) /
            player.sessionsTotal) *
            100
        )
      : 0;

  return (
    <div>
      <PageHeader
        eyebrow={`Player Portal · ${player.parentName}`}
        title={`Welcome back, ${player.name.split(" ")[0]}.`}
        subtitle="Everything you need — schedule, sessions, payments, progress, and the course. One place. One brand."
        actions={
          <>
            <button className="btn">
              <MessageSquare className="h-4 w-4" />
              Message coach
            </button>
            <Link href="/players" className="btn-ghost text-xs">
              Switch player →
            </Link>
          </>
        }
      />

      {/* Hero player card */}
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
                <ShieldCheck className="h-3 w-3" /> {player.level} · Strive
                Movement
              </div>
              <h2 className="h-display mt-2 text-4xl font-semibold leading-tight md:text-5xl">
                {player.name}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Age {player.age} · {player.coach} · {player.package} package
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <HeroStat
              value={`${player.sessionsRemaining}`}
              label="Sessions left"
            />
            <HeroStat value={`${pct}%`} label="Package used" />
            <HeroStat value="7" label="Day streak" icon={<Flame className="h-3.5 w-3.5" />} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Next session */}
        <section className="card relative overflow-hidden p-6 lg:col-span-2">
          <div className="absolute -left-16 -top-16 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative">
            <div className="chip">Next up</div>
            <h3 className="h-display mt-2 text-2xl font-semibold">
              {nextSession.title}
            </h3>
            <div className="mt-1 text-sm text-muted">
              {nextSession.date} · {nextSession.startTime} – {nextSession.endTime}
            </div>
            <div className="mt-1 text-xs text-muted">{nextSession.location}</div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button className="btn-accent">
                <CalendarDays className="h-4 w-4" />
                Add to calendar
              </button>
              <button className="btn">
                <MessageSquare className="h-4 w-4" />
                Notify coach I'll miss it
              </button>
            </div>
          </div>
        </section>

        {/* Payment status */}
        <section
          className={
            player.paymentStatus === "Paid"
              ? "card p-6"
              : "card border-red-500/20 bg-red-500/[0.04] p-6"
          }
        >
          <div className="chip">Account</div>
          <h3 className="h-display mt-2 text-xl font-semibold">
            {player.paymentStatus === "Paid"
              ? "All good — paid in full."
              : "Action needed"}
          </h3>
          <p className="mt-1 text-xs text-muted">
            {player.paymentStatus === "Paid"
              ? "Your package is active. Train hard."
              : "Settle the package to keep training without interruption."}
          </p>

          <div className="mt-4 space-y-2 text-xs">
            <Row label="Package" value={player.package} />
            <Row label="Sessions" value={`${player.sessionsRemaining} / ${player.sessionsTotal}`} />
            <Row
              label="Status"
              value={player.paymentStatus}
              accent={player.paymentStatus !== "Paid"}
            />
          </div>

          <button
            className={
              player.paymentStatus === "Paid" ? "btn mt-4 w-full" : "btn-accent mt-4 w-full"
            }
          >
            <CreditCard className="h-4 w-4" />
            {player.paymentStatus === "Paid"
              ? "Renew or top-up"
              : "Pay outstanding balance"}
          </button>
        </section>

        {/* Progress notes */}
        <section className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="chip">Coach notes</div>
            <span className="text-[11px] text-muted">From {player.coach}</span>
          </div>
          <h3 className="h-display mt-2 text-xl font-semibold">
            Your progress, your edge.
          </h3>
          <div className="mt-4 space-y-2">
            {player.progressNotes.map((n, i) => (
              <div
                key={i}
                className="flex gap-3 rounded-xl border border-white/5 bg-ink-200/40 p-3"
              >
                <Sparkles className="h-4 w-4 shrink-0 text-accent" />
                <p className="text-sm text-bone/90">{n}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Course launch */}
        <section className="card relative overflow-hidden p-6">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative">
            <div className="chip-accent">$67 · Included add-on</div>
            <h3 className="h-display mt-2 text-xl font-semibold">
              Ball Mastery Method
            </h3>
            <p className="mt-1 text-xs text-muted">
              30 days. 5 minutes a day. Train at home between sessions.
            </p>
            <a
              href={COURSE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-accent mt-4 w-full"
            >
              <GraduationCap className="h-4 w-4" />
              Open course
              <ArrowUpRight className="ml-auto h-4 w-4" />
            </a>
            <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted">
              <ExternalLink className="h-3 w-3" />
              Opens in a new tab
            </div>
          </div>
        </section>
      </div>

      {/* Movement footer */}
      <section className="mt-8 overflow-hidden rounded-3xl border border-white/5 bg-black p-8 text-center">
        <div className="chip-accent inline-flex">The Strive Movement</div>
        <h3 className="h-display mt-3 text-3xl font-semibold leading-tight md:text-4xl">
          You're not signed up for soccer training. <br />
          <span className="text-accent">You're part of a movement.</span>
        </h3>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted">
          Creativity. Composure. Intelligence. Slow the game down. Master the
          basics. Become unrecognizable.
        </p>
      </section>
    </div>
  );
}

function HeroStat({
  value,
  label,
  icon,
}: {
  value: string;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-black/40 px-4 py-3">
      <div className="h-display flex items-center justify-center gap-1.5 text-2xl font-semibold">
        {icon && <span className="text-accent">{icon}</span>}
        {value}
      </div>
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
