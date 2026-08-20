import { redirect } from "next/navigation";
import { AppNav, type NavItem } from "@/components/elite/AppNav";
import { getViewer } from "@/lib/elite/session";
import { unlockDueWeeks } from "@/lib/elite/unlock";

const COACH_NAV: NavItem[] = [
  { href: "/coach", label: "Roster", icon: "Users" },
];

export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/coach");
  if (viewer.role === "player") redirect("/dashboard");

  // Process any weeks due to unlock (Monday-morning flip, VA time).
  await unlockDueWeeks().catch(() => undefined);

  return (
    <div className="min-h-[100svh] bg-black text-bone lg:flex">
      <AppNav
        items={COACH_NAV}
        name={viewer.profile.full_name}
        color={viewer.profile.avatar_color}
        roleLabel="Coach"
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-5 sm:px-6 lg:pt-8">
        {children}
      </main>
    </div>
  );
}
