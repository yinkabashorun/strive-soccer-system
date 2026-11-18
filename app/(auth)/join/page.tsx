import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { JoinForm } from "@/components/elite/JoinForm";
import { getViewer } from "@/lib/elite/session";
import { isSupabaseConfigured } from "@/lib/elite/supabase/server";
import { inNativeApp } from "@/lib/elite/native-request";
import { homePathFor, isFreeSignupOpen, trackerFor } from "@/lib/elite/tracker-server";
import { JOIN_CLOSED_MESSAGE, cleanReferralCode, friendAskPath } from "@/lib/elite/tracker";

export const metadata: Metadata = {
  title: "Start your training log · Strive Elite",
};

export const dynamic = "force-dynamic";

// The free training log's front door (migration 069). Open to anyone only
// while a coach has free sign-up switched on at /coach/free; otherwise it
// says so and offers sign-in. A teammate's link carries ?ref=CODE: whoever
// joins with it becomes that teammate's friend.
export default async function JoinPage({
  searchParams,
}: {
  searchParams?: { ref?: string };
}) {
  // Inside the App Store app, accounts are not created (the existing
  // rule, lib/elite/native-request.ts): the screen there is sign-in only.
  if (inNativeApp()) redirect("/login");

  const ref = cleanReferralCode(searchParams?.ref);
  const viewer = await getViewer();
  if (viewer) {
    // Already has a free account and opened a teammate's link: their own
    // week, where one sheet asks whether to add that teammate as a friend.
    if (ref && (await trackerFor(viewer))) redirect(friendAskPath(ref));
    if (!viewer.demo) redirect(await homePathFor(viewer));
  }

  // With no database at all (a local build) the form is shown so it can
  // be looked at; it cannot create anything and says so, like the invite
  // form does.
  const configured = isSupabaseConfigured();
  if (configured && !(await isFreeSignupOpen())) {
    return (
      <div className="elite-card p-7 sm:p-8">
        <h1 className="font-display text-3xl font-black uppercase tracking-tight">
          Not open yet
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-white/70">{JOIN_CLOSED_MESSAGE}</p>
        <Link href="/login" className="btn-accent mt-6 w-full px-6 py-3.5 text-base">
          Sign in
        </Link>
      </div>
    );
  }

  return <JoinForm configured={configured} referral={ref ?? ""} />;
}
