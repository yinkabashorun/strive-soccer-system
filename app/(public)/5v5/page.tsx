import type { Metadata } from "next";
import { FiveVFiveLanding } from "@/components/events/FiveVFiveLanding";

// The price switches from early bird to standard by the clock, so the page
// is rendered per request, never cached from a build.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Strive Elite 5v5 · $3,000 cash prize",
  description: "Mon, Dec 21 at SoFive Columbia. 32 teams. Early bird $450 per team through Nov 25, $550 from Nov 26. Final deadline Dec 5.",
  openGraph: {
    title: "Strive Elite 5v5 · $3,000 cash prize",
    description: "Mon, Dec 21 at SoFive Columbia. 32 teams. Who runs the DMV?",
    type: "website",
  },
};

export default function FiveVFivePage() {
  return <FiveVFiveLanding />;
}
