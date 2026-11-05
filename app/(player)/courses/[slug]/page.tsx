import { notFound } from "next/navigation";
import { getViewer } from "@/lib/elite/session";
import { getCourse } from "@/lib/elite/data";
import { externalHref, stepIsUsable } from "@/lib/elite/courses";
import { CourseView, LinkCourseGate } from "@/components/elite/CourseLibrary";

// One course (041) as a member sees it: active only, usable steps only.
// The rendering is shared with the coach shell (CourseLibrary).
export default async function CoursePage({ params }: { params: { slug: string } }) {
  const viewer = await getViewer();
  if (!viewer?.playerId) return null;
  const course = await getCourse(params.slug);
  if (!course || !course.active) notFound();
  // A link course shows its gate (the password, then the button to its
  // site) before they leave the app (058).
  if (course.kind === "link") {
    if (!externalHref(course)) notFound();
    return <LinkCourseGate course={course} basePath="/courses" />;
  }
  const steps = course.steps.filter(stepIsUsable);
  if (steps.length === 0) notFound();
  return <CourseView course={{ ...course, steps }} basePath="/courses" />;
}
