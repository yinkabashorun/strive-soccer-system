import { View } from "react-native";
import { keys } from "@/api/queries";
import { queryClient } from "@/api/queryClient";
import { CoursesList } from "@/CoursesList";
import { PAGE_TOP, Screen } from "@/Screen";
import { Head } from "@/ui";

// Courses in the free app: the same shelf the members' tab shows
// (src/CoursesList.tsx), which the server sends a free account with every
// course locked. Locked is a state: the lock on each card says it, and
// there is no other word about it here.
export default function FreeCourses() {
  return (
    <Screen onRefresh={() => queryClient.invalidateQueries({ queryKey: keys.courses })}>
      <View style={{ paddingHorizontal: 20, paddingTop: PAGE_TOP }}>
        <Head size={40}>Courses</Head>
      </View>
      <CoursesList />
    </Screen>
  );
}
