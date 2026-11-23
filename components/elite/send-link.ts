"use client";

// Hand the player's own link to the phone's share sheet, or copy it where
// there is none. Gives back "copied" when it was copied, so the button can
// say so; "shared" or "none" otherwise.
export async function sendLink(link: string): Promise<"shared" | "copied" | "none"> {
  try {
    if (typeof navigator.share === "function") {
      await navigator.share({ url: link });
      return "shared";
    }
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") return "none";
  }
  try {
    await navigator.clipboard.writeText(link);
    return "copied";
  } catch {
    return "none";
  }
}
