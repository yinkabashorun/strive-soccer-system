"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { blockPlayer, removeFriend, reportLine, toggleProps } from "@/lib/elite/tracker-actions";
import { fmtDuration } from "@/lib/elite/time-trained";
import { FREE_HOME, auraLabel, firstNameOf, longDayLabel, type Profile } from "@/lib/elite/tracker";
import { ActionSheet } from "./ActionSheet";
import { AuraRing, Crest, FreeAvatar } from "./FreeAvatar";
import { FreeTopBar } from "./FreeTopBar";
import { IconBlock, IconBolt, IconCheck, IconClock, IconFlag, IconGear, IconGrid, IconMore, IconPerson } from "./FreeIcons";
import { StarMark } from "./StarMark";
import { sendLink } from "./send-link";

// "68h" once it is ten hours or more; "4h 30m" below that.
function bigTime(minutes: number): string {
  return minutes >= 600 ? `${Math.floor(minutes / 60)}h` : fmtDuration(minutes);
}

type Step = null | "menu" | "friends" | "block" | { report: "line" | "photo" } | "sent";

// A player's profile, full screen (the approved mock, screen 5): the photo
// in its aura ring with the level under it, three numbers, the name, the
// level they play at, their Playing for line, two buttons, their clubs as
// crests, then their posts. On your own profile the buttons are Edit
// profile and Share my link, and the gear opens Settings.
export function ProfileScreen({
  profile,
  myClubIds,
  inviteLink,
}: {
  profile: Profile;
  myClubIds: string[];
  inviteLink: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(null);
  const [tab, setTab] = useState<"grid" | "week">("grid");
  const [propped, setPropped] = useState(profile.propsPost?.propped ?? false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const first = firstNameOf(profile.name);
  const mine = new Set(myClubIds);

  function act(run: () => Promise<{ ok: boolean; error?: string }>, after: () => void) {
    setError(null);
    start(async () => {
      const res = await run();
      if (!res.ok) return setError(res.error ?? null);
      after();
    });
  }

  const reportStep = step && typeof step === "object" ? step.report : null;

  return (
    <div>
      <FreeTopBar
        back={FREE_HOME}
        title={
          <>
            <span className="truncate">{profile.you ? "You" : profile.name}</span>
            {profile.starred && <StarMark size={15} />}
          </>
        }
        right={
          profile.you ? (
            <Link href="/log/settings" aria-label="Settings" className="grid h-11 w-11 place-items-center text-bone">
              <IconGear />
            </Link>
          ) : (
            <button type="button" aria-label={`More for ${first}`} onClick={() => setStep("menu")} className="grid h-11 w-11 place-items-center text-bone">
              <IconMore />
            </button>
          )
        }
      />

      <div className="flex items-center gap-[22px] px-[18px] pt-1.5">
        {profile.you ? (
          <Link href="/log/settings/profile" aria-label={profile.photo ? "Change your photo" : "Add a photo"} className="shrink-0">
            <AuraRing progress={profile.aura.progress} level={profile.aura.level} size={96} label={auraLabel(profile.aura.level)}>
              <FreeAvatar photo={profile.photo} initials={profile.initials} size={82} you />
            </AuraRing>
          </Link>
        ) : (
          <AuraRing progress={profile.aura.progress} level={profile.aura.level} size={96} label={auraLabel(profile.aura.level)}>
            <FreeAvatar photo={profile.photo} initials={profile.initials} size={82} />
          </AuraRing>
        )}
        <div className="flex flex-1 justify-between text-center">
          <Stat big={fmtDuration(profile.weekMinutes)} small="this week" />
          <Stat big={bigTime(profile.allMinutes)} small="all time" />
          <Stat big={String(profile.clubs.length)} small={profile.clubs.length === 1 ? "club" : "clubs"} />
        </div>
      </div>

      <div className="px-[18px] pt-4">
        <p className="text-[16px] font-bold">{profile.name}</p>
        {profile.levelName && <p className="mt-[3px] text-[14px] text-white/60">{profile.levelName}</p>}
        {profile.playingFor && (
          <p className="mt-0.5 text-[14px]">
            Playing for <b className="font-bold">{profile.playingFor}</b>
          </p>
        )}
        {profile.you && !profile.photo && (
          <Link href="/log/settings/profile" className="mt-1 inline-flex min-h-[44px] items-center text-[14px] font-semibold text-accent">
            Add a photo
          </Link>
        )}
      </div>

      {error && <p className="px-[18px] pt-2 text-sm text-red-400">{error}</p>}

      <div className="flex gap-2 px-[18px] pt-3.5">
        {profile.you ? (
          <>
            <Link href="/log/settings/profile" className="flex h-11 flex-1 items-center justify-center rounded-xl bg-[#1e1e1e] text-[15px] font-bold">
              Edit profile
            </Link>
            <button
              type="button"
              onClick={async () => {
                if ((await sendLink(inviteLink)) === "copied") {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2500);
                }
              }}
              className="flex h-11 flex-1 items-center justify-center rounded-xl bg-[#1e1e1e] text-[15px] font-bold"
            >
              {copied ? "Link copied" : "Share my link"}
            </button>
          </>
        ) : (
          <>
            {profile.friend && (
              <button
                type="button"
                onClick={() => setStep("friends")}
                className="flex h-11 flex-1 items-center justify-center gap-[7px] rounded-xl bg-[#1e1e1e] text-[15px] font-bold"
              >
                <IconCheck size={18} />
                Friends
              </button>
            )}
            {profile.propsPost && (
              <button
                type="button"
                aria-pressed={propped}
                disabled={busy}
                onClick={() =>
                  act(
                    () => toggleProps(profile.propsPost!.id),
                    () => setPropped((p) => !p)
                  )
                }
                className={
                  "flex h-11 flex-1 items-center justify-center gap-[7px] rounded-xl text-[15px] font-bold " +
                  (propped ? "bg-[#2e2a1c] text-accent" : "bg-[#1e1e1e]")
                }
              >
                <IconBolt size={18} />
                Props
              </button>
            )}
          </>
        )}
      </div>

      {profile.clubs.length > 0 && (
        <ul className="flex gap-4 px-[18px] pt-[18px]">
          {profile.clubs.map((c) => {
            const inner = (
              <>
                <Crest club={c} size={64} className="mx-auto mb-[7px] shadow-[0_0_0_1.5px_#000,0_0_0_3px_#333]" />
                <span className="line-clamp-2">{c.name}</span>
              </>
            );
            return (
              <li key={c.id} className="w-[68px] text-center text-[11.5px] font-semibold leading-[1.2]">
                {mine.has(c.id) ? (
                  <Link href={`/log/club/${c.id}`} className="block">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-[18px] flex border-b border-white/[0.08]" role="tablist" aria-label="What to show">
        <TabButton on={tab === "grid"} label="Posts" onClick={() => setTab("grid")}>
          <IconGrid />
        </TabButton>
        <TabButton on={tab === "week"} label="This week" onClick={() => setTab("week")}>
          <IconClock />
        </TabButton>
      </div>

      {tab === "grid" ? (
        profile.posts.length > 0 ? (
          <div className="grid grid-cols-3 gap-[1.5px]">
            {profile.posts.map((p) => (
              <div key={p.id} className="relative aspect-square overflow-hidden bg-[#111]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.photoUrl} alt={`${profile.you ? "Your" : `${first}'s`} training, ${fmtDuration(p.minutes)}`} className="h-full w-full object-cover" />
                <span className="absolute bottom-1.5 left-[7px] font-display text-[17px] font-black [text-shadow:0_1px_6px_rgba(0,0,0,.8)]">
                  {fmtDuration(p.minutes)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-8 py-10 text-center text-[14px] text-white/60">
            {profile.you ? "Your posts show here." : `${first}'s posts from this week show here.`}
          </p>
        )
      ) : profile.week.length > 0 ? (
        <ul className="px-[18px] pt-2">
          {profile.week.map((w, i) => (
            <li key={i} className="flex h-[52px] items-center border-b border-white/[0.08] text-[15px]">
              <span className="flex-1 font-semibold">{longDayLabel(w.day)}</span>
              <span className="text-white/60">{w.kind === "gym" ? "Gym" : "Training"}</span>
              <span className="ml-4 w-16 text-right font-display text-[20px] font-black">{fmtDuration(w.minutes)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-8 py-10 text-center text-[14px] text-white/60">Nothing logged this week yet.</p>
      )}

      {step === "menu" && (
        <ActionSheet
          label={`More for ${first}`}
          onClose={() => setStep(null)}
          rows={[
            ...(profile.photo
              ? [{ label: "Report the profile photo", icon: <IconFlag />, red: true, onClick: () => setStep({ report: "photo" as const }) }]
              : []),
            ...(profile.playingFor
              ? [{ label: "Report the Playing for line", icon: <IconFlag />, red: true, onClick: () => setStep({ report: "line" as const }) }]
              : []),
            ...(profile.friend ? [{ label: "Remove from my friends", icon: <IconPerson />, onClick: () => setStep("friends") }] : []),
            { label: `Block ${first}`, icon: <IconBlock />, red: true, onClick: () => setStep("block") },
          ]}
          note={`${first} is not told if you report or block them.`}
        />
      )}

      {step === "friends" && (
        <ActionSheet
          label="Friends"
          title={`You and ${first} are friends`}
          onClose={() => setStep(null)}
          rows={[
            {
              label: "Remove from my friends",
              icon: <IconPerson />,
              red: true,
              disabled: busy,
              onClick: () => act(() => removeFriend(profile.id), () => router.push(FREE_HOME)),
            },
          ]}
          note={`${first} is not told. Their link can add you again.`}
        />
      )}

      {step === "block" && (
        <ActionSheet
          label={`Block ${first}`}
          title={`Block ${first}?`}
          onClose={() => setStep(null)}
          rows={[
            {
              label: `Block ${first}`,
              icon: <IconBlock />,
              red: true,
              disabled: busy,
              onClick: () => act(() => blockPlayer(profile.id), () => router.push(FREE_HOME)),
            },
          ]}
          note={`You stop being friends and you stop seeing each other's training. ${first} is not told, and their link will not add you again. You can unblock them in Settings.`}
        />
      )}

      {reportStep && (
        <ActionSheet
          label="Report"
          title={reportStep === "photo" ? `Report ${first}'s profile photo?` : `Report ${first}'s Playing for line?`}
          onClose={() => setStep(null)}
          rows={[
            {
              label: "Send it to the coaches",
              icon: <IconFlag />,
              red: true,
              disabled: busy,
              onClick: () => act(() => reportLine(profile.id, reportStep), () => setStep("sent")),
            },
          ]}
          note={`${first} is not told who reported it.`}
        />
      )}

      {step === "sent" && (
        <ActionSheet label="Sent" title="Sent to the coaches. Thank you." onClose={() => setStep(null)} rows={[{ label: "Done", onClick: () => setStep(null) }]} />
      )}
    </div>
  );
}

function Stat({ big, small }: { big: string; small: string }) {
  return (
    <div>
      <b className="block font-display text-[26px] font-black leading-none">{big}</b>
      <span className="text-[12.5px] text-white/60">{small}</span>
    </div>
  );
}

function TabButton({ on, label, onClick, children }: { on: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      aria-label={label}
      onClick={onClick}
      className={"grid h-11 flex-1 place-items-center " + (on ? "text-bone shadow-[inset_0_-1.5px_0_#f4f1ea]" : "text-white/50")}
    >
      {children}
    </button>
  );
}
