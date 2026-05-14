"use client";

import { motion } from "framer-motion";
import {
  Crosshair,
  Flame,
  MessageSquare,
  Phone,
  Send,
  Snowflake,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import {
  BUCKET_META,
  buildBrief,
  dealValue,
  smsDeepLink,
  telDeepLink,
  venmoDeepLink,
  whatsAppDeepLink,
} from "@/lib/pipeline";
import { opportunities } from "@/lib/pipeline-data";
import type { BriefAction, OperatorBucket } from "@/lib/types";
import { cn } from "@/lib/utils";

const TODAY_DATE = new Date("2026-05-14T18:00:00Z").toLocaleDateString(
  "en-US",
  { weekday: "long", month: "long", day: "numeric" },
);

const BUCKET_ACCENT: Record<OperatorBucket, string> = {
  promised_uncollected: "text-accent",
  won_uncollected: "text-accent",
  signed_unpaid: "text-amber-300",
  needs_close: "text-orange-300",
  rescue_new: "text-red-300",
  stale_followup: "text-muted",
  cooling: "text-muted",
};

const BUCKET_ICON: Record<
  OperatorBucket,
  React.ComponentType<{ className?: string }>
> = {
  promised_uncollected: Wallet,
  won_uncollected: Wallet,
  signed_unpaid: Wallet,
  needs_close: Flame,
  rescue_new: Crosshair,
  stale_followup: Snowflake,
  cooling: Snowflake,
};

export function OperatorBrief() {
  const brief = buildBrief();
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const totalDollars = brief.reduce((s, a) => {
    const o = opportunities.find((x) => x.id === a.opportunityId);
    return s + (o ? dealValue(o) : 0);
  }, 0);

  const toggleDone = (id: string) =>
    setDoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const completed = doneIds.size;
  const pct = brief.length === 0 ? 0 : completed / brief.length;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="card relative overflow-hidden p-5"
    >
      <div className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-accent/15 blur-3xl" />

      <div className="relative">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="chip-accent">
              <Crosshair className="h-3 w-3" />
              Operator brief · {TODAY_DATE}
            </div>
            <h2 className="h-display mt-2 text-2xl font-semibold leading-tight">
              Today's hit list
            </h2>
            <p className="mt-1 text-xs text-muted">
              {brief.length} actions · potential{" "}
              <span className="text-accent">
                ${totalDollars.toLocaleString()}
              </span>{" "}
              if you close them all.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              {completed} / {brief.length} done
            </div>
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${Math.max(2, pct * 100)}%` }}
              />
            </div>
          </div>
        </div>

        <ol className="mt-5 space-y-2">
          {brief.map((a) => (
            <BriefRow
              key={a.id}
              action={a}
              done={doneIds.has(a.id)}
              onToggle={() => toggleDone(a.id)}
            />
          ))}
        </ol>

        {brief.length === 0 && (
          <div className="mt-5 rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-muted">
            Pipeline is clean. Go make new leads — content + ads.
          </div>
        )}

        <div className="mt-5 rounded-xl border border-white/5 bg-black/30 p-3 text-[11px] text-muted">
          <span className="text-bone">North star:</span> $47K summer · M4 in
          August · retire her in fall. Revenue first. Always.
        </div>
      </div>
    </motion.section>
  );
}

function BriefRow({
  action,
  done,
  onToggle,
}: {
  action: BriefAction;
  done: boolean;
  onToggle: () => void;
}) {
  const o = opportunities.find((x) => x.id === action.opportunityId);
  if (!o) return null;
  const Icon = BUCKET_ICON[action.bucket];
  const meta = BUCKET_META[action.bucket];
  const accent = BUCKET_ACCENT[action.bucket];
  const fn = o.contactName.split(/\s+/)[0];
  const amount = dealValue(o);
  const usesWhatsApp = (o.tags ?? []).includes("whatsapp");

  const phone = o.phone ?? "";
  const messageHref = phone
    ? usesWhatsApp
      ? whatsAppDeepLink(phone, action.script)
      : smsDeepLink(phone, action.script)
    : "#";
  const venmoUrl = venmoDeepLink(amount, `Strive · ${fn}'s spot`);

  return (
    <li
      className={cn(
        "group rounded-xl border border-white/5 bg-ink-200/40 p-3 transition-all",
        done && "opacity-50",
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          aria-label={done ? "Mark as not done" : "Mark as done"}
          className={cn(
            "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border text-[11px] font-semibold tabular-nums transition-all",
            done
              ? "border-accent/40 bg-accent/15 text-accent"
              : "border-white/10 bg-white/[0.03] text-muted hover:border-white/20 hover:text-bone",
          )}
        >
          {done ? "✓" : action.rank}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "chip text-[9px]",
                action.bucket === "promised_uncollected" && "chip-accent",
              )}
            >
              <Icon className={cn("h-2.5 w-2.5", accent)} />
              {meta.short}
            </span>
            <div
              className={cn(
                "truncate text-sm font-semibold",
                done && "line-through",
              )}
            >
              {action.headline}
            </div>
          </div>
          <div className="mt-1 text-[11px] text-muted">{action.reason}</div>
          <div className="mt-2 rounded-lg border border-white/5 bg-black/30 p-2 text-[11px] italic leading-relaxed text-bone/80">
            "{action.script}"
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {phone && (
              <a
                href={telDeepLink(phone)}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold text-bone hover:border-white/20"
              >
                <Phone className="h-2.5 w-2.5" />
                Call
              </a>
            )}
            {phone && (
              <a
                href={messageHref}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold text-bone hover:border-white/20"
              >
                {usesWhatsApp ? (
                  <Send className="h-2.5 w-2.5" />
                ) : (
                  <MessageSquare className="h-2.5 w-2.5" />
                )}
                {usesWhatsApp ? "WhatsApp" : "Text"}
              </a>
            )}
            <a
              href={venmoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/15 px-2 py-1 text-[10px] font-semibold text-accent hover:border-accent/60"
            >
              <Wallet className="h-2.5 w-2.5" />
              Venmo ${amount}
            </a>
          </div>
        </div>
      </div>
    </li>
  );
}
