"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FREE_HOME, FREE_WEEK } from "@/lib/elite/tracker";
import { PostComposer } from "./PostComposer";
import { Play } from "lucide-react";
import { IconClock, IconFriends, IconPlus } from "./FreeIcons";

// The free app's frame: the two tabs and the plus between them (the
// approved mock, marketing/free-log/mock), and the posting screen that
// the plus and every "Post my training" button open. The plus goes
// straight to the camera; the posting screen comes up over everything
// with the photo just taken. A video instead of a photo can be saved as
// a take of one of the player's own drills (078); it never reaches the
// friends feed, which stays photos.
type Launcher = {
  // Open the camera; the posting screen follows with the photo.
  post: () => void;
  // The posting screen with no photo: for "Log it without a photo".
  logOnly: () => void;
  // A player's profile (a friend's, or your own): a screen of its own.
  profile: (id: string) => void;
};

const LauncherContext = createContext<Launcher>({
  post: () => undefined,
  logOnly: () => undefined,
  profile: () => undefined,
});
export const usePostLauncher = () => useContext(LauncherContext);

export function FreeShell({
  gym,
  train = false,
  children,
}: {
  gym: boolean;
  // Strive Pro is on (lib/elite/one-app.ts): one tab is ADDED, Train, which
  // opens the member's week. Friends, the plus and My week stay as they are.
  train?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [composer, setComposer] = useState<{ photo: File | null } | null>(null);

  const post = useCallback(() => input.current?.click(), []);
  const logOnly = useCallback(() => setComposer({ photo: null }), []);
  const profile = useCallback((id: string) => router.push(`/log/u/${id}`), [router]);

  // The set-up screens (the four questions, the days) and Settings have no
  // tab bar. A profile sits under Friends; a club and Top clubs under My week.
  const onFriends = pathname === FREE_HOME || pathname.startsWith("/log/u/");
  const onWeek =
    pathname === FREE_WEEK ||
    pathname.startsWith("/log/club") ||
    pathname.startsWith("/log/drills") ||
    pathname.startsWith("/log/events") ||
    pathname.startsWith("/log/plan/");
  const tabs = onFriends || onWeek;

  return (
    <LauncherContext.Provider value={{ post, logOnly, profile }}>
      {children}

      <input
        ref={input}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          e.target.value = "";
          if (file) setComposer({ photo: file });
        }}
      />

      {tabs && (
        <nav
          aria-label="Free app"
          className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-b from-transparent via-black to-black pb-[env(safe-area-inset-bottom)]"
        >
          <div className={"mx-auto flex h-[88px] max-w-md items-center justify-between pb-[18px] pt-3 " + (train ? "px-5" : "px-11")}>
            {train ? (
              <Tab href="/dashboard" label="Train" on={false}>
                <IconTrain />
              </Tab>
            ) : null}
            <Tab href={FREE_HOME} label="Friends" on={onFriends}>
              <IconFriends />
            </Tab>
            <button
              type="button"
              onClick={post}
              aria-label="Post my training"
              className="grid h-[62px] w-[62px] place-items-center rounded-full bg-bone text-black shadow-[0_0_0_5px_#000] active:scale-95"
            >
              <IconPlus size={28} />
            </button>
            <Tab href={FREE_WEEK} label="My week" on={onWeek}>
              <IconClock />
            </Tab>
          </div>
        </nav>
      )}


      {composer && (
        <PostComposer
          photo={composer.photo}
          gym={gym}
          onRetake={post}
          onClose={() => setComposer(null)}
        />
      )}
    </LauncherContext.Provider>
  );
}

const IconTrain = () => <Play className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden />;

function Tab({ href, label, on, children }: { href: string; label: string; on: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={
        "flex min-h-[52px] w-[72px] flex-col items-center justify-center gap-[5px] text-[12px] font-semibold " +
        (on ? "text-bone" : "text-white/60")
      }
    >
      {children}
      {label}
    </Link>
  );
}
