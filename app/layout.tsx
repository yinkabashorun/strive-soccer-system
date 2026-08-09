import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Strive Elite · Premium Player Development",
  description:
    "The complete development system for serious soccer players. Personalized coaching, weekly homework, progress tracking, film analysis, and accountability — from Strive Soccer FC.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://strive-soccer-system.vercel.app"
  ),
  openGraph: {
    title: "Strive Elite · Premium Player Development",
    description:
      "A complete development system, not just private sessions. Coaching, homework, progress, and film — in one premium app.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  maximumScale: 1,
};

// Root layout: <html> + <body> + brand fonts (Barlow / Barlow Condensed).
// Strive Elite (player + coach + marketing) and the legacy Strive OS both
// live under this shell.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-black">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow:wght@300;400;500;600;700&family=Barlow+Condensed:wght@500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-black font-body text-bone antialiased">
        {children}
      </body>
    </html>
  );
}
