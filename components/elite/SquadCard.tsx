"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { SQUAD_PAID_START, SQUAD_SEND, SQUAD_START, runningLine, type Squad } from "@/lib/elite/squad-pass";
import { startMyPass } from "@/lib/elite/squad-pass-actions";
import { sendLink } from "./send-link";

// Bring your squad (lib/elite/squad-pass.ts): the three places toward a
// month of Strive Pro, where "Send my link" has always been. A place turns
// gold when that teammate has posted their first training. An earned month
// is started from here, with no card.
export function SquadCard({ squad, inviteLink }: { squad: Squad; inviteLink: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const send = async () => {
    if ((await sendLink(inviteLink)) === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };
  const begin = () =>
    start(async () => {
      setError(null);
      const res = await startMyPass();
      if (!res.ok) setError(res.error);
      // a free player's month starts and they are sent to their week; a
      // player who pays stays here, where the card says their next month is free
      else if (squad.start === SQUAD_PAID_START) router.refresh();
      else router.push("/");
    });

  return (
    <section className="m-card mt-5 px-5 py-5 text-left" aria-label={squad.title}>
      <h3 className="m-head text-[22px] leading-[1.08]">{squad.title}</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-white/65">{squad.body}</p>

      {squad.ready === 0 && squad.canEarnMore ? (
        <>
          <ul className="mt-4 grid grid-cols-3 gap-2">
            {squad.slots.map((s, i) => (
              <li
                key={i}
                className={
                  s.state === "trained"
                    ? "flex h-[68px] flex-col items-center justify-center rounded-2xl border border-[#c8a858]/60 bg-[#c8a858]/10 px-2"
                    : "flex h-[68px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 px-2"
                }
              >
                {s.state === "trained" ? <Check className="h-4 w-4 text-[#c8a858]" aria-hidden /> : null}
                <span className={s.state === "open" ? "text-[12px] text-white/60" : "mt-0.5 max-w-full truncate text-[13px] font-semibold text-bone"}>
                  {s.state === "open" ? "Open" : s.name}
                </span>
                {s.state === "joined" ? <span className="text-[11px] text-white/50">joined</span> : null}
              </li>
            ))}
          </ul>
          {squad.waiting ? <p className="mt-3 text-[13px] leading-relaxed text-white/60">{squad.waiting}</p> : null}
        </>
      ) : null}

      {squad.runningUntil ? <p className="mt-3 text-[13px] text-white/60">{runningLine(squad.runningUntil)}</p> : null}
      {squad.note ? <p className="mt-3 text-[13px] text-white">{squad.note}</p> : null}
      {error ? <p className="mt-3 text-[13px] text-white">{error}</p> : null}

      <div className="mt-4 flex flex-col gap-2">
        {squad.ready > 0 ? (
          <button type="button" onClick={begin} disabled={busy} className="inline-flex h-12 items-center justify-center rounded-2xl bg-bone px-6 text-[15px] font-semibold text-black disabled:opacity-60">
            {squad.start ?? SQUAD_START}
          </button>
        ) : null}
        {squad.canEarnMore ? (
          <button
            type="button"
            onClick={send}
            className={
              squad.ready > 0
                ? "inline-flex h-12 items-center justify-center rounded-2xl border border-white/20 px-6 text-[15px] font-semibold text-bone"
                : "inline-flex h-12 items-center justify-center rounded-2xl bg-bone px-6 text-[15px] font-semibold text-black"
            }
          >
            {copied ? "Link copied" : SQUAD_SEND}
          </button>
        ) : null}
      </div>
    </section>
  );
}
