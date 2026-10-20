import { redirect } from "next/navigation";
import { getViewer } from "@/lib/elite/session";
import { authCodeLanding } from "@/lib/elite/auth-links";

// The app's front door. Strive Elite is a members-only dashboard - the
// public marketing lives on strivesoccer100x.com - so the root sends people
// straight to where they belong: their dashboard if signed in, otherwise
// the sign-in screen.
export default async function Home({
  searchParams,
}: {
  searchParams?: { code?: string; next?: string };
}) {
  // An auth email link whose redirect Supabase rewrote to the Site URL
  // arrives here with a one-time `code` and nothing to exchange it. Hand
  // it to the callback instead of dropping it (Bryan, Oct 19 2026; see
  // lib/elite/auth-links.ts).
  const landing = authCodeLanding({
    code: searchParams?.code ?? null,
    next: searchParams?.next ?? null,
  });
  if (landing) redirect(landing);

  const viewer = await getViewer();
  if (viewer?.role === "coach" || viewer?.role === "admin") redirect("/coach");
  if (viewer?.role === "player") redirect("/dashboard");
  redirect("/login");
}
