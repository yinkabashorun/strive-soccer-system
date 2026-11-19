import { PageHeader } from "@/components/PageHeader";
import { CourseAdsLibrary } from "@/components/CourseAdsLibrary";

export const dynamic = "force-dynamic";

export default function CourseAdsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Strive Dribbling System · Ad Copy"
        title="Every angle, hook, script, caption, and retargeting ad."
        subtitle="RETIRED Nov 18 2026: the $97 dribbling course and its sales page are gone. Kept as a copy archive only. Filter by tab. One click copies clean text — paste into Manus, Meta Ads Manager, TikTok, or wherever you ship."
      />
      <CourseAdsLibrary />
    </div>
  );
}
