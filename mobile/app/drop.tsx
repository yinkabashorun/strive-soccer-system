import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMe, useWeek } from "@/api/queries";
import { markWeekSeen } from "@/prefs";
import { feel } from "@/feel";
import { dropStartLabel } from "@shared/session-flow";
import { Body, Button, Eyebrow, Head, Press, Label } from "@/ui";
import { color, radius } from "@/theme";

// The drop (experience.md, moment 4): "Your week is here." and the week's
// sessions landing one after another. Once per new week, the first time it
// is opened and before anything in it is done; then Home.
export default function Drop() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const w = useWeek().data;
  const pid = me.data?.player?.id;

  useEffect(() => {
    if (pid && w) void markWeekSeen(pid, w.week);
    const id = setTimeout(() => feel("drill"), 600);
    return () => clearTimeout(id);
  }, [pid, w]);

  const plan = w?.sessions.filter((s) => !s.extra) ?? [];
  // the one button starts the week: its first session, one tap from here
  const first = plan[0] ?? null;
  return (
    <View style={[styles.fill, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24 }]}>
      <Animated.View entering={FadeIn.duration(400)}>
        <Eyebrow>{w ? `Week ${w.week}${w.range ? ` · ${w.range}` : ""}` : ""}</Eyebrow>
        <Head size={44} style={{ marginTop: 10 }}>
          Your week is here.
        </Head>
        {w ? (
          <Body dim style={{ marginTop: 10 }}>
            {w.dropLine}
          </Body>
        ) : null}
        {w?.lastWeekLine ? (
          <Body size={13.5} style={{ marginTop: 8, color: color.gold }}>
            {w.lastWeekLine}
          </Body>
        ) : null}
      </Animated.View>
      <View style={{ marginTop: 24, gap: 10, flex: 1 }}>
        {plan.map((s, i) => (
          <Animated.View key={s.n} entering={FadeInDown.delay(500 + i * 160).duration(380)} style={styles.card}>
            {s.image ? <Image source={{ uri: s.image }} style={[StyleSheet.absoluteFill, { opacity: 0.55 }]} contentFit="cover" /> : null}
            <View style={{ padding: 16 }}>
              <Head size={24}>{`Session ${i + 1}`}</Head>
              <Body size={13} style={{ color: "rgba(244,241,234,0.8)", marginTop: 4 }}>
                {`${i === 0 ? "Today · " : ""}${s.total} drills · ${s.minutesTotal} min`}
              </Body>
            </View>
          </Animated.View>
        ))}
      </View>
      <Animated.View entering={FadeIn.delay(500 + plan.length * 160).duration(300)}>
        <Button label={dropStartLabel(first)} onPress={() => (first ? router.replace(`/session/${first.n}`) : router.back())} />
        {first ? (
          <Press onPress={() => router.back()} accessibilityLabel="Not now" style={styles.later}>
            <Label size={14} dim>
              Not now
            </Label>
          </Press>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.black, paddingHorizontal: 20 },
  later: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 4 },
  card: { height: 92, borderRadius: radius.tile, overflow: "hidden", backgroundColor: "#060606", justifyContent: "center" },
});
