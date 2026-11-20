import { redirect } from "next/navigation";
import { FreeTopBar } from "@/components/elite/FreeTopBar";
import { PlayingForField } from "@/components/elite/PlayingForField";
import { ProfilePhotoPicker } from "@/components/elite/ProfilePhotoPicker";
import { getViewer } from "@/lib/elite/session";
import { myPhotoFor, trackerFor } from "@/lib/elite/tracker-server";
import { FREE_HOME, initialsOf, shortName } from "@/lib/elite/tracker";

export const metadata = { title: "Edit profile · Strive Elite" };
export const dynamic = "force-dynamic";

// Edit profile: the photo and the Playing for line. Name and age come from
// sign-up and are not edited here.
export default async function EditProfilePage() {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${FREE_HOME}`);
  const tracker = await trackerFor(viewer);
  if (!tracker) redirect("/account");
  const photo = await myPhotoFor(viewer);
  return (
    <div>
      <FreeTopBar back="/log/settings" title="Edit profile" />
      <ProfilePhotoPicker photo={photo} initials={initialsOf(shortName(viewer.profile.full_name))} />
      <div className="mt-4">
        <PlayingForField initial={tracker.playing_for} />
      </div>
    </div>
  );
}
