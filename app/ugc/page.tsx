import { PageHeader } from "@/components/PageHeader";
import { UGCGenerator } from "@/components/UGCGenerator";
import { isAnthropicConfigured } from "@/lib/ai";
import { isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default function UGCPage() {
  return (
    <div>
      <PageHeader
        eyebrow="AI UGC Generator · Dribbling Course"
        title="Spin up ads that sell the $97 course."
        subtitle="Pick the audience, drop a pain point and the transformation. Claude writes the hook, script, caption, voiceover, shot list, and ties it back to the VSL section it supports."
      />
      <UGCGenerator
        anthropicConfigured={isAnthropicConfigured()}
        supabaseConfigured={isSupabaseConfigured()}
      />
    </div>
  );
}
