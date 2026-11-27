"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, MoreHorizontal, Zap } from "lucide-react";
import { ActionSheet } from "./ActionSheet";
import { FreeAvatar } from "./FreeAvatar";
import { IconBlock, IconBolt, IconFlag, IconPerson, IconTrash } from "./FreeIcons";
import { blockPlayer, deleteLog, reportPost, toggleProps } from "@/lib/elite/tracker-actions";
import { fmtDuration } from "@/lib/elite/time-trained";
import { feel } from "@/lib/elite/native";
import { REPORT_REASONS, lockedHeadline, lockedHeadlineLines, lockedLine } from "@/lib/elite/tracker";
import type { ClubRequestView, FeedView, FriendRequestView, OpenCardView } from "@/lib/elite/tracker-server";
import type { LockedCard } from "@/lib/elite/tracker";
import { NOT_TIMED } from "@/lib/elite/training-clock";
import { usePostLauncher } from "./FreeShell";
import { FriendAsk } from "./FriendAsk";
import { FriendRequests } from "./FriendRequests";
import { ClubAsk } from "./ClubAsk";
import { TeamRequests } from "./TeamRequests";
import type { TeamAsks } from "@/lib/elite/club-teams-server";
import { sendLink } from "./send-link";
import { StarMark } from "./StarMark";
import type { Squad } from "@/lib/elite/squad-pass";
import type { FirstDays } from "@/lib/elite/first-days";
import { FirstDaysCard } from "./FirstDaysCard";
import { SquadCard } from "./SquadCard";

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
  requests = [],
  clubRequests = [],
  teamAsks,
  inviteLink,
  squad,
  firstDays = null,
}: {
  date: string; // "Wednesday, Nov 18"
  feed: FeedView;
  week: { minutes: number; target: number; percent: number };
  me: { id: string; initials: string; photo: string | null };
  friendAsk: { code: string; name: string } | null;
  clubAsk: { code: string; name: string; problem: string | null; byCoach?: boolean } | null;
  requests?: FriendRequestView[];
  clubRequests?: ClubRequestView[];
  teamAsks?: TeamAsks;
  inviteLink: string;
  squad?: Squad | null;
  firstDays?: FirstDays | null;
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
        <WeekRing initials={me.initials} photo={me.photo} onOpen={() => profile(me.id)} {...week} />
      </header>

      <FriendRequests requests={requests} clubRequests={clubRequests} />
      {teamAsks && <TeamRequests asks={teamAsks} />}

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
              <FreeAvatar
                photo={f.photo}
                initials={f.initials}
                size={54}
                you={f.you}
                className={"mx-auto " + (f.active ? "shadow-[0_0_0_2px_#000,0_0_0_4px_#D4AF37]" : "opacity-[0.42]")}
              />
              <span className={"mt-2 flex items-center justify-center gap-0.5 text-[11.5px] " + (f.active ? "text-bone" : "text-white/60")}>
                <span className="truncate">{f.first}</span>
                {f.starred && <StarMark size={11} />}
              </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {firstDays ? <FirstDaysCard list={firstDays} inviteLink={inviteLink} onPost={post} /> : null}

      {feed.friendCount === 0 ? (
        <Empty
          title="Your friends' training lands here"
          line="Send your link to a teammate. Accept their request, and you see each other's training every day."
          inviteLink={squad ? undefined : inviteLink}
        />
      ) : cards.length === 0 ? (
        <Empty
          title="Nobody has posted this week"
          line="Be the first. Post a photo of your training."
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

      {/* Bring your squad: one card, where the invite has always been. */}
      {squad ? (
        <div className="mx-[18px]">
          <SquadCard squad={squad} inviteLink={inviteLink} />
        </div>
      ) : null}

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
  photo,
  onOpen,
  minutes,
  target,
  percent,
}: {
  initials: string;
  photo: string | null;
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
      <FreeAvatar photo={photo} initials={initials} size={34} />
    </button>
  );
}

function Empty({ title, line, inviteLink }: { title: string; line: string; inviteLink?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mx-[18px] mt-6 rounded-[26px] border border-white/[0.09] bg-[#101010] px-6 py-8 text-center">
      <h2 className="font-display text-[30px] font-black uppercase leading-[0.95]">{title}</h2>
      <p className="mx-auto mt-3 max-w-[300px] text-[15px] leading-snug text-white/70">{line}</p>
      {inviteLink ? (
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
      ) : null}
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
        <FreeAvatar photo={card.photo} initials={card.initials} size={64} className="border-2 border-bone" />
        <p
          aria-label={lockedHeadline(card.first, card.minutes, card.kind)}
          className={"mt-4 font-display font-black uppercase leading-[0.95] " + (first ? "text-[38px]" : "text-[26px]")}
        >
          {lockedHeadlineLines(card.first, card.minutes, card.kind).map((line) => (
            <span key={line} className="block" aria-hidden>
              {line}
            </span>
          ))}
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
  const [reason, setReason] = useState<string | null>(null);
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
        <FreeAvatar photo={card.photo} initials={card.initials} size={36} you={card.mine} className="border-[1.5px] border-white/90" />
        <div className="[text-shadow:0_1px_8px_rgba(0,0,0,.6)]">
          <b className="flex items-center gap-1.5 text-[15px] font-bold leading-[1.1]">
            {card.name}
            {card.starred && <StarMark size={14} />}
          </b>
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
            {/* the length was typed, not timed by the clock (training-clock.ts) */}
            {card.timed === false ? ` · ${NOT_TIMED}` : ""}
          </div>
          <div className="font-display text-[66px] font-black uppercase leading-[0.82] tracking-[-1px]">
            {fmtDuration(card.minutes)}
          </div>
          {card.caption && <p className="mt-2.5 break-words text-[14.5px] text-white/90">{card.caption}</p>}
          {card.together && <p className="mt-1.5 text-[13px] font-semibold text-white/80">{card.together}</p>}
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
        <ActionSheet
          label={card.mine ? "Your post" : `${card.first}'s post`}
          onClose={() => setMenu(null)}
          keys={
            card.mine
              ? undefined
              : [
                  { label: "Profile", icon: <IconPerson />, onClick: () => { setMenu(null); profile(card.ownerId); } },
                  { label: "Props", icon: <IconBolt />, on: props.on, onClick: () => { toggle(); setMenu(null); } },
                ]
          }
          rows={
            card.mine
              ? [{ label: "Delete my post", icon: <IconTrash />, red: true, onClick: () => setMenu("delete") }]
              : [
                  { label: "Report this post", icon: <IconFlag />, red: true, onClick: () => { setReason(null); setMenu("report"); } },
                  { label: `Block ${card.first}`, icon: <IconBlock />, red: true, onClick: () => setMenu("block") },
                ]
          }
          note={card.mine ? undefined : `${card.first} is never told about a report or a block.`}
        />
      )}

      {menu === "report" && (
        <ActionSheet
          label="Report this post"
          title="What is wrong with it?"
          onClose={() => setMenu(null)}
          rows={REPORT_REASONS.map((r) => ({ label: r.label, checked: reason === r.id, onClick: () => setReason(r.id) }))}
          note={`The post leaves your feed and a coach looks at it. ${card.first} isn't told who reported it.`}
        >
          <div className="px-4 pt-2">
            {error && <p className="pb-2 text-sm text-red-400">{error}</p>}
            <button
              type="button"
              disabled={busy || !reason}
              onClick={() => reason && act(() => reportPost(card.id, reason))}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-bone text-[15px] font-bold text-black disabled:opacity-40"
            >
              Send the report
            </button>
          </div>
        </ActionSheet>
      )}

      {menu === "block" && (
        <ActionSheet
          label={`Block ${card.first}`}
          title={`Block ${card.first}?`}
          onClose={() => setMenu(null)}
          rows={[{ label: `Block ${card.first}`, icon: <IconBlock />, red: true, disabled: busy, onClick: () => act(() => blockPlayer(card.ownerId)) }]}
          note={`You stop being friends and you stop seeing each other's training. ${card.first} isn't told, and ${card.first}'s link won't add you again. You can unblock ${card.first} in Settings.`}
        >
          {error && <p className="px-[22px] pt-1 text-sm text-red-400">{error}</p>}
        </ActionSheet>
      )}

      {menu === "delete" && (
        <ActionSheet
          label="Delete your post"
          title="Delete your post?"
          onClose={() => setMenu(null)}
          rows={[{ label: "Delete my post", icon: <IconTrash />, red: true, disabled: busy, onClick: () => act(() => deleteLog(card.id)) }]}
          note="The photo is deleted and the time comes off your week."
        >
          {error && <p className="px-[22px] pt-1 text-sm text-red-400">{error}</p>}
        </ActionSheet>
      )}
    </article>
  );
}
