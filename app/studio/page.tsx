import { CalendarRange, Sparkles, Wand2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { AdStudio } from "@/components/AdStudio";

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

      <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
        <InfoBlock
          icon={Wand2}
          label="Strategist"
          body="Rotates pillars day-by-day (Ball Mastery → Player Spotlight → Mindset → Offer → Education → BTS) so the feed never drifts. Goal auto-picks: Lead-gen weekdays, Course Saturday, Brand Sunday."
        />
        <InfoBlock
          icon={CalendarRange}
          label="Daily auto-poster"
          body="The cron at /api/cron/daily-tiktok generates + schedules one TikTok every morning. Wire to Vercel Cron (0 9 * * *) or a GHL workflow. Protected with CRON_SECRET."
        />
        <InfoBlock
          icon={Sparkles}
          label="Provider status"
          body="Higgsfield + ElevenLabs run in mock mode until HIGGSFIELD_API_KEY and ELEVENLABS_API_KEY are set in .env.local. GHL falls back to mock when GHL_TIKTOK_ACCOUNT_ID is missing."
        />
      </div>
    </div>
  );
}

function InfoBlock({
  icon: Icon,
  label,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  body: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-accent" />
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
          {label}
        </div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-bone/80">{body}</p>
    </div>
  );
}
