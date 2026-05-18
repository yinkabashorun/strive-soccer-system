import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Strive Dribbling System · $97 · Master the ball. Slow the game down.",
  description:
    "30 minutes a day. 4 modules. Real ball mastery for youth players 9-18. $97 one-time, lifetime access, 14-day refund.",
  openGraph: {
    title: "Strive Dribbling System · $97",
    description:
      "Master the ball. Slow the game down. Play without fear. 14-day guarantee.",
    type: "website",
  },
};

// Public funnel layout — no sidebar, no topbar, no Strive OS chrome.
// This is what strangers see — the page that converts clicks into $97 sales.
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-black text-bone">{children}</div>;
}
