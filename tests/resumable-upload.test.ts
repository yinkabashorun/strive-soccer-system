import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CHUNK_BYTES,
  nextChunk,
  percentSent,
  readOffset,
  resumableEndpoint,
  resumableUpload,
  uploadMetadata,
} from "@/lib/elite/resumable-upload";
import { cameraHint } from "@/lib/elite/clips";

// Clips that survive a weak signal (punch list A26): 6 MB pieces, a
// dropped piece picks up from what the server has, the percent shows, the
// screen stays on.

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("the plan", () => {
  it("speaks the storage service's resumable protocol", () => {
    expect(resumableEndpoint("https://x.supabase.co/")).toBe("https://x.supabase.co/storage/v1/upload/resumable");
    const meta = uploadMetadata({ bucket: "elite-film", path: "filmroom/a/b/1.mp4", contentType: "video/mp4" });
    expect(meta).toContain(`bucketName ${Buffer.from("elite-film").toString("base64")}`);
    expect(meta).toContain(`objectName ${Buffer.from("filmroom/a/b/1.mp4").toString("base64")}`);
    expect(CHUNK_BYTES).toBe(6 * 1024 * 1024);
  });

  it("cuts the file into pieces and knows when it is done", () => {
    const size = CHUNK_BYTES * 2 + 10;
    expect(nextChunk(0, size)).toEqual({ start: 0, end: CHUNK_BYTES });
    expect(nextChunk(CHUNK_BYTES * 2, size)).toEqual({ start: CHUNK_BYTES * 2, end: size });
    expect(nextChunk(size, size)).toBeNull();
    expect(readOffset("12", 20)).toBe(12);
    expect(readOffset("30", 20)).toBeNull();
    expect(readOffset("x", 20)).toBeNull();
    expect(percentSent(1, 3)).toBe(33);
    expect(percentSent(9, 0)).toBe(0);
  });
});

// A pretend storage server: it takes pieces, and drops the connection on
// the second piece the first time.
function fakeServer(size: number) {
  let stored = 0;
  let dropped = false;
  const patches: number[] = [];
  const fetchMock = vi.fn(async (_url: string, init: { method: string; headers: Record<string, string> }) => {
    if (init.method === "POST") {
      expect(init.headers["Upload-Length"]).toBe(String(size));
      expect(init.headers.authorization).toBe("Bearer token");
      return new Response(null, { status: 201, headers: { Location: "/storage/v1/upload/resumable/abc" } });
    }
    return new Response(null, { status: 200, headers: { "Upload-Offset": String(stored) } });
  });
  class FakeXHR {
    upload: { onprogress: ((e: { loaded: number }) => void) | null } = { onprogress: null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    ontimeout: (() => void) | null = null;
    status = 0;
    private headers: Record<string, string> = {};
    open() {}
    setRequestHeader(k: string, v: string) {
      this.headers[k] = v;
    }
    getResponseHeader(k: string) {
      return k === "Upload-Offset" ? String(stored) : null;
    }
    send(body: Blob) {
      const offset = Number(this.headers["Upload-Offset"]);
      patches.push(offset);
      setTimeout(() => {
        if (offset === CHUNK_BYTES && !dropped) {
          dropped = true;
          stored = offset + 1000; // part of the piece arrived before the drop
          this.onerror?.();
          return;
        }
        this.upload.onprogress?.({ loaded: body.size });
        stored = offset + body.size;
        this.status = 204;
        this.onload?.();
      }, 0);
    }
  }
  return { fetchMock, FakeXHR, patches, stored: () => stored };
}

describe("a dropped connection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("asks the server how much arrived and carries on from there", async () => {
    vi.useFakeTimers();
    const size = CHUNK_BYTES * 2 + 5;
    const server = fakeServer(size);
    vi.stubGlobal("fetch", server.fetchMock);
    vi.stubGlobal("XMLHttpRequest", server.FakeXHR);
    const seen: number[] = [];
    const run = resumableUpload({
      auth: { supabaseUrl: "https://x.supabase.co", anonKey: "anon", accessToken: "token" },
      bucket: "elite-film",
      path: "filmroom/p/r/1.mp4",
      file: new Blob([new Uint8Array(size)]),
      contentType: "video/mp4",
      onProgress: (p) => seen.push(p),
    });
    await vi.runAllTimersAsync();
    expect(await run).toBe(true);
    expect(server.stored()).toBe(size);
    // piece 1, piece 2 (dropped), then on from exactly what the server had, to the end
    expect(server.patches).toEqual([0, CHUNK_BYTES, CHUNK_BYTES + 1000]);
    expect(seen[seen.length - 1]).toBe(100);
  });
});

describe("the buttons", () => {
  it("show the percent and keep the phone awake while a clip goes up", () => {
    const upload = read("lib/elite/clip-upload.ts");
    expect(upload).toContain("const letSleep = keepAwake();");
    expect(upload).toContain("resumableUpload({");
    expect(upload).toMatch(/finally \{\s*letSleep\(\);\s*letRefresh\(\);/);
    for (const f of ["SendClip", "ProgressVideoCard", "FilmRoomCard"]) {
      const src = read(`components/elite/${f}.tsx`);
      expect(src, f).toMatch(/uploadClip\([^)]*, (setPercent|\(p\) => setBusy)/);
      expect(src, f).toContain("useCameraHint(fileRef)");
      expect(src, f).not.toContain("Sending…");
    }
  });

  it("say where to turn the camera back on, the way the phone names it", () => {
    expect(cameraHint(true)).toContain("Settings, then Strive Elite, then Camera");
    expect(cameraHint(false)).toContain("browser's settings");
    for (const line of [cameraHint(true), cameraHint(false)]) expect(line).not.toMatch(/—/);
  });
});
