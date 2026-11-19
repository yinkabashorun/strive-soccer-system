"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ListOrdered, MoreHorizontal, Plus, X } from "lucide-react";
import {
  endMyClub,
  leaveClub,
  removeClubMember,
  renameMyClub,
  reportClub,
  startClub,
} from "@/lib/elite/tracker-actions";
import {
  CLUB_CAP_MESSAGE,
  CLUB_NAME_MAX,
  CLUBS_PER_PLAYER,
  clubLink,
  RANKING_MIN_MEMBERS,
  RANKING_TITLE,
  mayStartClub,
  type MyClub,
  type RankingRow,
} from "@/lib/elite/tracker";
import { fmtDuration } from "@/lib/elite/time-trained";
import { TrackerSheet } from "./TrackerSheet";
import { sendLink } from "./send-link";
import { usePostLauncher } from "./FreeShell";
import { StarMark } from "./StarMark";

type Sheet =
  | { kind: "club"; id: string }
  | { kind: "menu"; id: string }
  | { kind: "rename"; id: string }
  | { kind: "end"; id: string }
  | { kind: "report"; id: string }
  | { kind: "start" }
  | { kind: "started"; name: string; code: string }
  | { kind: "ranking" };

// Your clubs, on My week: each club a row with its name and how many are
// in it; a tap opens its roster with Send the club's link and Leave, and
// the captain's three (rename, take a member off, end the club). Start a
// club sits under them until the cap. Clubs are found by link only.
export function ClubsSection({ clubs, ranking, appUrl }: { clubs: MyClub[]; ranking: RankingRow[]; appUrl: string }) {
  const router = useRouter();
  const { profile } = usePostLauncher();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const club = sheet && "id" in sheet ? clubs.find((c) => c.id === sheet.id) ?? null : null;
  const canStart = mayStartClub(clubs.length);

  function open(next: Sheet | null) {
    setError(null);
    setCopied(false);
    setSheet(next);
  }

  function act(run: () => Promise<{ ok: true } | { ok: false; error: string }>, after: Sheet | null = null) {
    setError(null);
    start(async () => {
      const res = await run();
      if (!res.ok) return setError(res.error);
      open(after);
      router.refresh();
    });
  }

  async function share(code: string) {
    if ((await sendLink(clubLink(appUrl, code))) === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <section className="mx-[18px] mt-7">
      <h2 className="mb-1.5 text-[11px] font-bold uppercase tracking-[2.6px] text-white/60">Your clubs</h2>
      <ul>
        {clubs.map((c) => (
          <li key={c.id} className="border-b border-white/[0.09]">
            <button
              type="button"
              onClick={() => open({ kind: "club", id: c.id })}
              className="flex h-[56px] w-full items-center gap-3 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15.5px] font-semibold text-bone">{c.name}</span>
                <span className="block text-[12.5px] text-white/60">
                  {c.members.length} {c.members.length === 1 ? "player" : "players"}
                  {c.captain ? " · You're the captain" : ""}
                  {c.ended ? " · Ended" : ""}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-white/60" />
            </button>
          </li>
        ))}
      </ul>
      {ranking.length > 0 && (
        <button
          type="button"
          onClick={() => open({ kind: "ranking" })}
          className="flex h-[52px] w-full items-center gap-3 border-b border-white/[0.09] text-left"
        >
          <ListOrdered className="h-5 w-5 shrink-0 text-accent" />
          <span className="min-w-0 flex-1 text-[15px] font-semibold text-bone">{RANKING_TITLE}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/60" />
        </button>
      )}
      {canStart ? (
        <button
          type="button"
          onClick={() => {
            setName("");
            open({ kind: "start" });
          }}
          className="flex h-[52px] w-full items-center gap-2 text-[15px] font-semibold text-bone"
        >
          <Plus className="h-5 w-5" /> Start a club
        </button>
      ) : (
        <p className="py-3 text-[13px] text-white/60">{CLUB_CAP_MESSAGE}</p>
      )}

      {sheet?.kind === "start" && (
        <TrackerSheet title="Start a club" onClose={() => open(null)}>
          <p className="text-[15px] leading-relaxed text-white/70">
            Your club team, your school team, a tournament team. Everyone who joins with the link becomes friends,
            and you are the captain. You can be in {CLUBS_PER_PLAYER} clubs.
          </p>
          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-medium text-white/70">Club name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, CLUB_NAME_MAX))}
              maxLength={CLUB_NAME_MAX}
              placeholder="Bull Run 2010s"
              className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-[16px] text-bone placeholder:text-white/50 focus:border-accent/40 focus:outline-none"
            />
          </label>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={() =>
              start(async () => {
                setError(null);
                const res = await startClub(name);
                if (!res.ok) return setError(res.error);
                open({ kind: "started", name: name.trim(), code: res.code });
                router.refresh();
              })
            }
            className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl bg-bone font-display text-xl font-black uppercase tracking-wide text-black disabled:opacity-50"
          >
            Start the club
          </button>
        </TrackerSheet>
      )}

      {sheet?.kind === "ranking" && (
        <TrackerSheet title={RANKING_TITLE} onClose={() => open(null)}>
          <p className="text-[14px] leading-relaxed text-white/70">
            Clubs of {RANKING_MIN_MEMBERS} or more, by the average training a member logged this week. It starts again
            on Monday.
          </p>
          <ol className="mt-3">
            {ranking.map((r) => (
              <li key={r.id} className="flex min-h-[52px] items-center gap-3 border-b border-white/[0.09]">
                <span className="w-7 shrink-0 font-display text-[20px] font-black tabular-nums text-white/60">{r.place}</span>
                <span className={"min-w-0 flex-1 truncate text-[15px] font-semibold " + (r.mine ? "text-accent" : "text-bone")}>
                  {r.name}
                </span>
                <span className="shrink-0 text-right text-[13px] text-white/70">
                  <b className="font-display text-[20px] font-black tabular-nums text-bone">{fmtDuration(r.average)}</b>
                  <span className="block text-[11px]">a player</span>
                </span>
              </li>
            ))}
          </ol>
        </TrackerSheet>
      )}

      {sheet?.kind === "started" && (
        <TrackerSheet title={sheet.name} onClose={() => open(null)}>
          <p className="text-[15px] leading-relaxed text-white/70">
            Your club is ready. Send the link to your teammates; everyone who joins with it is in.
          </p>
          <button
            type="button"
            onClick={() => share(sheet.code)}
            className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl bg-bone font-display text-xl font-black uppercase tracking-wide text-black"
          >
            {copied ? "Link copied" : "Send the club's link"}
          </button>
        </TrackerSheet>
      )}

      {sheet?.kind === "club" && club && (
        <TrackerSheet title={club.name} onClose={() => open(null)}>
          {!club.captain && (
            <div className="-mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => open({ kind: "menu", id: club.id })}
                aria-label={`More for ${club.name}`}
                className="grid h-11 w-11 place-items-center text-white/60"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </div>
          )}
          <ul className="max-h-[42vh] divide-y divide-white/[0.08] overflow-y-auto">
            {club.members.map((m) => (
              <li key={m.id} className="flex min-h-[52px] items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    open(null);
                    profile(m.id);
                  }}
                  className="flex min-h-[48px] min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[15px] text-bone">
                    <span className="truncate">{m.you ? "You" : m.name}</span>
                    {m.starred && <StarMark size={13} />}
                  </span>
                  {m.captain && <span className="text-[12px] font-semibold uppercase tracking-[1.5px] text-accent">Captain</span>}
                </button>
                {club.captain && !m.you && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act(() => removeClubMember(club.id, m.id), { kind: "club", id: club.id })}
                    aria-label={`Take ${m.name} off ${club.name}`}
                    className="grid h-11 w-11 place-items-center text-white/60"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          <div className="mt-4 space-y-2.5">
            {!club.ended && (
              <button
                type="button"
                onClick={() => share(club.code)}
                className="flex h-14 w-full items-center justify-center rounded-2xl border border-white/15 text-[15px] font-semibold text-bone"
              >
                {copied ? "Link copied" : "Send the club's link"}
              </button>
            )}
            {club.captain && (
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setName(club.name);
                    open({ kind: "rename", id: club.id });
                  }}
                  className="flex h-14 items-center justify-center rounded-2xl border border-white/15 text-[15px] font-semibold text-bone"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => open({ kind: "end", id: club.id })}
                  className="flex h-14 items-center justify-center rounded-2xl border border-white/15 text-[15px] font-semibold text-bone"
                >
                  End the club
                </button>
              </div>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => act(() => leaveClub(club.id))}
              className="flex h-14 w-full items-center justify-center rounded-2xl border border-white/15 text-[15px] font-semibold text-bone disabled:opacity-60"
            >
              Leave the club
            </button>
            <p className="text-center text-[12px] text-white/60">
              Leaving keeps the friends you made. To cut one off, block them.
            </p>
          </div>
        </TrackerSheet>
      )}

      {sheet?.kind === "menu" && club && (
        <TrackerSheet title={club.name} onClose={() => open({ kind: "club", id: club.id })}>
          <button
            type="button"
            onClick={() => open({ kind: "report", id: club.id })}
            className="flex h-14 w-full items-center justify-center rounded-2xl border border-white/15 text-[15px] font-semibold text-bone"
          >
            Report this club
          </button>
        </TrackerSheet>
      )}

      {sheet?.kind === "report" && club && (
        <TrackerSheet title="Report this club?" onClose={() => open({ kind: "club", id: club.id })}>
          <p className="text-[15px] leading-relaxed text-white/70">
            For a name that should not be in the app. A coach looks at it and can rename or close the club. Nobody is
            told who reported it.
          </p>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={() => act(() => reportClub(club.id))}
            className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl border border-white/15 text-[15px] font-semibold text-bone disabled:opacity-60"
          >
            Report this club
          </button>
        </TrackerSheet>
      )}

      {sheet?.kind === "rename" && club && (
        <TrackerSheet title="Rename the club" onClose={() => open({ kind: "club", id: club.id })}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-white/70">Club name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, CLUB_NAME_MAX))}
              maxLength={CLUB_NAME_MAX}
              className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-[16px] text-bone focus:border-accent/40 focus:outline-none"
            />
          </label>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={() => act(() => renameMyClub(club.id, name), { kind: "club", id: club.id })}
            className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl bg-bone font-display text-xl font-black uppercase tracking-wide text-black disabled:opacity-50"
          >
            Save
          </button>
        </TrackerSheet>
      )}

      {sheet?.kind === "end" && club && (
        <TrackerSheet title="End the club?" onClose={() => open({ kind: "club", id: club.id })}>
          <p className="text-[15px] leading-relaxed text-white/70">
            Nobody new can join. The friends everyone made stay friends.
          </p>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={() => act(() => endMyClub(club.id))}
            className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl border border-white/15 text-[15px] font-semibold text-bone disabled:opacity-60"
          >
            End the club
          </button>
        </TrackerSheet>
      )}
    </section>
  );
}
