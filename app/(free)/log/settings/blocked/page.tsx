import { redirect } from "next/navigation";
import { BlockedList } from "@/components/elite/BlockedList";
import { FreeTopBar } from "@/components/elite/FreeTopBar";
import { getViewer } from "@/lib/elite/session";
import { blockedFor, trackerFor } from "@/lib/elite/tracker-server";
import { FREE_HOME } from "@/lib/elite/tracker";

export const metadata = { title: "Blocked · Strive Elite" };
export const dynamic = "force-dynamic";

// The players this free account blocked, each with Unblock.
export default async function BlockedPage() {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${FREE_HOME}`);
  if (!(await trackerFor(viewer))) redirect("/account");
  const blocked = await blockedFor(viewer);
  return (
    <div>
      <FreeTopBar back="/log/settings" title="Blocked" />
      <p className="px-[18px] pb-2 pt-3 text-[14px] leading-relaxed text-white/60">
        A player you block cannot see your training and you cannot see theirs. They are not told.
      </p>
      <BlockedList blocked={blocked} />
    </div>
  );
}
