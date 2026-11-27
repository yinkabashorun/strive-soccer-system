import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { emptyAnswers } from "@shared/quiz";
import { useMe, useSubmitQuiz } from "@/api/queries";
import { ApiError } from "@/api/client";
import { CodeDoor } from "@/CodeDoor";
import { doorDue } from "@/door";
import { MemberCard } from "@/MemberCard";
import { loadPrefs, prefsNow, usePrefs } from "@/prefs";
import { quizStepIds } from "@/quiz-steps";
import { useMyPhoto } from "@/usePhoto";
import { Body, Button, Head, Icon, Press } from "@/ui";
import { color } from "@/theme";

// The door (experience.md, moment 1): the Strive mark, a gold line draws,
// "You're in.", then the member card rises with a light across it. One
// tap: Build my week. The card carries the member's own photo and
// @username: both are picked before the door (app/profile-setup.tsx), so
// there is always a photo to show here.
//
// A FREE account opens on the same spot with its own first screens:
//   1. "Have a code from a teammate or a club?" (src/CodeDoor.tsx,
//      lib/elite/free-door.ts), once, for a NEW account only. A real code
//      goes straight to the free app; the quiz waits behind the one card
//      on Week.
//   2. what the quiz is for, and one tap to start it. This is also where
//      that card on Week opens, later, for a player who came in by a code.
// Nothing here says it is in anything yet.
export default function Door() {
  const me = useMe();
  return me.data?.state.kind === "free" ? <FreeDoor /> : <MemberDoor />;
}

function FreeDoor() {
  const me = useMe();
  const [prefs, setPref] = usePrefs();
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    void loadPrefs().then(() => setLoaded(true));
  }, []);
  // black for the moment the phone's own note is read, so the code screen
  // never flashes at someone who already went past it
  if (!loaded || !me.data) return <View style={styles.fill} />;
  const email = me.data.viewer.email;
  const stage = me.data.state.kind === "free" ? me.data.state.stage : null;
  if (doorDue({ stage, email, passed: prefs.doorPassed || prefsNow().doorPassed })) {
    return <CodeDoor onNoCode={() => setPref("doorPassed", email)} />;
  }
  return <FreeStart firstName={me.data.viewer.firstName} />;
}

function MemberDoor() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const me = useMe();
  const photo = useMyPhoto();
  const submit = useSubmitQuiz();
  const [error, setError] = useState<string | null>(null);
  const card = me.data?.player?.card;
  const line = useSharedValue(0);
  useEffect(() => {
    line.value = withDelay(reduce ? 0 : 400, withTiming(1, { duration: reduce ? 200 : 600 }));
  }, [line, reduce]);
  const lineStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: line.value }] }));

  // The quiz, from its first screen. A member whose account answered every
  // screen while it was free has none left: their week is built at once.
  async function build() {
    const first = quizStepIds(me.data)[0];
    if (first) return router.push(`/onboarding/${first}`);
    setError(null);
    try {
      await submit.mutateAsync(emptyAnswers());
      router.replace("/onboarding/building");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't save. Check your connection and try again.");
    }
  }

  return (
    <View style={[styles.fill, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 28 }]}>
      <Animated.View entering={FadeIn.duration(500)}>
        <Image source={require("../../assets/splash.png")} style={styles.mark} contentFit="contain" />
      </Animated.View>
      <Animated.View style={[styles.line, lineStyle]} />
      <Animated.View entering={FadeInDown.delay(650).duration(450)} style={{ alignItems: "center" }}>
        <Head size={44} style={{ marginTop: 24 }}>
          You're in.
        </Head>
        <Body dim style={{ marginTop: 10 }}>
          Welcome to Strive Elite, {me.data?.viewer.firstName ?? ""}.
        </Body>
      </Animated.View>
      <View style={{ alignSelf: "stretch", marginTop: 40 }}>
        {card ? (
          <MemberCard name={card.name} since={card.since} tier={card.tier} photo={photo} username={me.data?.profileSetup?.username} rise />
        ) : null}
      </View>
      <View style={{ flex: 1 }} />
      {error ? (
        <Body size={14} style={{ color: color.danger, marginBottom: 12, alignSelf: "stretch" }}>
          {error}
        </Body>
      ) : null}
      <Animated.View entering={FadeInDown.delay(reduce ? 0 : 1500).duration(400)} style={{ alignSelf: "stretch" }}>
        <Button label="Build my week" busy={submit.isPending} onPress={() => void build()} />
      </Animated.View>
    </View>
  );
}

function FreeStart({ firstName }: { firstName: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const first = quizStepIds(me.data)[0];
  // Opened from the one card on Week by a player who came in by a code:
  // the free app is behind this screen, so there is a way back to it.
  const fromWeek = me.data?.state.kind === "free" && me.data.state.stage === "ready";
  return (
    <View style={[styles.fill, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 28 }]}>
      {fromWeek ? (
        <Press onPress={() => router.back()} style={[styles.close, { top: insets.top + 8 }]} accessibilityLabel="Close">
          <Icon name="close" />
        </Press>
      ) : null}
      <Animated.View entering={FadeIn.duration(500)}>
        <Image source={require("../../assets/splash.png")} style={styles.mark} contentFit="contain" />
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(300).duration(450)} style={{ alignSelf: "stretch", marginTop: 40 }}>
        <Head size={40}>{firstName ? `${firstName}, tell us about your game.` : "Tell us about your game."}</Head>
        <Body dim style={{ marginTop: 14 }}>
          A few taps about how you play and where you train. Rate yourself honestly. Then we show you what your first week would go after.
        </Body>
      </Animated.View>
      <View style={{ flex: 1 }} />
      <Animated.View entering={FadeInDown.delay(700).duration(400)} style={{ alignSelf: "stretch" }}>
        <Button label="Start" onPress={() => router.push(`/onboarding/${first}`)} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.black, alignItems: "center", paddingHorizontal: 24 },
  mark: { width: 96, height: 96 },
  line: { width: 64, height: 1.5, backgroundColor: color.gold, marginTop: 20 },
  close: { position: "absolute", left: 16, width: 44, height: 44, justifyContent: "center", zIndex: 2 },
});
