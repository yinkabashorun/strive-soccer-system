import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { CreativeLibrary } from "@/components/CreativeLibrary";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const revalidate = 0;
export const dynamic = "force-dynamic";

type Creative = {
  id: string;
  title: string | null;
  audience: string | null;
  pain_point: string | null;
  transformation: string | null;
  tone: string | null;
  platform: string | null;
  hook: string | null;
  script: string | null;
  caption: string | null;
  cta: string | null;
  shot_list: string | null;
  voiceover_script: string | null;
  landing_angle: string | null;
  vsl_section: string | null;
  status: string;
  voiceover_audio_url: string | null;
  fal_request_id: string | null;
  video_url: string | null;
  performance_notes: string | null;
  created_at: string;
};

async function getCreatives(): Promise<Creative[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const db = supabase();
    const { data, error } = await db
      .from("creatives")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data as Creative[]) ?? [];
  } catch {
    return [];
  }
}

export default async function LibraryPage() {
  const creatives = await getCreatives();
  return (
    <div>
      <PageHeader
        eyebrow={`Creative Library · ${creatives.length} ad${creatives.length === 1 ? "" : "s"}`}
        title="Every UGC ad you've generated."
        subtitle="Tag winners, kill losers, copy what works. Each card has the full script, voiceover, and shot list ready to record."
        actions={
          <Link href="/ugc" className="btn-accent">
            <Plus className="h-4 w-4" />
            New UGC ad
          </Link>
        }
      />
      <CreativeLibrary
        creatives={creatives}
        supabaseConfigured={isSupabaseConfigured()}
      />
    </div>
  );
}
