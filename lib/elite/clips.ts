// Send a clip (offer stack item 5, Oct 13 2026): the one place the clip
// storage path convention lives. The database enforces the same rule
// (migration 036, elite_owns_clip_path): a family can only write to and
// read from clips/<player_id>/..., the coach reads everything.
export const CLIP_BUCKET = "elite-film";
export const MAX_CLIP_MB = 150;
export const CLIP_EXTENSIONS = ["mp4", "mov", "webm", "m4v"] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function clipExtension(fileName: string, mime = ""): string {
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  if ((CLIP_EXTENSIONS as readonly string[]).includes(ext)) return ext;
  if (mime === "video/quicktime") return "mov";
  if (mime === "video/webm") return "webm";
  return "mp4";
}

// clips/<player_id>/<homework_id>/<timestamp>.<ext>   (Send a clip, 036)
export function clipPath(playerId: string, homeworkId: string, ext: string, now = Date.now()): string {
  return `clips/${playerId}/${homeworkId}/${now}.${ext}`;
}

// progress/<player_id>/<week>/<timestamp>.<ext>   (progress video, 037)
export function progressPath(playerId: string, week: number, ext: string, now = Date.now()): string {
  return `progress/${playerId}/${week}/${now}.${ext}`;
}

function wellFormedFile(file: string): boolean {
  const ext = (file.split(".").pop() || "").toLowerCase();
  return /^[0-9]+\.[a-z0-9]+$/.test(file) && (CLIP_EXTENSIONS as readonly string[]).includes(ext);
}

// Is this a well-formed Send-a-clip path inside this player's own folder?
export function ownsClipPath(path: string, playerId: string): boolean {
  const parts = path.split("/");
  if (parts.length !== 4 || parts[0] !== "clips") return false;
  if (!UUID.test(parts[1]) || parts[1].toLowerCase() !== playerId.toLowerCase()) return false;
  if (!UUID.test(parts[2])) return false;
  return wellFormedFile(parts[3]);
}

// Is this a well-formed progress-video path for this player and week?
export function ownsProgressPath(path: string, playerId: string, week: number): boolean {
  const parts = path.split("/");
  if (parts.length !== 4 || parts[0] !== "progress") return false;
  if (!UUID.test(parts[1]) || parts[1].toLowerCase() !== playerId.toLowerCase()) return false;
  if (!/^[1-9][0-9]*$/.test(parts[2]) || Number(parts[2]) !== week) return false;
  return wellFormedFile(parts[3]);
}
