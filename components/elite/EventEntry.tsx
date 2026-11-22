"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enterEvent, withdrawEntry } from "@/lib/elite/club-teams-actions";
import type { EntryView } from "@/lib/elite/club-teams-server";
import { AppLink } from "./AppLink";
import { FreeAvatar } from "./FreeAvatar";
import { FreeTopBar } from "./FreeTopBar";

// Enter the event (the mock, screen 15). The captain picks up to the
// roster size from the club's members; anyone over the age limit, without
// a birth date on file, or already on another club's roster is shown but
// cannot be picked. Each player on it then says "I'm in" on their own card
// (accepting the event's waiver) before the entry goes to the coaches for
// payment. Nothing says a spot is held until it is paid.
export function EventEntry({ view }: { view: EntryView }) {
  const router = useRouter();
  const startPicked = new Set(view.entry?.roster.map((r) => r.id) ?? []);
  const [picked, setPicked] = useState<Set<string>>(startPicked);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const max = view.event.roster_max;

  function toggle(id: string) {
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else if (next.size < max) next.add(id);
      return next;
    });
  }

  function act(run: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    start(async () => {
      const res = await run().catch(() => ({ ok: false as const, error: "We could not reach the server. Try again in a minute." }));
      if (!res.ok) return setError(res.error);
      router.refresh();
    });
  }

  return (
    <div className="pb-8">
      <FreeTopBar back="/log/events" title={`Enter ${view.event.name}`} />
      <div className="px-[18px] pt-2">
        <h1 className="font-display text-[40px] font-black uppercase leading-[0.92]">{view.canEdit ? "Who's playing?" : view.club.name}</h1>
        <p className="mt-2 text-[14px] leading-snug text-white/70">
          {view.event.when} · {view.event.venue}. Up to {max} from {view.club.name}, all {view.event.max_age} and under.
        </p>
        {view.entry && (
          <p className={"mt-3 text-[15px] font-bold " + (view.entry.state === "paid" ? "text-accent" : "text-bone")}>{view.entry.line}</p>
        )}
        {view.entry?.paymentUrl && view.entry.state === "sent" && view.captain && (
          <AppLink
            href={view.entry.paymentUrl}
            title="Pay the entry"
            className="mt-3 flex h-12 items-center justify-center rounded-xl bg-bone text-[15px] font-bold text-black"
          >
            Pay {view.event.price_text}
          </AppLink>
        )}
      </div>

      {view.canEdit ? (
        <>
          <div className="mt-5 flex items-center justify-between px-[18px] text-[13px] text-white/70">
            <span>
              <b className="text-bone">{picked.size}</b> of {max} picked
            </span>
            <span>All {view.event.max_age} and under</span>
          </div>
          <ul className="mt-1">
            {view.members.map((m) => {
              const on = picked.has(m.id);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    disabled={Boolean(m.blocked)}
                    onClick={() => toggle(m.id)}
                    className="flex min-h-[64px] w-full items-center gap-3 px-[18px] text-left disabled:opacity-50"
                  >
                    <FreeAvatar photo={m.photo} initials={m.initials} size={42} you={m.you} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15.5px] font-semibold">{m.you ? "You" : m.name}</span>
                      <span className="block text-[12.5px] text-white/60">{m.blocked ?? (m.captain ? "Captain" : "Member")}</span>
                    </span>
                    <span
                      aria-hidden
                      className={"grid h-7 w-7 place-items-center rounded-lg border-2 " + (on ? "border-bone bg-bone text-black" : "border-white/30")}
                    >
                      {on && (
                        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="px-[18px] pt-4">
            <p className="text-[13px] leading-snug text-white/60">
              Each player says they&apos;re in on their own phone and accepts the event&apos;s waiver. Then you get the payment link.
            </p>
            {error && <p className="mt-2 text-[14px] text-red-400">{error}</p>}
            <button
              type="button"
              disabled={busy || picked.size === 0}
              onClick={() => act(() => enterEvent(view.event.id, view.club.id, [...picked]))}
              className="mt-3 flex h-[60px] w-full items-center justify-center rounded-[20px] bg-bone font-display text-[24px] font-black uppercase tracking-[0.5px] text-black disabled:opacity-50"
            >
              {view.entry ? "Save the roster" : `Enter ${view.club.name}`}
            </button>
            {view.entry && view.entry.state !== "paid" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => act(() => withdrawEntry(view.event.id, view.club.id))}
                className="mx-auto mt-1 flex min-h-[44px] items-center px-3 text-[14px] font-semibold text-white/70 underline underline-offset-4"
              >
                Take the club out
              </button>
            )}
          </div>
        </>
      ) : view.entry ? (
        <ul className="mt-4">
          {view.entry.roster.map((r) => (
            <li key={r.id} className="flex h-[52px] items-center justify-between border-b border-white/[0.08] px-[18px] text-[15px]">
              <span>{r.name}</span>
              <span className={r.in ? "text-accent" : "text-white/60"}>{r.in ? "In" : "Not answered"}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-[18px] pt-4 text-[14px] text-white/60">Your captain enters the club.</p>
      )}
    </div>
  );
}
