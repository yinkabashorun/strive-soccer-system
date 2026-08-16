"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import type { Message, Role } from "@/lib/elite/types";
import { cn } from "@/lib/utils";

// Shared 1-on-1 chat thread. Works for both sides — the caller passes the
// bound send action and which role "me" is, so bubbles align correctly.
export function MessageThread({
  messages,
  meRole,
  meName,
  send,
  placeholder = "Write a message…",
}: {
  messages: Message[];
  meRole: Role;
  meName: string;
  send: (body: string) => Promise<{ ok: boolean }>;
  placeholder?: string;
}) {
  // incoming is newest-first; show oldest-first for a natural chat flow.
  const [local, setLocal] = useState<Message[]>(() => [...messages].reverse());
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  // Reconcile when the server sends fresh data.
  useEffect(() => {
    setLocal([...messages].reverse());
  }, [messages]);

  function submit() {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    setLocal((s) => [
      ...s,
      {
        id: `tmp-${s.length}-${body.length}`,
        player_id: "",
        from_role: meRole,
        from_name: meName,
        body,
        created_at: new Date().toISOString(),
        read: false,
      } as Message,
    ]);
    start(async () => {
      await send(body);
      requestAnimationFrame(() =>
        endRef.current?.scrollIntoView({ behavior: "smooth" })
      );
    });
  }

  const optimistic = local;

  return (
    <div className="flex flex-col">
      <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
        {optimistic.length === 0 && (
          <p className="py-6 text-center text-sm text-white/30">
            No messages yet. Say hello.
          </p>
        )}
        {optimistic.map((m) => {
          const mine = m.from_role === meRole;
          return (
            <div
              key={m.id}
              className={cn("flex", mine ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                  mine
                    ? "bg-accent/90 text-black"
                    : "border border-white/8 bg-white/[0.04] text-white/85"
                )}
              >
                {!mine && (
                  <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    {m.from_name || "Coach"}
                  </div>
                )}
                {m.body}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-bone placeholder:text-white/25 focus:border-accent/40 focus:outline-none"
        />
        <button
          onClick={submit}
          disabled={pending || !draft.trim()}
          className="btn-accent px-3.5 py-2.5"
          aria-label="Send"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
