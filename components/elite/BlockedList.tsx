"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { unblockPlayer } from "@/lib/elite/tracker-actions";

// The players this free account has blocked, each with Unblock. Taking a
// block back does not make them friends again: that takes their link.
export function BlockedList({ blocked }: { blocked: { id: string; name: string }[] }) {
  const router = useRouter();
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const rows = blocked.filter((b) => !gone.has(b.id));

  if (rows.length === 0) {
    return <p className="p-4 text-[15px] text-white/60">You have not blocked anyone.</p>;
  }
  return (
    <>
      {rows.map((b) => (
        <div key={b.id} className="flex min-h-[56px] items-center gap-3 p-4">
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-bone">{b.name}</span>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              start(async () => {
                setError(null);
                const res = await unblockPlayer(b.id);
                if (!res.ok) return setError(res.error);
                setGone((g) => new Set([...g, b.id]));
                router.refresh();
              })
            }
            className="h-11 rounded-xl border border-white/15 px-4 text-[14px] font-semibold text-bone disabled:opacity-60"
          >
            Unblock
          </button>
        </div>
      ))}
      {error && <p className="px-4 pb-4 text-sm text-red-400">{error}</p>}
    </>
  );
}
