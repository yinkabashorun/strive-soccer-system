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

// /demo is the address the ads and the Instagram bio point at. The same
// page is also the site's front door at / (app/page.tsx).
export default function DemoPage() {
  return <DemoLanding />;
}
