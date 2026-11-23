"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SetupStep } from "@/lib/elite/account-profile";
import { ProfileSetup } from "./ProfileSetup";

// The one-time screen for an account made before the photo and the
// username were asked for (Nov 23 2026), built like the agreement screen
// (AgreementScreen): it shows in place of the app until both are set.
// Account (and deleting the account) and Sign out stay one tap away; the
// example tour never sees it; when the record cannot be read the app opens
// anyway (lib/elite/account-profile.ts).
export function ProfileSetupScreen({
  steps,
  ideas,
  initials,
  seenBy,
  signOut,
}: {
  steps: SetupStep[];
  ideas: string[];
  initials: string;
  seenBy: string;
  signOut: () => Promise<void>;
}) {
  const router = useRouter();
  return (
    <ProfileSetup
      steps={steps}
      ideas={ideas}
      initials={initials}
      seenBy={seenBy}
      onDone={() => router.refresh()}
      footer={
        <div className="flex flex-wrap items-center justify-center gap-x-5 text-[13px] text-white/50">
          <Link href="/account" className="tap underline-offset-4 hover:underline">
            Account
          </Link>
          <Link href="/account/delete" className="tap underline-offset-4 hover:underline">
            Delete my account
          </Link>
          <form action={signOut}>
            <button className="tap underline-offset-4 hover:underline">Sign out</button>
          </form>
        </div>
      }
    />
  );
}
