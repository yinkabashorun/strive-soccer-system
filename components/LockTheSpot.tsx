"use client";

import { Check, MessageSquare, Phone, Send, Wallet } from "lucide-react";
import { useState } from "react";
import type { Opportunity } from "@/lib/types";
import {
  dealValue,
  smsDeepLink,
  telDeepLink,
  venmoDeepLink,
  whatsAppDeepLink,
} from "@/lib/pipeline";
import { cn } from "@/lib/utils";

const DEFAULT_SMS = (firstName: string, amount: number) =>
  `Hey ${firstName} — locking your spot for the May 20 start. Venmo $${amount} to @Yinka-bash in the next 30 min and you're in. Spots cap at 6.`;

const DEFAULT_VENMO_NOTE = (firstName: string) =>
  `Strive Soccer Summer 2025 — ${firstName}'s spot`;

export function LockTheSpot({
  opportunity,
  compact = false,
  preset,
}: {
  opportunity: Opportunity;
  compact?: boolean;
  preset?: { script?: string };
}) {
  const fn = opportunity.contactName.split(/\s+/)[0];
  const amount = dealValue(opportunity);
  const usesWhatsApp = (opportunity.tags ?? []).includes("whatsapp");
  const script = preset?.script ?? DEFAULT_SMS(fn, amount);

  const [copied, setCopied] = useState(false);

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — older browsers without clipboard API
    }
  };

  const phone = opportunity.phone ?? "";
  const venmoUrl = venmoDeepLink(amount, DEFAULT_VENMO_NOTE(fn));
  const smsUrl = phone ? smsDeepLink(phone, script) : "#";
  const telUrl = phone ? telDeepLink(phone) : "#";
  const waUrl = phone ? whatsAppDeepLink(phone, script) : "#";

  const messageHref = usesWhatsApp ? waUrl : smsUrl;
  const MessageIcon = usesWhatsApp ? Send : MessageSquare;
  const messageLabel = usesWhatsApp ? "WhatsApp" : "Text";

  const baseBtn =
    "inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-all active:scale-[0.97]";

  return (
    <div
      className={cn(
        "flex flex-wrap gap-1.5",
        compact ? "" : "rounded-xl border border-white/5 bg-black/30 p-2",
      )}
    >
      <a
        href={telUrl}
        className={cn(
          baseBtn,
          "border-white/10 bg-white/[0.04] text-bone hover:border-white/20 hover:bg-white/[0.08]",
          !phone && "pointer-events-none opacity-30",
        )}
      >
        <Phone className="h-3 w-3" />
        Call
      </a>

      <a
        href={messageHref}
        className={cn(
          baseBtn,
          "border-white/10 bg-white/[0.04] text-bone hover:border-white/20 hover:bg-white/[0.08]",
          !phone && "pointer-events-none opacity-30",
        )}
      >
        <MessageIcon className="h-3 w-3" />
        {messageLabel}
      </a>

      <a
        href={venmoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          baseBtn,
          "border-accent/40 bg-accent/15 text-accent hover:border-accent/60 hover:bg-accent/25",
        )}
      >
        <Wallet className="h-3 w-3" />
        Venmo ${amount}
      </a>

      <button
        type="button"
        onClick={handleCopyScript}
        className={cn(
          baseBtn,
          "border-white/10 bg-white/[0.02] text-muted hover:border-white/20 hover:text-bone",
        )}
      >
        {copied ? (
          <>
            <Check className="h-3 w-3 text-accent" />
            Copied
          </>
        ) : (
          <>Copy script</>
        )}
      </button>
    </div>
  );
}
