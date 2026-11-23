import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { buildingLines, FIRST_WEEK_LINE, FIRST_WEEK_WAIT_MS, type FirstWeekStatus } from "@shared/experience";
import { buildFirstWeek, keys } from "@/api/queries";
import { queryClient } from "@/api/queryClient";
import { feel } from "@/feel";
import { Body, Button, Disc, Eyebrow, Head, Icon, Label } from "@/ui";
import { color } from "@/theme";

// Building (experience.md, moment 3): three lines tick off. The first two
// are true the moment the answers are saved; the third ticks only when the
// week really is built (the website's own first-week build). A week that is
// not built, or not open yet, is said so plainly. Nothing is faked.
export default function Building() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [ticks, setTicks] = useState(0);
  const [status, setStatus] = useState<FirstWeekStatus | null>(null);
  const p = useLocalSearchParams<{ spot?: string; sessions?: string }>();
  const lines = buildingLines(short(p.spot) ?? "you", short(p.sessions) ?? "your");

  useEffect(() => {
    let alive = true;
    const t1 = setTimeout(() => {
      setTicks((n) => Math.max(n, 1));
      feel("drill");
    }, 650);
    const t2 = setTimeout(() => {
      setTicks((n) => Math.max(n, 2));
      feel("drill");
    }, 1300);
    const started = Date.now();
    const wait = new Promise<{ status: FirstWeekStatus }>((r) => setTimeout(() => r({ status: "waiting" }), FIRST_WEEK_WAIT_MS));
    Promise.race([buildFirstWeek().catch(() => ({ status: "waiting" as FirstWeekStatus })), wait]).then((res) => {
      if (!alive) return;
      setTimeout(() => {
        if (!alive) return;
        void queryClient.invalidateQueries({ queryKey: keys.me });
        if (res.status === "live") {
          setTicks(3);
          feel("session");
          setTimeout(() => {
            if (!alive) return;
            void queryClient.invalidateQueries({ queryKey: keys.week });
            router.replace("/");
          }, 700);
        } else setStatus(res.status);
      }, Math.max(0, 1500 - (Date.now() - started)));
    });
    return () => {
      alive = false;
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [router]);

  const said = status && status !== "live" ? FIRST_WEEK_LINE[status] : null;
  return (
    <View style={[styles.fill, { paddingTop: insets.top + 150, paddingBottom: insets.bottom + 24 }]}>
      <Animated.View entering={FadeInDown.duration(350)}>
        <Eyebrow>Week 1</Eyebrow>
        <Head size={34} style={{ marginTop: 10 }}>
          {"Building\nyour week"}
        </Head>
      </Animated.View>
      <View style={{ marginTop: 28, gap: 18 }} accessibilityLiveRegion="polite">
        {lines.map((l, i) => {
          const ok = ticks > i;
          return (
            <View key={l} style={styles.line}>
              {ok ? (
                <Animated.View entering={ZoomIn.duration(220)}>
                  <Disc size={26} earned>
                    <Icon name="check" size={14} stroke="#1a1408" />
                  </Disc>
                </Animated.View>
              ) : (
                <View style={styles.ring} />
              )}
              <Label size={16} style={{ color: ok ? color.bone : color.faint }}>
                {l}
              </Label>
            </View>
          );
        })}
      </View>
      {said ? (
        <Animated.View entering={FadeIn.duration(350)} style={{ marginTop: 40 }}>
          <Head size={26}>{said.title}</Head>
          <Body dim style={{ marginTop: 8 }}>
            {said.body}
          </Body>
          <Button style={{ marginTop: 22 }} label="Done" onPress={() => router.replace("/")} />
        </Animated.View>
      ) : null}
    </View>
  );
}

// A route parameter is shown only when it is a short plain phrase.
function short(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.length <= 32 && /^[\w ,.'-]+$/.test(s) ? s : null;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.black, paddingHorizontal: 36 },
  line: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 28 },
  ring: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.12)" },
});
