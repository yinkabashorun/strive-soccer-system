import type {
  BriefAction,
  Opportunity,
  OperatorBucket,
  PipelineStage,
} from "./types";
import { opportunities, TODAY, DEFAULT_DEAL_VALUE } from "./pipeline-data";

// ============================================================================
// Time helpers — anchored to TODAY so the demo is deterministic.
// ============================================================================

export function daysSince(iso: string, now: Date = TODAY): number {
  const then = new Date(iso).getTime();
  const diffMs = Math.max(0, now.getTime() - then);
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function dealValue(o: Opportunity): number {
  if (o.leadValue && o.leadValue > 0) return o.leadValue;
  return o.expectedValue || DEFAULT_DEAL_VALUE;
}

// ============================================================================
// Bucket assignment — the heart of the operator system.
//
// Every open opportunity falls into exactly ONE bucket, ranked by
// "where would a dollar arrive fastest?" Buckets are evaluated top-down.
// ============================================================================

export const BUCKET_ORDER: OperatorBucket[] = [
  "promised_uncollected",
  "won_uncollected",
  "signed_unpaid",
  "needs_close",
  "rescue_new",
  "stale_followup",
  "cooling",
];

export const BUCKET_META: Record<
  OperatorBucket,
  {
    label: string;
    short: string;
    tone: "fire" | "money" | "warn" | "cold" | "neutral";
    blurb: string;
  }
> = {
  promised_uncollected: {
    label: "Promised — collect now",
    short: "Promised",
    tone: "money",
    blurb: "They said yes. Money isn't in. Highest-leverage call you can make.",
  },
  won_uncollected: {
    label: "Won — verify payment",
    short: "Won · unpaid",
    tone: "money",
    blurb: "Marked Won in GHL but cash hasn't hit. Confirm or fix.",
  },
  signed_unpaid: {
    label: "Signed up — payment unconfirmed",
    short: "Signed · unpaid",
    tone: "warn",
    blurb: "They're 'in' but no payment recorded. Are they actually playing?",
  },
  needs_close: {
    label: "Needs close — proposal sent",
    short: "Closing",
    tone: "fire",
    blurb: "Proposal in front of them, still warm. Push to a yes.",
  },
  rescue_new: {
    label: "Rescue — new lead untouched",
    short: "Rescue",
    tone: "warn",
    blurb: "Came in cold and nobody picked up the phone. Shame zone.",
  },
  stale_followup: {
    label: "Stale — multiple follow-ups, no movement",
    short: "Stale",
    tone: "cold",
    blurb: "You've followed up. They're ghosting. Get a yes/no, stop chasing.",
  },
  cooling: {
    label: "Cooling — followed up, give it time",
    short: "Cooling",
    tone: "neutral",
    blurb: "Recent touch. Don't crowd them. Set the next follow-up.",
  },
};

export function bucketFor(o: Opportunity): OperatorBucket | null {
  if (o.status === "lost") return null;

  const days = daysSince(o.updatedAt);

  if (o.stage === "Promised" && !o.collected) return "promised_uncollected";
  if (o.stage === "Won" && !o.collected) return "won_uncollected";
  if (o.stage === "Signed Up" && !o.collected) return "signed_unpaid";

  if (o.stage === "Proposal Sent") {
    return days <= 5 ? "needs_close" : "stale_followup";
  }

  if (o.stage === "New Lead") {
    return days >= 5 ? "rescue_new" : "needs_close";
  }

  if (o.stage === "Followed up 1" || o.stage === "Followed up 2x") {
    return days >= 7 ? "stale_followup" : "cooling";
  }

  return null;
}

export function groupByBucket(
  opps: Opportunity[] = opportunities,
): Record<OperatorBucket, Opportunity[]> {
  const out: Record<OperatorBucket, Opportunity[]> = {
    promised_uncollected: [],
    won_uncollected: [],
    signed_unpaid: [],
    needs_close: [],
    rescue_new: [],
    stale_followup: [],
    cooling: [],
  };
  for (const o of opps) {
    const b = bucketFor(o);
    if (b) out[b].push(o);
  }
  for (const k of Object.keys(out) as OperatorBucket[]) {
    out[k].sort((a, b) => daysSince(a.updatedAt) - daysSince(b.updatedAt));
  }
  return out;
}

// ============================================================================
// Money on the table — the number Yinka should obsess over.
// ============================================================================

export type MoneyOnTable = {
  totalUncollected: number;
  promisedDollars: number;
  wonUncollectedDollars: number;
  inFlightDollars: number; // proposal sent + needs close
  uncollectedCount: number;
  hottestLead: Opportunity | null;
  /** Realistic close estimate: weighted by stage probability. */
  weightedForecast: number;
};

const STAGE_PROB: Record<PipelineStage, number> = {
  "New Lead": 0.05,
  "Proposal Sent": 0.25,
  "Followed up 1": 0.15,
  "Followed up 2x": 0.1,
  Promised: 0.7,
  "Signed Up": 0.85,
  Won: 1.0,
  Lost: 0,
};

export function moneyOnTable(opps: Opportunity[] = opportunities): MoneyOnTable {
  let promised = 0;
  let won = 0;
  let inFlight = 0;
  let weighted = 0;
  let count = 0;
  let hottest: Opportunity | null = null;
  let hottestScore = -1;

  for (const o of opps) {
    if (o.collected) continue;
    if (o.status === "lost") continue;

    const v = dealValue(o);

    if (o.stage === "Promised") promised += v;
    else if (o.stage === "Won") won += v;
    else if (o.stage === "Proposal Sent" || o.stage === "Signed Up") inFlight += v;

    weighted += v * (STAGE_PROB[o.stage] ?? 0);
    count += 1;

    const score = (STAGE_PROB[o.stage] ?? 0) * v;
    if (score > hottestScore) {
      hottestScore = score;
      hottest = o;
    }
  }

  return {
    totalUncollected: promised + won + inFlight,
    promisedDollars: promised,
    wonUncollectedDollars: won,
    inFlightDollars: inFlight,
    uncollectedCount: count,
    hottestLead: hottest,
    weightedForecast: Math.round(weighted),
  };
}

// ============================================================================
// Daily Operator Brief — the morning hit list.
// ============================================================================

const FIRST_NAME = (full: string) => full.trim().split(/\s+/)[0];

function scriptFor(o: Opportunity, bucket: OperatorBucket): {
  channel: BriefAction["channel"];
  script: string;
} {
  const fn = FIRST_NAME(o.contactName);
  const v = dealValue(o);
  const usesWhatsApp = (o.tags ?? []).includes("whatsapp");
  const channel = usesWhatsApp ? "whatsapp" : bucket === "rescue_new" ? "call" : "sms";

  switch (bucket) {
    case "promised_uncollected":
      return {
        channel,
        script: `Hey ${fn} — locking your spot for the May 20 start. Venmo $${v} to @Yinka-bash in the next 30 min and you're in. Spots cap at 6.`,
      };
    case "won_uncollected":
      return {
        channel: "venmo",
        script: `${fn}, sending a quick Venmo request for $${v} to confirm. First session Tuesday — see you on the pitch.`,
      };
    case "signed_unpaid":
      return {
        channel: "sms",
        script: `${fn} — confirming your spot for Tuesday. Quick Venmo to lock it: @Yinka-bash · $${v}. Reply DONE when sent.`,
      };
    case "needs_close":
      return {
        channel,
        script: `${fn}, spots are capped at 6 and we're at 4. Want me to lock yours? $${v} on Venmo (@Yinka-bash) holds it through summer.`,
      };
    case "rescue_new":
      return {
        channel: "call",
        script: `Call ${fn} now. Open: "Hey ${fn}, this is Yinka from Strive Soccer — saw you reached out. Got 30 seconds?" Don't pitch. Ask what they're looking for. Then close.`,
      };
    case "stale_followup":
      return {
        channel,
        script: `${fn} — last check before I close out your spot. In or out for May 20? Either answer is fine, just need to know.`,
      };
    case "cooling":
      return {
        channel,
        script: `${fn}, quick one — sessions start May 20. Want me to walk you through the Development Pack ($319 / 10 sessions)? Takes 2 min.`,
      };
  }
}

const BUCKET_RANK: Record<OperatorBucket, number> = {
  promised_uncollected: 1,
  won_uncollected: 2,
  signed_unpaid: 3,
  rescue_new: 4,
  needs_close: 5,
  stale_followup: 6,
  cooling: 7,
};

const HEADLINE: Record<OperatorBucket, (o: Opportunity) => string> = {
  promised_uncollected: (o) => `Collect $${dealValue(o)} from ${FIRST_NAME(o.contactName)}`,
  won_uncollected: (o) => `Confirm $${dealValue(o)} actually hit — ${FIRST_NAME(o.contactName)}`,
  signed_unpaid: (o) => `Lock ${FIRST_NAME(o.contactName)}'s spot — $${dealValue(o)}`,
  needs_close: (o) => `Close ${FIRST_NAME(o.contactName)} ($${dealValue(o)})`,
  rescue_new: (o) => `Call ${FIRST_NAME(o.contactName)} — ${daysSince(o.updatedAt)}d untouched`,
  stale_followup: (o) => `Yes/no from ${FIRST_NAME(o.contactName)} — stop chasing`,
  cooling: (o) => `Nudge ${FIRST_NAME(o.contactName)}`,
};

const REASON: Record<OperatorBucket, (o: Opportunity) => string> = {
  promised_uncollected: () => `Already said yes. Money is the only thing missing.`,
  won_uncollected: () => `Marked Won but collected flag is false. Verify or fix.`,
  signed_unpaid: () => `Signed up but no payment on file. Sessions start May 20.`,
  needs_close: (o) => `Proposal sent ${daysSince(o.updatedAt)}d ago — strike while warm.`,
  rescue_new: (o) => `${daysSince(o.updatedAt)} days untouched. Inexcusable.`,
  stale_followup: (o) => `Followed up twice. ${daysSince(o.updatedAt)}d cold. Cut bait or close.`,
  cooling: (o) => `Touched ${daysSince(o.updatedAt)}d ago — don't crowd, but don't forget.`,
};

export function buildBrief(opps: Opportunity[] = opportunities): BriefAction[] {
  const grouped = groupByBucket(opps);
  const rows: { bucket: OperatorBucket; o: Opportunity }[] = [];
  for (const bucket of BUCKET_ORDER) {
    if (bucket === "cooling") continue; // de-prioritized — not on today's list
    for (const o of grouped[bucket]) {
      rows.push({ bucket, o });
    }
  }

  rows.sort((a, b) => {
    const r = BUCKET_RANK[a.bucket] - BUCKET_RANK[b.bucket];
    if (r !== 0) return r;
    return dealValue(b.o) - dealValue(a.o);
  });

  return rows.slice(0, 8).map(({ bucket, o }, i) => {
    const { channel, script } = scriptFor(o, bucket);
    return {
      id: `brief_${o.id}`,
      rank: i + 1,
      opportunityId: o.id,
      bucket,
      headline: HEADLINE[bucket](o),
      reason: REASON[bucket](o),
      script,
      channel,
    };
  });
}

// ============================================================================
// North-star math — Yinka's $47K summer goal.
// ============================================================================

export const NORTH_STAR = {
  summerTarget: 47000,
  m4Target: 8000,
  monthlyRecurringTarget: 3200,
  playersTarget: 60,
  sessionsStart: new Date("2026-05-20T00:00:00Z"),
};

export function summerProgress(opps: Opportunity[] = opportunities) {
  const collected = opps
    .filter((o) => o.collected)
    .reduce((s, o) => s + dealValue(o), 0);
  const pct = collected / NORTH_STAR.summerTarget;
  const playersCollected = opps.filter((o) => o.collected).length;
  const daysUntilSessions = Math.max(
    0,
    Math.ceil(
      (NORTH_STAR.sessionsStart.getTime() - TODAY.getTime()) /
        (1000 * 60 * 60 * 24),
    ),
  );
  return {
    collected,
    pct,
    playersCollected,
    playersTarget: NORTH_STAR.playersTarget,
    daysUntilSessions,
    weeksLeftInSummer: 14,
    weeklyBurnNeeded: Math.round(
      (NORTH_STAR.summerTarget - collected) / 14,
    ),
  };
}

// ============================================================================
// Lock-the-spot deeplinks.
// ============================================================================

export function venmoDeepLink(amount: number, note: string) {
  const params = new URLSearchParams({
    txn: "pay",
    audience: "private",
    recipients: "Yinka-bash",
    amount: String(amount),
    note,
  });
  return `https://venmo.com/?${params.toString()}`;
}

export function smsDeepLink(phone: string, body: string) {
  // iOS: sms:+15551234567&body=… ; this works on most modern mobile clients.
  const cleaned = phone.replace(/[^\d+]/g, "");
  return `sms:${cleaned}?&body=${encodeURIComponent(body)}`;
}

export function telDeepLink(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function whatsAppDeepLink(phone: string, body: string) {
  const cleaned = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(body)}`;
}
