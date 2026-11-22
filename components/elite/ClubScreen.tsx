"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { blockPlayer, endMyClub, leaveClub, newClubLink, removeClubMember, renameMyClub, reportClub } from "@/lib/elite/tracker-actions";
import { fmtDuration } from "@/lib/elite/time-trained";
import { CLUB_NAME_MAX, FREE_WEEK, clubLink, lastTrainedLabel, type MyClub } from "@/lib/elite/tracker";
import { placeLine } from "@/lib/elite/club-teams";
import type { ClubTeamView } from "@/lib/elite/club-teams-server";
import { ActionSheet } from "./ActionSheet";
import { Crest, FreeAvatar } from "./FreeAvatar";
import { FreeTopBar } from "./FreeTopBar";
import { IconBlock, IconCalendar, IconExit, IconFlag, IconLink, IconMore, IconPencil, IconPerson, IconPin, IconPlus, IconRanking } from "./FreeIcons";
import { CountySheet } from "./CountySheet";
import { PlanCardView } from "./PlanCardView";
import { PlayTermsSheet } from "./PlayTermsSheet";
import { StarMark } from "./StarMark";
import { sendLink } from "./send-link";
import { initialsOf } from "@/lib/elite/tracker";

type Sheet = null | "menu" | "rename" | "end" | "report" | "leave" | "remove" | "sent" | "block" | "county" | "organizer";

