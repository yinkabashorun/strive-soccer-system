import type { Metadata } from "next";
import { headers } from "next/headers";
import { Wordmark } from "@/components/elite/Wordmark";
import { PRO_SESSION_PARAM } from "@/lib/elite/pro";
import { confirmProSession } from "@/lib/elite/pro-server";
import { rateLimit } from "@/lib/rate-limit";

export const metadata: Metadata = { title: "Strive Pro", robots: { index: false } };
export const dynamic = "force-dynamic";

// Where a Strive Pro checkout opened from inside the iPhone app comes back
// to (lib/elite/pro.ts PRO_APP_RETURN). The checkout runs in a sheet over
// the app, and the sheet has no sign-in of its own, so this page needs
// none: it says what happened and to close the sheet.
//
// With a checkout session in the address it also asks Stripe about that
// session, and a paid Strive Pro checkout switches its own member on here
// (the same call the webhook makes), so the app finds the membership on
// the moment the sheet closes. The id is only a pointer: nobody is
// switched on unless Stripe says that session was paid, and only the
// member that session was opened for.
export default async function ProDonePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const raw = searchParams?.[PRO_SESSION_PARAM];
  const sessionId = typeof raw === "string" ? raw : "";
  const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const paid = sessionId && rateLimit(`pro-done:${ip}`, 20, 10 * 60_000) ? await confirmProSession(sessionId) : false;

  return (
    <div className="mx-auto flex min-h-[100svh] w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <Wordmark href={null} size="lg" />
      <h1 className="mt-8 font-display text-[34px] font-black uppercase leading-none">
        {paid ? "You're in." : sessionId ? "Almost there." : "No charge was made."}
      </h1>
      <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-white/70">
        {paid
          ? "Your membership is on. Tap Done at the top to go back to the app."
          : sessionId
            ? "Your payment is being confirmed. Tap Done at the top to go back to the app."
            : "Nothing was started. Tap Done at the top to go back to the app."}
      </p>
    </div>
  );
}
