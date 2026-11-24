import { appJson, appRoute } from "@/lib/elite/app-api";
import { coursePayload, isCourseSlug } from "@/lib/elite/app-courses";
import { APP_URL } from "@/lib/elite/app-url";
import { getCourse } from "@/lib/elite/data";

// One course with its levels and steps, as a member sees it on the
// website (lib/elite/app-courses.ts coursePayload): active only, usable
// steps only, a link course as its own pages. Members only: the member
// gate answers anyone else with 403 before a course is read.
export const dynamic = "force-dynamic";

const NOT_FOUND = { error: "not_found" } as const;

export function GET(req: Request, ctx?: { params?: { slug?: string } }): Promise<Response> {
  const slug = ctx?.params?.slug;
  return appRoute({ name: "course", access: "member" }, async () => {
    if (!isCourseSlug(slug)) return appJson(NOT_FOUND, 404);
    const course = coursePayload(await getCourse(slug), APP_URL);
    return course ? { course } : appJson(NOT_FOUND, 404);
  })(req);
}
