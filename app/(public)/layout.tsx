import type { Metadata } from "next";

// The default title for the public pages (/demo, the shared week preview).
// Each page sets its own; this is only what a link preview falls back to.
// No product name with a price here: the old paid course page that used to
// live under this layout was retired Nov 18 2026.
export const metadata: Metadata = {
  title: "Strive Elite",
  description: "Personalized remote training, built around your player.",
  openGraph: {
    title: "Strive Elite",
    description: "Personalized remote training, built around your player.",
    type: "website",
  },
};

// Public layout - no sidebar, no topbar, no Strive OS chrome.
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-black text-bone">{children}</div>;
}
