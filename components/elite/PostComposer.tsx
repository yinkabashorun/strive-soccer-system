"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { logTraining } from "@/lib/elite/tracker-actions";
import { teammatesToTag } from "@/lib/elite/club-teams-actions";
import { TOGETHER_MAX } from "@/lib/elite/club-teams";
import type { Teammate } from "@/lib/elite/club-teams-server";
import { FreeAvatar } from "./FreeAvatar";
import { holdRefresh } from "@/lib/elite/fresh";
import { feel } from "@/lib/elite/native";
import {
  CAPTION_MAX,
  FREE_HOME,
  FREE_WEEK,
  KINDS,
  LOG_CHIPS,
  NO_PHOTO_LINK,
  POST_JPEG_QUALITY,
  POST_REFUSED_PHOTO,
  POST_RULES_LINE,
  chipLabel,
  fitWithin,
  type Kind,
} from "@/lib/elite/tracker";

// The photo shrunk on the phone before it leaves: the longest side at
// most 1440, a JPEG. A photo the browser cannot read gives null.
async function shrink(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const size = fitWithin(bitmap.width, bitmap.height);
    if (!size.width) return null;
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();
    return await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/jpeg", POST_JPEG_QUALITY));
  } catch {
    return null;
  }
}

// Posting today's training (mock screen 2): the photo fills the screen, and
// the sheet over it asks how long, training or gym (older players only),
// one optional line, the club teammates who trained with them (optional,
// up to eight; each gets a card to add the same time to their own week,
// 077), and Post to my friends. Under it, "Log it without a
// photo" keeps the time in the player's own week and shows no card.
export function PostComposer({
  photo,
  gym,
  onRetake,
  onClose,
}: {
  photo: File | null;
  gym: boolean;
  onRetake: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [kind, setKind] = useState<Kind>("training");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"post" | "log" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mates, setMates] = useState<Teammate[]>([]);
  const [tagged, setTagged] = useState<string[]>([]);

  useEffect(() => {
    if (!photo) return setPreview(null);
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  // The club teammates who can be tagged: asked for once the sheet opens.
  useEffect(() => {
    if (!photo) return;
    let live = true;
    teammatesToTag()
      .then((res) => {
        if (live && res.ok) setMates(res.teammates);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [photo]);

  // Nothing redraws the page under the sheet while it is open.
  useEffect(() => holdRefresh(), []);

  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, []);

  function done(to: string) {
    feel("drill");
    onClose();
    router.push(to);
    router.refresh();
  }

  async function postIt() {
    if (!photo || minutes === null) return;
    setError(null);
    setBusy("post");
    const jpeg = await shrink(photo);
    if (!jpeg) {
      setBusy(null);
      return setError(POST_REFUSED_PHOTO);
    }
    const form = new FormData();
    form.set("photo", jpeg, "post.jpg");
    form.set("minutes", String(minutes));
    form.set("kind", gym ? kind : "training");
    form.set("caption", note);
    if (tagged.length) form.set("with", tagged.join(","));
    try {
      const res = await fetch("/api/elite/tracker/post", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setBusy(null);
        return setError(data.error || "Your post was not saved. Try again.");
      }
    } catch {
      setBusy(null);
      return setError("Your post was not saved. Check your connection and try again.");
    }
    done(FREE_HOME);
  }

  async function logIt() {
    if (minutes === null) return;
    setError(null);
    setBusy("log");
    const res = await logTraining(minutes, gym ? kind : "training").catch(() => null);
    if (!res || !res.ok) {
      setBusy(null);
      return setError(res && !res.ok ? res.error : "That was not saved. Check your connection and try again.");
    }
    done(FREE_WEEK);
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Post your training" className="fixed inset-0 z-50 bg-black">
      <div className="relative mx-auto h-full max-w-md overflow-hidden">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Your training photo" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_20%,#2a2a2a_0%,#000_70%)]" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.55)_0%,rgba(0,0,0,0)_20%,rgba(0,0,0,0)_34%,rgba(0,0,0,.94)_62%)]" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute left-[18px] top-[calc(14px+env(safe-area-inset-top))] z-10 grid h-11 w-11 place-items-center rounded-full bg-black/45"
        >
          <X className="h-5 w-5 text-white" strokeWidth={2.4} />
        </button>
        {preview && (
          <button
            type="button"
            onClick={onRetake}
            className="absolute right-[10px] top-[calc(14px+env(safe-area-inset-top))] z-10 flex h-11 items-center px-2 text-[14px] font-bold [text-shadow:0_1px_8px_rgba(0,0,0,.7)]"
          >
            Retake
          </button>
        )}

        <div className="absolute inset-x-0 bottom-0 z-10 max-h-full overflow-y-auto px-[18px] pb-[calc(28px+env(safe-area-inset-bottom))]">
          <h2 className="font-display text-[40px] font-black uppercase leading-[0.92]">
            How long did
            <br />
            you train?
          </h2>

          {gym && (
            <div role="radiogroup" aria-label="What you are posting" className="mt-[18px] flex rounded-2xl border border-white/[0.09] bg-[#161616] p-1">
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  role="radio"
                  aria-checked={kind === k.id}
                  onClick={() => setKind(k.id)}
                  className={
                    "h-11 flex-1 rounded-xl text-[15px] font-bold " +
                    (kind === k.id ? "bg-[#2b2b2b] text-bone" : "text-white/60")
                  }
                >
                  {k.label}
                </button>
              ))}
            </div>
          )}

          <div role="radiogroup" aria-label="How long" className="mt-3 flex gap-2">
            {LOG_CHIPS.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={minutes === m}
                onClick={() => setMinutes(m)}
                className={
                  "h-16 flex-1 rounded-[18px] font-display text-[24px] font-black " +
                  (minutes === m ? "bg-accent text-black" : "border border-white/[0.09] bg-[#161616] text-bone")
                }
              >
                {chipLabel(m)}
              </button>
            ))}
          </div>

          {preview && (
            <label className="mt-3 flex h-[54px] items-center gap-3 rounded-2xl border border-white/[0.09] bg-[#161616] px-4">
              <span className="sr-only">One line about your training</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, CAPTION_MAX))}
                maxLength={CAPTION_MAX}
                placeholder="What did you work on?"
                className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-bone placeholder:text-white/50 focus:outline-none"
              />
              <span className="text-[12px] text-white/60">optional</span>
            </label>
          )}

          {preview && mates.length > 0 && (
            <div className="mt-3">
              <p className="text-[12px] font-semibold uppercase tracking-[1.6px] text-white/60">Trained with (optional)</p>
              <ul className="no-scrollbar -mx-[18px] mt-1.5 flex gap-2 overflow-x-auto px-[18px]">
                {mates.map((m) => {
                  const on = tagged.includes(m.id);
                  return (
                    <li key={m.id} className="shrink-0">
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setTagged((t) => (on ? t.filter((x) => x !== m.id) : t.length < TOGETHER_MAX ? [...t, m.id] : t))
                        }
                        className={
                          "flex h-11 items-center gap-2 rounded-full pl-1 pr-3.5 text-[14px] font-semibold " +
                          (on ? "bg-bone text-black" : "border border-white/[0.12] bg-[#161616] text-bone")
                        }
                      >
                        <FreeAvatar photo={m.photo} initials={m.initials} size={34} />
                        {m.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {error && (
            <p className="mt-3 text-[14px] text-red-400" aria-live="polite">
              {error}
            </p>
          )}

          {preview ? (
            <>
              <p className="mt-3 text-[12px] leading-snug text-white/60">{POST_RULES_LINE}</p>
              <button
                type="button"
                disabled={minutes === null || busy !== null}
                onClick={postIt}
                className="mt-3 flex h-[60px] w-full items-center justify-center rounded-[20px] bg-bone font-display text-[24px] font-black uppercase tracking-[0.5px] text-black disabled:opacity-50"
              >
                {busy === "post" ? <Loader2 className="h-6 w-6 animate-spin" /> : "Post to my friends"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onRetake}
              className="mt-4 flex h-[60px] w-full items-center justify-center rounded-[20px] bg-bone font-display text-[24px] font-black uppercase tracking-[0.5px] text-black"
            >
              Take a photo
            </button>
          )}
          <button
            type="button"
            disabled={minutes === null || busy !== null}
            onClick={logIt}
            className="mx-auto mt-1 flex min-h-[44px] items-center justify-center px-3 text-[14px] font-semibold text-white/70 underline underline-offset-4 disabled:opacity-50"
          >
            {busy === "log" ? <Loader2 className="h-4 w-4 animate-spin" /> : NO_PHOTO_LINK}
          </button>
        </div>
      </div>
    </div>
  );
}
