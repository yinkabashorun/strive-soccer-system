"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { blockPlayer, loadProfile, removeFriend, reportLine } from "@/lib/elite/tracker-actions";
import { fmtDuration } from "@/lib/elite/time-trained";
import { auraLabel, auraNextLine, firstNameOf, type Profile } from "@/lib/elite/tracker";
import { TrackerSheet } from "./TrackerSheet";
import { sendLink } from "./send-link";
import { StarMark } from "./StarMark";

// A player's profile, small on purpose: initials, first name and last
// initial, the coaches' star if they have it, their aura level, the level
// they play at and their own "Playing for" line, their clubs, and their
// training this week. Opened from a face,
// a name on the board or a post; your own opens from your initials and
// adds your link and Account. The server hands it only to the player,
// their friends and coaches; anyone else gets nothing.
export function ProfileSheet({
  targetId,
  inviteLink,
  onClose,
}: {
  targetId: string;
  inviteLink: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null | "loading">("loading");
  const [step, setStep] = useState<"view" | "block" | "report">("view");
  const [reported, setReported] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  useEffect(() => {
    let live = true;
    setProfile("loading");
    loadProfile(targetId)
      .then((p) => live && setProfile(p))
      .catch(() => live && setProfile(null));
    return () => {
      live = false;
    };
  }, [targetId]);

  function act(run: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await run();
      if (!res.ok) return setError(res.error ?? null);
      onClose();
      router.refresh();
    });
  }

  if (profile === "loading") {
    return (
      <TrackerSheet title="Profile" onClose={onClose}>
        <div className="grid h-40 place-items-center" aria-live="polite">
          <Loader2 className="h-6 w-6 animate-spin text-white/60" />
        </div>
      </TrackerSheet>
    );
  }
  if (!profile) {
    return (
      <TrackerSheet title="Profile" onClose={onClose}>
        <p className="py-4 text-[15px] text-white/70">This profile is not there any more.</p>
      </TrackerSheet>
    );
  }

  const first = firstNameOf(profile.name);

  if (step === "report" && profile.playingFor) {
    return (
      <TrackerSheet title={`Report ${first}'s Playing for line?`} onClose={() => setStep("view")}>
        <p className="text-[15px] leading-relaxed text-white/70">
          &ldquo;{profile.playingFor}&rdquo; goes to the coaches to look at. {first} is not told who reported it.
        </p>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setError(null);
            start(async () => {
              const res = await reportLine(profile.id);
              if (!res.ok) return setError(res.error ?? null);
              setReported(true);
              setStep("view");
            });
          }}
          className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl border border-white/15 text-[15px] font-semibold text-bone disabled:opacity-60"
        >
          Send it to the coaches
        </button>
      </TrackerSheet>
    );
  }

  if (step === "block") {
    return (
      <TrackerSheet title={`Block ${first}?`} onClose={() => setStep("view")}>
        <p className="text-[15px] leading-relaxed text-white/70">
          You stop being friends and you stop seeing each other&apos;s training. {first} is not told, and their link
          will not add you again. You can unblock them in Account.
        </p>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={() => act(() => blockPlayer(profile.id))}
          className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl border border-white/15 text-[15px] font-semibold text-bone disabled:opacity-60"
        >
          Block {first}
        </button>
      </TrackerSheet>
    );
  }

  return (
    <TrackerSheet title={profile.you ? "You" : "Profile"} onClose={onClose}>
      <div className="flex items-center gap-4 pt-1">
        <span
          className={
            "grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full text-[24px] font-bold " +
            (profile.you ? "bg-accent text-black" : "bg-[#222] text-bone")
          }
          aria-hidden
        >
          {profile.initials}
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-display text-[34px] font-black uppercase leading-[0.95]">
            <span className="truncate">{profile.name}</span>
            {profile.starred && <StarMark size={22} />}
          </p>
          <p className="mt-1 text-[14px] text-white/70">
            <b className="font-semibold text-bone">{fmtDuration(profile.weekMinutes)}</b> trained this week
          </p>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-[11px] font-bold uppercase tracking-[2.6px] text-accent">{auraLabel(profile.aura.level)}</p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(profile.aura.progress * 100)}%` }} />
        </div>
        {profile.you && auraNextLine(profile.aura) && (
          <p className="mt-2 text-[13px] text-white/70">{auraNextLine(profile.aura)}</p>
        )}
      </div>

      {(profile.levelName || profile.playingFor) && (
        <div className="mt-4 space-y-1">
          {profile.levelName && <p className="text-[15px] font-semibold text-bone">{profile.levelName}</p>}
          {profile.playingFor && (
            <p className="text-[15px] text-white/70">
              Playing for <b className="font-semibold text-bone">{profile.playingFor}</b>
            </p>
          )}
          {profile.you && !profile.playingFor && (
            <Link href="/account" className="inline-flex min-h-[44px] items-center text-[14px] text-white/70 underline">
              Add who you play for in Account
            </Link>
          )}
        </div>
      )}

      {profile.clubs.length > 0 && (
        <div className="mt-4">
          <h3 className="text-[11px] font-bold uppercase tracking-[2.6px] text-white/60">Clubs</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {profile.clubs.map((c) => (
              <li key={c} className="rounded-full border border-accent/40 px-3 py-1.5 text-[13px] font-semibold text-bone">
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-5 space-y-2.5">
        {profile.you ? (
          <>
            <button
              type="button"
              onClick={async () => {
                if ((await sendLink(inviteLink)) === "copied") {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2500);
                }
              }}
              className="flex h-14 w-full items-center justify-center rounded-2xl border border-white/15 text-[15px] font-semibold text-bone"
            >
              {copied ? "Link copied" : "Send my link"}
            </button>
            <Link
              href="/account"
              className="flex h-14 w-full items-center justify-center rounded-2xl border border-white/15 text-[15px] font-semibold text-bone"
            >
              Account
            </Link>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => act(() => removeFriend(profile.id))}
              className="flex h-14 w-full items-center justify-center rounded-2xl border border-white/15 text-[15px] font-semibold text-bone disabled:opacity-60"
            >
              Remove from my friends
            </button>
            <button
              type="button"
              onClick={() => setStep("block")}
              className="flex h-14 w-full items-center justify-center rounded-2xl border border-white/15 text-[15px] font-semibold text-bone"
            >
              Block {first}
            </button>
            {profile.playingFor &&
              (reported ? (
                <p className="py-2 text-center text-[14px] text-white/70">Sent to the coaches. Thank you.</p>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep("report")}
                  className="flex min-h-[44px] w-full items-center justify-center text-[14px] text-white/70 underline"
                >
                  Report the Playing for line
                </button>
              ))}
          </>
        )}
      </div>
    </TrackerSheet>
  );
}
