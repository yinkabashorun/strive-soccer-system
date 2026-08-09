import { redirect } from "next/navigation";
import { AppNav, type NavItem } from "@/components/elite/AppNav";
import { Wordmark } from "@/components/elite/Wordmark";
import { getViewer } from "@/lib/elite/session";
import { getPlayer } from "@/lib/elite/data";
import { signOut } from "@/lib/elite/auth-actions";

const PLAYER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: "Home" },
  { href: "/homework", label: "Homework", icon: "Clipboard" },
  { href: "/progress", label: "Progress", icon: "BarChart3" },
  { href: "/film", label: "Film", icon: "Film" },
];

export default async function PlayerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/dashboard");
  if (viewer.role === "coach") redirect("/coach");

  // Authenticated player whose coach hasn't set up their profile yet.
  if (!viewer.playerId) {
    return (
      <GateScreen
        title="Almost there"
        body="Your coach is setting up your development profile. You'll get an email the moment your first week is ready."
      />
    );
  }

  // Membership gate: access requires an active/trialing subscription. This
  // lets the coach revoke access by flipping a player to inactive.
  const player = await getPlayer(viewer.playerId);
  const status = player?.subscription_status ?? "none";
  if (status !== "active" && status !== "trialing") {
    return (
      <GateScreen
        title="Membership paused"
        body="Your Strive Elite membership isn't active right now. Reach out to your coach to reactivate and pick your training back up."
      />
    );
  }

  return (
    <div className="min-h-[100svh] bg-black text-bone lg:flex">
      <AppNav
        items={PLAYER_NAV}
        name={viewer.profile.full_name}
        color={viewer.profile.avatar_color}
        roleLabel="Player"
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-5 sm:px-6 lg:pb-12 lg:pt-8">
        {children}
      </main>
    </div>
  );
}

function GateScreen({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-[100svh] flex-col items-center justify-center bg-black px-6 text-center text-bone">
      <Wordmark href={null} size="lg" />
      <h1 className="mt-8 font-display text-3xl font-black uppercase tracking-tight">
        {title}
      </h1>
      <p className="mt-3 max-w-sm text-white/55">{body}</p>
      <form action={signOut} className="mt-8">
        <button className="btn px-6 py-3">Sign out</button>
      </form>
    </div>
  );
}
