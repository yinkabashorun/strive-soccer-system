import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/elite/session";
import { trackerFor } from "@/lib/elite/tracker-server";
import { FREE_DRILLS, canAddTake } from "@/lib/elite/my-drills";
import { myDrillFor } from "@/lib/elite/my-drills-server";
import { DrillScreen } from "@/components/elite/MyDrills";
import { shareLinkFor } from "@/lib/elite/share-link-server";
import { FreeTopBar } from "@/components/elite/FreeTopBar";

export const metadata = { title: "My drill · Strive Elite" };
export const dynamic = "force-dynamic";

// One of the player's own drills: Film a new take, Then and now, the
// progress reel and every take. Only ever the signed-in player's own.
export default async function DrillPage({ params }: { params: { id: string } }) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${FREE_DRILLS}`);
  const tracker = await trackerFor(viewer);
  if (!tracker) redirect("/dashboard");
  const drill = await myDrillFor(viewer, params.id);
  if (!drill) notFound();
  const { list, ...rest } = drill;
  return (
    <div>
      <FreeTopBar back={FREE_DRILLS} />
      <DrillScreen
        drill={rest}
        takes={list}
        canAddTake={canAddTake(list.length)}
        profileId={viewer.profile.id}
        example={viewer.demo}
        shareLink={await shareLinkFor(tracker, viewer.demo)}
      />
    </div>
  );
}
