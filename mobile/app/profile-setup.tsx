import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { SetupStep } from "@shared/account-profile";
import { keys, useMe } from "@/api/queries";
import { queryClient } from "@/api/queryClient";
import { signOutEverywhere } from "@/account";
import { PhotoStep, UsernameStep } from "@/ProfileSteps";
import { FormScreen } from "@/FormScreen";
import { Body, Eyebrow, Icon, Label, Press } from "@/ui";
import { color } from "@/theme";

// The profile photo and @username (081), the ONE screen that asks for them
// (lib/elite/account-profile.ts profileSetupDue is the one rule that says
// who owes them; src/navigation.ts says when):
//   a new member        before the door, so the member card on it carries
//                       their photo
//   a free account      after its quiz and before the offer, which shows
//                       their card
//   a member from       once, before the app (no skip, like the website's
//   before 081          one-time screen)
// Settings and Sign out stay reachable. From Settings it changes either
// one (?edit=username or ?edit=photo, with Back).
export default function ProfileSetup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const me = useMe().data;
  const setup = me?.profileSetup;
  // who sees the photo, in the website's words for each kind of account
  const seenBy = me?.state.kind === "free" ? "your friends and the coaches" : "your coaches";
  const editing: SetupStep | null = edit === "username" || edit === "photo" ? edit : null;
  // The screens owed, fixed when this opens.
  const [steps] = useState<SetupStep[]>(() => (editing ? [editing] : setup?.steps ?? []));
  const [at, setAt] = useState(0);
  const step = steps[at];

  async function done() {
    if (at < steps.length - 1) return setAt(at + 1);
    await queryClient.invalidateQueries({ queryKey: keys.me });
    if (editing) router.back();
  }

  return (
    <FormScreen contentStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 24, paddingBottom: insets.bottom + 40 }}>
        {editing ? (
          <Press onPress={() => router.back()} style={{ width: 44, height: 44, justifyContent: "center" }} accessibilityLabel="Back">
            <Icon name="back" />
          </Press>
        ) : (
          <View style={{ height: 44 }} />
        )}
        {step ? (
          <Animated.View key={step} entering={FadeInDown.duration(320)} style={{ marginTop: 18 }}>
            <Eyebrow>{editing ? "Your profile" : `Your profile · ${at + 1} of ${steps.length}`}</Eyebrow>
            <View style={{ marginTop: 10 }}>
              {step === "username" ? (
                <UsernameStep ideas={setup?.ideas ?? []} initial={setup?.username} onDone={() => void done()} />
              ) : (
                <PhotoStep seenBy={seenBy} onDone={() => void done()} />
              )}
            </View>
          </Animated.View>
        ) : (
          <Body dim style={{ marginTop: 40 }}>
            Your profile is all set.
          </Body>
        )}
        {!editing ? (
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 18, marginTop: 24 }}>
            <Press onPress={() => router.push("/settings")} style={{ minHeight: 44, justifyContent: "center" }}>
              <Label dim size={14}>Settings</Label>
            </Press>
            <Press onPress={() => void signOutEverywhere()} style={{ minHeight: 44, justifyContent: "center" }}>
              <Label dim size={14}>Sign out</Label>
            </Press>
          </View>
        ) : null}
    </FormScreen>
  );
}
