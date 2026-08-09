"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Send } from "lucide-react";

// Small compose box reused for coach notes and coach→player messages.
// Takes a server action that persists a single string body.
export function QuickComposer({
  action,
  placeholder,
  cta = "Post",
}: {
  action: (body: string) => Promise<{ ok: boolean }>;
  placeholder: string;
  cta?: string;
}) {
  const [body, setBody] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  function submit() {
    const v = body.trim();
    if (!v) return;
    start(async () => {
      await action(v);
      setBody("");
      setDone(true);
      setTimeout(() => setDone(false), 2200);
    });
  }

  return (
    <div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder={placeholder}
        className="w-full resize-y rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-bone placeholder:text-white/25 focus:border-accent/40 focus:outline-none"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={submit}
          disabled={pending || !body.trim()}
          className="btn px-4 py-2 text-sm"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {cta}
        </button>
        {done && (
          <span className="flex items-center gap-1.5 text-sm text-accent">
            <Check className="h-4 w-4" /> Saved
          </span>
        )}
      </div>
    </div>
  );
}
