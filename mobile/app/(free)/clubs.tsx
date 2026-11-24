import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useRouter, type Href } from "expo-router";
import type { AppClubCard } from "@shared/app-contract";
import { CLUB_CAP_MESSAGE, CLUBS_PER_PLAYER } from "@shared/tracker";
import { OFFLINE_MESSAGE } from "@/api/client";
import { refreshClubs, useClubs } from "@/api/clubs";
import { Avatar, MyAvatar } from "@/Avatar";
import { Crest } from "@/Crest";
import { PAGE_TOP, Screen } from "@/Screen";
import { Shade } from "@/Shade";
import { Body, Button, Card, Eyebrow, Head, Label, Press, Skeleton } from "@/ui";
import { color, radius } from "@/theme";

// Clubs (the free app's middle tab): your clubs, three at most, each one
// alive at a glance: its crest and name, how much the club has trained
// this week, the faces of the members who trained today, what is next and
// this week's matchup. Then Start a club, and Have a club code.
//
// Positive only: a member who has not trained today is simply not in the
// row of faces, and nothing here says who did not.
//
// There is no selling on this screen.
export default function Clubs() {
  const router = useRouter();
  const clubs = useClubs();
  const c = clubs.data;
  const start = () => router.push("/club/start" as Href);
  const join = () => router.push("/club/join" as Href);

  return (
    <Screen onRefresh={refreshClubs}>
      <View style={{ paddingHorizontal: 20, paddingTop: PAGE_TOP }}>
        <Head size={40}>Clubs</Head>
      </View>

      {!c ? (
        clubs.isError || clubs.isPaused ? (
          <View style={{ margin: 20 }}>
            <Body dim>{OFFLINE_MESSAGE}</Body>
            <Button quiet style={{ marginTop: 16 }} label="Try again" busy={clubs.isFetching} onPress={() => void clubs.refetch()} />
          </View>
        ) : (
          <View style={{ margin: 14, gap: 14 }}>
            <Skeleton height={190} r={radius.card} />
            <Skeleton height={190} r={radius.card} />
          </View>
        )
      ) : c.clubs.length === 0 ? (
        <Card style={styles.empty}>
          <Head size={28} style={{ textAlign: "center" }}>
            Your club lives here
          </Head>
          <Body dim style={{ textAlign: "center", marginTop: 10 }}>
            {`Your team. Your pickup crew. The players you train with. Start a club, or join one with your captain's code. You can be in ${CLUBS_PER_PLAYER} clubs.`}
          </Body>
          <Button style={{ marginTop: 20 }} label="Start a club" onPress={start} />
          <Button quiet style={{ marginTop: 10 }} label="Have a club code?" onPress={join} />
        </Card>
      ) : (
        <>
          <View style={{ gap: 14, marginTop: 16 }}>
            {c.clubs.map((club) => (
              <ClubCard key={club.id} club={club} onPress={() => router.push(`/club/${club.id}` as Href)} />
            ))}
          </View>
          <View style={{ marginHorizontal: 14, marginTop: 20, gap: 10 }}>
            {c.canStart ? (
              <Button quiet label="Start a club" onPress={start} />
            ) : (
              <Body dim size={13.5} style={{ textAlign: "center" }}>
                {CLUB_CAP_MESSAGE}
              </Body>
            )}
            <Press onPress={join} style={styles.code} accessibilityLabel="Have a club code?">
              <Label dim size={14}>
                Have a club code?
              </Label>
            </Press>
          </View>
        </>
      )}
    </Screen>
  );
}

// Dark from the top, so the name reads, and darker again under the faces.
const CLUB_SHADE: [number, number][] = [
  [0, 0.72],
  [0.5, 0.62],
  [1, 0.9],
];

function ClubCard({ club, onPress }: { club: AppClubCard; onPress: () => void }) {
  const who = club.today.map((f) => f.first).join(", ");
  return (
    <Press
      onPress={onPress}
      style={styles.card}
      accessibilityLabel={`${club.name}. ${club.weekTime} trained this week.${who ? ` Trained today: ${who}.` : ""}${club.matchup ? ` ${club.matchup}` : ""}`}
    >
      {club.photo ? (
        <>
          <Image source={{ uri: club.photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} cachePolicy="disk" />
          <Shade id={`club-${club.id}`} stops={CLUB_SHADE} />
        </>
      ) : null}
      <View style={styles.head}>
        <Crest club={club} size={52} />
        <View style={{ flex: 1 }}>
          <Head size={24} numberOfLines={2}>
            {club.name}
          </Head>
          <Body dim size={13}>
            {`${club.members} ${club.members === 1 ? "player" : "players"}${club.ended ? " · Ended" : ""}`}
          </Body>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Head size={30}>{club.weekTime}</Head>
          <Body dim size={12.5}>
            this week
          </Body>
        </View>
      </View>

      {club.today.length ? (
        <View style={styles.today}>
          <Eyebrow>Trained today</Eyebrow>
          <View style={styles.faces}>
            {club.today.slice(0, 7).map((f) =>
              f.you ? <MyAvatar key={f.id} uri={f.photo} initials={f.initials} size={36} ring /> : <Avatar key={f.id} uri={f.photo} initials={f.initials} size={36} ring />
            )}
            {club.today.length > 7 ? (
              <Label dim size={13} style={{ marginLeft: 6 }}>
                {`and ${club.today.length - 7} more`}
              </Label>
            ) : null}
          </View>
        </View>
      ) : null}

      {club.next || club.matchup || club.waiting ? (
        <View style={styles.lines}>
          {club.matchup ? <Body size={13.5}>{club.matchup}</Body> : null}
          {club.next ? (
            <Body dim size={13.5}>
              {`Next up: ${club.next}`}
            </Body>
          ) : null}
          {club.waiting ? <Label size={13.5}>{club.waiting === 1 ? "1 answer waiting on you" : `${club.waiting} answers waiting on you`}</Label> : null}
        </View>
      ) : null}
    </Press>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 14, borderRadius: radius.card, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line, overflow: "hidden", padding: 18 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  today: { marginTop: 18 },
  faces: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  lines: { marginTop: 16, gap: 4 },
  empty: { marginHorizontal: 14, marginTop: 16, paddingVertical: 30, paddingHorizontal: 22 },
  code: { minHeight: 44, alignSelf: "center", justifyContent: "center" },
});
