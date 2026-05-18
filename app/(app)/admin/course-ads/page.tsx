import Link from "next/link";
import { ExternalLink, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { CourseAdsLibrary } from "@/components/CourseAdsLibrary";

export const dynamic = "force-dynamic";

export default function CourseAdsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Strive Dribbling System · Ad Copy"
        title="Every angle, hook, script, caption, and retargeting ad."
        subtitle="The full direct-response copy library for the $97 dribbling course. Filter by tab. One click copies clean text — paste into Manus, Meta Ads Manager, TikTok, or wherever you ship."
        actions={
          <Link
            href="/dribbling-course"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-accent"
          >
            <Sparkles className="h-4 w-4" />
            Open the VSL
            <ExternalLink className="h-3 w-3" />
          </Link>
        }
      />
      <CourseAdsLibrary />
    </div>
  );
}
