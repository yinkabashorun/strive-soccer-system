import { notFound } from "next/navigation";
import { getViewer } from "@/lib/elite/session";
import { getCourse } from "@/lib/elite/data";
import { courseForApp, externalHref, stepIsUsable } from "@/lib/elite/courses";
import { inNativeApp } from "@/lib/elite/native-request";
import { CourseView, LinkCourseGate } from "@/components/elite/CourseLibrary";

// One course (041) as a member sees it: active only, usable steps only.
// The rendering is shared with the coach shell (CourseLibrary).
export default async function CoursePage({ params }: { params: { slug: string } }) {
  const viewer = await getViewer();
  if (!viewer?.playerId) return null;
  const found = await getCourse(params.slug);
  if (!found || !found.active) notFound();
  // Inside the App Store app a link course shows its own in-app pages
  // instead of sending the member to another website (courseForApp).
  const course = courseForApp(found, inNativeApp());
  if (!course) notFound();
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
