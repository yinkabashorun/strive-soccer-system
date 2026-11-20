"use client";

import { useEffect, useState, type RefObject } from "react";
import { cameraHint } from "@/lib/elite/clips";
import { isNativeUserAgent } from "@/lib/elite/app-links";

// The camera hint under a clip button: shown when the picker closes with
// nothing picked (the browser's "cancel" on a file input), cleared on the
// next tap. Where the browser does not report a cancel, nothing shows.
export function useCameraHint(ref: RefObject<HTMLInputElement>): [string | null, () => void] {
  const [hint, setHint] = useState<string | null>(null);
  useEffect(() => {
    const input = ref.current;
    if (!input) return;
    const onCancel = () => setHint(cameraHint(isNativeUserAgent(navigator.userAgent)));
    input.addEventListener("cancel", onCancel);
    return () => input.removeEventListener("cancel", onCancel);
  }, [ref]);
  return [hint, () => setHint(null)];
}
