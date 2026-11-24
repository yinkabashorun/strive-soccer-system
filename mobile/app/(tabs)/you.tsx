import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { achievementMark } from "@shared/achievement-rules";
import { fmtDuration } from "@shared/time-trained";
import { keys, useMe, useYou } from "@/api/queries";
import { queryClient } from "@/api/queryClient";
import { MemberCard } from "@/MemberCard";
import { useMyPhoto } from "@/usePhoto";
import { PAGE_TOP, Screen } from "@/Screen";
import { Body, Card, Disc, Hairline, Head, Label, Medal, Ring, SettingRow, Skeleton } from "@/ui";
import { color } from "@/theme";

// You (approved mock v4): the member card, this week's time in the gold
// ring, all time ("it only ever goes up"), the last weeks as bars, time by
// area and what has been earned. A quiet week is a short grey bar, never a
// mark against them. Settings sit underneath.
export default function You() {
  const router = useRouter();
  const me = useMe();
  const { data: y } = useYou();
  const photo = useMyPhoto();
  const card = y?.card ?? me.data?.player?.card;
  const max = Math.max(1, ...(y?.bars.map((b) => b.minutes) ?? [1]));

  return (
    <Screen onRefresh={() => queryClient.invalidateQueries({ queryKey: keys.you })}>
      <View style={{ paddingHorizontal: 20, paddingTop: PAGE_TOP }}>
        <Head size={40}>You</Head>
        <Body dim size={13.5} style={{ marginTop: 6 }}>
          {[card?.name, y?.position ?? me.data?.player?.position].filter(Boolean).join(" · ")}
        </Body>
      </View>

      <View style={{ marginHorizontal: 20, marginTop: 18 }}>
        {card ? (
          <MemberCard name={card.name} since={card.since} tier={card.tier} photo={photo} username={me.data?.profileSetup?.username} />
        ) : (
          <Skeleton height={204} r={22} />
        )}
      </View>

      {!y ? (
        <View style={{ margin: 20, gap: 14 }}>
          <Skeleton height={132} />
          <Skeleton height={150} />
        </View>
      ) : (
        <>
          <View style={styles.ringRow}>
            <Ring size={132} stroke={10} value={y.weekMinutesPlanned > 0 ? Math.min(1, y.weekMinutesDone / y.weekMinutesPlanned) : 0}>
              <Head size={28}>{fmtDuration(y.weekMinutesDone)}</Head>
              <Body dim size={11.5}>this week</Body>
            </Ring>
            <View style={{ flex: 1 }}>
              <Head size={48}>{fmtDuration(y.allTimeMinutes)}</Head>
              <Body dim size={13}>
                trained, all time.{"\n"}It only ever goes up.
              </Body>
            </View>
          </View>

          <View style={styles.chart} accessible accessibilityLabel="Minutes trained in each of the last weeks">
            {y.bars.map((b) => {
              const now = b.week === y.week;
              return (
                <View key={b.week} style={styles.col}>
                  <View style={[styles.bar, { height: `${Math.max(6, (b.minutes / max) * 100)}%` }, now ? { backgroundColor: color.gold } : null]} />
                  <Label size={11} style={{ color: now ? color.bone : color.faint }}>
                    {now ? "Now" : `W${b.week}`}
                  </Label>
                </View>
              );
            })}
          </View>

          {y.areas.length ? (
            <View style={{ marginHorizontal: 20, marginTop: 26 }}>
              <Label size={17}>Time by area</Label>
              <Card style={{ marginTop: 10, padding: 0 }}>
                {y.areas.map((a, i) => (
                  <View key={a.area}>
                    {i > 0 ? <Hairline /> : null}
                    <View style={styles.area}>
                      <Label style={{ flex: 1 }}>{a.area}</Label>
                      {a.thisWeek > 0 ? (
                        <Label size={13} style={{ color: color.gold, marginRight: 10 }}>
                          +{fmtDuration(a.thisWeek)} this week
                        </Label>
                      ) : null}
                      <Label dim>{fmtDuration(a.minutes)}</Label>
                    </View>
                  </View>
                ))}
              </Card>
            </View>
          ) : null}

          <View style={{ marginHorizontal: 20, marginTop: 26 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
              <Label size={17}>Earned</Label>
              {y.next ? (
                <Body dim size={13}>
                  {`${y.next.hours} hours in ${fmtDuration(y.next.minutesAway)}`}
                </Body>
              ) : null}
            </View>
            <View style={styles.medals}>
              {y.medals.map((m) => (
                <View key={m.hours} style={{ alignItems: "center", flex: 1 }}>
                  <Disc size={72} earned={m.earned}>
                    <Head size={20} style={{ color: m.earned ? "#1a1408" : color.faint }}>{`${m.hours}H`}</Head>
                  </Disc>
                  <Body dim size={12} style={{ marginTop: 9 }}>
                    {m.hours === 1 ? "1 hour" : `${m.hours} hours`}
                  </Body>
                </View>
              ))}
            </View>
            {y.achievements.length ? (
              <View style={styles.badges}>
                {y.achievements.map((a) => (
                  <View key={a.id} style={styles.badge} accessible accessibilityLabel={`Earned: ${a.title}. ${a.detail}`}>
                    <Medal size={58} mark={achievementMark(a.title)} />
                    <Head size={18} style={styles.badgeTitle}>
                      {a.title}
                    </Head>
                    <Body dim size={12.5} style={styles.badgeDetail}>
                      {a.detail}
                    </Body>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </>
      )}

      <Card style={{ marginHorizontal: 20, marginTop: 26, padding: 0 }}>
        <SettingRow label="Settings" detail="Notifications, this phone, your password" onPress={() => router.push("/settings")} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ringRow: { flexDirection: "row", alignItems: "center", gap: 18, marginHorizontal: 20, marginTop: 22 },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 9, height: 150, marginHorizontal: 20, marginTop: 22 },
  col: { flex: 1, height: "100%", justifyContent: "flex-end", alignItems: "center", gap: 6 },
  bar: { width: "100%", borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: color.fill2 },
  area: { minHeight: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: 16 },
  medals: { flexDirection: "row", marginTop: 14 },
  badges: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10, marginTop: 18 },
  // A badge is a medal, not a grey tile: the gold medal, its name in the
  // headline face and the whole line of what it was for, never cut short.
  badge: {
    width: "48.5%",
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 16,
    paddingHorizontal: 10,
    borderRadius: 22,
    backgroundColor: color.fill,
    borderWidth: 1,
    borderColor: "rgba(200,168,88,0.32)",
  },
  badgeTitle: { textAlign: "center", marginTop: 2 },
  badgeDetail: { textAlign: "center", marginTop: 5 },
});
