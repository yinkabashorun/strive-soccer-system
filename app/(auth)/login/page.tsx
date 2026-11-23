import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/elite/LoginForm";
import { isSupabaseConfigured } from "@/lib/elite/supabase/server";
import { inNativeApp } from "@/lib/elite/native-request";
import { isFreeSignupOpen } from "@/lib/elite/tracker-server";

export const metadata: Metadata = {
  title: "Sign in · Strive Elite",
};

export default async function LoginPage() {
  // Inside the App Store app no member account is created (see
  // lib/elite/native-request.ts); the free app's Join free is offered there
  // while free sign-up is open.
  const native = inNativeApp();
  // the free app's door, shown only while a coach has free sign-up open
  const freeOpen = isSupabaseConfigured() ? await isFreeSignupOpen().catch(() => false) : false;
  return (
    <Suspense
      fallback={<div className="elite-card h-96 animate-pulse rounded-3xl" />}
    >
      <LoginForm configured={isSupabaseConfigured()} native={native} freeOpen={freeOpen} />
    </Suspense>
  );
}
