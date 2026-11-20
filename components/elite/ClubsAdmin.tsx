"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveClub, createClub, dismissClubReports, renameClub } from "@/lib/elite/tracker-actions";
import { CLUB_NAME_MAX, clubLink, type CoachClub, type ReportedClub } from "@/lib/elite/tracker";

// The Clubs card on /coach/free: reported club names first (rename,
// archive or no action), then make a club (the Dec 19 5v5 ones), and
// every club with its link, who joined, its captain, rename and archive.
// Archiving stops new joins; the roster and every friendship stay.
export function ClubsAdmin({
  clubs,
  reports,
  appUrl,
}: {
  clubs: CoachClub[];
  reports: ReportedClub[];
  appUrl: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function act(run: () => Promise<{ ok: true } | { ok: false; error: string }>, then?: () => void) {
    setError(null);
    start(async () => {
      const res = await run();
      if (!res.ok) return setError(res.error);
      then?.();
      router.refresh();
    });
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(clubLink(appUrl, code));
      setCopied(code);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      // nothing to copy to
    }
  }

  const renameRow = (id: string) =>
    renaming?.id === id ? (
      <div className="mt-3 flex gap-2">
        <input
          value={renaming.name}
          onChange={(e) => setRenaming({ id, name: e.target.value.slice(0, CLUB_NAME_MAX) })}
          maxLength={CLUB_NAME_MAX}
          aria-label="New club name"
          className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-[15px] text-bone focus:outline-none"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => act(() => renameClub(id, renaming.name), () => setRenaming(null))}
          className="btn-accent h-11 px-4"
        >
          Save
        </button>
      </div>
    ) : null;

  return (
    <section className="mt-8">
      <h2 className="font-display text-2xl font-black uppercase tracking-tight">Clubs</h2>
      <p className="mt-1 max-w-2xl text-sm text-white/60">
        Any free player can start a club and join up to three. Joining a club makes a player friends with everyone in
        it. Make the 5v5 clubs here and hand out each link.
      </p>

      {reports.length > 0 && (
        <div className="mt-4 rounded-2xl border border-red-400/40 p-4">
          <h3 className="text-sm font-semibold text-red-300">Reported club names</h3>
          <ul className="mt-2 space-y-3">
            {reports.map((r) => (
              <li key={r.club_id}>
                <div className="font-semibold text-bone">{r.name}</div>
                <div className="text-sm text-white/60">
                  {r.members} {r.members === 1 ? "player" : "players"}
                  {r.captain ? ` · captain ${r.captain}` : ""} · reported by {r.reports.map((x) => x.reporter).join(", ")}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setRenaming({ id: r.club_id, name: r.name })}
                    className="h-11 rounded-xl border border-white/15 px-4 text-sm font-semibold text-bone"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act(() => archiveClub(r.club_id))}
                    className="h-11 rounded-xl border border-white/15 px-4 text-sm font-semibold text-bone"
                  >
                    Archive
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act(() => dismissClubReports(r.club_id))}
                    className="h-11 rounded-xl border border-white/15 px-4 text-sm font-semibold text-bone"
                  >
                    No action
                  </button>
                </div>
                {renameRow(r.club_id)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form
        className="mt-4 flex max-w-xl gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          act(() => createClub(name), () => setName(""));
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, CLUB_NAME_MAX))}
          maxLength={CLUB_NAME_MAX}
          placeholder="Strive Elite 5v5: Team 7"
          aria-label="New club name"
          className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-[15px] text-bone placeholder:text-white/50 focus:outline-none"
        />
        <button type="submit" disabled={busy || !name.trim()} className="btn-accent h-11 px-4">
          Make a club
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      {clubs.length === 0 ? (
        <p className="mt-4 text-sm text-white/60">No clubs yet.</p>
      ) : (
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {clubs.map((c) => (
            <li key={c.id} className="elite-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-bone">{c.name}</div>
                  <div className="text-sm text-white/60">
                    {c.members.length} joined · {c.kind === "coach" ? "made by a coach" : `captain ${c.captain ?? "none"}`}
                    {c.ended ? " · archived" : ""}
                  </div>
                </div>
              </div>
              {c.members.length > 0 && (
                <p className="mt-2 text-sm leading-relaxed text-white/70">{c.members.join(", ")}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {!c.ended && (
                  <button
                    type="button"
                    onClick={() => copy(c.code)}
                    className="h-11 rounded-xl border border-white/15 px-4 text-sm font-semibold text-bone"
                  >
                    {copied === c.code ? "Link copied" : "Copy link"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setRenaming({ id: c.id, name: c.name })}
                  className="h-11 rounded-xl border border-white/15 px-4 text-sm font-semibold text-bone"
                >
                  Rename
                </button>
                {!c.ended && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act(() => archiveClub(c.id))}
                    className="h-11 rounded-xl border border-white/15 px-4 text-sm font-semibold text-bone"
                  >
                    Archive
                  </button>
                )}
              </div>
              {renameRow(c.id)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
