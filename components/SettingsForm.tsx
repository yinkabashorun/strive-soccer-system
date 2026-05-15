"use client";

import {
  AlertCircle,
  Check,
  Database,
  KeyRound,
  Loader2,
  Save,
  Wand2,
} from "lucide-react";
import { useState } from "react";
import type { OperatorConfig } from "@/lib/store";
import type { AdGoal, AdPillar } from "@/lib/types";
import { cn } from "@/lib/utils";

const PILLARS: AdPillar[] = [
  "Ball Mastery",
  "Mindset",
  "Behind the Scenes",
  "Player Spotlight",
  "Education",
  "Offer",
];

const GOALS: AdGoal[] = ["Lead-gen", "Brand", "Course", "Camp", "Booking"];

const DAYS = [
  { key: "sun", label: "Sun" },
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
];

export function SettingsForm({ initial }: { initial: OperatorConfig }) {
  const [cfg, setCfg] = useState<OperatorConfig>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof OperatorConfig>(
    k: K,
    v: OperatorConfig[K],
  ) => {
    setCfg((c) => ({ ...c, [k]: v }));
    setSaved(false);
  };

  const togglePostDay = (day: string) => {
    setSaved(false);
    setCfg((c) => ({
      ...c,
      postDays: c.postDays.includes(day)
        ? c.postDays.filter((d) => d !== day)
        : [...c.postDays, day],
    }));
  };

  const updatePillarAt = (i: number, p: AdPillar) => {
    setSaved(false);
    setCfg((c) => {
      const next = [...c.pillarRotation];
      next[i] = p;
      return { ...c, pillarRotation: next };
    });
  };

  const updateGoalAt = (i: number, g: AdGoal) => {
    setSaved(false);
    setCfg((c) => {
      const next = [...c.goalRotation];
      next[i] = g;
      return { ...c, goalRotation: next };
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Save failed");
      setCfg(json.config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {error && (
        <div className="card flex items-center gap-2 border-red-500/30 bg-red-500/[0.05] p-3 text-xs text-red-300">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      {/* Posting schedule */}
      <section className="card p-5">
        <SectionHeader
          label="Posting schedule"
          blurb="When the daily cron creates a post. Time is local to the timezone selected."
        />

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Post time (local)">
            <input
              type="time"
              value={cfg.postTimeLocal}
              onChange={(e) => update("postTimeLocal", e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Timezone">
            <select
              value={cfg.postTimezone}
              onChange={(e) => update("postTimezone", e.target.value)}
              className={inputClass}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz} className="bg-ink-200">
                  {tz}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Auto-approve">
            <button
              onClick={() => update("autoApprove", !cfg.autoApprove)}
              className={cn(
                "relative inline-flex h-9 w-full items-center justify-between rounded-xl border px-3 text-sm transition-colors",
                cfg.autoApprove
                  ? "border-accent/40 bg-accent/15 text-accent"
                  : "border-white/10 bg-white/[0.03] text-muted",
              )}
            >
              <span>{cfg.autoApprove ? "ON · skip review" : "OFF · require review"}</span>
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  cfg.autoApprove
                    ? "bg-accent shadow-[0_0_10px_2px_rgba(229,255,61,0.6)]"
                    : "bg-white/30",
                )}
              />
            </button>
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Post on these days">
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d) => {
                const active = cfg.postDays.includes(d.key);
                return (
                  <button
                    key={d.key}
                    onClick={() => togglePostDay(d.key)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all",
                      active
                        ? "border-accent/40 bg-accent/15 text-accent"
                        : "border-white/10 bg-white/[0.03] text-muted hover:text-bone",
                    )}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
      </section>

      {/* Pillar rotation */}
      <section className="card p-5">
        <SectionHeader
          label="Pillar + goal rotation"
          blurb="Day-of-week assignment. Strategist uses these to keep the feed on-brand."
        />

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-7">
          {DAYS.map((d, i) => (
            <div key={d.key} className="rounded-xl border border-white/5 bg-black/30 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                {d.label}
              </div>
              <select
                value={cfg.pillarRotation[i]}
                onChange={(e) => updatePillarAt(i, e.target.value as AdPillar)}
                className={cn(inputClass, "mt-2 py-1.5 text-xs")}
              >
                {PILLARS.map((p) => (
                  <option key={p} value={p} className="bg-ink-200">
                    {p}
                  </option>
                ))}
              </select>
              <select
                value={cfg.goalRotation[i]}
                onChange={(e) => updateGoalAt(i, e.target.value as AdGoal)}
                className={cn(inputClass, "mt-1.5 py-1.5 text-xs")}
              >
                {GOALS.map((g) => (
                  <option key={g} value={g} className="bg-ink-200">
                    {g}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      {/* CTA library */}
      <section className="card p-5">
        <SectionHeader
          label="CTA library"
          blurb="The closer for each goal. Strategist appends one of these to every script."
        />
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <CtaField label="Lead-gen" value={cfg.ctaLeadGen} onChange={(v) => update("ctaLeadGen", v)} />
          <CtaField label="Brand" value={cfg.ctaBrand} onChange={(v) => update("ctaBrand", v)} />
          <CtaField label="Course" value={cfg.ctaCourse} onChange={(v) => update("ctaCourse", v)} />
          <CtaField label="Camp" value={cfg.ctaCamp} onChange={(v) => update("ctaCamp", v)} />
          <div className="md:col-span-2">
            <CtaField
              label="Booking"
              value={cfg.ctaBooking}
              onChange={(v) => update("ctaBooking", v)}
            />
          </div>
        </div>
      </section>

      {/* Higgsfield AI influencer config */}
      <section className="card p-5">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-accent" />
          <SectionHeader
            label="Higgsfield · AI influencer"
            blurb="The avatar, course, and ad mode the strategist embeds in every daily Higgsfield prompt. Pasted into Claude.ai with the Higgsfield MCP to render the video."
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Avatar name (for your reference)">
            <input
              type="text"
              value={cfg.higgsfieldAvatarName}
              onChange={(e) => update("higgsfieldAvatarName", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Avatar type">
            <select
              value={cfg.higgsfieldAvatarType}
              onChange={(e) =>
                update(
                  "higgsfieldAvatarType",
                  e.target.value as OperatorConfig["higgsfieldAvatarType"],
                )
              }
              className={inputClass}
            >
              <option value="preset" className="bg-ink-200">
                preset (Higgsfield stock)
              </option>
              <option value="custom" className="bg-ink-200">
                custom (your Soul Character)
              </option>
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Avatar id (Higgsfield uuid)">
              <input
                type="text"
                value={cfg.higgsfieldAvatarId}
                onChange={(e) => update("higgsfieldAvatarId", e.target.value)}
                className={cn(inputClass, "font-mono text-[12px]")}
                placeholder="94950cff-b90a-4416-8384-ce554ff387e1"
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Course / webproduct URL">
              <input
                type="url"
                value={cfg.higgsfieldWebproductUrl}
                onChange={(e) =>
                  update("higgsfieldWebproductUrl", e.target.value)
                }
                className={inputClass}
                placeholder="https://totalballmastery.netlify.app"
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Webproduct id (Higgsfield uuid)">
              <input
                type="text"
                value={cfg.higgsfieldWebproductId}
                onChange={(e) =>
                  update("higgsfieldWebproductId", e.target.value)
                }
                className={cn(inputClass, "font-mono text-[12px]")}
                placeholder="61d71e62-5acf-41d7-85b6-58798582d1d6"
              />
            </Field>
          </div>
          <Field label="Marketing Studio mode">
            <select
              value={cfg.higgsfieldMode}
              onChange={(e) => update("higgsfieldMode", e.target.value)}
              className={inputClass}
            >
              {[
                "UGC",
                "Tutorial",
                "Product Review",
                "Unboxing",
                "Hyper Motion",
                "TV Spot",
                "Wild Card",
                "UGC Virtual Try On",
                "Pro Virtual Try On",
              ].map((m) => (
                <option key={m} value={m} className="bg-ink-200">
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Duration (seconds)">
            <input
              type="number"
              min={5}
              max={60}
              value={cfg.higgsfieldDurationSec}
              onChange={(e) =>
                update(
                  "higgsfieldDurationSec",
                  Math.max(5, Math.min(60, Number(e.target.value) || 15)),
                )
              }
              className={inputClass}
            />
          </Field>
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-white/10 p-3 text-[11px] text-muted">
          <span className="text-bone">How it works:</span> the daily cron writes
          a script and embeds these values in a Higgsfield prompt. You open the
          post in /queue → "Open in Claude.ai" → Claude with the Higgsfield MCP
          renders the video → you paste the URL back. Approve → GHL schedules.
        </div>
      </section>

      {/* Save bar */}
      <div className="sticky bottom-4 z-10 flex items-center justify-end gap-2">
        <button
          onClick={save}
          disabled={saving}
          className={cn(
            "btn-accent text-sm shadow-[0_8px_30px_-10px_rgba(229,255,61,0.5)]",
            saving && "opacity-70",
          )}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : saved ? (
            <>
              <Check className="h-4 w-4" />
              Saved
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save settings
            </>
          )}
        </button>
      </div>
    </div>
  );
}

const inputClass =
  "w-full appearance-none rounded-xl border border-white/5 bg-black/30 px-3 py-2 text-sm text-bone focus:border-accent/40 focus:outline-none";

function SectionHeader({ label, blurb }: { label: string; blurb: string }) {
  return (
    <div>
      <h2 className="h-display text-xl font-semibold">{label}</h2>
      <p className="mt-1 text-xs text-muted">{blurb}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function CtaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className={cn(inputClass, "resize-none text-[13px] leading-relaxed")}
      />
    </Field>
  );
}

// ============================================================================
// Provider connection block — server-rendered status + copyable env keys
// ============================================================================

export function ProviderBlock({
  providers,
}: {
  providers: {
    label: string;
    envKeys: string[];
    configured: boolean;
    instructions: string;
    docs?: string;
  }[];
}) {
  return (
    <section className="card p-5">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-accent" />
        <h2 className="h-display text-xl font-semibold">Provider connections</h2>
      </div>
      <p className="mt-1 text-xs text-muted">
        Add each key to <code className="kbd">.env.local</code> and redeploy.
        Until configured, providers run in mock mode.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {providers.map((p) => (
          <div key={p.label} className="rounded-xl border border-white/5 bg-black/30 p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{p.label}</div>
              <span
                className={
                  p.configured
                    ? "rounded-full border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-accent"
                    : "rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted"
                }
              >
                {p.configured ? "Live" : "Mock"}
              </span>
            </div>
            <div className="mt-2 space-y-1">
              {p.envKeys.map((k) => (
                <code
                  key={k}
                  className="block rounded bg-black/40 px-2 py-1 text-[10px] text-muted"
                >
                  {k}
                </code>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-bone/80">{p.instructions}</p>
            {p.docs && (
              <a
                href={p.docs}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-[11px] text-accent hover:underline"
              >
                Docs →
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function StorageBlock({ live }: { live: boolean }) {
  return (
    <section
      className={cn(
        "card p-5",
        live ? "border-accent/30" : "border-orange-400/30",
      )}
    >
      <div className="flex items-center gap-2">
        <Database
          className={cn("h-4 w-4", live ? "text-accent" : "text-orange-300")}
        />
        <h2 className="h-display text-xl font-semibold">Supabase storage</h2>
        <span
          className={
            live
              ? "ml-auto rounded-full border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-accent"
              : "ml-auto rounded-full border border-orange-400/40 bg-orange-400/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-orange-200"
          }
        >
          {live ? "Live" : "Memory fallback"}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">
        {live
          ? "Queue + config are persisted in your Supabase project."
          : "Running on in-memory storage. Set Supabase keys in .env.local and run supabase/migrations/0001_init.sql in the Supabase SQL editor."}
      </p>

      {!live && (
        <ol className="mt-3 space-y-1.5 text-[11px] text-bone/80">
          <li>
            1. Paste{" "}
            <code className="kbd">supabase/migrations/0001_init.sql</code> into
            your Supabase SQL editor and run.
          </li>
          <li>
            2. Add to <code className="kbd">.env.local</code>:
            <code className="mt-1 block rounded bg-black/40 px-2 py-1 text-[10px] text-muted">
              NEXT_PUBLIC_SUPABASE_URL
              <br />
              NEXT_PUBLIC_SUPABASE_ANON_KEY
              <br />
              SUPABASE_SERVICE_ROLE_KEY
            </code>
          </li>
          <li>3. Redeploy. The Queue + Settings will start persisting.</li>
        </ol>
      )}
    </section>
  );
}
