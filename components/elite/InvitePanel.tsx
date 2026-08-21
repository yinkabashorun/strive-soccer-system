"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound, Loader2, Plus } from "lucide-react";
import {
  generateInviteCode,
  type InviteCode,
} from "@/lib/elite/invite-actions";
import { cn } from "@/lib/utils";

// Coach tool: generate single-use invite codes for paying clients and see
// which have been redeemed.
export function InvitePanel({ initial }: { initial: InviteCode[] }) {
  const [codes, setCodes] = useState<InviteCode[]>(initial);
  const [note, setNote] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function generate() {
    setError(null);
    start(async () => {
      const res = await generateInviteCode(note);
      if (!res.ok) {
        setError(res.error ?? "Could not generate a code.");
        return;
      }
      setFresh(res.code);
      setCodes((c) => [
        {
          id: `local-${res.code}`,
          code: res.code,
          note,
          used_by: null,
          used_at: null,
          created_at: new Date().toISOString(),
        },
        ...c,
      ]);
      setNote("");
    });
  }

  // Copy a ready-to-send signup LINK - the code rides along in the URL and
  // prefills at signup, so the parent just fills in name/email/password.
  function inviteLink(code: string): string {
    return `${window.location.origin}/signup?code=${encodeURIComponent(code)}`;
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(inviteLink(code));
      setCopied(code);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard blocked - user can select manually */
    }
  }

  const outstanding = codes.filter((c) => !c.used_by).length;

  return (
    <div className="elite-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-tight">
          <KeyRound className="h-4 w-4 text-accent" /> Invite a client
        </h2>
        <span className="text-xs text-white/40">{outstanding} unused</span>
      </div>
      <p className="mt-1 text-sm text-white/50">
        Generate a single-use invite and send the link to a client (or their
        parent) after they pay. It opens sign-up with the code already filled
        in.
      </p>

      <div className="mt-4 flex gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Client name (optional)"
          className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-bone placeholder:text-white/25 focus:border-accent/40 focus:outline-none"
        />
        <button
          onClick={generate}
          disabled={pending}
          className="btn-accent px-4 py-2.5 text-sm"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Generate
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      {fresh && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-accent/25 bg-accent/[0.06] px-4 py-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              New invite: send the link
            </div>
            <div className="font-display text-xl font-black tracking-wide">
              {fresh}
            </div>
          </div>
          <button onClick={() => copy(fresh)} className="btn px-3 py-2 text-sm">
            {copied === fresh ? (
              <Check className="h-4 w-4 text-accent" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            Copy link
          </button>
        </div>
      )}

      {codes.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-white/6 pt-3">
          {codes.slice(0, 8).map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <div className="min-w-0">
                <span className="font-mono text-white/80">{c.code}</span>
                {c.note && (
                  <span className="ml-2 text-white/40">· {c.note}</span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!c.used_by && (
                  <button
                    onClick={() => copy(c.code)}
                    className="grid h-7 w-7 place-items-center rounded-lg text-white/40 transition-colors hover:bg-white/5 hover:text-accent"
                    aria-label={`Copy invite link for ${c.code}`}
                    title="Copy invite link"
                  >
                    {copied === c.code ? (
                      <Check className="h-3.5 w-3.5 text-accent" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]",
                    c.used_by
                      ? "border-white/12 text-white/40"
                      : "border-accent/30 text-accent"
                  )}
                >
                  {c.used_by ? "Redeemed" : "Unused"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
