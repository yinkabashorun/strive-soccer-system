import { getCourses } from "@/lib/elite/data";
import { coursesForApp, libraryCourses } from "@/lib/elite/courses";
import { inNativeApp } from "@/lib/elite/native-request";
import { CourseList } from "@/components/elite/CourseLibrary";

export const metadata = { title: "Courses · Strive Elite" };

// The Courses library from the coach shell (Oct 29 2026, Coach Yinka:
// "make it so we can see courses"). Coaches and the admin never enter
// the player shell, so this is the same CourseList members get, with
// every course listed (an off or empty one carries a notice) and a link
// to the editor in the drill bank.
export default async function CoachCoursesPage() {
  // Inside the App Store app the coach sees a link course the way a member
  // does there: its in-app pages, never another website.
  const courses = libraryCourses(
    coursesForApp(await getCourses({ includeInactive: true }), inNativeApp()),
    { staff: true }
  );
  return <CourseList courses={courses} basePath="/coach/courses" staff />;
}
