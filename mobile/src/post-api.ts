import * as ImageManipulator from "expo-image-manipulator";
import { POST_JPEG_QUALITY, POST_MAX_BYTES, POST_MAX_EDGE, POST_REFUSED_PHOTO, fitWithin } from "@shared/tracker";
import { base64ToBytes, fileForm } from "@shared/upload-body";
import { ApiError } from "./api/client";
import { sendPost } from "./api/free";
import { FIXTURES } from "./config";

// A training post, made ready on the phone the way the website makes it:
// the photo shrunk so its longest side is POST_MAX_EDGE and saved as a
// JPEG, then sent as plain bytes with how long, training or gym, and the
// one-line note (lib/elite/upload-body.ts says why it is never a FormData
// or a fetch of the file). The server checks all of it again: a whole JPEG
// of a real size, where and when it was taken removed, the length, gym by
// grade, the word filter on the note, the 8 hours a day.
const SHRINK: { edge: number; compress: number }[] = [
  { edge: POST_MAX_EDGE, compress: POST_JPEG_QUALITY },
  { edge: 1080, compress: 0.7 },
  { edge: 800, compress: 0.6 },
];

export type PickedPhoto = { uri: string; width: number; height: number };

// `session` ("<week>-<n>"): a member posting a session they just finished.
// The photo goes onto that session's own entry; its time is already on the
// week, written by the server from the session itself, so no length is
// ever sent from the phone. (Training outside a session is timed by the
// clock, src/clock.ts, which sends its own two photos.)
export async function postTraining(input: { photo: PickedPhoto; caption: string; session: string }): Promise<void> {
  const fields: Record<string, string> = { session: input.session, caption: input.caption.trim() };
  let bytes: Uint8Array | null = null;
  // The example build sends nothing anywhere: the picked photo is not read.
  if (FIXTURES) bytes = new Uint8Array(0);
  else {
    for (const step of SHRINK) {
      const size = fitWithin(input.photo.width, input.photo.height, step.edge);
      const out = await ImageManipulator.manipulateAsync(input.photo.uri, [{ resize: size }], {
        compress: step.compress,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      });
      if (!out.base64) throw new ApiError(0, "photo", POST_REFUSED_PHOTO);
      bytes = base64ToBytes(out.base64);
      if (bytes.length <= POST_MAX_BYTES) break;
    }
    if (!bytes || bytes.length === 0 || bytes.length > POST_MAX_BYTES) throw new ApiError(0, "photo", POST_REFUSED_PHOTO);
  }
  const res = await sendPost(fileForm(fields, { field: "photo", fileName: "post.jpg", type: "image/jpeg", bytes }));
  if (!res.ok) throw new ApiError(400, null, res.error ?? "Your post wasn't saved. Try again.");
}
