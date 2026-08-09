import type { Metadata } from "next";
import { SignupForm } from "@/components/elite/SignupForm";
import { isSupabaseConfigured } from "@/lib/elite/supabase/server";

export const metadata: Metadata = {
  title: "Get started · Strive Elite",
};

export default function SignupPage() {
  return <SignupForm configured={isSupabaseConfigured()} />;
}
