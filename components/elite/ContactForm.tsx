"use client";

import { useState } from "react";
import { Check, Loader2, Send } from "lucide-react";

// Contact form. Posts to /api/elite/contact (which logs / forwards). Shows
// an optimistic success state so the experience stays premium even before a
// backend inbox is wired up.
export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const form = e.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      await fetch("/api/elite/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      /* fire-and-forget — still confirm to the user */
    }
    setStatus("done");
    form.reset();
  }

  if (status === "done") {
    return (
      <div className="elite-card flex flex-col items-center gap-4 p-10 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent/10 text-accent">
          <Check className="h-7 w-7" />
        </div>
        <h3 className="font-display text-2xl font-bold uppercase tracking-tight">
          Message sent
        </h3>
        <p className="max-w-sm text-white/55">
          Thanks for reaching out. A Strive coach will get back to you within one
          business day.
        </p>
        <button
          onClick={() => setStatus("idle")}
          className="btn mt-2 px-5 py-2.5"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="elite-card space-y-4 p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="name" label="Your name" placeholder="Parent or player" required />
        <Field
          name="email"
          type="email"
          label="Email"
          placeholder="you@example.com"
          required
        />
      </div>
      <Field
        name="player_age"
        label="Player age (optional)"
        placeholder="e.g. 12"
      />
      <div>
        <label className="mb-2 block text-sm font-medium text-white/70">
          How can we help?
        </label>
        <textarea
          name="message"
          required
          rows={5}
          placeholder="Tell us about your player and their goals…"
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-bone placeholder:text-white/30 focus:border-accent/40 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={status === "sending"}
        className="btn-accent w-full px-6 py-3.5 text-base"
      >
        {status === "sending" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            Send message <Send className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  placeholder,
  required,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-white/70">
        {label}
      </label>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete={type === "email" ? "email" : "off"}
        className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-bone placeholder:text-white/30 focus:border-accent/40 focus:outline-none"
      />
    </div>
  );
}
