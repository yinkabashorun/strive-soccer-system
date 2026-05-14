"use client";

import { motion } from "framer-motion";
import { Clock, MessageSquare, Phone, Send, Wallet } from "lucide-react";
import { useState } from "react";
import {
  dealValue,
  daysSince,
  smsDeepLink,
  telDeepLink,
  venmoDeepLink,
  whatsAppDeepLink,
} from "@/lib/pipeline";
import type { Opportunity, OperatorBucket } from "@/lib/types";
import { Avatar } from "./Avatar";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";

const BUCKET_BORDER: Record<OperatorBucket, string> = {
  promised_uncollected: "border-accent/30 bg-accent/[0.04]",
  won_uncollected: "border-accent/20 bg-accent/[0.02]",
  signed_unpaid: "border-amber-400/20 bg-amber-400/[0.02]",
  needs_close: "border-orange-400/20 bg-orange-400/[0.02]",
  rescue_new: "border-red-500/30 bg-red-500/[0.04]",
  stale_followup: "border-white/5",
  cooling: "border-white/5",
};

const SCRIPT_BY_BUCKET: Record<OperatorBucket, (o: Opportunity) => string> = {
  promised_uncollected: (o) =>
    `Hey ${first(o)} — locking your spot for May 20. Venmo $${dealValue(o)} to @Yinka-bash now and you're in. Spots cap at 6.`,
  won_uncollected: (o) =>
    `${first(o)}, sending Venmo request for $${dealValue(o)} to confirm. First session Tuesday — see you there.`,
  signed_unpaid: (o) =>
    `${first(o)} — confirming your spot for Tuesday. Venmo @Yinka-bash · $${dealValue(o)}. Reply DONE when sent.`,
  needs_close: (o) =>
    `${first(o)}, spots cap at 6, we're at 4. Want me to lock yours? $${dealValue(o)} on Venmo holds it through summer.`,
  rescue_new: (o) =>
    `Hey ${first(o)}, this is Yinka from Strive Soccer — saw you reached out. Got 30 seconds?`,
  stale_followup: (o) =>
    `${first(o)} — last check before I close out your spot. In or out for May 20?`,
  cooling: (o) =>
    `${first(o)}, sessions start May 20. Want me to walk you through the Development Pack ($319 / 10 sessions)?`,
};

const first = (o: Opportunity) => o.contactName.split(/\s+/)[0];

export function PipelineLeadCard({
  opportunity,
  bucket,
  index = 0,
}: {
  opportunity: Opportunity;
  bucket: OperatorBucket;
  index?: number;
}) {
  const o = opportunity;
  const days = daysSince(o.updatedAt);
  const stageDays = daysSince(o.updatedAt);
  const amount = dealValue(o);
  const usesWhatsApp = (o.tags ?? []).includes("whatsapp");
  const script = SCRIPT_BY_BUCKET[bucket](o);

  const phone = o.phone ?? "";
  const messageHref = phone
    ? usesWhatsApp
      ? whatsAppDeepLink(phone, script)
      : smsDeepLink(phone, script)
    : "#";
  const venmoUrl = venmoDeepLink(amount, `Strive · ${first(o)}'s spot`);

  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.02 }}
      className={cn(
        "card relative overflow-hidden border p-4 transition-all hover:border-white/10",
        BUCKET_BORDER[bucket],
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar name={o.contactName} color="#1a1a1d" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="truncate text-sm font-semibold">{o.contactName}</div>
            {o.tags?.map((t) => (
              <span
                key={t}
                className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted"
              >
                {t}
              </span>
            ))}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-muted">
            {o.stage} · {o.phone ?? "no phone"}
          </div>
        </div>
        <div className="text-right">
          <div className="h-display text-base font-semibold tabular-nums text-accent">
            {formatCurrency(amount)}
          </div>
          <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted">
            <Clock className="h-2.5 w-2.5" />
            {stageDays}d cold
          </div>
        </div>
      </div>

      {o.notes && (
        <div className="mt-3 rounded-lg border border-white/5 bg-black/30 p-2 text-[11px] text-muted">
          {o.notes}
        </div>
      )}

      {expanded && (
        <div className="mt-3 rounded-lg border border-white/5 bg-black/30 p-2.5 text-[11px] italic leading-relaxed text-bone/80">
          "{script}"
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
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
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto rounded-lg px-2 py-1 text-[10px] font-semibold text-muted hover:text-bone"
        >
          {expanded ? "Hide script" : "Script"}
        </button>
      </div>

      {days >= 7 && (
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1 bg-gradient-to-b from-red-500/0 via-red-500/40 to-red-500/0" />
      )}
    </motion.div>
  );
}
