import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";

// Internal Strive OS chrome: dark grid background + sidebar + topbar.
// Anything inside app/(app)/ inherits this. The public dribbling course
// funnel lives in app/(public)/ and skips it entirely.
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-grid-faint bg-[length:32px_32px]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
        <Sidebar />
        <div className="flex min-h-screen w-full flex-col">
          <TopBar />
          <main className="flex-1 px-5 pb-24 pt-6 md:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
