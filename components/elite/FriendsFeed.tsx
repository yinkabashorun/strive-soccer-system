"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, MoreHorizontal, Zap } from "lucide-react";
import { blockPlayer, deleteLog, reportPost, toggleProps } from "@/lib/elite/tracker-actions";
import { fmtDuration } from "@/lib/elite/time-trained";
import { feel } from "@/lib/elite/native";
import { REPORT_REASONS, lockedHeadline, lockedLine } from "@/lib/elite/tracker";
import type { FeedView, OpenCardView } from "@/lib/elite/tracker-server";
import type { LockedCard } from "@/lib/elite/tracker";
import { usePostLauncher } from "./FreeShell";
import { FriendAsk } from "./FriendAsk";
import { ClubAsk } from "./ClubAsk";
import { TrackerSheet } from "./TrackerSheet";
import { sendLink } from "./send-link";

// The Friends tab, as the approved mock draws it: TODAY and the date, the
// week ring in the corner, the row of faces (lit when that friend trained
// today), then the posts. Friends' posts from today are locked until you
// post a photo of your own today: the card says who trained and for how
// long, and the button under it opens the camera.
export function FriendsFeed({
  date,
  feed,
  week,
  me,
  friendAsk,
  clubAsk,
  inviteLink,
}: {
  date: string; // "Wednesday, Nov 18"
  feed: FeedView;
  week: { minutes: number; target: number; percent: number };
  me: { id: string; initials: string };
  friendAsk: { code: string; name: string } | null;
  clubAsk: { code: string; name: string; problem: string | null } | null;
  inviteLink: string;
}) {
  const { post, profile } = usePostLauncher();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const cards = feed.cards.filter((c) => !hidden.has(c.id));
  const locked = cards.filter((c): c is LockedCard => c.state === "locked");
  const faces = feed.faces.filter((f) => !f.you || f.active);
  const hide = (id: string) => setHidden((h) => new Set([...h, id]));

  return (
    <div>
      <header className="flex items-end justify-between px-[18px] pt-[34px]">
        <div>
          <h1 className="font-display text-[44px] font-black uppercase leading-[0.9] tracking-[-0.5px]">Today</h1>
          <p className="mt-1.5 text-[13px] tracking-[0.2px] text-white/60">{date}</p>
        </div>
        <WeekRing initials={me.initials} onOpen={() => profile(me.id)} {...week} />
      </header>

      {faces.length > 0 && (
        <ul className="no-scrollbar flex gap-3.5 overflow-x-auto px-[18px] pb-1.5 pt-5" aria-label="Who trained today">
          {faces.map((f) => (
            <li key={f.id} className="w-[58px] shrink-0 text-center">
              <button
                type="button"
                onClick={() => profile(f.id)}
                aria-label={`${f.you ? "Your" : `${f.first}'s`} profile${f.active ? ", trained today" : ""}`}
                className="block w-full"
              >
              <span
                className={
                  "mx-auto grid h-[54px] w-[54px] place-items-center rounded-full text-[17px] font-bold " +
                  (f.you ? "bg-accent text-black" : "bg-[#222] text-[#ddd]") +
                  (f.active ? " shadow-[0_0_0_2px_#000,0_0_0_4px_#D4AF37]" : " opacity-[0.42]")
                }
                aria-hidden
              >
                {f.initials}
              </span>
              <span className={"mt-2 block truncate text-[11.5px] " + (f.active ? "text-bone" : "text-white/60")}>
                {f.first}
              </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {feed.friendCount === 0 ? (
        <Empty
          title="Your friends' training lands here"
          line="Send your link to a teammate. Once they join, you see each other's training every day."
          inviteLink={inviteLink}
        />
      ) : cards.length === 0 ? (
        <Empty
          title="Nobody has posted yet this week"
          line="Post a photo of your training and be the first your friends see."
        />
      ) : (
        <ul className="mt-3.5 space-y-3.5">
          {cards.map((c) =>
            c.state === "locked" ? (
              <li key={c.id}>
                <LockedPost card={c} first={c.id === locked[0]?.id} friendsToday={feed.friendsToday} />
              </li>
            ) : (
              <li key={c.id}>
                <OpenPost card={c} onGone={() => hide(c.id)} />
              </li>
            )
          )}
        </ul>
      )}

      {!feed.unlocked && locked.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-30 mx-auto max-w-md px-[18px]">
          <button
            type="button"
            onClick={post}
            className="flex h-[60px] w-full items-center justify-center gap-2.5 rounded-[20px] bg-bone font-display text-[24px] font-black uppercase tracking-[0.5px] text-black shadow-[0_8px_30px_rgba(0,0,0,.6)]"
          >
            <Camera className="h-[22px] w-[22px]" strokeWidth={2.4} />
            Post my training
          </button>
        </div>
      )}

      <FriendAsk ask={friendAsk} />
      <ClubAsk ask={clubAsk} />
    </div>
  );
}

// Your initials in the week's ring: how far the week has come, and the
// way to your own profile.
function WeekRing({
  initials,
  onOpen,
  minutes,
  target,
  percent,
}: {
  initials: string;
  onOpen: () => void;
  minutes: number;
  target: number;
  percent: number;
}) {
  const C = 2 * Math.PI * 21;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Your profile. This week: ${fmtDuration(minutes)} of ${fmtDuration(target)}`}
      className="relative grid h-[46px] w-[46px] place-items-center"
    >
      <svg viewBox="0 0 46 46" className="absolute inset-0" aria-hidden>
        <circle cx="23" cy="23" r="21" fill="none" stroke="#262626" strokeWidth="3" />
        <circle
          cx="23"
          cy="23"
          r="21"
          fill="none"
          stroke="#D4AF37"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${(percent / 100) * C} ${C}`}
          transform="rotate(-90 23 23)"
        />
      </svg>
      <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-[#2a2a2a] text-[13px] font-bold">
        {initials}
      </span>
    </button>
  );
}

function Empty({ title, line, inviteLink }: { title: string; line: string; inviteLink?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mx-[18px] mt-6 rounded-[26px] border border-white/[0.09] bg-[#101010] px-6 py-8 text-center">
      <h2 className="font-display text-[30px] font-black uppercase leading-[0.95]">{title}</h2>
      <p className="mx-auto mt-3 max-w-[300px] text-[15px] leading-snug text-white/70">{line}</p>
      {inviteLink && (
        <button
          type="button"
          onClick={async () => {
            if ((await sendLink(inviteLink)) === "copied") {
              setCopied(true);
              setTimeout(() => setCopied(false), 2500);
            }
          }}
          className="mt-5 inline-flex h-12 items-center justify-center rounded-2xl border border-white/20 px-6 text-[15px] font-semibold text-bone"
        >
          {copied ? "Link copied" : "Send my link"}
        </button>
      )}
    </div>
  );
}

// A friend's post from today, before you have posted yours. No photo was
// sent for it, so the backdrop is drawn, not blurred.
function LockedPost({ card, first, friendsToday }: { card: LockedCard; first: boolean; friendsToday: number }) {
  return (
    <div
      className={
        "relative mx-[18px] overflow-hidden rounded-[26px] bg-[radial-gradient(90%_60%_at_30%_35%,#4a4636_0%,transparent_70%),radial-gradient(80%_60%_at_75%_75%,#2f3a2a_0%,transparent_70%),linear-gradient(180deg,#3a3830,#151512)] " +
        (first ? "h-[440px]" : "h-[200px]")
      }
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center px-[34px] text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full border-2 border-bone bg-[#222] text-[20px] font-bold" aria-hidden>
          {card.initials}
        </span>
        <p className={"mt-4 font-display font-black uppercase leading-[0.95] " + (first ? "text-[38px]" : "text-[26px]")}>
          {lockedHeadline(card.first, card.minutes, card.kind)}
        </p>
        {first && <p className="mt-2.5 text-[15px] leading-[1.35] text-white/80">{lockedLine(friendsToday)}</p>}
      </div>
    </div>
  );
}

function OpenPost({ card, onGone }: { card: OpenCardView; onGone: () => void }) {
  const router = useRouter();
  const { profile } = usePostLauncher();
  const [props, setProps] = useState({ count: card.props, on: card.propped });
  const [menu, setMenu] = useState<null | "menu" | "report" | "block" | "delete">(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function toggle() {
    const next = { count: props.count + (props.on ? -1 : 1), on: !props.on };
    setProps(next);
    feel("drill");
    toggleProps(card.id).then((res) => {
      if (!res.ok) setProps(props);
    });
  }

  function act(run: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await run().catch(() => ({ ok: false, error: "We could not reach the server. Try again in a minute." }));
      if (!res.ok) return setError(res.error ?? null);
      setMenu(null);
      onGone();
      router.refresh();
    });
  }

  return (
    <article className="relative mx-[18px] h-[440px] overflow-hidden rounded-[26px] bg-[#111]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={card.photoUrl} alt={`${card.name}'s training`} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.5)_0%,rgba(0,0,0,0)_22%,rgba(0,0,0,0)_52%,rgba(0,0,0,.86)_100%)]" />

      <button
        type="button"
        onClick={() => profile(card.ownerId)}
        aria-label={`${card.mine ? "Your" : `${card.first}'s`} profile`}
        className="absolute left-3.5 top-3.5 z-10 flex min-h-[44px] items-center gap-2.5 text-left"
      >
        <span className="grid h-9 w-9 place-items-center rounded-full border-[1.5px] border-white/90 bg-[#222] text-[13px] font-bold" aria-hidden>
          {card.initials}
        </span>
        <div className="[text-shadow:0_1px_8px_rgba(0,0,0,.6)]">
          <b className="block text-[15px] font-bold leading-[1.1]">{card.name}</b>
          <span className="text-[12px] text-white/80">{card.ago}</span>
        </div>
      </button>
      <button
        type="button"
        onClick={() => setMenu("menu")}
        aria-label={card.mine ? "Your post: more" : `${card.first}'s post: more`}
        className="absolute right-1.5 top-1.5 z-10 grid h-11 w-11 place-items-center text-white [filter:drop-shadow(0_1px_6px_rgba(0,0,0,.6))]"
      >
        <MoreHorizontal className="h-6 w-6" />
      </button>

      <div className="absolute inset-x-4 bottom-4 z-10 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[2.6px] text-accent">
            {card.kind === "gym" ? "Gym" : "Training"}
          </div>
          <div className="font-display text-[66px] font-black uppercase leading-[0.82] tracking-[-1px]">
            {fmtDuration(card.minutes)}
          </div>
          {card.caption && <p className="mt-2.5 break-words text-[14.5px] text-white/90">{card.caption}</p>}
        </div>
        {card.mine ? (
          props.count > 0 && (
            <span className="flex h-[46px] shrink-0 items-center gap-2 rounded-[23px] border border-white/20 bg-white/[0.14] px-4 text-[14px] font-bold backdrop-blur-md">
              <Zap className="h-[17px] w-[17px]" fill="currentColor" aria-hidden />
              {props.count}
              <span className="sr-only">props</span>
            </span>
          )
        ) : (
          <button
            type="button"
            onClick={toggle}
            aria-pressed={props.on}
            aria-label={`Props for ${card.first}${props.count ? `, ${props.count} so far` : ""}`}
            className={
              "flex h-[46px] shrink-0 items-center gap-2 rounded-[23px] border px-4 text-[14px] font-bold backdrop-blur-md " +
              (props.on ? "border-transparent bg-bone text-black" : "border-white/20 bg-white/[0.14] text-bone")
            }
          >
            <Zap className="h-[17px] w-[17px]" fill={props.on ? "currentColor" : "none"} aria-hidden />
            {props.count > 0 ? props.count : "Props"}
          </button>
        )}
      </div>

      {menu === "menu" && (
        <TrackerSheet title={card.mine ? "Your post" : `${card.first}'s post`} onClose={() => setMenu(null)}>
          <div className="space-y-2.5 pb-1">
            {card.mine ? (
              <SheetButton onClick={() => setMenu("delete")}>Delete my post</SheetButton>
            ) : (
              <>
                <SheetButton onClick={() => setMenu("report")}>Report this post</SheetButton>
                <SheetButton onClick={() => setMenu("block")}>Block {card.first}</SheetButton>
              </>
            )}
          </div>
        </TrackerSheet>
      )}

      {menu === "report" && (
        <TrackerSheet title="What is wrong with it?" onClose={() => setMenu(null)}>
          <p className="text-[15px] leading-relaxed text-white/70">
            The post leaves your feed now and a coach looks at it. {card.first} is not told who reported it.
          </p>
          <div className="mt-4 space-y-2.5 pb-1">
            {REPORT_REASONS.map((r) => (
              <SheetButton key={r.id} disabled={busy} onClick={() => act(() => reportPost(card.id, r.id))}>
                {r.label}
              </SheetButton>
            ))}
          </div>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </TrackerSheet>
      )}

      {menu === "block" && (
        <TrackerSheet title={`Block ${card.first}?`} onClose={() => setMenu(null)}>
          <p className="text-[15px] leading-relaxed text-white/70">
            You stop being friends and you stop seeing each other&apos;s training. {card.first} is not told, and their
            link will not add you again. You can unblock them in Account.
          </p>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          <SheetButton className="mt-5" disabled={busy} onClick={() => act(() => blockPlayer(card.ownerId))}>
            Block {card.first}
          </SheetButton>
        </TrackerSheet>
      )}

      {menu === "delete" && (
        <TrackerSheet title="Delete your post?" onClose={() => setMenu(null)}>
          <p className="text-[15px] leading-relaxed text-white/70">
            The photo is deleted and the time comes off your week.
          </p>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          <SheetButton className="mt-5" disabled={busy} onClick={() => act(() => deleteLog(card.id))}>
            Delete my post
          </SheetButton>
        </TrackerSheet>
      )}
    </article>
  );
}

function SheetButton({
  children,
  onClick,
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        "flex h-14 w-full items-center justify-center rounded-2xl border border-white/15 text-[16px] font-semibold text-bone disabled:opacity-60 " +
        className
      }
    >
      {children}
    </button>
  );
}

