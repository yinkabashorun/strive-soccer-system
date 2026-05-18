import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Strive OS · The Operating System for Strive Soccer",
  description:
    "Internal operating system and content engine for Strive Soccer.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

// Root layout: only <html> + <body>. Chrome lives in app/(app)/layout.tsx
// for internal pages; public funnel pages live in app/(public)/ and skip
// the sidebar/topbar entirely.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-black">
      <body className="bg-black text-bone antialiased">{children}</body>
    </html>
  );
}
