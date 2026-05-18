import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, NotebookPen, UserRoundPlus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { CheckInList } from "@/components/CheckInList";
import {
  players as mockPlayers,
  todaySessions,
  upcomingSessions,
} from "@/lib/data";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Player, Session } from "@/lib/types";

export const revalidate = 0;
export const dynamic = "force-dynamic";

async function getSession(id: string): Promise<Session | null> {
  if (isSupabaseConfigured()) {
    try {
      const db = supabase();
      const { data, error } = await db
        .from("sessions")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as Session;
    } catch {
      // fall through
    }
  }
  return (
    [...todaySessions, ...upcomingSessions].find((s) => s.id === id) ?? null
  );
}

async function getRoster(ids: string[]): Promise<Player[]> {
  if (ids.length === 0) return [];
  if (isSupabaseConfigured()) {
    try {
      const db = supabase();
      const { data, error } = await db.from("players").select("*").in("id", ids);
      if (error) throw error;
      if (data && data.length > 0) return data as Player[];
    } catch {
      // fall through
    }
  }
  return ids
    .map((id) => mockPlayers.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p));
}

export default async function SessionDetail({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession(params.id);
  if (!session) return notFound();

  const roster = await getRoster(session.enrolled ?? []);
  const attendedSet = new Set(session.attended ?? []);

  return (
    <div>
      <Link
        href="/sessions"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-bone"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to sessions
      </Link>

      <PageHeader
        eyebrow={`${session.type} · ${session.date}`}
        title={session.title}
        subtitle={`${session.startTime} – ${session.endTime} · ${session.coach}`}
        actions={
          <>
            <button className="btn">
              <UserRoundPlus className="h-4 w-4" />
              Add player
            </button>
            <button className="btn-accent">
              <NotebookPen className="h-4 w-4" />
              Session notes
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="h-display text-lg font-semibold">Roster · check-in</h2>
            <div className="text-xs text-muted">
              {roster.length} / {session.capacity}
              {attendedSet.size > 0 && (
                <span className="ml-2 text-accent">
                  · {attendedSet.size} attended
                </span>
              )}
            </div>
          </div>
          <CheckInList players={roster} />
        </section>

        <section className="space-y-4">
          <div className="card p-5">
            <div className="chip">Logistics</div>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted" />
              {session.location}
            </div>
            <div className="divider my-3" />
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-muted">Coach</div>
                <div className="mt-0.5 font-medium text-bone">{session.coach}</div>
              </div>
              <div>
                <div className="text-muted">Capacity</div>
                <div className="mt-0.5 font-medium text-bone">
                  {session.enrolled?.length ?? 0} / {session.capacity}
                </div>
              </div>
              <div>
                <div className="text-muted">Type</div>
                <div className="mt-0.5 font-medium text-bone">{session.type}</div>
              </div>
              <div>
                <div className="text-muted">Date</div>
                <div className="mt-0.5 font-medium text-bone">{session.date}</div>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="chip">Focus block</div>
            <p className="mt-3 text-sm leading-relaxed text-bone/90">
              {session.notes ??
                "No focus set. Tap to add the day's coaching focus — moves, principles, themes."}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
