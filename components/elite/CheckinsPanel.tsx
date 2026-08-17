"use client";

import { useState, useTransition } from "react";
import { Loader2, MessageCircleReply } from "lucide-react";
import type { Checkin } from "@/lib/elite/types";
import { addCheckinFeedback } from "@/lib/elite/coach-actions";
import { timeAgo } from "@/lib/utils";

// Coach view of a player's weekly check-ins, with a reply box on any
// check-in that hasn't been answered yet.
export function CheckinsPanel({
  playerId,
  checkins,
}: {
  playerId: string;
  checkins: Checkin[];
}) {
  if (checkins.length === 0) {
    return (
      <div className="elite-card p-6 text-center text-sm text-white/40">
        No check-ins yet. They&apos;ll appear here when your player submits their
        weekly reflection.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {checkins.map((c) => (
        <CheckinRow key={c.id} playerId={playerId} checkin={c} />
      ))}
    </div>
  );
}

function CheckinRow({
  playerId,
  checkin,
}: {
  playerId: string;
  checkin: Checkin;
}) {
  const [feedback, setFeedback] = useState(checkin.coach_feedback);
  const [sent, setSent] = useState(Boolean(checkin.coach_feedback));
  const [pending, start] = useTransition();

  function reply() {
    const body = feedback.trim();
    if (!body) return;
    start(async () => {
      await addCheckinFeedback(checkin.id, playerId, body);
      setSent(true);
    });
  }

  return (
    <div className="elite-card p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-bone">Week {checkin.week}</div>
        <div className="flex items-center gap-3 text-xs text-white/40">
          {checkin.rating ? <span>Week {checkin.rating}/5</span> : null}
          {checkin.energy ? <span>Energy {checkin.energy}/5</span> : null}
          <span>{timeAgo(checkin.created_at)}</span>
        </div>
      </div>

      <div className="mt-3 space-y-2 text-sm">
        {checkin.went_well && (
          <Line label="Went well" value={checkin.went_well} />
        )}
        {checkin.struggled && (
          <Line label="Struggled" value={checkin.struggled} />
        )}
        {checkin.note && <Line label="Note" value={checkin.note} />}
      </div>

      {sent ? (
        <div className="mt-3 rounded-xl border border-accent/20 bg-accent/[0.05] p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
            Your reply
          </div>
          <p className="mt-1 text-sm text-white/75">{feedback}</p>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <input
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && reply()}
            placeholder="Reply to this check-in…"
            className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-bone placeholder:text-white/25 focus:border-accent/40 focus:outline-none"
          />
          <button
            onClick={reply}
            disabled={pending || !feedback.trim()}
            className="btn px-3 py-2"
            aria-label="Reply"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageCircleReply className="h-4 w-4" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
        {label}:{" "}
      </span>
      <span className="text-white/75">{value}</span>
    </div>
  );
}
