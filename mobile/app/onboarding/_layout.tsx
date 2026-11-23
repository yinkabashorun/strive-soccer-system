import { Stack } from "expo-router";
import { useMe } from "@/api/queries";
import { QuizDraftProvider } from "@/quiz-draft";
import { color } from "@/theme";

// The first minutes of membership: the door, the quiz one question a
// screen (each question its own screen, so swiping back goes to the last
// answer like any iPhone app), then building. Answers are held here.
export default function OnboardingLayout() {
  const me = useMe();
  return (
    <QuizDraftProvider knownParentPhone={me.data?.player?.knownParentPhone ?? ""}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.black }, gestureEnabled: true }}>
        <Stack.Screen name="index" options={{ animation: "fade" }} />
        <Stack.Screen name="[step]" />
        <Stack.Screen name="building" options={{ animation: "fade", gestureEnabled: false }} />
      </Stack>
    </QuizDraftProvider>
  );
}
