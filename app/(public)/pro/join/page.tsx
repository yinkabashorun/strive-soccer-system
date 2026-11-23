import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProJoinForm } from "@/components/elite/ProJoinForm";
import { getViewer } from "@/lib/elite/session";
import { isStripeConfigured } from "@/lib/stripe";
import { isSupabaseConfigured } from "@/lib/elite/supabase/server";
import { birthYears } from "@/lib/elite/tracker";
import { nyToday } from "@/lib/elite/time";

export const metadata: Metadata = {
  title: "Start Strive Pro",
};

export const dynamic = "force-dynamic";

// Strive Pro sign-up (074). A signed-in viewer never sees this form: a
// member goes to Home (where an unpaid Pro membership shows the checkout),
// a coach to the coach side. The form is one question a screen, full
// screen, with its own back arrow to the Pro page (Nov 23 2026).
export default async function ProJoinPage() {
  const viewer = await getViewer();
  if (viewer && !viewer.demo) redirect(viewer.role === "player" ? "/dashboard" : "/coach");

  const today = nyToday();
  return (
    <div className="member-ui">
      <ProJoinForm configured={isSupabaseConfigured()} payments={isStripeConfigured()} today={today} years={birthYears(today)} />
    </div>
  );
}
