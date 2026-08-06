import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/elite/LoginForm";
import { isSupabaseConfigured } from "@/lib/elite/supabase/server";

export const metadata: Metadata = {
  title: "Sign in · Strive Elite",
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={<div className="elite-card h-96 animate-pulse rounded-3xl" />}
    >
      <LoginForm configured={isSupabaseConfigured()} />
    </Suspense>
  );
}
