"use client";

import { useState, useTransition } from "react";
import { PARENT_GUARDIAN, PARENT_NEEDS_BOXES, PARENT_TERMS_LEAD, parentStart } from "@/lib/elite/parent-link";
import { startAsParent } from "@/lib/elite/parent-link-actions";
import { AppLink } from "./AppLink";

// The parent's part of the page: who they are, the two boxes (never ticked
// for them), and the button that opens the card checkout for their player.
export function ParentStartForm({ code, first }: { code: string; first: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [guardian, setGuardian] = useState(false);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const go = () => {
    if (!guardian || !terms || name.trim().length < 3) {
      setError(PARENT_NEEDS_BOXES);
      return;
    }
    start(async () => {
      setError(null);
      const res = await startAsParent({ code, guardian, terms, guardianName: name, email });
      if (res.ok) window.location.assign(res.url);
      else setError(res.error);
    });
  };

  const field = "mt-1.5 h-12 w-full rounded-2xl border border-white/20 bg-transparent px-4 text-[16px] text-bone outline-none focus:border-white/60";
  return (
    <form
      className="mt-7"
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
    >
      <label className="block text-[13px] text-white/70">
        Your full name
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
      </label>
      <label className="mt-4 block text-[13px] text-white/70">
        Your email, for the receipt
        <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" />
      </label>
      <label className="mt-5 flex min-h-[44px] items-start gap-3 text-[14px] leading-relaxed text-white/85">
        <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={guardian} onChange={(e) => setGuardian(e.target.checked)} />
        {PARENT_GUARDIAN}
      </label>
      <label className="mt-2 flex min-h-[44px] items-start gap-3 text-[14px] leading-relaxed text-white/85">
        <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
        <span>
          {PARENT_TERMS_LEAD}{" "}
          <AppLink href="/terms" title="Terms of Service" className="underline underline-offset-2">
            Terms of Service
          </AppLink>{" "}
          and the{" "}
          <AppLink href="/privacy" title="Privacy Policy" className="underline underline-offset-2">
            Privacy Policy
          </AppLink>
          .
        </span>
      </label>
      {error ? <p className="mt-4 text-[14px] text-white">{error}</p> : null}
      <button type="submit" disabled={busy} className="mt-6 inline-flex h-14 w-full items-center justify-center rounded-2xl bg-bone px-6 text-[16px] font-semibold text-black disabled:opacity-60">
        {parentStart(first)}
      </button>
    </form>
  );
}
