import { StyleSheet, View } from "react-native";
import { achievementMark } from "@shared/achievement-rules";
import { fmtDuration, nextMedalLine } from "@shared/time-trained";
import type { AppYou } from "@shared/app-contract";
import { Body, Card, Disc, Hairline, Head, Label, Medal } from "@/ui";
import { color } from "@/theme";

// What a member's sessions have added up to: time by area, the hours
// medals and the badges. ONE component, on the member app's You tab and on
// the You tab of the free tabs once Strive Pro is on (lib/elite/one-app.ts),
// so the two can never say different things. A badge is a medal, not a
// grey tile; nothing here counts what was missed.
export function YouEarned({ y }: { y: AppYou }) {
  return (
    <>
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
              {nextMedalLine(y.next.hours, y.next.minutesAway)}
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
  );
}

const styles = StyleSheet.create({
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
