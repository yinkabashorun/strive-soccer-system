import { Wordmark } from "@/components/elite/Wordmark";
import { inNativeApp } from "@/lib/elite/native-request";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Inside the App Store app nothing on these screens leads to another
  // website (lib/elite/native-request.ts). The website keeps the link.
  const native = inNativeApp();
  return (
    <div className="relative flex min-h-[100svh] flex-col bg-black text-bone">
      <div className="absolute inset-0 bg-radial-spot" />
      <header className="relative z-10 flex items-center justify-between px-5 py-5 pt-safe">
        <Wordmark href={null} />
        {!native && (
          <a
            href="https://strivesoccer100x.com"
            className="tap text-sm text-white/60 transition-colors hover:text-white"
          >
            strivesoccer100x.com ↗
          </a>
        )}
      </header>
      <main className="relative z-10 flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
