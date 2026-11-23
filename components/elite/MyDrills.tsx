"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, MoreHorizontal, Pause, Play, Plus, Share2, Video } from "lucide-react";
import {
  DRILL_NAME_MAX,
  TAKE_MAX_MB,
  TAKE_TOO_LONG,
  byDate,
  cleanCount,
  countChange,
  defaultPair,
  drillHref,
  pickTwo,
  reelSeconds,
  reelTakes,
  shortDate,
  startTake,
  takeExtension,
  takeLabel,
  takeLengthOk,
  takePath,
  type MyDrill,
  type Take,
} from "@/lib/elite/my-drills";
import { createDrill, deleteDrill, deleteTake, renameDrill, saveTake, setStartTake, setTakeCount } from "@/lib/elite/my-drills-actions";
import { composeDuet, composeReel, readVideoSeconds, shareOrSave, videoShareSupported } from "@/lib/elite/my-drills-client";
import { uploadClip } from "@/lib/elite/clip-upload";
import { POST_BUCKET } from "@/lib/elite/tracker";
import { AUTOPLAY_PREF_KEY } from "@/lib/elite/session-flow";
import { ActionSheet } from "./ActionSheet";
import { TrackerSheet } from "./TrackerSheet";
import { useCameraHint } from "./useCameraHint";
import { cn } from "@/lib/utils";
import { shareText } from "@/lib/elite/share-link";

// MY DRILLS (078), the free app's own and completely optional: the drills
// a player named, each a folder of takes they film whenever they want.
// Private: only the player sees them (and the coaches); never the feed.

// ---- The list ----------------------------------------------------------

export function MyDrillsList({ drills, canAdd, example }: { drills: MyDrill[]; canAdd: boolean; example: boolean }) {
  const router = useRouter();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function make() {
    setBusy(true);
    setError(null);
    const res = await createDrill(name).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) return setError(res && !res.ok ? res.error : "That was not saved. Try again.");
    router.push(drillHref(res.id));
    router.refresh();
  }

  return (
    <div className="px-[18px]">
      <h1 className="font-display text-[44px] font-black uppercase leading-[0.9]">My drills</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-white/70">
        Name a drill, film a take whenever you train it, and watch yourself get better. Only you can see them.
      </p>

      {drills.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-white/10 bg-[#121212] p-5 text-[15px] text-white/70">
          No drills yet. Name the first thing you want to get better at, like &ldquo;Weak foot juggles&rdquo;.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-white/[0.08] overflow-hidden rounded-2xl border border-white/10 bg-[#121212]">
          {drills.map((d) => (
            <li key={d.id}>
              <Link href={drillHref(d.id)} className="flex min-h-[72px] items-center gap-3 px-4 py-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
                  <Video className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-bold text-bone">{d.name}</span>
                  <span className="block text-[13px] text-white/60">
                    {d.takes === 0
                      ? "No takes yet"
                      : `${d.takes} ${d.takes === 1 ? "take" : "takes"} · first ${shortDate(d.first_at!)}${
                          d.takes > 1 ? ` · latest ${shortDate(d.latest_at!)}` : ""
                        }`}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-white/50" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {naming ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-[#121212] p-4">
          <label className="block text-[13px] font-semibold uppercase tracking-[0.14em] text-white/60" htmlFor="drill-name">
            Name your drill
          </label>
          <input
            id="drill-name"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, DRILL_NAME_MAX))}
            maxLength={DRILL_NAME_MAX}
            placeholder="Weak foot juggles"
            autoFocus
            className="mt-2 h-12 w-full rounded-xl border border-white/15 bg-black px-3 text-[16px] text-bone placeholder:text-white/50 focus:outline-none"
          />
          {error && <p className="mt-2 text-[14px] text-red-400">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setNaming(false)}
              className="h-12 flex-1 rounded-xl border border-white/15 text-[15px] font-semibold text-white/70"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || !name.trim()}
              onClick={() => void make()}
              className="flex h-12 flex-1 items-center justify-center rounded-xl bg-bone text-[15px] font-bold text-black disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Make the drill"}
            </button>
          </div>
        </div>
      ) : canAdd ? (
        <button
          type="button"
          onClick={() => setNaming(true)}
          className="mt-4 flex h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-bone font-display text-[20px] font-black uppercase text-black"
        >
          <Plus className="h-5 w-5" /> New drill
        </button>
      ) : (
        <p className="mt-4 text-[14px] text-white/60">You have the most drills one player can keep. Delete one to make another.</p>
      )}
      {example && <p className="mt-3 text-[13px] text-white/60">In the example, nothing is saved.</p>}
    </div>
  );
}

