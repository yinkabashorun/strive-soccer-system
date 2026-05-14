import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";

export const metadata: Metadata = {
  title: "Strive OS · The Operating System for Strive Soccer",
  description:
    "Internal operating system and content engine for Strive Soccer — sessions, course, AI content, and player experience.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-black">
      <body className="bg-black text-bone antialiased">
        <div className="min-h-screen bg-grid-faint bg-[length:32px_32px]">
          <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
            <Sidebar />
            <div className="flex min-h-screen w-full flex-col">
              <TopBar />
              <main className="flex-1 px-5 pb-24 pt-6 md:px-8">{children}</main>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
