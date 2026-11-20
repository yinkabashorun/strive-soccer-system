import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Wordmark } from "@/components/elite/Wordmark";
import { ProJoinForm } from "@/components/elite/ProJoinForm";
import { getViewer } from "@/lib/elite/session";
import { isStripeConfigured } from "@/lib/stripe";
import { isSupabaseConfigured } from "@/lib/elite/supabase/server";
import { birthYears } from "@/lib/elite/tracker";
import { nyToday } from "@/lib/elite/time";
import { PRO_PAGE } from "@/lib/elite/pro";

export const metadata: Metadata = {
  title: "Start Strive Pro",
};

export const dynamic = "force-dynamic";

// Strive Pro sign-up (074). A signed-in viewer never sees this form: a
// member goes to Home (where an unpaid Pro membership shows the checkout),
// a coach to the coach side.
export default async function ProJoinPage() {
  const viewer = await getViewer();
  if (viewer && !viewer.demo) redirect(viewer.role === "player" ? "/dashboard" : "/coach");

  const today = nyToday();
  return (
    <div className="mx-auto w-full max-w-md px-4 pb-16 pt-[calc(1.25rem+env(safe-area-inset-top))]">
      <header className="flex items-center justify-between">
        <Link href={PRO_PAGE} className="inline-flex h-11 items-center gap-1 pr-3 text-[15px] font-medium text-white/70">
          <ChevronLeft className="h-5 w-5" /> Back
        </Link>
        <Wordmark href={null} />
      </header>
      <div className="mt-6">
        <ProJoinForm
          configured={isSupabaseConfigured()}
          payments={isStripeConfigured()}
          today={today}
          years={birthYears(today)}
        />
      </div>
    </div>
  );
}
