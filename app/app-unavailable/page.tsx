import Link from "next/link";
import { Wordmark } from "@/components/elite/Wordmark";
import { signOut } from "@/lib/elite/auth-actions";
import { getViewer } from "@/lib/elite/session";

export const metadata = { title: "Strive Elite" };
export const dynamic = "force-dynamic";

// Where the App Store app lands on a screen that no reviewed build
// describes yet (lib/elite/app-review.ts, punch list A25). Plain, no link
// out of the app; a signed-in account can still sign out or delete itself
// from here, which App Review asks of every account that signs in.
export default async function AppUnavailablePage() {
  const viewer = await getViewer();
  return (
    <div className="flex min-h-[100svh] flex-col bg-black px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(2.5rem+env(safe-area-inset-top))] text-bone">
      <Wordmark href="/" />
      <div className="mx-auto mt-16 w-full max-w-sm flex-1">
        <h1 className="font-display text-3xl font-black uppercase leading-tight">
          Not in the app yet
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-white/70">
          This part of Strive Elite is not in the iPhone app yet. Everything a member needs to
          train is here: the week, the sessions, the courses, Film Room and your coach.
        </p>
        {viewer && !viewer.demo ? (
          <div className="mt-10 space-y-3">
            <form action={signOut}>
              <button
                type="submit"
                className="h-12 w-full rounded-full bg-white text-[15px] font-semibold text-black"
              >
                Sign out
              </button>
            </form>
            <Link
              href="/account/delete"
              className="flex h-12 items-center justify-center text-[15px] font-medium text-white/60"
            >
              Delete my account
            </Link>
          </div>
        ) : (
          <Link
            href="/"
            className="mt-10 flex h-12 w-full items-center justify-center rounded-full bg-white text-[15px] font-semibold text-black"
          >
            Back to the app
          </Link>
        )}
      </div>
    </div>
  );
}
