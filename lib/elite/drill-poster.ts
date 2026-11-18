// The still picture for a drill clip (App Store punch list, A6). A drill
// shows its picture at once, instead of a black box while the video
// loads. One rule, pure:
//
//   a clip served from our own domain at /drills/<name>.mp4
//   has its poster at                    /drills/posters/<name>.jpg
//
// The posters are made by scripts/make-drill-posters.sh and a test fails
// when a clip in public/drills has none. A clip on any other host has no
// poster and gets none: the video simply loads as it always did.

const OWN_HOSTS = new Set(["thestriveapp.com", "www.thestriveapp.com"]);
const CLIP_PATH = /^\/drills\/([a-z0-9][a-z0-9-]*)\.mp4$/;

export function drillPoster(src: string | null | undefined): string | null {
  if (typeof src !== "string") return null;
  // A clip address may carry a time fragment (#t=0.5) or a query.
  const bare = src.trim().split("#")[0].split("?")[0];
  let path: string;
  if (bare.startsWith("/") && !bare.startsWith("//")) {
    path = bare;
  } else {
    try {
      const u = new URL(bare);
      if (u.protocol !== "https:" || !OWN_HOSTS.has(u.hostname)) return null;
      path = u.pathname;
    } catch {
      return null;
    }
  }
  const name = path.match(CLIP_PATH)?.[1];
  // Always a path on the site the page is on, so it works the same on the
  // website, in the App Store app and on a local build.
  return name ? `/drills/posters/${name}.jpg` : null;
}

// In the session player the next drill's clip is fetched ahead, so moving
// on does not start from nothing. A member who switched off "play drill
// demos automatically" has asked the app not to pull video on its own, so
// for them only the next still is fetched.
export function preloadNextClip(input: { autoplay: boolean; nextSrc: string | null | undefined }): boolean {
  return input.autoplay && typeof input.nextSrc === "string" && input.nextSrc.length > 0;
}
