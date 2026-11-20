"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { answerClubRequest, answerFriendRequest } from "@/lib/elite/tracker-actions";
import type { ClubRequestView, FriendRequestView } from "@/lib/elite/tracker-server";
import { FreeAvatar } from "./FreeAvatar";

// Requests waiting on this player, at the top of the Friends tab. A player
// who opened your link is not your friend until you tap Accept (072), and
// a player asking into a club you captain is not on it until you tap Let in
// (073). Declining takes the request away and they are not told. First
// name and last initial only, no photo, until accepted.
type Row =
  | { kind: "friend"; key: string; id: string; name: string; initials: string }
  | { kind: "club"; key: string; id: string; clubId: string; club: string; name: string; initials: string };

export function FriendRequests({
  requests,
  clubRequests = [],
}: {
  requests: FriendRequestView[];
  clubRequests?: ClubRequestView[];
}) {
  const router = useRouter();
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const rows: Row[] = [
    ...requests.map((r) => ({ kind: "friend" as const, key: `f:${r.id}`, ...r })),
    ...clubRequests.map((r) => ({ kind: "club" as const, key: `c:${r.clubId}:${r.id}`, ...r })),
  ].filter((r) => !gone.has(r.key));
  if (rows.length === 0) return null;

  function answer(row: Row, accept: boolean) {
    setError(null);
    start(async () => {
      const res =
        row.kind === "friend" ? await answerFriendRequest(row.id, accept) : await answerClubRequest(row.clubId, row.id, accept);
      if (!res.ok) return setError(res.error);
      setGone((g) => new Set([...g, row.key]));
      if (accept) router.refresh();
    });
  }

  return (
    <section aria-label="Requests" className="mx-[18px] mt-5 rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3">
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-accent">
        {rows.length === 1 ? "Request" : "Requests"}
      </h2>
      <ul className="mt-1 divide-y divide-white/[0.07]">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-3 py-2.5">
            <FreeAvatar photo={null} initials={r.initials} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] text-bone">{r.name}</span>
              <span className="block truncate text-[12px] text-white/60">
                {r.kind === "friend" ? "Wants to be friends" : `Wants to join ${r.club}`}
              </span>
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => answer(r, false)}
              className="h-11 rounded-full border border-white/15 px-4 text-[14px] font-semibold text-white/70 disabled:opacity-60"
              aria-label={`Decline ${r.name}`}
            >
              Decline
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => answer(r, true)}
              className="h-11 rounded-full bg-bone px-4 text-[14px] font-semibold text-black disabled:opacity-60"
              aria-label={`${r.kind === "friend" ? "Accept" : "Let in"} ${r.name}`}
            >
              {r.kind === "friend" ? "Accept" : "Let in"}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="pb-1 text-[13px] text-red-400">{error}</p>}
    </section>
  );
}
