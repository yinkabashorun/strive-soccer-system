import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getViewer } from "@/lib/elite/session";
import { ProfilePhotoPicker } from "@/components/elite/ProfilePhotoPicker";
import { UsernameEditor } from "@/components/elite/UsernameEditor";
import { photoAddress } from "@/lib/elite/account-profile";
import { initials } from "@/lib/utils";

export const metadata = { title: "Edit profile · Strive Elite" };

// A member's profile (081): the photo and the @username, both set at
// onboarding (or once, on the screen that asked members made before),
// changed here. The photo can be changed, never taken off: it is required.
// The coaches see it; a coach can take it off a member's page, which asks
// the member for a new one.
export default async function MemberProfilePage() {
  const viewer = await getViewer();
  if (!viewer?.playerId) redirect("/dashboard");
  if (!viewer.setup.available && !viewer.demo) redirect("/you");
  return (
    <div className="space-y-6">
      <header className="flex items-center gap-1 pr-24">
        <Link href="/you" aria-label="Back to You" className="-ml-2 grid h-11 w-11 place-items-center rounded-full text-bone">
          <ChevronLeft className="h-7 w-7" />
        </Link>
        <h1 className="m-head text-[30px] leading-none">Edit profile</h1>
      </header>
      <ProfilePhotoPicker photo={photoAddress(viewer.setup)} initials={initials(viewer.profile.full_name)} seenBy="Your coaches see your photo." />
      <UsernameEditor current={viewer.setup.username} />
    </div>
  );
}
