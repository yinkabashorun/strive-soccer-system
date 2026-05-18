"use client";

import { useState } from "react";
import {
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Globe,
  Loader2,
  Save,
} from "lucide-react";

type Funnel = {
  id?: string;
  slug?: string;
  product_name: string;
  vsl_url: string | null;
  checkout_url: string | null;
  offer_price_cents: number;
  currency: string;
  lead_magnet_url: string | null;
  top_cta: string | null;
  current_offer: string | null;
  main_promise: string | null;
  objections_handled: string[];
  testimonials: string[];
  conversion_notes: string | null;
};

const DEFAULT: Funnel = {
  product_name: "Strive Dribbling Course",
  vsl_url: "",
  checkout_url: "",
  offer_price_cents: 9700,
  currency: "usd",
  lead_magnet_url: "",
  top_cta: "Get the Dribbling Course · $97",
  current_offer: "",
  main_promise: "Become unrecognizable on the ball in 30 days.",
  objections_handled: [],
  testimonials: [],
  conversion_notes: "",
};

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "ok"; at: string }
  | { kind: "error"; message: string };

export function FunnelEditor({
  initial,
  supabaseConfigured,
}: {
  initial: Funnel | null;
  supabaseConfigured: boolean;
}) {
  const [funnel, setFunnel] = useState<Funnel>(initial ?? DEFAULT);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [objectionDraft, setObjectionDraft] = useState("");
  const [testimonialDraft, setTestimonialDraft] = useState("");

  function update<K extends keyof Funnel>(key: K, value: Funnel[K]) {
    setFunnel((f) => ({ ...f, [key]: value }));
  }

  async function saveFunnel() {
    setSave({ kind: "saving" });
    try {
      const res = await fetch("/api/funnel", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "dribbling-course", ...funnel }),
      });
      const data = await res.json();
      if (!res.ok || !data?.funnel) {
        setSave({
          kind: "error",
          message: data?.error || `Save failed (${res.status})`,
        });
        return;
      }
      setSave({ kind: "ok", at: new Date().toLocaleTimeString() });
    } catch (err) {
      setSave({
        kind: "error",
        message: err instanceof Error ? err.message : "request_failed",
      });
    }
  }

  async function createCheckoutTest() {
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceCents: funnel.offer_price_cents,
          productName: funnel.product_name,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        alert(data?.error ?? "Stripe checkout failed.");
        return;
      }
      window.open(data.url, "_blank");
    } catch (err) {
      alert(err instanceof Error ? err.message : "request_failed");
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Left column: core offer */}
      <section className="card p-6 lg:col-span-2">
        <div className="chip">Offer</div>
        <h2 className="h-display mt-2 text-lg font-semibold">
          What you're selling.
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Product name">
            <input
              value={funnel.product_name}
              onChange={(e) => update("product_name", e.target.value)}
              className="input"
            />
          </Field>
          <Field label={`Price · ${funnel.currency.toUpperCase()}`}>
            <div className="flex items-center gap-2">
              <span className="text-muted">$</span>
              <input
                type="number"
                value={Math.round(funnel.offer_price_cents / 100)}
                onChange={(e) =>
                  update(
                    "offer_price_cents",
                    Math.max(0, Math.round(Number(e.target.value) * 100)),
                  )
                }
                className="input"
              />
            </div>
          </Field>

          <Field label="VSL landing page URL" full>
            <input
              value={funnel.vsl_url ?? ""}
              onChange={(e) => update("vsl_url", e.target.value)}
              placeholder="https://strivesoccer.com/dribbling-course-vsl"
              className="input"
            />
          </Field>
          <Field label="Checkout URL (Stripe-hosted or other)" full>
            <input
              value={funnel.checkout_url ?? ""}
              onChange={(e) => update("checkout_url", e.target.value)}
              placeholder="https://strivesoccer.com/checkout"
              className="input"
            />
          </Field>
          <Field label="Lead magnet / masterclass URL" full>
            <input
              value={funnel.lead_magnet_url ?? ""}
              onChange={(e) => update("lead_magnet_url", e.target.value)}
              placeholder="https://strivesoccer.com/free-masterclass"
              className="input"
            />
          </Field>
          <Field label="Top CTA" full>
            <input
              value={funnel.top_cta ?? ""}
              onChange={(e) => update("top_cta", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Current offer / promo" full>
            <input
              value={funnel.current_offer ?? ""}
              onChange={(e) => update("current_offer", e.target.value)}
              placeholder="$97 today · $147 after Friday"
              className="input"
            />
          </Field>
          <Field label="Main promise" full>
            <textarea
              value={funnel.main_promise ?? ""}
              onChange={(e) => update("main_promise", e.target.value)}
              className="input min-h-[72px]"
              rows={2}
            />
          </Field>
          <Field label="Conversion notes (what's working/not)" full>
            <textarea
              value={funnel.conversion_notes ?? ""}
              onChange={(e) => update("conversion_notes", e.target.value)}
              className="input min-h-[72px]"
              rows={3}
            />
          </Field>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={saveFunnel}
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
                Save funnel
              </>
            )}
          </button>
          <button onClick={createCheckoutTest} className="btn">
            <CreditCard className="h-4 w-4" />
            Open Stripe checkout (test)
          </button>
          {funnel.vsl_url && (
            <a
              href={funnel.vsl_url}
              target="_blank"
              rel="noreferrer"
              className="btn"
            >
              <Globe className="h-4 w-4" />
              Open VSL
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {!supabaseConfigured && (
          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-300">
            Supabase not wired — Save will fail until env is set.
          </div>
        )}
        {save.kind === "ok" && (
          <div className="mt-3 rounded-lg border border-accent/30 bg-accent/[0.06] px-3 py-2 text-[11px] text-bone">
            <CheckCircle2 className="mr-1 inline h-3 w-3 text-accent" />
            Saved at {save.at}
          </div>
        )}
        {save.kind === "error" && (
          <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/[0.05] px-3 py-2 text-[11px] text-red-300">
            {save.message}
          </div>
        )}
      </section>

      {/* Right column: objections + testimonials */}
      <section className="space-y-4 lg:col-span-1">
        <ListBlock
          title="Objections handled"
          subtitle="What stops people from buying — and how the VSL answers it."
          placeholder="e.g. My kid already has a coach"
          draft={objectionDraft}
          setDraft={setObjectionDraft}
          items={funnel.objections_handled}
          onAdd={(v) =>
            update("objections_handled", [...funnel.objections_handled, v])
          }
          onRemove={(i) =>
            update(
              "objections_handled",
              funnel.objections_handled.filter((_, j) => j !== i),
            )
          }
        />
        <ListBlock
          title="Testimonials / proof"
          subtitle="Names, quotes, before/after — anything you can drop into the VSL."
          placeholder="e.g. Jordan (U10) — coach asked what we changed"
          draft={testimonialDraft}
          setDraft={setTestimonialDraft}
          items={funnel.testimonials}
          onAdd={(v) => update("testimonials", [...funnel.testimonials, v])}
          onRemove={(i) =>
            update(
              "testimonials",
              funnel.testimonials.filter((_, j) => j !== i),
            )
          }
        />
      </section>

      {/* Tailwind utility class */}
      <style>{`
        .input {
          width: 100%;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.03);
          padding: 8px 12px;
          font-size: 14px;
          color: #f5f4ef;
          outline: none;
        }
        .input:focus { border-color: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
  full = false,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
        {label}
      </div>
      {children}
    </div>
  );
}

function ListBlock({
  title,
  subtitle,
  placeholder,
  draft,
  setDraft,
  items,
  onAdd,
  onRemove,
}: {
  title: string;
  subtitle: string;
  placeholder: string;
  draft: string;
  setDraft: (v: string) => void;
  items: string[];
  onAdd: (v: string) => void;
  onRemove: (i: number) => void;
}) {
  function add() {
    const v = draft.trim();
    if (!v) return;
    onAdd(v);
    setDraft("");
  }
  return (
    <div className="card p-5">
      <div className="chip">{title}</div>
      <p className="mt-1 text-[11px] text-muted">{subtitle}</p>
      <div className="mt-3 space-y-2">
        {items.map((v, i) => (
          <div
            key={`${i}-${v}`}
            className="flex items-start gap-2 rounded-xl border border-white/5 bg-ink-200/40 p-2.5 text-xs"
          >
            <span className="flex-1">{v}</span>
            <button
              onClick={() => onRemove(i)}
              className="text-muted hover:text-red-300"
            >
              ×
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/10 p-3 text-center text-[11px] text-muted">
            Nothing yet.
          </div>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="input"
        />
        <button onClick={add} className="btn-accent shrink-0">
          Add
        </button>
      </div>
    </div>
  );
}