// One club, full screen (the approved mocks, screens 7 and 13): the newest
// post photo from a member the viewer may see as the header (else dark),
// the crest and name, its county and players, the three numbers (record,
// place in the county, trained this week), Plan (the captain) and Invite,
// what is coming up (sessions and games, each "Organized by" the club,
// and Strive events it entered), then the roster with photos, when each
// last trained and their time. A captain's controls are in the "..." sheet.
export function ClubScreen({
  club,
  play,
  weekTotal,
  heroUrl,
  appUrl,
  today,
}: {
  club: MyClub;
  play: ClubTeamView;
  weekTotal: number;
  heroUrl: string | null;
  appUrl: string;
  today: string;
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [name, setName] = useState(club.name);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const rank = placeLine(play.place);
  const members = [...club.members].sort((x, y) => (y.minutes ?? 0) - (x.minutes ?? 0) || x.name.localeCompare(y.name));

  function act(run: () => Promise<{ ok: true } | { ok: false; error: string }>, after: () => void) {
    setError(null);
    start(async () => {
      const res = await run();
      if (!res.ok) return setError(res.error);
      after();
    });
  }

  async function invite() {
    if ((await sendLink(clubLink(appUrl, club.code))) === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  const players = `${club.members.length} ${club.members.length === 1 ? "player" : "players"}`;

  function plan() {
    if (!play.accepted.organizer) return setSheet("organizer");
    router.push(`/log/club/${club.id}/plan`);
  }

  return (
    <div>
      <div className="relative h-[290px] overflow-hidden">
        {heroUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroUrl} alt="" aria-hidden className="h-full w-full object-cover object-[50%_25%] brightness-[.55] saturate-[.9]" />
        ) : (
          <div className="h-full w-full bg-gradient-to-b from-[#26231a] via-[#121212] to-black" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.55),rgba(0,0,0,0)_30%,rgba(0,0,0,.2)_55%,#000_100%)]" />
        <div className="absolute inset-x-0 top-0 z-10">
          <FreeTopBar
            back={FREE_WEEK}
            overlay
            right={
              <button
                type="button"
                aria-label={`More for ${club.name}`}
                onClick={() => setSheet("menu")}
                className="grid h-11 w-11 place-items-center rounded-full bg-black/40 text-bone"
              >
                <IconMore />
              </button>
            }
          />
        </div>
        <div className="absolute inset-x-[18px] bottom-4 z-10 flex items-end gap-[14px]">
          <Crest club={club} size={70} className="shadow-[0_0_0_3px_#000]" />
          <div className="min-w-0">
            <h1 className="font-display text-[34px] font-black uppercase leading-[0.92]">{club.name}</h1>
            <p className="mt-[5px] flex items-center gap-1 text-[13.5px] text-white/60">
              {play.countyName && <IconPin size={15} />}
              {play.countyName ? `${play.countyName} · ` : ""}
              {players}
              {club.ended ? " · Ended" : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-[18px] mt-1.5 flex rounded-[18px] bg-[#141414] py-4 text-center">
        <Num big={play.record} small="record" />
        <Num big={rank.big} small={rank.small} />
        <Num big={fmtDuration(weekTotal)} small="trained this week" last />
      </div>

      {!club.ended && (
        <div className="flex gap-2.5 px-[18px] pt-3.5">
          {play.canPlan && (
            <button
              type="button"
              onClick={plan}
              className="flex h-11 flex-1 items-center justify-center gap-[7px] rounded-xl bg-bone text-[15px] font-bold text-black"
            >
              <IconPlus size={18} />
              Plan
            </button>
          )}
          <button
            type="button"
            onClick={invite}
            className={
              "flex h-11 flex-1 items-center justify-center gap-[7px] rounded-xl text-[15px] font-bold " +
              (play.canPlan ? "bg-[#1c1c1c] text-bone" : "bg-bone text-black")
            }
          >
            <IconPlus size={18} />
            {copied ? "Link copied" : play.canPlan ? "Invite" : "Invite to the club"}
          </button>
        </div>
      )}

      {(play.plans.length > 0 || play.events.length > 0) && (
        <>
          <h2 className="px-[18px] pb-2 pt-[22px] text-[11px] font-bold uppercase tracking-[2.4px] text-white/60">Coming up</h2>
          <ul className="space-y-2.5">
            {play.plans.map((p) => (
              <li key={p.id}>
                <PlanCardView card={p} perspective={club.id} />
              </li>
            ))}
            {play.events.map((e) => (
              <li key={e.id}>
                <Link href={`/log/events/${e.id}?club=${club.id}`} className="mx-[18px] block rounded-[22px] bg-[#141414] px-[18px] pb-4 pt-[15px]">
                  <span className="block text-[11px] font-bold uppercase tracking-[2.2px] text-white/60">Strive event</span>
                  <span className="mt-1.5 block font-display text-[24px] font-black uppercase leading-[1]">{e.name}</span>
                  <span className="mt-1.5 block text-[14px] text-white/60">{e.when}</span>
                  <span
                    className={
                      "mt-2.5 inline-flex min-h-[32px] items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-bold " +
                      (e.state === "paid" ? "bg-[#2e2a1c] text-accent" : "bg-[#222] text-bone")
                    }
                  >
                    <IconCalendar size={15} />
                    {e.line}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="px-[18px] pb-2 pt-[22px] text-[11px] font-bold uppercase tracking-[2.4px] text-white/60">This week</h2>
      <ul>
        {members.map((m) => (
          <li key={m.id}>
            <Link href={`/log/u/${m.you ? "me" : m.id}`} className="flex h-[58px] items-center gap-3 px-[18px]">
              <FreeAvatar photo={m.photo} initials={initialsOf(m.name)} size={42} you={m.you} />
              <span className="min-w-0">
                <span className={"flex items-center gap-[5px] text-[15.5px] font-semibold " + (m.you ? "text-accent" : "")}>
                  <span className="truncate">{m.you ? "You" : m.name}</span>
                  {m.starred && <StarMark size={15} />}
                  {m.captain && (
                    <span className="rounded-md bg-bone px-1.5 pb-px pt-0.5 text-[11px] font-bold uppercase tracking-[1.2px] text-black">
                      Captain
                    </span>
                  )}
                </span>
                <span className="mt-px block text-[12.5px] text-white/60">{lastTrainedLabel(m.lastDay, today)}</span>
              </span>
              <span className={"ml-auto font-display text-[22px] font-black " + (m.you ? "text-accent" : "")}>
                {fmtDuration(m.minutes ?? 0)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {error && <p className="px-[18px] pt-2 text-sm text-red-400">{error}</p>}

      {sheet === "menu" && (
        <ActionSheet
          label={club.name}
          onClose={() => setSheet(null)}
          rows={[
            ...(!club.ended ? [{ label: "Send the club's link", icon: <IconLink />, onClick: () => { setSheet(null); invite(); } }] : []),
            ...(club.captain
              ? [
                  { label: "County and games", icon: <IconPin />, onClick: () => setSheet("county") },
                  ...(play.county ? [{ label: "Clubs near you", icon: <IconRanking />, onClick: () => { setSheet(null); router.push(`/log/club/${club.id}/near`); } }] : []),
                  { label: "Rename the club", icon: <IconPencil />, onClick: () => { setName(club.name); setSheet("rename"); } },
                  { label: "Take a player off", icon: <IconPerson />, onClick: () => setSheet("remove") },
                  ...(!club.ended
                    ? [{ label: "Make a new link", icon: <IconLink />, disabled: busy, onClick: () => act(() => newClubLink(club.id), () => { setSheet(null); router.refresh(); }) }]
                    : []),
                  { label: "End the club", icon: <IconBlock />, red: true, onClick: () => setSheet("end") },
                ]
              : [{ label: "Report this club", icon: <IconFlag />, red: true, onClick: () => setSheet("report") }]),
            ...(club.members.some((m) => !m.you)
              ? [{ label: "Block a player", icon: <IconBlock />, red: true, onClick: () => setSheet("block") }]
              : []),
            { label: "Leave the club", icon: <IconExit />, red: true, onClick: () => setSheet("leave") },
          ]}
          note="Leaving keeps the friends you made. To cut one off, block them."
        />
      )}

      {sheet === "county" && <CountySheet clubId={club.id} county={play.county} open={play.open} onClose={() => setSheet(null)} />}

      {sheet === "organizer" && (
        <PlayTermsSheet
          kind="organizer"
          onClose={() => setSheet(null)}
          then={() => {
            setSheet(null);
            router.push(`/log/club/${club.id}/plan`);
          }}
        />
      )}

      {sheet === "block" && (
        <ActionSheet
          label="Block a player"
          title="Block a player"
          onClose={() => setSheet("menu")}
          rows={club.members
            .filter((m) => !m.you)
            .map((m) => ({
              label: m.name,
              icon: <FreeAvatar photo={m.photo} initials={initialsOf(m.name)} size={28} />,
              red: true,
              disabled: busy,
              onClick: () => act(() => blockPlayer(m.id), () => { setSheet(null); router.refresh(); }),
            }))}
          note="You stop seeing each other anywhere in the app. They are not told."
        />
      )}

      {sheet === "remove" && (
        <ActionSheet
          label="Take a player off"
          title="Take a player off"
          onClose={() => setSheet("menu")}
          rows={club.members
            .filter((m) => !m.you)
            .map((m) => ({
              label: m.name,
              icon: <FreeAvatar photo={m.photo} initials={initialsOf(m.name)} size={28} />,
              disabled: busy,
              onClick: () => act(() => removeClubMember(club.id, m.id), () => { setSheet(null); router.refresh(); }),
            }))}
          note="The club's link will not let them back in. They stay friends with everyone they made friends with here; to cut one off, block them."
        />
      )}

      {sheet === "rename" && (
        <ActionSheet label="Rename the club" title="Rename the club" onClose={() => setSheet("menu")}>
          <div className="px-[22px] pb-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, CLUB_NAME_MAX))}
              maxLength={CLUB_NAME_MAX}
              aria-label="Club name"
              className="h-12 w-full rounded-xl border border-white/10 bg-black px-4 text-[16px] text-bone focus:border-white/30 focus:outline-none"
            />
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            <button
              type="button"
              disabled={busy || !name.trim()}
              onClick={() => act(() => renameMyClub(club.id, name), () => { setSheet(null); router.refresh(); })}
              className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-bone text-[15px] font-bold text-black disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </ActionSheet>
      )}

      {sheet === "end" && (
        <ActionSheet
          label="End the club"
          title="End the club?"
          onClose={() => setSheet("menu")}
          rows={[{ label: "End the club", icon: <IconBlock />, red: true, disabled: busy, onClick: () => act(() => endMyClub(club.id), () => router.push(FREE_WEEK)) }]}
          note="Nobody new can join. The friends everyone made stay friends."
        />
      )}

      {sheet === "leave" && (
        <ActionSheet
          label="Leave the club"
          title={`Leave ${club.name}?`}
          onClose={() => setSheet("menu")}
          rows={[{ label: "Leave the club", icon: <IconExit />, red: true, disabled: busy, onClick: () => act(() => leaveClub(club.id), () => router.push(FREE_WEEK)) }]}
          note="Leaving keeps the friends you made. To cut one off, block them."
        />
      )}

      {sheet === "report" && (
        <ActionSheet
          label="Report this club"
          title="Report this club?"
          onClose={() => setSheet("menu")}
          rows={[{ label: "Send it to the coaches", icon: <IconFlag />, red: true, disabled: busy, onClick: () => act(() => reportClub(club.id), () => setSheet("sent")) }]}
          note="For a name that should not be in the app. A coach looks at it and can rename or close the club. Nobody is told who reported it."
        />
      )}

      {sheet === "sent" && (
        <ActionSheet label="Sent" title="Sent to the coaches. Thank you." onClose={() => setSheet(null)} rows={[{ label: "Done", onClick: () => setSheet(null) }]} />
      )}
    </div>
  );
}

function Num({ big, small, last = false }: { big: string; small: string; last?: boolean }) {
  return (
    <div className={"flex-1 " + (last ? "" : "border-r border-white/[0.08]")}>
      <b className="block font-display text-[30px] font-black leading-none">{big}</b>
      <span className="text-[12px] text-white/60">{small}</span>
    </div>
  );
}
