import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DemoLanding } from "@/components/elite/DemoLanding";
import { demoRedirectFor } from "@/lib/elite/app-links";

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
//
// It is never drawn inside the App Store app: it carries the Meta pixel,
// and the app's listing says the app does no tracking. A request from the
// app goes to the app's front door instead (lib/elite/app-links.ts).
export default function DemoPage() {
  const userAgent = headers().get("user-agent");
  const door = demoRedirectFor(userAgent);
  if (door) redirect(door);
  return <DemoLanding userAgent={userAgent} />;
}