// ---- One drill ---------------------------------------------------------

export function DrillScreen({
  drill,
  takes,
  canAddTake,
  profileId,
  example,
  shareLink,
}: {
  drill: MyDrill;
  takes: Take[];
  canAddTake: boolean;
  profileId: string;
  example: boolean;
  shareLink: string; // their own join link: every share is an invite
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [hint, clearHint] = useCameraHint(fileRef);
  const [percent, setPercent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [takeMenu, setTakeMenu] = useState<Take | null>(null);
  const [counting, setCounting] = useState<{ take: Take; value: string } | null>(null);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  const sorted = useMemo(() => byDate(takes), [takes]);
  const start = startTake(sorted, drill.start_take_id);
  const pair = useMemo(() => {
    if (picked.length === 2) return pickTwo(sorted, picked[0], picked[1]);
    return defaultPair(sorted, drill.start_take_id);
  }, [sorted, picked, drill.start_take_id]);
  const reel = useMemo(() => reelTakes(sorted, drill.start_take_id), [sorted, drill.start_take_id]);
  const label = (t: Take) => (start ? takeLabel(t, start) : null) ?? shortDate(t.created_at);

  async function onFile(file: File) {
    setError(null);
    const seconds = await readVideoSeconds(file);
    if (!takeLengthOk(seconds)) return setError(TAKE_TOO_LONG);
    const takeId = crypto.randomUUID();
    const path = takePath(profileId, takeId, takeExtension(file.name, file.type));
    if (!path) return setError("That video could not be used. Try another one.");
    setPercent(0);
    const up = await uploadClip(file, path, setPercent, { bucket: POST_BUCKET, maxMb: TAKE_MAX_MB });
    if (!up.ok) {
      setPercent(null);
      return setError(up.error);
    }
    const res = await saveTake({ drillId: drill.id, takeId, path, seconds: Number.isFinite(seconds) ? seconds : null }).catch(() => null);
    setPercent(null);
    if (!res || !res.ok) return setError(res && !res.ok ? res.error : "That take was not saved. Try again.");
    router.refresh();
  }

  async function run(p: Promise<{ ok: true } | { ok: false; error: string }>, after?: () => void) {
    const res = await p.catch(() => null);
    if (!res || !res.ok) return setError(res && !res.ok ? res.error : "That was not saved. Try again.");
    after?.();
    router.refresh();
  }

  return (
    <div className="px-[18px] pb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[40px] font-black uppercase leading-[0.92]">{drill.name}</h1>
          <p className="mt-1.5 text-[13px] text-white/60">
            {sorted.length} {sorted.length === 1 ? "take" : "takes"}. Only you can see them.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMenu(true)}
          aria-label="Drill options"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.06] text-bone"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void onFile(f);
        }}
      />
      <button
        type="button"
        disabled={!canAddTake || percent !== null || example}
        onClick={() => {
          clearHint();
          fileRef.current?.click();
        }}
        className="mt-4 flex h-[64px] w-full items-center justify-center gap-2.5 rounded-[20px] bg-bone font-display text-[24px] font-black uppercase text-black disabled:opacity-50"
      >
        {percent !== null ? <Loader2 className="h-6 w-6 animate-spin" /> : <Video className="h-6 w-6" />}
        {percent !== null ? `Sending ${percent}%` : "Film a new take"}
      </button>
      <p className="mt-2 text-center text-[13px] text-white/60">
        {example
          ? "In the example, nothing is filmed or saved."
          : canAddTake
            ? "Up to 20 seconds. Same angle each time makes the change easy to see."
            : "This drill is full. Delete an old take to film a new one."}
      </p>
      {error && <p className="mt-2 text-[14px] text-red-400" aria-live="polite">{error}</p>}
      {hint && !error && <p className="mt-2 text-[13px] text-white/60">{hint}</p>}

      {pair ? (
        <ThenAndNow
          name={drill.name}
          a={pair[0]}
          b={pair[1]}
          labelA={label(pair[0])}
          labelB={label(pair[1])}
          picked={picked.length === 2}
          shareLink={shareLink}
          onPick={() => {
            setPicking(true);
            setPicked([]);
          }}
          onReset={() => {
            setPicking(false);
            setPicked([]);
          }}
        />
      ) : sorted.length === 1 ? (
        <p className="mt-6 rounded-2xl border border-white/10 bg-[#121212] p-4 text-[15px] text-white/70">
          This is your starting take. Film another one later and the two play side by side here.
        </p>
      ) : null}

      {reel.length >= 2 && <ProgressReel name={drill.name} takes={reel} labelOf={label} shareLink={shareLink} />}

      {sorted.length > 0 && (
        <section className="mt-7" aria-label="Your takes">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[22px] font-black uppercase">Your takes</h2>
            {picking && (
              <span className="text-[13px] text-accent" aria-live="polite">
                {picked.length === 2 ? "Comparing these two" : `Tap ${2 - picked.length} more`}
              </span>
            )}
          </div>
          <ul className="mt-2 divide-y divide-white/[0.08] overflow-hidden rounded-2xl border border-white/10 bg-[#121212]">
            {[...sorted].reverse().map((t) => {
              const on = picked.includes(t.id);
              return (
                <li key={t.id} className="flex min-h-[64px] items-center gap-3 px-3 py-2">
                  <button
                    type="button"
                    onClick={() =>
                      picking
                        ? setPicked((p) => (on ? p.filter((x) => x !== t.id) : p.length < 2 ? [...p, t.id] : [p[1], t.id]))
                        : setTakeMenu(t)
                    }
                    aria-pressed={picking ? on : undefined}
                    aria-label={`${label(t)}, ${shortDate(t.created_at)}${t.count !== null ? `, count ${t.count}` : ""}`}
                    className="flex min-h-[48px] min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span
                      className={cn(
                        "relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-black",
                        on && "ring-2 ring-accent"
                      )}
                    >
                      {t.url && <video src={`${t.url}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-bold text-bone">
                        {label(t)}
                        {start?.id === t.id && <span className="ml-2 text-[12px] font-semibold text-accent">Start</span>}
                      </span>
                      <span className="block text-[13px] text-white/60">{shortDate(t.created_at)}</span>
                    </span>
                    {t.count !== null && (
                      <span className="font-display text-[24px] font-black tabular-nums text-bone">{t.count}</span>
                    )}
                  </button>
                  {!picking && (
                    <button
                      type="button"
                      onClick={() => setTakeMenu(t)}
                      aria-label="Take options"
                      className="grid h-11 w-11 shrink-0 place-items-center text-white/60"
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {menu && (
        <ActionSheet
          label="Drill options"
          title={drill.name}
          onClose={() => setMenu(false)}
          rows={[
            { label: "Rename the drill", onClick: () => (setMenu(false), setRenaming(drill.name)) },
            {
              label: "Delete the drill and every take",
              red: true,
              onClick: () => {
                setMenu(false);
                if (window.confirm(`Delete ${drill.name} and all ${sorted.length} takes? This cannot be undone.`)) {
                  void run(deleteDrill(drill.id), () => router.push("/log/drills"));
                }
              },
            },
          ]}
        />
      )}

      {renaming !== null && (
        <TrackerSheet title="Rename the drill" onClose={() => setRenaming(null)}>
          <input
            value={renaming}
            onChange={(e) => setRenaming(e.target.value.slice(0, DRILL_NAME_MAX))}
            maxLength={DRILL_NAME_MAX}
            aria-label="The drill's name"
            className="mt-3 h-12 w-full rounded-xl border border-white/15 bg-black px-3 text-[16px] text-bone focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void run(renameDrill(drill.id, renaming), () => setRenaming(null))}
            className="mt-3 h-12 w-full rounded-xl bg-bone text-[15px] font-bold text-black"
          >
            Save the name
          </button>
        </TrackerSheet>
      )}

      {takeMenu && (
        <ActionSheet
          label="Take options"
          title={`${label(takeMenu)}, ${shortDate(takeMenu.created_at)}`}
          onClose={() => setTakeMenu(null)}
          rows={[
            ...(start?.id !== takeMenu.id
              ? [{ label: "Set as starting take", onClick: () => void run(setStartTake(drill.id, takeMenu.id), () => setTakeMenu(null)) }]
              : []),
            {
              label: takeMenu.count === null ? "Add a count" : "Change the count",
              onClick: () => {
                setCounting({ take: takeMenu, value: takeMenu.count === null ? "" : String(takeMenu.count) });
                setTakeMenu(null);
              },
            },
            {
              label: "Delete this take",
              red: true,
              onClick: () => {
                const t = takeMenu;
                setTakeMenu(null);
                if (window.confirm("Delete this take? This cannot be undone.")) void run(deleteTake(t.id));
              },
            },
          ]}
        />
      )}

      {counting && (
        <TrackerSheet title="Your count" onClose={() => setCounting(null)}>
          <p className="mt-1 text-[14px] text-white/70">
            How many you got in this take, if you counted. Leave it empty to take the count off.
          </p>
          <input
            value={counting.value}
            onChange={(e) => setCounting({ ...counting, value: e.target.value.replace(/[^0-9]/g, "").slice(0, 3) })}
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label="Your count"
            placeholder="0"
            className="mt-3 h-20 w-full rounded-2xl border border-white/15 bg-black text-center font-display text-5xl font-black tabular-nums text-bone focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              const n = cleanCount(counting.value);
              if (n === undefined) return setError("A count is a whole number from 0 to 999.");
              void run(setTakeCount(counting.take.id, n), () => setCounting(null));
            }}
            className="mt-3 h-12 w-full rounded-xl bg-bone text-[15px] font-bold text-black"
          >
            Save the count
          </button>
        </TrackerSheet>
      )}
    </div>
  );
}

// ---- Then and now ------------------------------------------------------

function useAutoplay(): boolean {
  const [auto, setAuto] = useState(false);
  useEffect(() => {
    let on = true;
    try {
      on = window.localStorage.getItem(AUTOPLAY_PREF_KEY) !== "off";
    } catch {
      /* default on */
    }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) on = false;
    setAuto(on);
  }, []);
  return auto;
}

function useCanShare(): boolean {
  const [can, setCan] = useState(false);
  useEffect(() => setCan(videoShareSupported()), []);
  return can;
}

// Two takes side by side, muted, starting together and starting over
// together, the label and date under each, the counts when both have one.
export function ThenAndNow({
  name,
  a,
  b,
  labelA,
  labelB,
  picked,
  onPick,
  onReset,
  shareLink,
}: {
  shareLink: string;
  name: string;
  a: Take;
  b: Take;
  labelA: string;
  labelB: string;
  picked: boolean;
  onPick: () => void;
  onReset: () => void;
}) {
  const refA = useRef<HTMLVideoElement>(null);
  const refB = useRef<HTMLVideoElement>(null);
  const auto = useAutoplay();
  const canShare = useCanShare();
  const [playing, setPlaying] = useState(false);
  const [sharing, setSharing] = useState<"idle" | "making" | "error" | "done">("idle");
  const change = countChange(a, b);

  const playBoth = useCallback(() => {
    for (const v of [refA.current, refB.current]) {
      if (!v) continue;
      v.currentTime = 0;
      void v.play().catch(() => undefined);
    }
    setPlaying(true);
  }, []);

  useEffect(() => {
    if (auto) playBoth();
  }, [auto, playBoth, a.id, b.id]);

  async function share() {
    if (!a.url || !b.url) return;
    setSharing("making");
    const file = await composeDuet({
      name,
      top: { url: a.url, label: `${labelA} · ${shortDate(a.created_at)}`, count: a.count },
      bottom: { url: b.url, label: `${labelB} · ${shortDate(b.created_at)}`, count: b.count },
    });
    if (!file) return setSharing("error");
    await shareOrSave(file, "Then and now", shareText("then_and_now", shareLink));
    setSharing("done");
  }

  const side = (t: Take, l: string, ref: React.RefObject<HTMLVideoElement>) => (
    <figure className="min-w-0">
      <div className="aspect-[3/4] overflow-hidden rounded-2xl border border-white/10 bg-black">
        {t.url ? (
          <video ref={ref} src={t.url} muted playsInline preload="auto" onEnded={playBoth} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center px-3 text-center text-[13px] text-white/60">This take could not load.</div>
        )}
      </div>
      <figcaption className="mt-2">
        <span className="block text-[13px] font-bold uppercase tracking-[0.12em] text-accent">{l}</span>
        <span className="block text-[13px] text-white/70">{shortDate(t.created_at)}</span>
        {t.count !== null && <span className="block font-display text-[26px] font-black leading-none tabular-nums">{t.count}</span>}
      </figcaption>
    </figure>
  );

  return (
    <section className="mt-7" aria-label="Then and now">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-[22px] font-black uppercase">Then and now</h2>
        <button
          type="button"
          onClick={picked ? onReset : onPick}
          className="min-h-[44px] px-1 text-[14px] font-semibold text-white/70 underline underline-offset-4"
        >
          {picked ? "Back to start and latest" : "Pick two"}
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3">
        {side(a, labelA, refA)}
        {side(b, labelB, refB)}
      </div>
      {change && <p className="mt-3 font-display text-[34px] font-black tabular-nums text-accent">{change}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {!playing && (
          <button
            type="button"
            onClick={playBoth}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-white/15 px-4 text-[14px] font-semibold text-bone"
          >
            <Play className="h-4 w-4" fill="currentColor" /> Play both
          </button>
        )}
        {canShare && a.url && b.url && (
          <ShareButton busy={sharing === "making"} onClick={() => void share()} label="Share then and now" />
        )}
      </div>
      <ShareNote state={sharing} />
    </section>
  );
}

// ---- The progress reel ---------------------------------------------------

// Every take in order, about 3 seconds each, the label on it, the latest
// held longer. Played here as a preview; Share makes it one video.
export function ProgressReel({
  name,
  takes,
  labelOf,
  shareLink,
}: {
  name: string;
  takes: Take[];
  labelOf: (t: Take) => string;
  shareLink: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const canShare = useCanShare();
  const [i, setI] = useState(0);
  const [on, setOn] = useState(false);
  const [sharing, setSharing] = useState<"idle" | "making" | "error" | "done">("idle");
  const slots = useMemo(() => reelSeconds(takes.map((t) => t.seconds ?? NaN)), [takes]);
  const take = takes[i];

  useEffect(() => {
    if (!on) return;
    const v = ref.current;
    if (v) {
      v.currentTime = 0;
      void v.play().catch(() => undefined);
    }
    const id = setTimeout(() => {
      if (i < takes.length - 1) setI(i + 1);
      else setOn(false);
    }, slots[i] * 1000);
    return () => clearTimeout(id);
  }, [on, i, slots, takes.length]);

  async function share() {
    if (takes.some((t) => !t.url)) return;
    setSharing("making");
    const file = await composeReel({ name, takes: takes.map((t) => ({ url: t.url!, label: labelOf(t) })) });
    if (!file) return setSharing("error");
    await shareOrSave(file, "Progress reel", shareText("progress_reel", shareLink));
    setSharing("done");
  }

  return (
    <section className="mt-7" aria-label="Progress reel">
      <h2 className="font-display text-[22px] font-black uppercase">Progress reel</h2>
      <p className="mt-1 text-[13px] text-white/60">
        {takes.length} takes, {labelOf(takes[0])} to {labelOf(takes[takes.length - 1])}, about 3 seconds each.
      </p>
      <div className="relative mx-auto mt-2 aspect-[9/16] max-h-[60svh] overflow-hidden rounded-2xl border border-white/10 bg-black">
        {take?.url && (
          <video key={take.id} ref={ref} src={take.url} muted playsInline preload="auto" className="h-full w-full object-cover" />
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-3">
          <span className="text-[13px] font-bold uppercase text-bone [text-shadow:0_1px_8px_rgba(0,0,0,.8)]">{name}</span>
          <span className="text-[13px] font-black uppercase tracking-[0.12em] text-accent [text-shadow:0_1px_8px_rgba(0,0,0,.8)]">STRIVE</span>
        </div>
        <span className="pointer-events-none absolute bottom-4 left-4 font-display text-[44px] font-black uppercase leading-none text-bone [text-shadow:0_2px_14px_rgba(0,0,0,.8)]">
          {take ? labelOf(take) : ""}
        </span>
        <div className="absolute inset-x-3 bottom-2 flex gap-1" aria-hidden>
          {takes.map((t, n) => (
            <span key={t.id} className={cn("h-1 flex-1 rounded-full", n <= i ? "bg-accent" : "bg-white/25")} />
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            if (on) return setOn(false);
            setI(0);
            setOn(true);
          }}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-white/15 px-4 text-[14px] font-semibold text-bone"
        >
          {on ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4" fill="currentColor" />}
          {on ? "Pause" : "Play the reel"}
        </button>
        {canShare && <ShareButton busy={sharing === "making"} onClick={() => void share()} label="Share the reel" />}
      </div>
      <ShareNote state={sharing} />
    </section>
  );
}

function ShareButton({ busy, onClick, label }: { busy: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-bone px-4 text-[14px] font-bold uppercase tracking-wide text-black disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
      {busy ? "Making your video" : label}
    </button>
  );
}

function ShareNote({ state }: { state: "idle" | "making" | "error" | "done" }) {
  if (state === "making") return <p className="mt-2 text-[13px] text-white/60">Made on your phone. Keep this screen open.</p>;
  if (state === "error")
    return <p className="mt-2 text-[13px] text-white/60">This phone could not make the video. It still plays here any time.</p>;
  if (state === "done") return <p className="mt-2 text-[13px] text-white/60">Made on your phone. We never post anything for you.</p>;
  return null;
}
