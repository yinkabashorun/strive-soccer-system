"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2 } from "lucide-react";
import { markAllPlayerMessagesRead } from "@/lib/elite/coach-actions";

// Clears the unread backlog in one tap.
export function MarkAllReadButton({ count }: { count: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (count === 0) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm">
      <span className="text-white/60">
        {count} unread message{count === 1 ? "" : "s"} and clip{count === 1 ? "" : "s"}. Opening a player marks theirs read.
      </span>
      <button
        onClick={() =>
          start(async () => {
            await markAllPlayerMessagesRead();
            router.refresh();
          })
        }
        disabled={pending}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent/40 px-4 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10 disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
        Mark all read
      </button>
    </div>
  );
}
