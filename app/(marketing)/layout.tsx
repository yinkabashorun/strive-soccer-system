import { MarketingNav } from "@/components/elite/MarketingNav";
import { MarketingFooter } from "@/components/elite/MarketingFooter";

// Public Strive Elite marketing shell — nav + footer, no app chrome.
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100svh] bg-black text-bone">
      <MarketingNav />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}
