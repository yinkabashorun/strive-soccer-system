"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { answerFriendRequest } from "@/lib/elite/tracker-actions";
import type { FriendRequestView } from "@/lib/elite/tracker-server";
import { FreeAvatar } from "./FreeAvatar";

// Friend requests waiting on this player, at the top of the Friends tab
// (072). A player who opened your link is not your friend until you tap
// Accept here; Decline takes the request away and they are not told.
// First name and last initial only, no photo, until accepted.
export function FriendRequests({ requests }: { requests: FriendRequestView[] }) {
  const router = useRouter();
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const left = requests.filter((r) => !gone.has(r.id));
  if (left.length === 0) return null;

  function answer(id: string, accept: boolean) {
    setError(null);
    start(async () => {
      const res = await answerFriendRequest(id, accept);
      if (!res.ok) return setError(res.error);
      setGone((g) => new Set([...g, id]));
      if (accept) router.refresh();
    });
  }

  return (
    <section aria-label="Friend requests" className="mx-[18px] mt-5 rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3">
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-accent">
        Friend {left.length === 1 ? "request" : "requests"}
      </h2>
      <ul className="mt-1 divide-y divide-white/[0.07]">
        {left.map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-2.5">
            <FreeAvatar photo={null} initials={r.initials} size={40} />
            <span className="min-w-0 flex-1 truncate text-[15px] text-bone">{r.name}</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => answer(r.id, false)}
              className="h-11 rounded-full border border-white/15 px-4 text-[14px] font-semibold text-white/70 disabled:opacity-60"
              aria-label={`Decline ${r.name}`}
            >
              Decline
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => answer(r.id, true)}
              className="h-11 rounded-full bg-bone px-4 text-[14px] font-semibold text-black disabled:opacity-60"
              aria-label={`Accept ${r.name}`}
            >
              Accept
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="pb-1 text-[13px] text-red-400">{error}</p>}
    </section>
  );
}
