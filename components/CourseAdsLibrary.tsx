"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  CAPTIONS,
  HOOKS,
  PARENT_ADS,
  PLAYER_ADS,
  RETARGETING_ADS,
  UGC_ANGLES,
  UGC_SCRIPTS,
} from "@/lib/course-ads-data";
import { cn } from "@/lib/utils";

type TabKey =
  | "angles"
  | "hooks"
  | "scripts"
  | "captions"
  | "parent"
  | "player"
  | "retargeting";

type Tab = {
  key: TabKey;
  label: string;
  count: number;
  badge: string;
};

export function CourseAdsLibrary() {
  const [active, setActive] = useState<TabKey>("angles");

  const tabs: Tab[] = useMemo(
    () => [
      { key: "angles", label: "UGC Angles", count: UGC_ANGLES.length, badge: "angle" },
      { key: "hooks", label: "Hooks", count: HOOKS.length, badge: "hook" },
      { key: "scripts", label: "30s Scripts", count: UGC_SCRIPTS.length, badge: "script" },
      { key: "captions", label: "Captions", count: CAPTIONS.length, badge: "caption" },
      { key: "parent", label: "Parent Ads", count: PARENT_ADS.length, badge: "parent" },
      { key: "player", label: "Player Ads", count: PLAYER_ADS.length, badge: "player" },
      {
        key: "retargeting",
        label: "Retargeting",
        count: RETARGETING_ADS.length,
        badge: "retarget",
      },
    ],
    [],
  );

  return (
    <div>
      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              active === t.key
                ? "border-accent bg-accent text-black"
                : "border-white/10 bg-white/[0.03] text-muted hover:border-white/20 hover:text-bone",
            )}
          >
            {t.label} <span className="ml-1 opacity-70">· {t.count}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mt-6">
        {active === "angles" && (
          <Grid>
            {UGC_ANGLES.map((a) => (
              <AdCard
                key={a.id}
                number={a.number}
                badge="angle"
                title={a.title}
                body={a.description}
                copyText={`${a.title} — ${a.description}`}
              />
            ))}
          </Grid>
        )}

        {active === "hooks" && (
          <Grid cols={3}>
            {HOOKS.map((h) => (
              <AdCard
                key={h.id}
                number={h.number}
                badge="hook"
                body={h.text}
                copyText={h.text}
                compact
              />
            ))}
          </Grid>
        )}

        {active === "scripts" && (
          <Grid>
            {UGC_SCRIPTS.map((s) => (
              <AdCard
                key={s.id}
                number={s.number}
                badge="script · 30s"
                title={s.title}
                body={s.body}
                copyText={s.body}
              />
            ))}
          </Grid>
        )}

        {active === "captions" && (
          <Grid cols={2}>
            {CAPTIONS.map((c) => (
              <AdCard
                key={c.id}
                number={c.number}
                badge="caption"
                body={c.text}
                copyText={c.text}
              />
            ))}
          </Grid>
        )}

        {active === "parent" && (
          <Grid>
            {PARENT_ADS.map((p) => (
              <AdCard
                key={p.id}
                number={p.number}
                badge="parent"
                title={p.title}
                body={p.body}
                copyText={p.body}
              />
            ))}
          </Grid>
        )}

        {active === "player" && (
          <Grid>
            {PLAYER_ADS.map((p) => (
              <AdCard
                key={p.id}
                number={p.number}
                badge="player"
                title={p.title}
                body={p.body}
                copyText={p.body}
              />
            ))}
          </Grid>
        )}

        {active === "retargeting" && (
          <Grid>
            {RETARGETING_ADS.map((r) => (
              <AdCard
                key={r.id}
                number={r.number}
                badge="retargeting"
                title={r.title}
                body={r.body}
                copyText={r.body}
              />
            ))}
          </Grid>
        )}
      </div>
    </div>
  );
}

function Grid({
  children,
  cols = 2,
}: {
  children: React.ReactNode;
  cols?: 2 | 3;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3",
        cols === 3 ? "md:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2",
      )}
    >
      {children}
    </div>
  );
}

function AdCard({
  number,
  badge,
  title,
  body,
  copyText,
  compact = false,
}: {
  number: number;
  badge: string;
  title?: string;
  body: string;
  copyText: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // noop
    }
  }

  return (
    <article className="card relative overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg border border-accent/30 bg-accent/10 text-[11px] font-bold text-accent tabular-nums">
            {String(number).padStart(2, "0")}
          </span>
          <span className="chip text-[10px]">{badge}</span>
        </div>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-muted hover:border-white/20 hover:text-bone"
        >
          {copied ? (
            <Check className="h-3 w-3 text-accent" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {title && (
        <h3 className="h-display mt-3 text-base font-semibold leading-snug">
          {title}
        </h3>
      )}
      <p
        className={cn(
          "leading-relaxed text-bone/90",
          compact ? "mt-3 text-sm italic" : "mt-3 text-sm",
        )}
      >
        {body}
      </p>
    </article>
  );
}
