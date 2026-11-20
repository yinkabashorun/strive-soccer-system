"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeMyPhoto } from "@/lib/elite/tracker-actions";
import { AVATAR_EDGE, AVATAR_MAX_BYTES, AVATAR_MESSAGE, squareCrop } from "@/lib/elite/tracker";
import { FreeAvatar } from "./FreeAvatar";
import { IconCamera } from "./FreeIcons";

// The profile photo, cut to a square on the phone and shrunk to a small
// JPEG before it leaves. Never asked for at sign-up; a player adds one here
// when they want to. Friends and coaches see it; it can be reported.
async function squareJpeg(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const crop = squareCrop(bitmap.width, bitmap.height);
    if (!crop.size) return null;
    const edge = Math.min(AVATAR_EDGE, crop.size);
    const canvas = document.createElement("canvas");
    canvas.width = edge;
    canvas.height = edge;
    canvas.getContext("2d")?.drawImage(bitmap, crop.sx, crop.sy, crop.size, crop.size, 0, 0, edge, edge);
    bitmap.close();
    for (const quality of [0.85, 0.7, 0.55]) {
      const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/jpeg", quality));
      if (blob && blob.size <= AVATAR_MAX_BYTES) return blob;
    }
    return null;
  } catch {
    return null;
  }
}

export function ProfilePhotoPicker({ photo, initials }: { photo: string | null; initials: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    start(async () => {
      const blob = await squareJpeg(file);
      if (!blob) return setError(AVATAR_MESSAGE);
      const form = new FormData();
      form.append("photo", blob, "avatar.jpg");
      const res = await fetch("/api/elite/tracker/avatar", { method: "POST", body: form }).catch(() => null);
      if (!res || !res.ok) {
        const body = (await res?.json().catch(() => null)) as { error?: string } | null;
        return setError(body?.error ?? AVATAR_MESSAGE);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-center px-[18px] pt-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label={photo ? "Change your photo" : "Add a photo"}
        className="relative"
      >
        <FreeAvatar photo={photo} initials={initials} size={96} you />
        <span className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full border-2 border-black bg-bone text-black">
          <IconCamera size={16} />
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div className="mt-4 flex gap-2.5">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="flex h-11 items-center justify-center rounded-xl bg-bone px-5 text-[15px] font-bold text-black disabled:opacity-60"
        >
          {busy ? "Saving" : photo ? "Change photo" : "Add a photo"}
        </button>
        {photo && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              start(async () => {
                setError(null);
                const res = await removeMyPhoto();
                if (!res.ok) return setError(res.error);
                router.refresh();
              })
            }
            className="flex h-11 items-center justify-center rounded-xl bg-[#1f1f1f] px-5 text-[15px] font-semibold text-bone disabled:opacity-60"
          >
            Remove photo
          </button>
        )}
      </div>
      <p className="mt-3 text-center text-[13px] leading-snug text-white/60">Your friends and the coaches see your photo.</p>
      {error && (
        <p role="alert" className="mt-2 text-center text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
