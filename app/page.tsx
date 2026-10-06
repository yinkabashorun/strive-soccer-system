import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/elite/session";
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

// The site's front door. Signed-in members go straight to their dashboard;
// everyone else sees the Strive Elite landing page (the same page as /demo,
// which the ads link to). Sign-in lives at /login.
export default async function Home() {
  const viewer = await getViewer();
  if (viewer?.role === "coach" || viewer?.role === "admin") redirect("/coach");
  if (viewer?.role === "player") redirect("/dashboard");
  return (
    <div className="min-h-screen bg-black text-bone">
      <DemoLanding />
    </div>
  );
}
