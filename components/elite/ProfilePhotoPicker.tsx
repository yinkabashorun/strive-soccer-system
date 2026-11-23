"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadProfilePhoto } from "@/lib/elite/photo-upload";
import { FreeAvatar } from "./FreeAvatar";
import { IconCamera } from "./FreeIcons";

// Change the profile photo (settings, You). Every account has one: it is
// asked for once, before training starts (lib/elite/account-profile.ts),
// so here it can be changed but not taken off. Friends and coaches see it;
// it can be reported, and a coach can take a reported one off, which asks
// the player for a new one. The phone crops and shrinks it first
// (lib/elite/photo-upload.ts).
export function ProfilePhotoPicker({
  photo,
  initials,
  seenBy = "Your friends and the coaches see your photo.",
}: {
  photo: string | null;
  initials: string;
  seenBy?: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    start(async () => {
      const res = await uploadProfilePhoto(file);
      if (!res.ok) return setError(res.error);
      setPreview(res.preview);
      router.refresh();
    });
  }

  const shown = preview ?? photo;
  return (
    <div className="flex flex-col items-center px-[18px] pt-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label={shown ? "Change your photo" : "Add a photo"}
        className="press relative"
      >
        <FreeAvatar photo={shown} initials={initials} size={96} you />
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
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className="press mt-4 flex h-11 items-center justify-center rounded-xl bg-bone px-5 text-[15px] font-bold text-black disabled:opacity-60"
      >
        {busy ? "Saving" : shown ? "Change photo" : "Add a photo"}
      </button>
      <p className="mt-3 text-center text-[13px] leading-snug text-white/60">{seenBy}</p>
      {error && (
        <p role="alert" className="mt-2 text-center text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
