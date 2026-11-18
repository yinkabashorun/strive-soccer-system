import { redirect } from "next/navigation";
import { AppNav, type NavItem } from "@/components/elite/AppNav";
import { FreshOnReturn } from "@/components/elite/FreshOnReturn";
import { AgreementScreen } from "@/components/elite/AgreementScreen";
import { getViewer } from "@/lib/elite/session";
import { signOut } from "@/lib/elite/auth-actions";
import { consentDue } from "@/lib/elite/legal-server";
import { trackerFor } from "@/lib/elite/tracker-server";
import { FREE_HOME } from "@/lib/elite/tracker";

// One screen, so one tab: the bottom bar is not drawn for a single item.
// Account (password, sign out, delete account) is behind the initials.
const FREE_NAV: NavItem[] = [{ href: FREE_HOME, label: "Home", icon: "Home" }];

// The free training log's shell (migration 069). Only a free account gets
// in: a coach goes to the coach side, and a member (or a player still
// waiting on a profile) goes to the member side, which knows what to show.
export default async function FreeLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${FREE_HOME}`);
  if (viewer.role !== "player") redirect("/coach");

  const tracker = await trackerFor(viewer);
  if (!tracker) redirect("/dashboard");

  // The agreement gate (068), the same one members pass. A free account
  // accepts at sign-up, so this shows only when the terms change.
  if (!viewer.demo && (await consentDue(viewer.profile.id))) {
    return <AgreementScreen signOut={signOut} />;
  }

  return (
    <div className="min-h-[100svh] bg-black text-bone lg:flex">
      <FreshOnReturn />
      <AppNav
        items={FREE_NAV}
        name={viewer.profile.full_name}
        color={viewer.profile.avatar_color}
        roleLabel="Player"
      />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:pt-8">
        {children}
      </main>
    </div>
  );
}
