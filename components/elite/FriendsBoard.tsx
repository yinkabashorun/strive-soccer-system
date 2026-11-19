"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { blockPlayer, removeFriend } from "@/lib/elite/tracker-actions";
import {
  BOARD_EMPTY_LINE,
  BOARD_TITLE,
  firstNameOf,
  friendsBoard,
  initialsOf,
  type BoardEntry,
  type BoardRow,
} from "@/lib/elite/tracker";
import { TrackerSheet } from "./TrackerSheet";
import { sendLink } from "./send-link";

// The week next to your friends (mock screen 4): you and the friends you
// added, in order of training time this week. It starts again every
// Monday. Friends are made by the link only: there is no search, no list
// of other players and no requests. Tapping a friend offers two things,
// taking them off or blocking them. Nothing here announces a change of
// place.
export function FriendsBoard({
  me,
  myMinutes,
  friends,
  inviteLink,
}: {
  me: { id: string; name: string };
  myMinutes: number; // this week's training, as the screen shows it now
  friends: BoardEntry[];
  inviteLink: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState<BoardRow | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const rows = friendsBoard([{ id: me.id, name: me.name, minutes: myMinutes }, ...friends], me.id);

  async function send() {
    if ((await sendLink(inviteLink)) === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  function act(run: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await run();
      if (!res.ok) return setError(res.error ?? null);
      setOpen(null);
      setBlocking(false);
      router.refresh();
    });
  }

  const first = open ? firstNameOf(open.name) : "";

  return (
    <section className="mx-[18px] mt-[18px]">
      <h2 className="mb-1.5 text-[11px] font-bold uppercase tracking-[2.6px] text-white/60">{BOARD_TITLE}</h2>

      {friends.length === 0 ? (
        <p className="py-2 text-[15px] leading-relaxed text-white/70">{BOARD_EMPTY_LINE}</p>
      ) : (
        <ol>
          {rows.map((r) => {
            const inner = (
              <>
                <span className={"w-[18px] shrink-0 font-display text-[22px] font-black " + (r.me ? "text-accent" : "text-white/60")}>
                  {r.place}
                </span>
                <span
                  className={
                    "grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-bold " +
                    (r.me ? "bg-accent text-black" : "bg-[#222] text-bone")
                  }
                  aria-hidden
                >
                  {initialsOf(r.name)}
                </span>
                <span className={"min-w-0 flex-1 truncate text-left text-[15.5px] font-semibold " + (r.me ? "text-accent" : "text-bone")}>
                  {r.me ? "You" : r.name}
                </span>
                <span className="font-display text-[24px] font-black tabular-nums text-bone">{r.time}</span>
              </>
            );
            return (
              <li key={r.id} className="border-b border-white/[0.09] last:border-0">
                {r.me ? (
                  <div className="flex h-[50px] items-center gap-3">{inner}</div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setOpen(r);
                    }}
                    className="flex h-[50px] w-full items-center gap-3"
                  >
                    {inner}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <button
        type="button"
        onClick={send}
        className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl border border-white/20 text-[15px] font-semibold text-bone"
      >
        {copied ? "Link copied" : "Send my link"}
      </button>

      {open && !blocking && (
        <TrackerSheet title={open.name} onClose={() => setOpen(null)}>
          <p className="text-[15px] leading-relaxed text-white/70">{open.time} trained this week.</p>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          <div className="mt-5 space-y-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => act(() => removeFriend(open.id))}
              className="flex h-14 w-full items-center justify-center rounded-2xl border border-white/15 text-[15px] font-semibold text-bone disabled:opacity-60"
            >
              Remove from my friends
            </button>
            <button
              type="button"
              onClick={() => setBlocking(true)}
              className="flex h-14 w-full items-center justify-center rounded-2xl border border-white/15 text-[15px] font-semibold text-bone"
            >
              Block {first}
            </button>
          </div>
        </TrackerSheet>
      )}

      {open && blocking && (
        <TrackerSheet title={`Block ${first}?`} onClose={() => setBlocking(false)}>
          <p className="text-[15px] leading-relaxed text-white/70">
            You stop being friends and you stop seeing each other&apos;s training. {first} is not told, and their link
            will not add you again. You can unblock them in Account.
          </p>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={() => act(() => blockPlayer(open.id))}
            className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl border border-white/15 text-[15px] font-semibold text-bone disabled:opacity-60"
          >
            Block {first}
          </button>
        </TrackerSheet>
      )}
    </section>
  );
}
