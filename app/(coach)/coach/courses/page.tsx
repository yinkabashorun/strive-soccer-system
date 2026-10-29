import { getCourses } from "@/lib/elite/data";
import { libraryCourses } from "@/lib/elite/courses";
import { CourseList } from "@/components/elite/CourseLibrary";

export const metadata = { title: "Courses · Strive Elite" };

// The Courses library from the coach shell (Oct 29 2026, Coach Yinka:
// "make it so we can see courses"). Coaches and the admin never enter
// the player shell, so this is the same CourseList members get, with
// every course listed (an off or empty one carries a notice) and a link
// to the editor in the drill bank.
export default async function CoachCoursesPage() {
  const courses = libraryCourses(await getCourses({ includeInactive: true }), { staff: true });
  return <CourseList courses={courses} basePath="/coach/courses" staff />;
}
