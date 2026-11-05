"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { markPlayerMessagesRead } from "@/lib/elite/coach-actions";

// Opening a player's page counts as reading their thread (Nov 5 2026):
// marks their unread messages and clips read, once, so the roster badge
// and the "To answer" count drop the way a chat app's do.
export function MarkThreadRead({ playerId, unread }: { playerId: string; unread: number }) {
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || unread === 0) return;
    done.current = true;
    void markPlayerMessagesRead(playerId).then(() => router.refresh());
  }, [playerId, unread, router]);
  return null;
}
