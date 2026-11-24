import { appRoute } from "@/lib/elite/app-api";
import { courseListPayload } from "@/lib/elite/app-courses";
import { APP_URL } from "@/lib/elite/app-url";
import { getCourses } from "@/lib/elite/data";

// The Courses shelf (lib/elite/app-courses.ts): the courses a member sees
// on the website's Courses tab, in the same order. A member gets them
// open. Any other signed-in account (a free account) gets the same shelf
// with every course locked: its name, its line and its picture, never a
// step; a single course is a member route and refuses them.
export const dynamic = "force-dynamic";

export const GET = appRoute({ name: "courses", access: "account" }, async ({ state }) =>
  courseListPayload(await getCourses(), { member: state.kind === "ok", base: APP_URL })
);
