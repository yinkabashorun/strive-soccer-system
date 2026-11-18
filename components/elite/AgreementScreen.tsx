"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { acceptAgreement, type AgreeState } from "@/lib/elite/legal-actions";
import { AGREEMENT_POINTS, GUARDIAN_STATEMENT, TERMS_STATEMENT } from "@/lib/elite/legal";
import { Wordmark } from "./Wordmark";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-14 w-full items-center justify-center rounded-2xl bg-white font-display text-xl font-black uppercase tracking-wide text-black disabled:opacity-60 active:scale-[0.98]"
    >
      {pending ? "Saving" : "Agree and continue"}
    </button>
  );
}

// Shown once to a member who has not yet accepted the current Terms and
// Privacy Policy (and once more whenever they change). One short screen:
// what is being agreed to, two boxes, a name, one button.
export function AgreementScreen({ signOut }: { signOut: () => Promise<void> }) {
  const [state, action] = useFormState<AgreeState, FormData>(acceptAgreement, { error: null });

  return (
    <div className="min-h-[100svh] bg-black px-5 py-10 text-bone">
      <div className="mx-auto max-w-md">
        <Wordmark href={null} size="lg" />
        <h1 className="mt-8 font-display text-4xl font-black uppercase leading-[0.95]">
          Before you train
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-white/70">
          A parent or guardian needs to read and accept our terms. It takes a minute and we
          only ask again if they change.
        </p>

        <ul className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          {AGREEMENT_POINTS.map((point) => (
            <li key={point} className="flex gap-3 text-sm leading-relaxed text-white/75">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              {point}
            </li>
          ))}
        </ul>

        <p className="mt-4 text-sm text-white/65">
          Read them in full:{" "}
          <Link href="/terms" target="_blank" className="tap font-semibold text-bone underline underline-offset-4">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" target="_blank" className="tap font-semibold text-bone underline underline-offset-4">
            Privacy Policy
          </Link>
          .
        </p>

        <form action={action} className="mt-6 space-y-4">
          <label className="flex min-h-[44px] items-start gap-3 py-1 text-[15px] leading-snug text-bone">
            <input type="checkbox" name="guardian" required className="mt-0.5 h-6 w-6 shrink-0 accent-white" />
            <span>{GUARDIAN_STATEMENT}</span>
          </label>
          <label className="flex min-h-[44px] items-start gap-3 py-1 text-[15px] leading-snug text-bone">
            <input type="checkbox" name="terms" required className="mt-0.5 h-6 w-6 shrink-0 accent-white" />
            <span>{TERMS_STATEMENT}</span>
          </label>

          <div>
            <label htmlFor="guardian_name" className="mb-1.5 block text-sm font-semibold text-white/75">
              Full name of the adult agreeing
            </label>
            <input
              id="guardian_name"
              name="guardian_name"
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
              className="h-12 w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 text-base text-bone outline-none focus:border-white/40"
            />
          </div>

          {state.error && (
            <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
              {state.error}
            </p>
          )}

          <Submit />
        </form>

        <div className="mt-6 flex items-center justify-center gap-6 text-sm text-white/55">
          <Link href="/account" className="tap underline-offset-4 hover:underline">
            Account
          </Link>
          <form action={signOut}>
            <button className="tap underline-offset-4 hover:underline">Sign out</button>
          </form>
        </div>
      </div>
    </div>
  );
}
