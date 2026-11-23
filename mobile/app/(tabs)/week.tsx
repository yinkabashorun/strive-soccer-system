import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import type { AppSession } from "@shared/app-contract";
import { keys, useWeek } from "@/api/queries";
import { queryClient } from "@/api/queryClient";
import { Screen } from "@/Screen";
import { Body, Disc, Head, Icon, Press, Skeleton } from "@/ui";
import { color, radius } from "@/theme";

// Week (approved mock v4): the week, what it goes after, a bar per session
// (gold once done) and the sessions as photo cards. Today's is outlined
// with a play button; a done one is dimmed with a gold tick.
export default function Week() {
  const router = useRouter();
  const { data: w } = useWeek();
  const plan = w?.sessions.filter((s) => !s.extra) ?? [];

  return (
    <Screen onRefresh={() => queryClient.invalidateQueries({ queryKey: keys.week })}>
      <View style={{ paddingHorizontal: 20, paddingTop: 44 }}>
        <Head size={40}>{w && w.week > 0 ? `Week ${w.week}` : "Your week"}</Head>
        {w?.range ? (
          <Body dim size={13.5} style={{ marginTop: 6 }}>
            {w.range}
          </Body>
        ) : null}
      </View>

      {!w ? (
        <View style={{ padding: 14, gap: 10 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={108} r={radius.tile} />
          ))}
        </View>
      ) : w.week === 0 ? (
        <Body dim style={{ marginHorizontal: 20, marginTop: 16 }}>
          {w.nextWeekLine}
        </Body>
      ) : (
        <>
          {w.focus ? <Body style={{ marginHorizontal: 20, marginTop: 16, fontSize: 16, lineHeight: 22 }}>{w.focus}</Body> : null}
          <View style={styles.bar} accessible accessibilityLabel={`${plan.filter((s) => s.complete).length} of ${plan.length} sessions done`}>
            {plan.map((s) => (
              <View key={s.n} style={[styles.seg, s.complete ? { backgroundColor: color.gold } : null]} />
            ))}
          </View>
          <View style={styles.cards}>
            {w.sessions.map((s, i) => (
              <Animated.View key={s.n} entering={FadeInDown.delay(i * 60).duration(320)}>
                <SessionCard s={s} now={s.n === w.current} onPress={() => router.push(`/session/${s.n}`)} />
              </Animated.View>
            ))}
          </View>
          <Body dim size={13} style={{ marginHorizontal: 20, marginTop: 18 }}>
            {w.nextWeekLine}
          </Body>
        </>
      )}
    </Screen>
  );
}

function SessionCard({ s, now, onPress }: { s: AppSession; now: boolean; onPress: () => void }) {
  const line = s.complete
    ? `Done · ${s.minutesTotal} min`
    : `${now ? "Today · " : ""}${s.total} drills · ${s.minutesTotal} min`;
  return (
    <Press onPress={onPress} accessibilityLabel={`${s.name}. ${line}`} style={[styles.card, now ? styles.now : null]}>
      {s.image ? (
        <Image
          source={{ uri: s.image }}
          style={[StyleSheet.absoluteFill, { opacity: s.complete ? 0.28 : 0.55 }]}
          contentFit="cover"
          transition={200}
        />
      ) : null}
      <View style={styles.cardText}>
        <Head size={26}>{s.name}</Head>
        <Body size={13} style={{ color: "rgba(244,241,234,0.8)" }}>
          {line}
        </Body>
      </View>
      <View style={styles.right}>
        {s.complete ? (
          <Disc size={40} earned>
            <Icon name="check" size={18} stroke="#1a1408" />
          </Disc>
        ) : now ? (
          <View style={styles.play}>
            <Icon name="play" size={18} fill={color.black} />
          </View>
        ) : null}
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", gap: 6, marginHorizontal: 20, marginTop: 16 },
  seg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: color.fill2 },
  cards: { marginTop: 16, gap: 10, paddingHorizontal: 14 },
  card: { height: 108, borderRadius: radius.tile, overflow: "hidden", flexDirection: "row", backgroundColor: "#060606" },
  now: { borderWidth: 2.5, borderColor: color.bone },
  cardText: { flex: 1, padding: 16, paddingLeft: 18, justifyContent: "space-between" },
  right: { width: 86, alignItems: "center", justifyContent: "center" },
  play: { width: 44, height: 44, borderRadius: 22, backgroundColor: color.bone, alignItems: "center", justifyContent: "center" },
});
