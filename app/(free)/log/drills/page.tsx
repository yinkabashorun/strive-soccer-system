import { redirect } from "next/navigation";
import { getViewer } from "@/lib/elite/session";
import { trackerFor } from "@/lib/elite/tracker-server";
import { FREE_WEEK } from "@/lib/elite/tracker";
import { FREE_DRILLS, canAddDrill } from "@/lib/elite/my-drills";
import { myDrillsFor } from "@/lib/elite/my-drills-server";
import { MyDrillsList } from "@/components/elite/MyDrills";
import { FreeTopBar } from "@/components/elite/FreeTopBar";

export const metadata = { title: "My drills · Strive Elite" };
export const dynamic = "force-dynamic";

// My drills (078): the drills this player named, each a folder of takes.
// Optional, and private: only the player sees them.
export default async function MyDrillsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${FREE_DRILLS}`);
  if (!(await trackerFor(viewer))) redirect("/dashboard");
  const drills = await myDrillsFor(viewer);
  return (
    <div>
      <FreeTopBar back={FREE_WEEK} />
      <MyDrillsList drills={drills} canAdd={canAddDrill(drills.length)} example={viewer.demo} />
    </div>
  );
}
