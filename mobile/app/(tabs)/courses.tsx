import { View } from "react-native";
import { keys } from "@/api/queries";
import { queryClient } from "@/api/queryClient";
import { CoursesList } from "@/CoursesList";
import { PAGE_TOP, Screen } from "@/Screen";
import { Body, Head } from "@/ui";

// Courses (approved mock v4, screen 6): the library every member has on
// top of their week. The shelf itself is src/CoursesList.tsx; a course
// opens at app/course/[slug].tsx.
export default function Courses() {
  return (
    <Screen onRefresh={() => queryClient.invalidateQueries({ queryKey: keys.courses })}>
      <View style={{ paddingHorizontal: 20, paddingTop: PAGE_TOP }}>
        <Head size={40}>Courses</Head>
        <Body dim size={13.5} style={{ marginTop: 6 }}>
          On top of your week. Open one, watch the step, go do it.
        </Body>
      </View>
      <CoursesList />
    </Screen>
  );
}
