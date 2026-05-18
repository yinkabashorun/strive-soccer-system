import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  CircleOff,
  Cloud,
  RefreshCw,
  Sparkles,
  Webhook,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { isAnthropicConfigured } from "@/lib/ai";
import { isElevenLabsConfigured } from "@/lib/elevenlabs";
import { isFalConfigured } from "@/lib/fal";
import { isGHLConfigured } from "@/lib/ghl";
import { isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const supabaseOk = isSupabaseConfigured();
  const ghlOk = isGHLConfigured();
  const anthropicOk = isAnthropicConfigured();
  const falOk = isFalConfigured();
  const elevenOk = isElevenLabsConfigured();
  const cronSecretSet = Boolean(process.env.CRON_SECRET);
  const webhookSecretSet = Boolean(process.env.GHL_WEBHOOK_SECRET);

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Workspace · Strive OS"
        subtitle="What's automated, what's wired, and where each cron runs."
      />

      {/* Automations */}
      <section className="card mb-4 overflow-hidden">
        <div className="border-b border-white/5 px-6 py-4">
          <div className="chip-accent">
            <Sparkles className="h-3 w-3" /> Hands-off
          </div>
          <h2 className="h-display mt-2 text-xl font-semibold">Automations</h2>
          <p className="mt-1 text-xs text-muted">
            These run on Vercel cron — no clicking required.
          </p>
        </div>
        <Automation
          icon={<RefreshCw className="h-4 w-4" />}
          name="Daily GHL contact sync"
          path="/api/cron/sync-contacts"
          schedule="06:00 UTC · daily"
          enabled={ghlOk && supabaseOk}
          enabledNote="Pulls every contact, auto-promotes Won tags"
          disabledNote="Set GHL_API_KEY, GHL_LOCATION_ID, and Supabase env to activate"
        />
        <Automation
          icon={<Sparkles className="h-4 w-4" />}
          name="Weekly content autopilot"
          path="/api/cron/autopilot"
          schedule="08:00 UTC · Mondays"
          enabled={anthropicOk && ghlOk}
          enabledNote="14 posts (2/day for the week) into GHL Social Planner"
          disabledNote="Needs ANTHROPIC_API_KEY + GHL_API_KEY to publish for real"
        />
        <Automation
          icon={<Webhook className="h-4 w-4" />}
          name="GHL webhook → lead intake"
          path="/api/ghl/webhook"
          schedule="Real-time"
          enabled={supabaseOk}
          enabledNote={
            webhookSecretSet
              ? "HMAC-verified · auto-promotes Won tags"
              : "No signature verification (set GHL_WEBHOOK_SECRET)"
          }
          disabledNote="Wire Supabase to persist incoming contacts"
        />
      </section>

      {/* Connections */}
      <section className="card mb-4 overflow-hidden">
        <div className="border-b border-white/5 px-6 py-4">
          <div className="chip">Connections</div>
          <h2 className="h-display mt-2 text-xl font-semibold">Service status</h2>
        </div>
        <Connection label="Supabase" ok={supabaseOk} env="NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY" />
        <Connection label="GoHighLevel" ok={ghlOk} env="GHL_API_KEY + GHL_LOCATION_ID" />
        <Connection label="Anthropic (Claude)" ok={anthropicOk} env="ANTHROPIC_API_KEY" />
        <Connection label="ElevenLabs" ok={elevenOk} env="ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID" />
        <Connection label="Fal.ai" ok={falOk} env="FAL_KEY" />
        <Connection label="GHL webhook secret" ok={webhookSecretSet} env="GHL_WEBHOOK_SECRET (HMAC verify)" />
        <Connection label="Cron secret" ok={cronSecretSet} env="CRON_SECRET (Vercel cron auth)" />
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card p-5">
          <div className="chip">Brand</div>
          <h3 className="h-display mt-2 text-lg font-semibold">Strive Soccer</h3>
          <p className="mt-1 text-xs text-muted">
            Modern soccer training brand — ball mastery, creativity, composure.
          </p>
        </div>
        <div className="card p-5">
          <div className="chip">Need to change something?</div>
          <h3 className="h-display mt-2 text-lg font-semibold">
            Wire keys in Vercel
          </h3>
          <p className="mt-1 text-xs text-muted">
            Add env vars in your Vercel project settings, redeploy, and the OS
            picks them up. Status above updates on every page load.
          </p>
          <Link href="/integrations" className="btn-ghost mt-3 text-xs">
            <Cloud className="h-3.5 w-3.5" />
            Open Integrations
          </Link>
        </div>
      </div>
    </div>
  );
}

function Automation({
  icon,
  name,
  path,
  schedule,
  enabled,
  enabledNote,
  disabledNote,
}: {
  icon: React.ReactNode;
  name: string;
  path: string;
  schedule: string;
  enabled: boolean;
  enabledNote: string;
  disabledNote: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 border-b border-white/5 px-6 py-4 last:border-b-0 md:grid-cols-12">
      <div className="col-span-5 flex items-center gap-3">
        <span
          className={
            enabled
              ? "grid h-9 w-9 place-items-center rounded-xl bg-accent/15 text-accent"
              : "grid h-9 w-9 place-items-center rounded-xl bg-white/[0.04] text-muted"
          }
        >
          {icon}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{name}</div>
          <code className="kbd text-[10px]">{path}</code>
        </div>
      </div>
      <div className="col-span-3 flex items-center gap-2 text-xs text-muted">
        <CalendarClock className="h-3.5 w-3.5" />
        {schedule}
      </div>
      <div className="col-span-4 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted">
          {enabled ? enabledNote : disabledNote}
        </span>
        <span
          className={
            enabled
              ? "chip-accent shrink-0"
              : "chip shrink-0 border-white/10 text-muted"
          }
        >
          {enabled ? (
            <>
              <CheckCircle2 className="h-3 w-3" />
              Live
            </>
          ) : (
            <>
              <CircleOff className="h-3 w-3" />
              Needs keys
            </>
          )}
        </span>
      </div>
    </div>
  );
}

function Connection({
  label,
  ok,
  env,
}: {
  label: string;
  ok: boolean;
  env: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 px-6 py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{label}</div>
        <code className="kbd text-[10px]">{env}</code>
      </div>
      <span
        className={
          ok
            ? "chip-accent shrink-0"
            : "chip shrink-0 border-white/10 text-muted"
        }
      >
        {ok ? "Wired" : "Not set"}
      </span>
    </div>
  );
}
