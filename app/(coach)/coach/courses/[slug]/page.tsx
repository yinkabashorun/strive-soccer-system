import { notFound } from "next/navigation";
import { getCourse } from "@/lib/elite/data";
import { stepIsUsable } from "@/lib/elite/courses";
import { CourseView } from "@/components/elite/CourseLibrary";

// One course from the coach shell: rendered exactly as a member sees it,
// but an off course or one with nothing usable still opens (with the
// notice) so the coach can read it before switching it on.
export default async function CoachCoursePage({ params }: { params: { slug: string } }) {
  const course = await getCourse(params.slug);
  if (!course) notFound();
  const steps = course.steps.filter(stepIsUsable);
  return <CourseView course={{ ...course, steps }} basePath="/coach/courses" staff />;
}
