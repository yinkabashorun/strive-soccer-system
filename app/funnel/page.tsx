import { PageHeader } from "@/components/PageHeader";
import { FunnelEditor } from "@/components/FunnelEditor";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const revalidate = 0;
export const dynamic = "force-dynamic";

type Funnel = {
  id: string;
  slug: string;
  product_name: string;
  vsl_url: string | null;
  checkout_url: string | null;
  offer_price_cents: number;
  currency: string;
  lead_magnet_url: string | null;
  top_cta: string | null;
  current_offer: string | null;
  main_promise: string | null;
  objections_handled: string[];
  testimonials: string[];
  conversion_notes: string | null;
  updated_at: string;
};

async function loadFunnel(): Promise<Funnel | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const db = supabase();
    const { data, error } = await db
      .from("funnel_settings")
      .select("*")
      .eq("slug", "dribbling-course")
      .maybeSingle();
    if (error) throw error;
    return (data as Funnel) ?? null;
  } catch {
    return null;
  }
}

export default async function FunnelPage() {
  const funnel = await loadFunnel();
  return (
    <div>
      <PageHeader
        eyebrow="VSL Funnel · Dribbling Course"
        title="The page that turns clicks into $97 sales."
        subtitle="Single source of truth for your VSL, checkout URL, offer, main promise, objections, and testimonials. Edit and save — every change persists to Supabase."
      />
      <FunnelEditor
        initial={funnel}
        supabaseConfigured={isSupabaseConfigured()}
      />
    </div>
  );
}
