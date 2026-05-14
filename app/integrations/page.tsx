import { PageHeader } from "@/components/PageHeader";
import {
  CheckCircle2,
  Circle,
  Cloud,
  Database,
  GitBranch,
  Mic,
  Sparkles,
  Webhook,
  Zap,
} from "lucide-react";

const integrations = [
  {
    name: "GoHighLevel",
    role: "CRM + automations · source of truth for leads",
    status: "Wired",
    icon: Zap,
    note: "Webhook endpoint: /api/ghl/webhook",
  },
  {
    name: "Supabase",
    role: "Postgres backend · players, sessions, content, payments",
    status: "Ready",
    icon: Database,
    note: "Set NEXT_PUBLIC_SUPABASE_URL + ANON_KEY to activate",
  },
  {
    name: "Stripe",
    role: "Course checkout + package payments",
    status: "Ready",
    icon: Cloud,
    note: "Architecture is Stripe-ready · webhooks land in /api/ghl/webhook",
  },
  {
    name: "Manus",
    role: "Landing pages + websites · external",
    status: "External",
    icon: GitBranch,
    note: "Manus drives top of funnel, GHL captures, Strive OS operates",
  },
  {
    name: "Higgsfield",
    role: "AI video generation · feeds the content engine",
    status: "External",
    icon: Sparkles,
    note: "Pipeline: Higgsfield → Edited → Posted in the Content Engine",
  },
  {
    name: "Voiceover Provider",
    role: "ElevenLabs / OpenAI TTS (pluggable)",
    status: "Pluggable",
    icon: Mic,
    note: "Voiceover button in Content Engine swaps in real TTS when wired",
  },
];

export default function IntegrationsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Integrations"
        title="Strive OS sits at the center — not on top."
        subtitle="GoHighLevel keeps running. Manus keeps the pages. Strive OS becomes the operating system that connects every tool."
      />

      {/* Architecture diagram */}
      <section className="card relative mb-6 overflow-hidden p-6">
        <div className="absolute inset-0 dot-grid opacity-30" />
        <div className="relative">
          <div className="chip">System architecture</div>
          <h2 className="h-display mt-2 text-2xl font-semibold">
            How the pieces connect.
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-5">
            <Node label="Manus" sub="Landing pages" />
            <Arrow />
            <Node label="GoHighLevel" sub="CRM + automations" highlighted />
            <Arrow />
            <Node label="Strive OS" sub="Operating system" accent />
          </div>
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-5">
            <Node label="Higgsfield" sub="AI video" />
            <Arrow />
            <Node label="Content Engine" sub="Inside Strive OS" />
            <Arrow />
            <Node label="TikTok / IG" sub="Distribution" />
          </div>
        </div>
      </section>

      {/* Integration list */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {integrations.map((i) => {
          const Icon = i.icon;
          const wired = i.status === "Wired";
          return (
            <div
              key={i.name}
              className="card card-hover flex items-start gap-4 p-5"
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-bone">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold">{i.name}</h3>
                  <span
                    className={
                      wired
                        ? "chip-accent"
                        : i.status === "Ready"
                        ? "chip"
                        : "chip"
                    }
                  >
                    {wired ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <Circle className="h-3 w-3" />
                    )}
                    {i.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">{i.role}</p>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/5 bg-black/30 px-2.5 py-1 text-[11px] font-mono text-muted">
                  <Webhook className="h-3 w-3" />
                  {i.note}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Webhook payload sample */}
      <section className="card mt-6 p-6">
        <div className="chip">Webhook contract</div>
        <h2 className="h-display mt-2 text-xl font-semibold">
          GHL → Strive OS payload shape
        </h2>
        <p className="mt-1 text-xs text-muted">
          Point your GoHighLevel webhook step at{" "}
          <code className="kbd">/api/ghl/webhook</code>. We handle{" "}
          <code className="kbd">contact.created</code>,{" "}
          <code className="kbd">opportunity.stage_changed</code>,{" "}
          <code className="kbd">payment.received</code>, and{" "}
          <code className="kbd">appointment.booked</code>.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl border border-white/5 bg-black/60 p-4 text-[11px] leading-relaxed text-bone/80">
{`POST /api/ghl/webhook
Content-Type: application/json
X-GHL-Signature: <hmac>

{
  "event": "contact.created",
  "data": {
    "id": "ghl_abc123",
    "firstName": "Jordan",
    "lastName": "Hayes",
    "email": "jordan@example.com",
    "phone": "+14045550199",
    "source": "TikTok ad · Ball Mastery hook",
    "tags": ["tiktok", "group-training"]
  }
}`}
        </pre>
      </section>
    </div>
  );
}

function Node({
  label,
  sub,
  accent,
  highlighted,
}: {
  label: string;
  sub: string;
  accent?: boolean;
  highlighted?: boolean;
}) {
  return (
    <div
      className={
        accent
          ? "rounded-2xl border border-accent/40 bg-accent/[0.08] p-4 text-center shadow-glow"
          : highlighted
          ? "rounded-2xl border border-white/15 bg-white/[0.04] p-4 text-center"
          : "rounded-2xl border border-white/5 bg-ink-200/40 p-4 text-center"
      }
    >
      <div className={accent ? "text-sm font-semibold text-accent" : "text-sm font-semibold"}>
        {label}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted">
        {sub}
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <div className="grid place-items-center text-muted">
      <div className="hidden h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent md:block" />
      <div className="block text-xs md:hidden">↓</div>
    </div>
  );
}
