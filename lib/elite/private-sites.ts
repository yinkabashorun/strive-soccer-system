// Private course sites (Nov 5 2026): a course that is a small static site
// (the Dribbling Transformation pages) served by the app behind the login,
// so the address alone is never enough to read it. The files live in
// content/courses/<slug>/ and are served by app/learn/[slug]/[[...path]].
// Pure rules here; the route does the I/O and the session check.
//
// A request names one file. Only a plain .html name (letters, digits,
// underscore, dash) that exists in that site's folder is ever served, so
// no path segment, dot-dot, encoded slash or other file type can reach the
// disk. Relative links inside the pages (slide_02_philosophy.html) resolve
// beside the page that holds them, which is why the entry address is the
// explicit .../index.html and never a bare folder.

export const PRIVATE_SITES: Record<string, { dir: string; entry: string }> = {
  "dribbling-transformation": { dir: "content/courses/dribbling-transformation", entry: "index.html" },
};

const FILE = /^[A-Za-z0-9_-]{1,80}\.html$/;

export type SiteTarget =
  | { kind: "file"; dir: string; file: string }
  | { kind: "redirect-entry"; to: string }
  | { kind: "none" };

// slug and path segments come straight from the URL.
export function resolveSiteRequest(slug: string, segments: string[] | undefined): SiteTarget {
  const site = Object.prototype.hasOwnProperty.call(PRIVATE_SITES, slug) ? PRIVATE_SITES[slug] : null;
  if (!site) return { kind: "none" };
  const parts = segments ?? [];
  if (parts.length === 0) return { kind: "redirect-entry", to: `/learn/${slug}/${site.entry}` };
  if (parts.length !== 1) return { kind: "none" };
  const file = parts[0];
  if (!FILE.test(file)) return { kind: "none" };
  return { kind: "file", dir: site.dir, file };
}
