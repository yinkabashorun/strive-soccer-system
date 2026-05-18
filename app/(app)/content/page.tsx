import { PageHeader } from "@/components/PageHeader";
import { AutopilotPanel } from "@/components/AutopilotPanel";
import { ContentEngine } from "@/components/ContentEngine";
import { contentItems, stats } from "@/lib/data";
import { Flame, Sparkles, TrendingUp } from "lucide-react";
import { formatCompact } from "@/lib/utils";

export default function ContentPage() {
  return (
    <div>
      <PageHeader
        eyebrow="AI Content Engine"
        title="Set it once. Strive ships content for you."
        subtitle="Strive OS writes the ideas, voices them, films UGC videos, and schedules two posts a day to your GoHighLevel calendar. You don't lift a finger."
      />

      <AutopilotPanel />

      <div className="mt-8 mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <BannerStat
          icon={<Flame className="h-4 w-4" />}
          label="Viral · 30d"
          value={String(stats.viralPostsLast30)}
          hint="3 hit > 100K"
        />
        <BannerStat
          icon={<TrendingUp className="h-4 w-4" />}
          label="Total reach"
          value={formatCompact(stats.contentReachLast30)}
          hint="last 30 days"
        />
        <BannerStat
          icon={<Sparkles className="h-4 w-4" />}
          label="In pipeline"
          value={String(contentItems.length)}
          hint="ideas through posted"
        />
        <BannerStat
          icon={<Sparkles className="h-4 w-4" />}
          label="Posting cadence"
          value="2 / day"
          hint="autopilot enforced"
        />
      </div>

      <ContentEngine items={contentItems} />
    </div>
  );
}

function BannerStat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
        <span className="text-accent">{icon}</span>
        {label}
      </div>
      <div className="h-display mt-2 text-2xl font-semibold">{value}</div>
      <div className="text-[11px] text-muted">{hint}</div>
    </div>
  );
}
