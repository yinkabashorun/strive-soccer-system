import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { QUIZ_STEPS } from "@shared/quiz";
import { useMe } from "@/api/queries";
import { MemberCard } from "@/MemberCard";
import { Body, Button, Head } from "@/ui";
import { color } from "@/theme";

// The door (experience.md, moment 1): the Strive mark, a gold line draws,
// "You're in.", then the member card rises with a light across it. One
// tap: Build my week.
export default function Door() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const me = useMe();
  const card = me.data?.player?.card;
  const line = useSharedValue(0);
  useEffect(() => {
    line.value = withDelay(reduce ? 0 : 400, withTiming(1, { duration: reduce ? 200 : 600 }));
  }, [line, reduce]);
  const lineStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: line.value }] }));

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
        {card ? <MemberCard name={card.name} since={card.since} tier={card.tier} rise /> : null}
      </View>
      <View style={{ flex: 1 }} />
      <Animated.View entering={FadeInDown.delay(reduce ? 0 : 1500).duration(400)} style={{ alignSelf: "stretch" }}>
        <Button label="Build my week" onPress={() => router.push(`/onboarding/${QUIZ_STEPS[0].id}`)} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.black, alignItems: "center", paddingHorizontal: 24 },
  mark: { width: 96, height: 96 },
  line: { width: 64, height: 1.5, backgroundColor: color.gold, marginTop: 20 },
});
