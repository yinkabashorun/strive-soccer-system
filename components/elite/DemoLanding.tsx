import Link from "next/link";
import Script from "next/script";
import { Wordmark } from "@/components/elite/Wordmark";
import { Reveal } from "@/components/elite/Reveal";
import { VslPlayer } from "@/components/elite/VslPlayer";
import { VslFilePlayer } from "@/components/elite/VslFilePlayer";
import { MetaPixel } from "@/components/elite/MetaPixel";

// Meta Pixel for the ad funnel (Coach Yinka, Oct 10 2026). This page only.
const META_PIXEL_ID = "1655175349021847";

// Set this to the unlisted YouTube video id once the VSL is uploaded. The
// player autoplays muted with a "Tap for sound" layer
// (components/elite/VslPlayer.tsx). Empty = no video section.
// Oct 7: the first upload (QoYKWmCN5lM) is blocked by YouTube over a
// claimed song. Empty until a clean upload exists, so no broken player shows.
const VSL_YOUTUBE_ID = "";
// Direct video file (Oct 7 2026: Manus-hosted, sent by Coach Yinka). Takes
// priority over the YouTube id when set. Autoplays muted with "Tap for sound".
const VSL_SRC = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663373072550/HEzbBNxdHtaTpMWq.mov";
// The upload is a YouTube Short (9:16), so the player is portrait.
const VSL_PORTRAIT = true;

// MINIMAL BY DESIGN (Coach Yinka, Nov 17 2026: "as minimalistic as
// possible, just the video and the form, take off prices and all of
// that"). The page is the wordmark, the VSL, one line, the intake form
// and a member sign-in link. No headline, no feature lists, no drill
// tiles, no questions, no price, no guarantee: the video does the
// talking and the call does the selling. Do not add a section back
// without his word. Copy rules still apply to the one line: "we" (Coach
// Gary is in the video), "your player", never "AI", no em dashes.
export function DemoLanding() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <MetaPixel id={META_PIXEL_ID} />
      <div className="rise-in">
        <Wordmark href={null} size="lg" />
      </div>
      <div className="draw-line mt-3 h-px w-24 bg-accent/80" />

      {VSL_SRC ? (
        <div className="rise-in mt-6" style={{ animationDelay: "250ms" }}>
          <VslFilePlayer src={VSL_SRC} />
        </div>
      ) : VSL_YOUTUBE_ID ? (
        <div className="rise-in mt-6" style={{ animationDelay: "250ms" }}>
          <VslPlayer videoId={VSL_YOUTUBE_ID} portrait={VSL_PORTRAIT} />
        </div>
      ) : null}

      <Reveal as="p" delay={120} className="mt-8 text-center text-sm font-semibold text-white">
        Tell us about your player. We&apos;ll reach out to get your call on
        the books.
      </Reveal>

      <Reveal delay={160} className="mt-4 overflow-hidden rounded-2xl border border-white/8 bg-white">
        <iframe
          src="https://api.leadconnectorhq.com/widget/survey/W14MZotX2vYkpyDPKOY8"
          style={{ border: "none", width: "100%", display: "block" }}
          scrolling="no"
          id="W14MZotX2vYkpyDPKOY8"
          title="Strive Elite intake"
          data-cookie-consent="true"
          data-cookie-consent-provider="auto"
          className="min-h-[720px]"
        />
      </Reveal>
      <Script src="https://link.msgsndr.com/js/form_embed.js" strategy="afterInteractive" />

      <Reveal as="p" delay={200} className="mt-8 text-center text-xs text-white/35">
        Already a member?{" "}
        <Link href="/login" className="text-white/70 underline underline-offset-4 hover:text-white">
          Sign in
        </Link>
      </Reveal>
    </div>
  );
}
