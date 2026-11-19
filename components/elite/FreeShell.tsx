"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, Plus, Users } from "lucide-react";
import { FREE_HOME, FREE_WEEK } from "@/lib/elite/tracker";
import { PostComposer } from "./PostComposer";

// The free app's frame: the two tabs and the plus between them (the
// approved mock, marketing/free-log/mock), and the posting screen that
// the plus and every "Post my training" button open. The plus goes
// straight to the camera; the posting screen comes up over everything
// with the photo just taken.
type Launcher = {
  // Open the camera; the posting screen follows with the photo.
  post: () => void;
  // The posting screen with no photo: for "Log it without a photo".
  logOnly: () => void;
};

const LauncherContext = createContext<Launcher>({ post: () => undefined, logOnly: () => undefined });
export const usePostLauncher = () => useContext(LauncherContext);

export function FreeShell({ gym, children }: { gym: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const input = useRef<HTMLInputElement>(null);
  const [composer, setComposer] = useState<{ photo: File | null } | null>(null);

  const post = useCallback(() => input.current?.click(), []);
  const logOnly = useCallback(() => setComposer({ photo: null }), []);

  // The set-up screens (the four questions, the days) have no tab bar.
  const tabs = pathname === FREE_HOME || pathname === FREE_WEEK;

  return (
    <LauncherContext.Provider value={{ post, logOnly }}>
      {children}

      <input
        ref={input}
        type="file"
        accept="image/*"
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
          <div className="mx-auto flex h-[88px] max-w-md items-center justify-between px-11 pb-[18px] pt-3">
            <Tab href={FREE_HOME} label="Friends" on={pathname === FREE_HOME}>
              <Users className="h-6 w-6" strokeWidth={2} />
            </Tab>
            <button
              type="button"
              onClick={post}
              aria-label="Post my training"
              className="grid h-[62px] w-[62px] place-items-center rounded-full bg-bone text-black shadow-[0_0_0_5px_#000] active:scale-95"
            >
              <Plus className="h-7 w-7" strokeWidth={2.6} />
            </button>
            <Tab href={FREE_WEEK} label="My week" on={pathname === FREE_WEEK}>
              <Clock className="h-6 w-6" strokeWidth={2} />
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
