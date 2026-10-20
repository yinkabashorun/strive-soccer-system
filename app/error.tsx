"use client";

import Link from "next/link";
import { useReportError } from "@/lib/elite/report-error";

// The one error page for the whole app (every route under the root
// layout: player, coach, sign-in, the landing page, the OS). Two jobs:
// say something calm and true to whoever is looking at it, and make sure
// the error is recorded before anything else happens. Oct 19 2026 a
// studio publish ended on Next's default error screen and nothing
// anywhere logged what threw; this page posts every error to
// /api/elite/errors (route, side, digest, message) so the coach
// dashboard and the daily digest see it.
//
// Copy rules: full sentences, no exclamation, no em dashes, never "AI".
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useReportError(error);
  const reference = error?.digest ?? null;

  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-black px-4 py-10 text-bone">
      <div className="elite-card w-full max-w-md p-7 sm:p-8">
        <div className="chip-accent mb-3 inline-flex">Something went wrong</div>
        <h1 className="font-display text-3xl font-black uppercase tracking-tight">
          This page hit an error
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-white/60">
          It has been logged and Coach Yinka will see it. Tap try again. If
          you were in the middle of saving something, check it once you are
          back in.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={reset} className="btn-accent px-5 py-3">
            Try again
          </button>
          <Link href="/" className="btn px-5 py-3">
            Back to the app
          </Link>
        </div>
        {reference && (
          <p className="mt-5 text-[11px] text-white/30">Reference {reference}</p>
        )}
      </div>
    </div>
  );
}
