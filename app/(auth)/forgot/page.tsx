import type { Metadata } from "next";
import { ForgotForm } from "@/components/elite/ForgotForm";
import { isSupabaseConfigured } from "@/lib/elite/supabase/server";

export const metadata: Metadata = {
  title: "Reset password · Strive Elite",
};

export default function ForgotPage() {
  return <ForgotForm configured={isSupabaseConfigured()} />;
}
