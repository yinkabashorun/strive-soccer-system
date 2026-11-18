import { getViewer } from "@/lib/elite/session";
import { getCourses } from "@/lib/elite/data";
import { coursesForApp, libraryCourses } from "@/lib/elite/courses";
import { inNativeApp } from "@/lib/elite/native-request";
import { CourseList } from "@/components/elite/CourseLibrary";

export const metadata = { title: "Courses · Strive Elite" };

// The Courses tab (041): a library every member sees. Nothing is ticked
// or tracked here; the week is where training is counted. The rendering
// is shared with the coach shell's /coach/courses (CourseLibrary).
export default async function CoursesPage() {
  const viewer = await getViewer();
  if (!viewer?.playerId) return null;
  // Inside the App Store app a course never opens another website: a link
  // course shows its own in-app pages there (courseForApp).
  const courses = libraryCourses(coursesForApp(await getCourses(), inNativeApp()), { staff: false });
  return <CourseList courses={courses} basePath="/courses" />;
}
