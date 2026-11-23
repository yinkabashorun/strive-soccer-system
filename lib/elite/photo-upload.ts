// The profile photo, on the phone: cut to the middle square and shrunk to
// a small JPEG before it leaves, then sent to our own route, which checks
// it again and stores it privately (app/api/elite/profile/photo). One
// helper for every place a photo is added: the onboarding step, the
// one-time screen, You and Account, the free app's settings.
import { AVATAR_EDGE, AVATAR_MAX_BYTES, AVATAR_MESSAGE, squareCrop } from "./tracker";

export const PHOTO_ROUTE = "/api/elite/profile/photo";

export async function squareJpeg(file: File): Promise<Blob | null> {
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

// Crop, shrink and send. Answers with the photo as it will look (a local
// address, shown at once) or the line to show under the circle.
export async function uploadProfilePhoto(file: File): Promise<{ ok: true; preview: string } | { ok: false; error: string }> {
  const blob = await squareJpeg(file);
  if (!blob) return { ok: false, error: AVATAR_MESSAGE };
  const form = new FormData();
  form.append("photo", blob, "avatar.jpg");
  const res = await fetch(PHOTO_ROUTE, { method: "POST", body: form }).catch(() => null);
  if (!res || !res.ok) {
    const body = (await res?.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, error: body?.error ?? AVATAR_MESSAGE };
  }
  return { ok: true, preview: URL.createObjectURL(blob) };
}
