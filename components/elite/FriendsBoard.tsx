"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmFriend, removeFriend } from "@/lib/elite/tracker-actions";
import {
  BOARD_EMPTY_LINE,
  BOARD_TITLE,
  FREE_HOME,
  addFriendQuestion,
  friendsBoard,
  type BoardEntry,
  type BoardRow,
} from "@/lib/elite/tracker";
import { TrackerSheet } from "./TrackerSheet";

// The week next to your friends: you and the friends you connected with
// by link, in order of training time this week. It starts again every
// Monday. Friends are made by the link only: there is no search, no list
// of other players and no requests. Tapping a friend offers one thing,
// taking them off. Nothing here announces a change of place.
export function FriendsBoard({
  me,
  myMinutes,
  friends,
  ask,
  inviteLink,
}: {
  me: { id: string; name: string };
  myMinutes: number; // this week's training, as the screen shows it now
  friends: BoardEntry[];
  // A teammate whose link was just opened: asked about once, in a sheet.
  ask: { code: string; name: string } | null;
  inviteLink: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [asking, setAsking] = useState(ask);
  const [leaving, setLeaving] = useState<BoardRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  // A link opened while this screen is already up brings its own question.
  const askCode = ask?.code ?? null;
  useEffect(() => {
    setAsking(ask);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askCode]);

  const rows = friendsBoard([{ id: me.id, name: me.name, minutes: myMinutes }, ...friends], me.id);

  async function send() {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ url: inviteLink });
        return;
      }
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // no share sheet and no clipboard: nothing more to try
    }
  }

  // The answer to "Add ... as a friend?". Either way the code leaves the
  // address, so the question is asked once.
  function answer(yes: boolean) {
    const code = asking?.code;
    setError(null);
    if (!yes || !code) {
      setAsking(null);
      router.replace(FREE_HOME);
      return;
    }
    start(async () => {
      const res = await confirmFriend(code);
      if (!res.ok) return setError(res.error);
      setAsking(null);
      router.replace(FREE_HOME);
      router.refresh();
    });
  }

  function takeOff() {
    const row = leaving;
    if (!row) return;
    setError(null);
    start(async () => {
      const res = await removeFriend(row.id);
      if (!res.ok) return setError(res.error);
      setLeaving(null);
      router.refresh();
    });
  }

  return (
    <section className="mt-7 border-t border-white/[0.07] pt-5">
      <h2 className="text-[15px] font-semibold text-bone">{BOARD_TITLE}</h2>

      {friends.length === 0 ? (
        <p className="mt-1.5 text-[15px] leading-relaxed text-white/70">{BOARD_EMPTY_LINE}</p>
      ) : (
        <ol className="mt-2 divide-y divide-white/[0.07]">
          {rows.map((r) => {
            const inner = (
              <>
                <span className="w-7 shrink-0 text-left text-sm tabular-nums text-white/50">{r.place}</span>
                <span className="min-w-0 flex-1 truncate text-left text-[15px] text-bone">
                  {r.name}
                  {r.me && <span className="text-accent"> · you</span>}
                </span>
                <span className="font-display text-xl font-bold tabular-nums text-bone">{r.time}</span>
              </>
            );
            return (
              <li key={r.id}>
                {r.me ? (
                  <div className="flex min-h-[48px] items-center gap-2">{inner}</div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setLeaving(r);
                    }}
                    className="flex min-h-[48px] w-full items-center gap-2"
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

      {asking && (
        <TrackerSheet title={addFriendQuestion(asking.name)} onClose={() => answer(false)}>
          <p className="text-[15px] leading-relaxed text-white/70">
            You will each see the other&apos;s first name, last initial and training time for the week.
          </p>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => answer(false)}
              className="flex h-14 items-center justify-center rounded-2xl border border-white/15 text-[15px] font-semibold text-bone"
            >
              No
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => answer(true)}
              className="flex h-14 items-center justify-center rounded-2xl bg-white font-display text-xl font-black uppercase tracking-wide text-black disabled:opacity-60"
            >
              Yes
            </button>
          </div>
        </TrackerSheet>
      )}

      {leaving && (
        <TrackerSheet title={leaving.name} onClose={() => setLeaving(null)}>
          <p className="text-[15px] leading-relaxed text-white/70">
            {leaving.time} trained this week.
          </p>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={takeOff}
            className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl border border-white/15 text-[15px] font-semibold text-bone disabled:opacity-60"
          >
            Remove from my friends
          </button>
        </TrackerSheet>
      )}
    </section>
  );
}
