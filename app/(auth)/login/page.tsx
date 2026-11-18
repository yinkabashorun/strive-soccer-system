import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/elite/LoginForm";
import { isSupabaseConfigured } from "@/lib/elite/supabase/server";
import { inNativeApp } from "@/lib/elite/native-request";

export const metadata: Metadata = {
  title: "Sign in · Strive Elite",
};

export default function LoginPage() {
  // Inside the App Store app the screen is sign-in only (see
  // lib/elite/native-request.ts).
  const native = inNativeApp();
  return (
    <Suspense
      fallback={<div className="elite-card h-96 animate-pulse rounded-3xl" />}
    >
      <LoginForm configured={isSupabaseConfigured()} native={native} />
    </Suspense>
  );
}
