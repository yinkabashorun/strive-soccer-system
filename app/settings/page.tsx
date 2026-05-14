import { PageHeader } from "@/components/PageHeader";
import {
  ProviderBlock,
  SettingsForm,
  StorageBlock,
} from "@/components/SettingsForm";
import { isAnthropicConfigured } from "@/lib/anthropic";
import { isGhlSocialConfigured } from "@/lib/ghl-social";
import { getConfig, isStoreLive } from "@/lib/store";
import { isElevenLabsConfigured, isHiggsfieldConfigured } from "@/lib/video-gen";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const config = await getConfig();
  const cronConfigured = Boolean(process.env.CRON_SECRET);

  return (
    <div>
      <PageHeader
        eyebrow="Settings · workspace config"
        title="Configure the operator."
        subtitle="Posting schedule, pillar rotation, CTAs, and provider connections. Settings persist to Supabase when configured."
      />

      <SettingsForm initial={config} />

      <div className="mt-8 space-y-4">
        <StorageBlock live={isStoreLive()} />

        <ProviderBlock
          providers={[
            {
              label: "Claude · strategist",
              envKeys: ["ANTHROPIC_API_KEY"],
              configured: isAnthropicConfigured(),
              instructions:
                "Issues the hook, script, caption, CTA, and video prompt. Defaults to claude-sonnet-4-5.",
              docs: "https://console.anthropic.com/",
            },
            {
              label: "Higgsfield · text-to-video",
              envKeys: ["HIGGSFIELD_API_KEY"],
              configured: isHiggsfieldConfigured(),
              instructions:
                "Renders the 9:16 visual from the video prompt. Without a key, the studio shows a placeholder mp4.",
              docs: "https://higgsfield.ai",
            },
            {
              label: "ElevenLabs · voiceover",
              envKeys: ["ELEVENLABS_API_KEY", "SUPABASE_MEDIA_BUCKET"],
              configured: isElevenLabsConfigured(),
              instructions:
                "Generates voiceover audio. With Supabase Storage, audio uploads to the `media` bucket (override with SUPABASE_MEDIA_BUCKET).",
              docs: "https://elevenlabs.io/docs",
            },
            {
              label: "GoHighLevel · Social Planner",
              envKeys: [
                "GHL_API_KEY",
                "GHL_LOCATION_ID",
                "GHL_TIKTOK_ACCOUNT_ID",
              ],
              configured: isGhlSocialConfigured(),
              instructions:
                "Schedules TikTok posts. Get the Private Integration token with Social Planner write scope, then connect TikTok in Social Planner UI to grab the account id.",
              docs: "https://highlevel.stoplight.io/docs/integrations",
            },
            {
              label: "Daily cron · auto-poster",
              envKeys: ["CRON_SECRET"],
              configured: cronConfigured,
              instructions:
                "Protects /api/cron/daily-tiktok. Vercel Cron already configured in vercel.json — set the secret in Vercel env and add it as the ?key= param.",
            },
          ]}
        />
      </div>
    </div>
  );
}
