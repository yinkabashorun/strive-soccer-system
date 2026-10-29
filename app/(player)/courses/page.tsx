import { getViewer } from "@/lib/elite/session";
import { getCourses } from "@/lib/elite/data";
import { libraryCourses } from "@/lib/elite/courses";
import { CourseList } from "@/components/elite/CourseLibrary";

export const metadata = { title: "Courses · Strive Elite" };

// The Courses tab (041): a library every member sees. Nothing is ticked
// or tracked here; the week is where training is counted. The rendering
// is shared with the coach shell's /coach/courses (CourseLibrary).
export default async function CoursesPage() {
  const viewer = await getViewer();
  if (!viewer?.playerId) return null;
  const courses = libraryCourses(await getCourses(), { staff: false });
  return <CourseList courses={courses} basePath="/courses" />;
}
