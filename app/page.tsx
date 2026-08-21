import { redirect } from "next/navigation";
import { getViewer } from "@/lib/elite/session";

// The app's front door. Strive Elite is a members-only dashboard - the
// public marketing lives on strivesoccer100x.com - so the root sends people
// straight to where they belong: their dashboard if signed in, otherwise
// the sign-in screen.
export default async function Home() {
  const viewer = await getViewer();
  if (viewer?.role === "coach" || viewer?.role === "admin") redirect("/coach");
  if (viewer?.role === "player") redirect("/dashboard");
  redirect("/login");
}
