import { describe, expect, it } from "vitest";
import { clipExtension, clipPath, ownsClipPath } from "@/lib/elite/clips";

// Send a clip (Oct 13 2026): a family writes only inside its own folder.
const P = "8f0a3b4c-1d2e-4f5a-9b6c-7d8e9f0a1b2c";
const H = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

describe("clip paths", () => {
  it("builds the convention the storage policy checks", () => {
    expect(clipPath(P, H, "mp4", 1700000000000)).toBe(`clips/${P}/${H}/1700000000000.mp4`);
  });
  it("owns only a well-formed path in the player's own folder", () => {
    expect(ownsClipPath(clipPath(P, H, "mov", 5), P)).toBe(true);
    expect(ownsClipPath(clipPath(P, H, "mp4", 5), H)).toBe(false); // someone else's folder
    expect(ownsClipPath(`clips/${P}/not-a-homework/5.mp4`, P)).toBe(false);
    expect(ownsClipPath(`clips/${P}/${H}/5.exe`, P)).toBe(false);
    expect(ownsClipPath(`film/${P}/${H}/5.mp4`, P)).toBe(false);
    expect(ownsClipPath(`clips/${P}/${H}/../x/5.mp4`, P)).toBe(false);
  });
  it("picks a safe extension", () => {
    expect(clipExtension("IMG_0001.MOV")).toBe("mov");
    expect(clipExtension("blob", "video/quicktime")).toBe("mov");
    expect(clipExtension("clip.avi")).toBe("mp4");
  });
});
