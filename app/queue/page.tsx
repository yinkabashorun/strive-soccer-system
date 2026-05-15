import { Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { QueueView } from "@/components/QueueView";
import { listPosts } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const posts = await listPosts({});

  const needsVideo = posts.filter((p) => p.status === "awaiting_video").length;
  const awaiting = posts.filter((p) => p.status === "awaiting_approval").length;
  const scheduled = posts.filter((p) => p.status === "scheduled").length;

  const headline =
    needsVideo > 0
      ? `${needsVideo} ${needsVideo === 1 ? "post needs" : "posts need"} video.`
      : awaiting > 0
      ? `${awaiting} ${awaiting === 1 ? "post needs" : "posts need"} your approval.`
      : "All caught up.";

  return (
    <div>
      <PageHeader
        eyebrow={`Content queue · ${posts.length} posts · daily Higgsfield workflow`}
        title={headline}
        subtitle="Each morning the cron writes the script. Open in Claude.ai → Higgsfield renders → paste URL back → approve → GHL schedules to TikTok."
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
        <Stat label="Needs video" value={needsVideo} tone={needsVideo > 0 ? "warn" : "neutral"} />
        <Stat label="Awaiting approval" value={awaiting} tone={awaiting > 0 ? "warn" : "neutral"} />
        <Stat label="Scheduled" value={scheduled} tone="accent" />
        <Stat
          label="Posted (last 30d)"
          value={posts.filter((p) => p.status === "posted").length}
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
