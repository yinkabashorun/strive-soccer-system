// Clips that survive a weak signal (punch list A26).
//
// A Film Room clip can be 150 MB, sent from a car park on one bar of
// signal. One plain upload that drops at 90% starts again from nothing.
// This sends the file in 6 MB pieces with the storage service's resumable
// upload (the open TUS protocol Supabase Storage speaks): when a piece
// fails, it asks the server how much arrived and carries on from there, a
// few times, before saying anything to the player. Storage rules are the
// same as for a plain upload: the request carries the player's own sign-in,
// so the private bucket's policies decide what may be written (036/037/062).
//
// The pure parts (the plan, the headers) are tested in
// tests/resumable-upload.test.ts; the browser part is below them.

// Supabase Storage takes resumable pieces of exactly this size (the last
// one may be smaller).
export const CHUNK_BYTES = 6 * 1024 * 1024;

// How long to wait before each new try of a piece that failed.
export const RETRY_DELAYS_MS = [1000, 3000, 8000, 15000];

export function resumableEndpoint(supabaseUrl: string): string {
  return supabaseUrl.replace(/\/+$/, "") + "/storage/v1/upload/resumable";
}

function b64(value: string): string {
  // ASCII paths and types only (our paths are ids and a short extension)
  if (typeof btoa === "function") return btoa(value);
  return Buffer.from(value, "utf8").toString("base64");
}

// The Upload-Metadata header: comma-separated "key base64(value)".
export function uploadMetadata(input: { bucket: string; path: string; contentType: string }): string {
  return [
    `bucketName ${b64(input.bucket)}`,
    `objectName ${b64(input.path)}`,
    `contentType ${b64(input.contentType)}`,
    `cacheControl ${b64("3600")}`,
  ].join(",");
}

// The next piece to send from this offset.
export function nextChunk(offset: number, size: number): { start: number; end: number } | null {
  if (!Number.isFinite(offset) || offset < 0 || offset >= size) return null;
  return { start: offset, end: Math.min(offset + CHUNK_BYTES, size) };
}

// The Upload-Offset a server answered with, or null when it is not one.
export function readOffset(value: string | null | undefined, size: number): number | null {
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return null;
  const n = Number(value.trim());
  return n >= 0 && n <= size ? n : null;
}

// How much of the file has gone up, as a whole percent for the button.
export function percentSent(sent: number, size: number): number {
  if (size <= 0) return 0;
  return Math.max(0, Math.min(100, Math.floor((sent / size) * 100)));
}

// ---- the browser part -------------------------------------------------

type Auth = { supabaseUrl: string; anonKey: string; accessToken: string };

function headers(auth: Auth, extra: Record<string, string>): Record<string, string> {
  return {
    "Tus-Resumable": "1.0.0",
    authorization: `Bearer ${auth.accessToken}`,
    apikey: auth.anonKey,
    ...extra,
  };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function sendPiece(
  url: string,
  auth: Auth,
  body: Blob,
  offset: number,
  onSent: (bytes: number) => void
): Promise<number | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PATCH", url);
    const h = headers(auth, { "Upload-Offset": String(offset), "Content-Type": "application/offset+octet-stream" });
    for (const [k, v] of Object.entries(h)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => onSent(e.loaded);
    xhr.onload = () => {
      if (xhr.status === 204 || xhr.status === 200) resolve(Number(xhr.getResponseHeader("Upload-Offset")));
      else resolve(null);
    };
    xhr.onerror = () => resolve(null);
    xhr.ontimeout = () => resolve(null);
    xhr.send(body);
  });
}

async function serverOffset(url: string, auth: Auth, size: number): Promise<number | null> {
  try {
    const res = await fetch(url, { method: "HEAD", headers: headers(auth, {}) });
    if (!res.ok) return null;
    return readOffset(res.headers.get("Upload-Offset"), size);
  } catch {
    return null;
  }
}

// Send one file. Resolves true when the whole file is stored.
export async function resumableUpload(input: {
  auth: Auth;
  bucket: string;
  path: string;
  file: Blob;
  contentType: string;
  onProgress?: (percent: number) => void;
}): Promise<boolean> {
  const { auth, file } = input;
  const size = file.size;
  let created: Response;
  try {
    created = await fetch(resumableEndpoint(auth.supabaseUrl), {
      method: "POST",
      headers: headers(auth, {
        "Upload-Length": String(size),
        "Upload-Metadata": uploadMetadata({ bucket: input.bucket, path: input.path, contentType: input.contentType }),
        "x-upsert": "false",
      }),
    });
  } catch {
    return false;
  }
  const location = created.headers.get("Location");
  if (created.status !== 201 || !location) return false;
  const url = new URL(location, auth.supabaseUrl).toString();

  let offset = 0;
  let tries = 0;
  input.onProgress?.(0);
  for (;;) {
    const piece = nextChunk(offset, size);
    if (!piece) return offset === size;
    const at = await sendPiece(url, auth, file.slice(piece.start, piece.end), piece.start, (bytes) =>
      input.onProgress?.(percentSent(piece.start + bytes, size))
    );
    if (at !== null && Number.isFinite(at) && at > offset) {
      offset = at;
      tries = 0;
      input.onProgress?.(percentSent(offset, size));
      continue;
    }
    // the piece did not land: wait, ask how much did, carry on from there
    if (tries >= RETRY_DELAYS_MS.length) return false;
    await wait(RETRY_DELAYS_MS[tries++]);
    const known = await serverOffset(url, auth, size);
    if (known !== null) offset = known;
  }
}
