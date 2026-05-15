import { CalendarRange, Eye, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { AdStudio } from "@/components/AdStudio";
import { isAnthropicConfigured } from "@/lib/anthropic";
import { isGhlSocialConfigured } from "@/lib/ghl-social";
import { isStoreLive, listPosts } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const recent = await listPosts({ limit: 4 });
  const awaiting = recent.filter((p) => p.status === "awaiting_approval").length;

  return (
    <div>
      <PageHeader
        eyebrow={`Content Studio · ${awaiting > 0 ? `${awaiting} awaiting review` : "all clear"}`}
        title="Idea in. Viral TikTok ad out."
        subtitle="Claude writes it. Higgsfield renders it. ElevenLabs voices it. GHL schedules it. You approve from the queue."
        actions={
          <>
            <Link href="/settings" className="btn">
              <Settings className="h-4 w-4" />
              Settings
            </Link>
            <Link href="/queue" className="btn-accent">
              <Eye className="h-4 w-4" />
              Queue {awaiting > 0 && `· ${awaiting}`}
            </Link>
          </>
        }
      />

      <AdStudio />

      <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-4">
        <ProviderChip
          label="Storage"
          configured={isStoreLive()}
          liveNote="Supabase"
          mockNote="In-memory"
        />
        <ProviderChip
          label="Strategist · Claude"
          configured={isAnthropicConfigured()}
          liveNote="Live writes"
          mockNote="Template fallback"
        />
        <ProviderChip
          label="Video · Higgsfield"
          configured
          liveNote="Manual via Claude.ai MCP"
          mockNote=""
        />
        <ProviderChip
          label="Scheduler · GHL"
          configured={isGhlSocialConfigured()}
          liveNote="TikTok wired"
          mockNote="Mock post id"
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
        <InfoCard
          title="Today's pillar rotation"
          body="The cron picks pillar + goal from your /settings rotation. Edit there to change feed direction."
          cta={{ label: "Open Settings", href: "/settings" }}
        />
        <InfoCard
          title="Cron schedule"
          body="vercel.json runs /api/cron/daily-tiktok every day at 9am ET. Set CRON_SECRET in Vercel env and the cron query string."
          cta={{
            label: "Trigger now",
            href: "/api/cron/daily-tiktok",
            external: true,
          }}
        />
        <InfoCard
          title="Approval workflow"
          body="By default every generated post lands in the Queue as awaiting_approval. Flip Auto-approve ON in Settings to skip review (not recommended)."
          cta={{ label: "Open Queue", href: "/queue" }}
        />
      </div>
    </div>
  );
}

function ProviderChip({
  label,
  configured,
  liveNote,
  mockNote,
}: {
  label: string;
  configured: boolean;
  liveNote: string;
  mockNote: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
          {label}
        </div>
        <span
          className={
            configured
              ? "rounded-full border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-accent"
              : "rounded-full border border-orange-400/30 bg-orange-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-orange-200"
          }
        >
          {configured ? "Live" : "Mock"}
        </span>
      </div>
      <div className="mt-2 text-xs text-bone/80">
        {configured ? liveNote : mockNote}
      </div>
    </div>
  );
}

function InfoCard({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta: { label: string; href: string; external?: boolean };
}) {
  const Anchor = cta.external ? "a" : Link;
  const extraProps = cta.external
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};
  return (
    <div className="card p-4">
      <h3 className="h-display text-base font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted">{body}</p>
      <Anchor
        href={cta.href}
        {...(extraProps as Record<string, string>)}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
      >
        {cta.label} →
      </Anchor>
    </div>
  );
}
