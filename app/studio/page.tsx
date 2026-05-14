import { CalendarRange, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { AdStudio } from "@/components/AdStudio";
import { ScheduledQueue } from "@/components/ScheduledQueue";
import { isAnthropicConfigured } from "@/lib/anthropic";
import { isHiggsfieldConfigured, isElevenLabsConfigured } from "@/lib/video-gen";
import { isGhlSocialConfigured } from "@/lib/ghl-social";

export const dynamic = "force-dynamic";

export default function StudioPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Content Studio · AI ad generator"
        title="Idea in. Viral TikTok ad out."
        subtitle="Write the hook, render the video (Higgsfield), record the voiceover (ElevenLabs), schedule on TikTok via GHL Social Planner — in one screen."
        actions={
          <>
            <a
              href="/api/cron/daily-tiktok"
              target="_blank"
              rel="noopener noreferrer"
              className="btn"
            >
              <CalendarRange className="h-4 w-4" />
              Run today's auto-post
            </a>
            <a
              href="https://app.gohighlevel.com/social-planner"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-accent"
            >
              <Sparkles className="h-4 w-4" />
              Open GHL Social Planner
            </a>
          </>
        }
      />

      <AdStudio />

      <div className="mt-8">
        <ScheduledQueue />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-4">
        <ProviderChip
          label="Strategist (Claude)"
          configured={isAnthropicConfigured()}
          note={
            isAnthropicConfigured()
              ? "Live · ANTHROPIC_API_KEY set"
              : "Mock · using template fallback"
          }
        />
        <ProviderChip
          label="Video (Higgsfield)"
          configured={isHiggsfieldConfigured()}
          note={
            isHiggsfieldConfigured()
              ? "Live · HIGGSFIELD_API_KEY set"
              : "Mock · placeholder mp4"
          }
        />
        <ProviderChip
          label="Voice (ElevenLabs)"
          configured={isElevenLabsConfigured()}
          note={
            isElevenLabsConfigured()
              ? "Live · ELEVENLABS_API_KEY set"
              : "Mock · placeholder audio"
          }
        />
        <ProviderChip
          label="Scheduler (GHL)"
          configured={isGhlSocialConfigured()}
          note={
            isGhlSocialConfigured()
              ? "Live · TikTok wired"
              : "Mock · returns fake post id"
          }
        />
      </div>
    </div>
  );
}

function ProviderChip({
  label,
  configured,
  note,
}: {
  label: string;
  configured: boolean;
  note: string;
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
              : "rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted"
          }
        >
          {configured ? "Live" : "Mock"}
        </span>
      </div>
      <div className="mt-2 text-xs text-bone/80">{note}</div>
    </div>
  );
}
