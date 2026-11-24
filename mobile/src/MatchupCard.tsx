import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import type { MatchupView } from "@shared/app-contract";
import { MATCHUP_HOW_LINK, MATCHUP_LAST_WEEK, MATCHUP_PER_PLAYER, matchupTitle } from "@shared/club-matchup-words";
import { Crest } from "./Crest";
import { Body, Card, Eyebrow, Head, Icon, Label, Press } from "./ui";
import { color } from "./theme";

// The weekly club matchup (083), right under the club's week: both crests
// and names, each club's time per player as two big numbers, and one plain
// line that says who is ahead (or, once the week is over, who won it).
//
// Every word is the server's or lib/elite/club-matchup-words.ts's, the one
// file the website's card reads too, written so a 9 year old understands it
// the first time. "How it works" opens the explanation. Positive only:
// nothing here names a player or says who has not trained.
export function MatchupCard({ matchup }: { matchup: MatchupView }) {
  const router = useRouter();
  const sides = matchup.mine && matchup.theirs ? [matchup.mine, matchup.theirs] : null;
  return (
    <Card style={styles.card}>
      <Eyebrow gold={false}>{matchupTitle(matchup.state)}</Eyebrow>
      {sides ? (
        <View style={styles.sides}>
          {sides.map((side) => (
            <View key={side.id} style={{ flex: 1 }} accessible accessibilityLabel={`${side.name}: ${side.time} ${MATCHUP_PER_PLAYER}`}>
              <View style={styles.who}>
                <Crest club={side} size={34} />
                <Label size={14} numberOfLines={2} style={{ flex: 1 }}>
                  {side.name}
                </Label>
              </View>
              <Head size={38} style={{ marginTop: 10 }}>
                {side.time}
              </Head>
              <Body dim size={12.5}>
                {MATCHUP_PER_PLAYER}
              </Body>
            </View>
          ))}
        </View>
      ) : null}
      <Label size={15.5} style={{ marginTop: sides ? 14 : 10, lineHeight: 21 }}>
        {matchup.line}
      </Label>
      {matchup.last ? (
        <Body dim size={13} style={{ marginTop: 6 }}>
          {`${MATCHUP_LAST_WEEK}: ${matchup.last}`}
        </Body>
      ) : null}
      <Press onPress={() => router.push("/club/how")} style={styles.how} accessibilityLabel={MATCHUP_HOW_LINK}>
        <Label dim size={14}>
          {MATCHUP_HOW_LINK}
        </Label>
        <Icon name="chevron" size={16} stroke={color.faint} />
      </Press>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 14, marginTop: 14, paddingBottom: 4 },
  sides: { flexDirection: "row", gap: 14, marginTop: 14 },
  who: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 36 },
  how: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
});
