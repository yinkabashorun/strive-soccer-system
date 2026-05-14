import { CalendarRange, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { QueueView } from "@/components/QueueView";
import { listPosts, getConfig } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const [posts, config] = await Promise.all([listPosts({}), getConfig()]);

  const awaiting = posts.filter((p) => p.status === "awaiting_approval").length;
  const scheduled = posts.filter((p) => p.status === "scheduled").length;

  return (
    <div>
      <PageHeader
        eyebrow={`Content queue · ${posts.length} posts · ${config.autoApprove ? "Auto-approve ON" : "Manual approve"}`}
        title={
          awaiting > 0
            ? `${awaiting} ${awaiting === 1 ? "post needs" : "posts need"} your approval.`
            : "All caught up."
        }
        subtitle="Every AI-generated post in one place. Review, approve, reject, regenerate. Approved posts schedule through GHL Social Planner."
        actions={
          <>
            <Link href="/settings" className="btn">
              <Settings className="h-4 w-4" />
              Schedule settings
            </Link>
            <Link href="/studio" className="btn-accent">
              <Sparkles className="h-4 w-4" />
              New ad
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Awaiting" value={awaiting} tone={awaiting > 0 ? "warn" : "neutral"} />
        <Stat label="Scheduled" value={scheduled} tone="accent" />
        <Stat
          label="Posted (last 30d)"
          value={posts.filter((p) => p.status === "posted").length}
        />
        <Stat
          label="Failed"
          value={posts.filter((p) => p.status === "failed").length}
          tone={
            posts.some((p) => p.status === "failed") ? "warn" : "neutral"
          }
        />
      </div>

      <div className="mt-6">
        <QueueView initialPosts={posts} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "accent" | "warn" | "neutral";
}) {
  const cls =
    tone === "accent"
      ? "text-accent"
      : tone === "warn"
      ? "text-orange-300"
      : "text-bone";
  return (
    <div className="card p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
        {label}
      </div>
      <div className={`h-display mt-1.5 text-2xl font-semibold tabular-nums ${cls}`}>
        {value}
      </div>
    </div>
  );
}
