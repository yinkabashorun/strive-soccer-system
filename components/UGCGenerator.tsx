"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Copy,
  Loader2,
  Save,
  Sparkles,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Audience = "player" | "parent" | "both";
type Platform = "TikTok" | "IG Reel" | "Meta Ad" | "YouTube Shorts";

type Output = {
  hook: string;
  script: string;
  caption: string;
  cta: string;
  shotList: string;
  voiceoverScript: string;
  landingAngle: string;
  vslSection: string;
  provider: "anthropic" | "fallback" | string;
  input: {
    audience: Audience;
    painPoint: string;
    transformation: string;
    tone: string;
    cta: string;
    platform: Platform;
  };
};

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "ok"; id: string }
  | { kind: "error"; message: string };

const TONES = [
  "bold",
  "emotional",
  "coach-style",
  "viral TikTok",
  "parent-trust",
] as const;

export function UGCGenerator({
  anthropicConfigured,
  supabaseConfigured,
}: {
  anthropicConfigured: boolean;
  supabaseConfigured: boolean;
}) {
  const [audience, setAudience] = useState<Audience>("parent");
  const [painPoint, setPainPoint] = useState("");
  const [transformation, setTransformation] = useState("");
  const [tone, setTone] = useState<string>("coach-style");
  const [cta, setCta] = useState("Get the Strive Dribbling Course");
  const [platform, setPlatform] = useState<Platform>("TikTok");
  const [generating, setGenerating] = useState(false);
  const [out, setOut] = useState<Output | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [copied, setCopied] = useState<string | null>(null);

  async function generate() {
    setGenerating(true);
    setError(null);
    setSave({ kind: "idle" });
    try {
      const res = await fetch("/api/ugc/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience,
          painPoint,
          transformation,
          tone,
          cta,
          platform,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || `Generation failed (${res.status})`);
        return;
      }
      setOut(data as Output);
    } catch (err) {
      setError(err instanceof Error ? err.message : "request_failed");
    } finally {
      setGenerating(false);
    }
  }

  async function saveCreative() {
    if (!out) return;
    setSave({ kind: "saving" });
    try {
      const res = await fetch("/api/creatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: out.hook.slice(0, 80),
          audience: out.input.audience,
          painPoint: out.input.painPoint,
          transformation: out.input.transformation,
          tone: out.input.tone,
          platform: out.input.platform,
          hook: out.hook,
          script: out.script,
          caption: out.caption,
          cta: out.cta,
          shotList: out.shotList,
          voiceoverScript: out.voiceoverScript,
          landingAngle: out.landingAngle,
          vslSection: out.vslSection,
          status: "script_ready",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.creative?.id) {
        setSave({
          kind: "error",
          message: data?.error || `Save failed (${res.status})`,
        });
        return;
      }
      setSave({ kind: "ok", id: data.creative.id });
    } catch (err) {
      setSave({
        kind: "error",
        message: err instanceof Error ? err.message : "request_failed",
      });
    }
  }

  async function copyField(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1400);
    } catch {
      // noop
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Form */}
      <section className="card relative overflow-hidden p-6 lg:col-span-1">
        <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative">
          <div className="chip-accent">
            <Sparkles className="h-3 w-3" />
            Inputs
          </div>
          <h2 className="h-display mt-2 text-lg font-semibold">Brief Claude.</h2>

          <div className="mt-4 space-y-3">
            <Field label="Audience">
              <div className="grid grid-cols-3 gap-1.5">
                {(["parent", "player", "both"] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAudience(a)}
                    className={cn(
                      "rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                      audience === a
                        ? "border-accent bg-accent text-black"
                        : "border-white/10 bg-white/[0.03] text-muted hover:border-white/20 hover:text-bone",
                    )}
                  >
                    {a === "both" ? "Both" : a[0].toUpperCase() + a.slice(1)}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Pain point">
              <textarea
                value={painPoint}
                onChange={(e) => setPainPoint(e.target.value)}
                placeholder="My kid panics every time he gets the ball under pressure."
                className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-bone placeholder:text-muted focus:border-white/20 focus:outline-none"
                rows={2}
              />
            </Field>

            <Field label="Desired transformation">
              <textarea
                value={transformation}
                onChange={(e) => setTransformation(e.target.value)}
                placeholder="Composed on the ball, taking on defenders 1v1."
                className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-bone placeholder:text-muted focus:border-white/20 focus:outline-none"
                rows={2}
              />
            </Field>

            <Field label="Tone">
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-bone outline-none hover:border-white/20"
              >
                {TONES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Call to action">
              <input
                value={cta}
                onChange={(e) => setCta(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-bone outline-none focus:border-white/20"
              />
            </Field>

            <Field label="Platform">
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as Platform)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-bone outline-none hover:border-white/20"
              >
                <option value="TikTok">TikTok</option>
                <option value="IG Reel">IG Reel</option>
                <option value="Meta Ad">Meta Ad</option>
                <option value="YouTube Shorts">YouTube Shorts</option>
              </select>
            </Field>

            <button
              onClick={generate}
              disabled={generating}
              className="btn-accent w-full disabled:opacity-60"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Writing the ad…
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Generate UGC ad
                </>
              )}
            </button>

            {!anthropicConfigured && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-300">
                ANTHROPIC_API_KEY not set — using on-brand template fallback.
              </div>
            )}
            {!supabaseConfigured && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-300">
                Supabase not wired — Save will fail until env is set.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Output */}
      <section className="card p-6 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="chip">Output</div>
            <h2 className="h-display mt-2 text-lg font-semibold">
              {out ? "Your UGC ad." : "Fill the brief, hit Generate."}
            </h2>
          </div>
          {out && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted">
                {out.input.platform} ·{" "}
                <span
                  className={
                    out.provider === "anthropic" ? "text-accent" : "text-bone"
                  }
                >
                  {out.provider === "anthropic" ? "Claude (live)" : "fallback"}
                </span>
              </span>
              <button
                onClick={saveCreative}
                disabled={save.kind === "saving" || !supabaseConfigured}
                className="btn-accent disabled:opacity-60"
              >
                {save.kind === "saving" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save to Library
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.05] p-3 text-xs text-red-300">
            {error}
          </div>
        )}

        {save.kind === "ok" && (
          <div className="mt-4 rounded-xl border border-accent/30 bg-accent/[0.06] p-3 text-xs text-bone">
            <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-accent" />
            Saved to Library · status set to{" "}
            <code className="kbd">script_ready</code>
          </div>
        )}
        {save.kind === "error" && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.05] p-3 text-xs text-red-300">
            {save.message}
          </div>
        )}

        {out && (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <OutBlock
              label="Hook"
              value={out.hook}
              onCopy={() => copyField("hook", out.hook)}
              copied={copied === "hook"}
            />
            <OutBlock
              label="Caption"
              value={out.caption}
              onCopy={() => copyField("caption", out.caption)}
              copied={copied === "caption"}
            />
            <OutBlock
              label="CTA"
              value={out.cta}
              onCopy={() => copyField("cta", out.cta)}
              copied={copied === "cta"}
            />
            <OutBlock
              label="Landing angle"
              value={out.landingAngle}
              onCopy={() => copyField("landingAngle", out.landingAngle)}
              copied={copied === "landingAngle"}
            />
            <OutBlock
              label="VSL section"
              value={out.vslSection}
              onCopy={() => copyField("vslSection", out.vslSection)}
              copied={copied === "vslSection"}
            />
            <div className="md:col-span-1">
              <OutBlock
                label="Voiceover (~60w)"
                value={out.voiceoverScript}
                onCopy={() => copyField("voiceover", out.voiceoverScript)}
                copied={copied === "voiceover"}
              />
            </div>
            <div className="md:col-span-2">
              <OutBlock
                label="30s Script"
                value={out.script}
                onCopy={() => copyField("script", out.script)}
                copied={copied === "script"}
                mono
              />
            </div>
            <div className="md:col-span-2">
              <OutBlock
                label="Shot list"
                value={out.shotList}
                onCopy={() => copyField("shotList", out.shotList)}
                copied={copied === "shotList"}
                mono
              />
            </div>
          </div>
        )}
      </section>
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
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
        {label}
      </div>
      {children}
    </div>
  );
}

function OutBlock({
  label,
  value,
  onCopy,
  copied,
  mono = false,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-black/40 p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
          {label}
        </div>
        <button
          onClick={onCopy}
          className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-bone"
        >
          <Copy className="h-3 w-3" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div
        className={cn(
          "mt-2 whitespace-pre-wrap leading-relaxed text-bone/90",
          mono ? "font-mono text-xs" : "text-sm",
        )}
      >
        {value}
      </div>
    </div>
  );
}
