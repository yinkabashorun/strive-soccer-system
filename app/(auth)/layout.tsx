import { Wordmark } from "@/components/elite/Wordmark";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-[100svh] flex-col bg-black text-bone">
      <div className="absolute inset-0 bg-radial-spot" />
      <header className="relative z-10 flex items-center justify-between px-5 py-5 pt-safe">
        <Wordmark href={null} />
        <a
          href="https://strivesoccer100x.com"
          className="text-sm text-white/50 transition-colors hover:text-white"
        >
          strivesoccer100x.com ↗
        </a>
      </header>
      <main className="relative z-10 flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
