import type { Metadata } from "next";
import { DemoLanding } from "@/components/elite/DemoLanding";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Strive Elite",
  description: "Training a lot doesn't help if it's never the thing your player actually needs.",
  openGraph: {
    title: "Strive Elite",
    description: "Training a lot doesn't help if it's never the thing your player actually needs.",
    type: "website",
  },
};

// /demo is the address the ads and the Instagram bio point at. It is the
// only place the landing page lives (the site's root is the app's door).
export default function DemoPage() {
  return <DemoLanding />;
}
