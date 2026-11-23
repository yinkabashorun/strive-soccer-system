"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { answerGame, answerScore, cancelPlan, enterScore, reportPlan, setImIn } from "@/lib/elite/club-teams-actions";
import {
  CONFIRM_HOURS,
  NEEDS_ORGANIZER_OK,
  NEEDS_PLAYER_OK,
  PLAN_REPORT_REASONS,
  inCountLine,
  organizedBy,
  recordLabel,
} from "@/lib/elite/club-teams";
import type { PlanCard } from "@/lib/elite/club-teams-server";
import type { CountyRow } from "@/lib/elite/club-teams";
import { fmtDuration } from "@/lib/elite/time-trained";
import { FREE_WEEK } from "@/lib/elite/tracker";
import { ActionSheet } from "./ActionSheet";
import { Crest } from "./FreeAvatar";
import { FreeTopBar } from "./FreeTopBar";
import { IconBlock, IconCheck, IconFlag, IconMore } from "./FreeIcons";
import { PlayTermsSheet } from "./PlayTermsSheet";

type Sheet = null | "menu" | "report" | "sent" | "cancel" | "score" | "player" | "organizer";

// One session or game (the mock, screen 18): what it is, the score once a
// captain entered it and where it stands, when and where, "Organized by"
// the club, who is in (names only from your own club), and for a game the
// county ranking. Captains answer, cancel and enter the score here; anyone
// who can see it can report it.
export function PlanDetail({ card, countyName, ranking }: { card: PlanCard; countyName: string | null; ranking: CountyRow[] }) {
  const router = useRouter();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [mine, setMine] = useState("");
  const [theirs, setTheirs] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [after, setAfter] = useState<(() => void) | null>(null);

  function act(run: () => Promise<{ ok: true } | { ok: false; error: string }>, done?: () => void) {
    setError(null);
    start(async () => {
      const res = await run().catch(() => ({ ok: false as const, error: "We could not reach the server. Try again in a minute." }));
      if (!res.ok) {
        if (res.error === NEEDS_PLAYER_OK || res.error === NEEDS_ORGANIZER_OK) {
          setAfter(() => () => act(run, done));
          return setSheet(res.error === NEEDS_PLAYER_OK ? "player" : "organizer");
        }
        return setError(res.error);
      }
      done?.();
      router.refresh();
    });
  }

  const score = card.result?.score ?? null;
  const title = card.kind === "training" ? card.title ?? "Club training" : "Club game";

  return (
    <div className="pb-6">
      <FreeTopBar
        back={FREE_WEEK}
        title={card.kind === "training" ? "Club training" : "Club game"}
        right={
          <button type="button" aria-label="More" onClick={() => setSheet("menu")} className="grid h-11 w-11 place-items-center text-bone">
            <IconMore />
          </button>
        }
      />

      <p className="pt-3 text-center text-[11px] font-bold uppercase tracking-[2.4px] text-white/60">
        {card.result?.state === "confirmed" ? "Final · " : ""}
        {card.when}
      </p>

      {card.kind === "game" && card.opponent ? (
        <div className="mt-4 flex items-center justify-center gap-3 px-[18px]">
          <Side club={card.organizer} />
          <div className="flex min-w-[96px] items-center justify-center gap-2 font-display text-[56px] font-black leading-none">
            {score ? (
              <>
                <span className={score[0] >= score[1] ? "text-accent" : ""}>{score[0]}</span>
                <span className="text-[30px] text-white/50">-</span>
                <span className={score[1] >= score[0] ? "text-accent" : ""}>{score[1]}</span>
              </>
            ) : (
              <span className="text-[28px] text-white/60">VS</span>
            )}
          </div>
          <Side club={card.opponent} />
        </div>
      ) : (
        <h1 className="mt-3 px-[18px] text-center font-display text-[40px] font-black uppercase leading-[0.92]">{title}</h1>
      )}

      {card.result?.line && <p className="mt-3 px-8 text-center text-[13.5px] text-accent">{card.result.line}</p>}

      <div className="mx-[18px] mt-5 rounded-[20px] bg-[#141414] px-4 py-3.5 text-[14.5px]">
        <div>
          {card.when} · {fmtDuration(card.minutes)}
        </div>
        <div className="mt-1 text-white/70">{card.place}</div>
        <div className="mt-1 text-[13px] text-white/60">{organizedBy(card.organizer.name)}, not by Strive.</div>
        {card.status === "pending" && <div className="mt-1 text-[13px] text-white/60">Waiting on the other captain to accept.</div>}
        {card.status === "cancelled" && <div className="mt-1 text-[13px] text-red-400">Called off.</div>}
        {card.status === "passed" && <div className="mt-1 text-[13px] text-white/60">The other club passed.</div>}
      </div>

      {card.canAnswer && (
        <div className="mx-[18px] mt-3 flex gap-2">
          <button type="button" disabled={busy} onClick={() => act(() => answerGame(card.id, false))} className="h-12 flex-1 rounded-xl border border-white/15 text-[15px] font-bold text-white/80">
            Pass
          </button>
          <button type="button" disabled={busy} onClick={() => act(() => answerGame(card.id, true))} className="h-12 flex-1 rounded-xl bg-bone text-[15px] font-bold text-black">
            Accept
          </button>
        </div>
      )}

      {card.result?.canEnter && (
        <button type="button" onClick={() => setSheet("score")} className="mx-[18px] mt-3 flex h-12 w-[calc(100%-36px)] items-center justify-center rounded-xl bg-bone text-[15px] font-bold text-black">
          Enter the score
        </button>
      )}
      {card.result?.canAnswer && (
        <div className="mx-[18px] mt-3 flex gap-2">
          <button type="button" disabled={busy} onClick={() => act(() => answerScore(card.id, false))} className="h-12 flex-1 rounded-xl border border-white/15 text-[15px] font-bold text-white/80">
            Not right
          </button>
          <button type="button" disabled={busy} onClick={() => act(() => answerScore(card.id, true))} className="h-12 flex-1 rounded-xl bg-bone text-[15px] font-bold text-black">
            Confirm
          </button>
        </div>
      )}

      {card.status === "on" && (
        <section className="mx-[18px] mt-5">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-[#222] px-3 text-[13.5px] font-bold">
              <IconCheck size={15} />
              {inCountLine(card.ins)}
            </span>
            {card.canJoin && (
              <button
                type="button"
                disabled={busy}
                aria-pressed={card.imIn}
                onClick={() => act(() => setImIn(card.id, !card.imIn))}
                className={"ml-auto h-11 rounded-xl px-5 text-[14.5px] font-bold " + (card.imIn ? "border border-white/20" : "bg-bone text-black")}
              >
                {card.imIn ? "You're in" : "I'm in"}
              </button>
            )}
          </div>
          {card.names.length > 0 && <p className="mt-2 text-[13.5px] leading-snug text-white/70">{card.names.join(", ")}</p>}
        </section>
      )}
      {error && <p className="mx-[18px] mt-2 text-[14px] text-red-400">{error}</p>}

      {card.kind === "game" && ranking.length > 0 && (
        <section className="mt-6">
          <h2 className="px-[18px] pb-2 text-[11px] font-bold uppercase tracking-[2.4px] text-white/60">{countyName ? `${countyName}, by wins` : "By wins"}</h2>
          <ol>
            {ranking.map((r) => (
              <li key={r.id} className="flex h-[62px] items-center gap-3 border-b border-white/[0.08] px-[18px]">
                <span className="w-5 font-display text-[20px] font-black text-white/60">{r.place}</span>
                <Crest club={r} size={38} />
                <span className="min-w-0">
                  <span className={"block truncate text-[15px] font-semibold " + (r.mine ? "text-accent" : "")}>{r.name}</span>
                  <span className="block text-[12px] text-white/60">
                    {r.members} players{r.mine ? ". Your club" : ""}
                  </span>
                </span>
                <span className="ml-auto font-display text-[22px] font-black">{recordLabel(r.record)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {sheet === "menu" && (
        <ActionSheet
          label="More"
          onClose={() => setSheet(null)}
          rows={[
            ...(card.canCancel ? [{ label: card.kind === "game" ? "Call off the game" : "Call off the session", icon: <IconBlock />, red: true, onClick: () => setSheet("cancel") }] : []),
            { label: card.kind === "game" ? "Report this game" : "Report this session", icon: <IconFlag />, red: true, onClick: () => { setReason(null); setSheet("report"); } },
          ]}
        />
      )}

      {sheet === "cancel" && (
        <ActionSheet
          label="Call it off"
          title="Call it off?"
          onClose={() => setSheet(null)}
          rows={[{ label: "Call it off", icon: <IconBlock />, red: true, disabled: busy, onClick: () => act(() => cancelPlan(card.id), () => setSheet(null)) }]}
          note="Everyone who can see it sees it called off."
        />
      )}

      {sheet === "report" && (
        <ActionSheet
          label="Report"
          title="What is wrong with it?"
          onClose={() => setSheet(null)}
          rows={PLAN_REPORT_REASONS.map((r) => ({ label: r.label, checked: reason === r.id, onClick: () => setReason(r.id) }))}
          note="A coach looks at it. Nobody is told who reported it."
        >
          <div className="px-4 pt-2">
            <button
              type="button"
              disabled={busy || !reason}
              onClick={() => reason && act(() => reportPlan(card.id, reason), () => setSheet("sent"))}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-bone text-[15px] font-bold text-black disabled:opacity-40"
            >
              Send the report
            </button>
          </div>
        </ActionSheet>
      )}

      {sheet === "sent" && <ActionSheet label="Sent" title="Sent to the coaches. Thank you." onClose={() => setSheet(null)} rows={[{ label: "Done", onClick: () => setSheet(null) }]} />}

      {sheet === "score" && card.opponent && (
        <ActionSheet label="Enter the score" title="Enter the score" onClose={() => setSheet(null)}>
          <div className="px-[22px] pb-2">
            <div className="flex items-center gap-3">
              <ScoreBox label={card.organizer.name} value={mine} onChange={setMine} />
              <span className="pt-5 font-display text-[24px] text-white/60">-</span>
              <ScoreBox label={card.opponent.name} value={theirs} onChange={setTheirs} />
            </div>
            <p className="mt-3 text-[13px] text-white/60">The other captain confirms it. If they do not answer in {CONFIRM_HOURS} hours, it counts.</p>
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            <button
              type="button"
              disabled={busy || mine === "" || theirs === ""}
              onClick={() => act(() => enterScore(card.id, mine, theirs), () => setSheet(null))}
              className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-bone text-[15px] font-bold text-black disabled:opacity-50"
            >
              Save the score
            </button>
          </div>
        </ActionSheet>
      )}

      {(sheet === "player" || sheet === "organizer") && (
        <PlayTermsSheet
          kind={sheet}
          onClose={() => setSheet(null)}
          then={() => {
            setSheet(null);
            after?.();
          }}
        />
      )}
    </div>
  );
}

function Side({ club }: { club: { id: string; name: string } }) {
  return (
    <div className="flex w-[110px] flex-col items-center text-center">
      <Crest club={club} size={72} />
      <span className="mt-2 line-clamp-2 text-[14px] font-bold leading-tight">{club.name}</span>
    </div>
  );
}

function ScoreBox({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex-1">
      <span className="block truncate text-[12.5px] text-white/70">{label}</span>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 2))}
        className="mt-1 h-14 w-full rounded-xl border border-white/10 bg-black text-center font-display text-[30px] font-black text-bone focus:border-white/30 focus:outline-none"
      />
    </label>
  );
}
