import { useState } from "react";
import { Alert, RefreshControl, ScrollView, Share, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppClubPage, AppClubTile, ClubMemberRow } from "@shared/app-contract";
import { STAR_LABEL } from "@shared/tracker";
import { ApiError, OFFLINE_MESSAGE } from "@/api/client";
import { leaveClub, refreshClubs, reportClub, useClub } from "@/api/clubs";
import { blockPlayer, refreshFree } from "@/api/free";
import { Avatar, MyAvatar, Star } from "@/Avatar";
import Animated, { FadeIn } from "react-native-reanimated";
import { Crest, CrestGlow } from "@/Crest";
import { HERO_SHADE, Shade } from "@/Shade";
import { recordShort } from "@/social-view";
import { MatchupCard } from "@/MatchupCard";
import { PlanCardView } from "@/PlanCards";
import { choose } from "@/sheet";
import { Body, Button, Card, Eyebrow, Hairline, Head, Icon, Label, Press, SettingRow, Skeleton } from "@/ui";
import { useBelowClock } from "@/Screen";
import { color, radius } from "@/theme";

// One club, top to bottom:
//   the crest, the name, its county and players, and its two records, each
//   its own line (games, and weeks won in the weekly matchup)
//   THIS WEEK   the club's training time as the one big number, next to
//               its best week; the weekly matchup right under it; then the
//               members ranked by this week's training, with their photos
//   NEXT UP     the club's next session or game, who is in, and "I'm in"
//   THIS WEEK'S PHOTOS  the club's training photos, by the feed's own lock
//   Invite, and for the captain one row, Manage
//
// Positive only: a member with nothing logged yet this week is listed
// with no place and no time, and nothing here says who has not trained.
// When nothing is planned, the captain is offered to plan; everyone else
// is shown nothing at all.
//
// There is no selling on this screen.
export default function Club() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const belowClock = useBelowClock();
  const { id } = useLocalSearchParams<{ id: string }>();
  const club = useClub(id);
  const c = club.data;
  // the club's picture: this week's newest training photo the viewer may see
  const open = c?.photos.find((t) => t.state === "open");
  const heroPhoto = open && open.state === "open" ? open.photoUrl : null;
  const weeks = recordShort(c?.matchup?.recordLine);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One answer for the things that end with leaving this page.
  async function act(run: () => Promise<{ ok: boolean; error?: string }>, after: () => void) {
    setError(null);
    try {
      const res = await run();
      if (!res.ok) return setError(res.error ?? "That did not go through. Try again.");
      void refreshClubs();
      after();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : OFFLINE_MESSAGE);
    }
  }

  function more(page: AppClubPage) {
    const others = page.members.filter((m) => !m.you);
    choose({
      message: "Leaving keeps the friends you made. To cut one off, block them.",
      choices: [
        ...(page.captain
          ? []
          : [
              {
                label: "Report the club's name",
                destructive: true,
                run: () =>
                  Alert.alert("Report the club's name?", "For a name that should not be in the app. A coach looks at it and can rename or close the club. Nobody is told who reported it.", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Send it to the coaches", style: "destructive", onPress: () => void act(() => reportClub(page.id), () => Alert.alert("Sent to the coaches. Thank you.")) },
                  ]),
              },
            ]),
        ...(others.length
          ? [
              {
                label: "Block a player",
                destructive: true,
                run: () =>
                  choose({
                    title: "Block a player",
                    message: "You stop seeing each other anywhere in the app. They are not told.",
                    choices: others.map((m) => ({
                      label: m.name,
                      destructive: true,
                      run: () => void act(() => blockPlayer(m.id), () => void refreshFree()),
                    })),
                  }),
              },
            ]
          : []),
        {
          label: "Leave the club",
          destructive: true,
          run: () =>
            Alert.alert(`Leave ${page.name}?`, "Leaving keeps the friends you made. To cut one off, block them.", [
              { text: "Cancel", style: "cancel" },
              { text: "Leave the club", style: "destructive", onPress: () => void act(() => leaveClub(page.id), () => router.back()) },
            ]),
        },
      ],
    });
  }

  const top = (
    <View style={styles.bar}>
      <Press onPress={() => router.back()} style={styles.barButton} accessibilityLabel="Back">
        <Icon name="back" />
      </Press>
      {c ? (
        <Press onPress={() => more(c)} style={[styles.barButton, { alignItems: "flex-end" }]} accessibilityLabel={`More for ${c.name}`}>
          <View style={{ flexDirection: "row", gap: 3.5 }}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
        </Press>
      ) : null}
    </View>
  );

  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: color.black }, belowClock]}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 48 }}
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          tintColor={color.bone}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await refreshClubs().catch(() => undefined);
            setRefreshing(false);
          }}
        />
      }
    >
      {top}
      {!c ? (
        club.isError || club.isPaused ? (
          <View style={{ margin: 20 }}>
            <Body dim>{club.error instanceof ApiError && club.error.status === 404 ? "That club is not there any more." : OFFLINE_MESSAGE}</Body>
            <Button quiet style={{ marginTop: 16 }} label="Try again" busy={club.isFetching} onPress={() => void club.refetch()} />
          </View>
        ) : (
          <View style={{ margin: 14, gap: 14 }}>
            <Skeleton height={90} />
            <Skeleton height={170} r={30} />
            <Skeleton height={240} r={30} />
          </View>
        )
      ) : (
        <>
          {/* The club leads with its own picture, the way Train leads with
              today's session: this week's newest training photo the viewer
              may see, or the club's own colour until there is one. The
              record is two numbers a player says out loud ("4-1"); the
              plain sentence stays what a screen reader says. */}
          <Animated.View entering={FadeIn.duration(300)} style={[styles.hero, heroPhoto ? styles.heroPhoto : null]}>
            {heroPhoto ? (
              <>
                <Image source={{ uri: heroPhoto }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} cachePolicy="disk" />
                <Shade id="club-hero" stops={HERO_SHADE} />
              </>
            ) : (
              <CrestGlow club={c} />
            )}
            <View style={styles.heroIn}>
              <Crest club={c} size={64} />
              <Head size={36} style={{ marginTop: 12 }} numberOfLines={2}>
                {c.name}
              </Head>
              <Body size={13.5} style={{ marginTop: 4, color: "rgba(242,239,232,0.8)" }}>
                {[c.countyName, `${c.membersCount} ${c.membersCount === 1 ? "player" : "players"}`, c.ended ? "Ended" : null].filter(Boolean).join(" · ")}
              </Body>
              <View style={styles.chips}>
                <RecordChip big={c.record} small={c.record === "New" ? "no games yet" : "games won-lost"} says={c.recordLine} />
                {weeks ? <RecordChip big={weeks} small="weeks won-lost" says={c.matchup!.recordLine} /> : null}
              </View>
            </View>
          </Animated.View>
          {error ? (
            <Body size={13.5} style={{ color: color.danger, marginHorizontal: 20, marginTop: 10 }}>
              {error}
            </Body>
          ) : null}

          <Card style={styles.week}>
            <Eyebrow gold={false}>This week</Eyebrow>
            <Head size={64} style={{ marginTop: 6 }}>
              {c.week.time}
            </Head>
            <Body dim size={13.5}>
              trained by your club
            </Body>
            {c.week.bestLine ? (
              c.week.record ? (
                <Eyebrow style={{ marginTop: 12, lineHeight: 16 }}>{c.week.bestLine}</Eyebrow>
              ) : (
                <Label size={15} style={{ marginTop: 12 }}>
                  {c.week.bestLine}
                </Label>
              )
            ) : null}
          </Card>

          {c.matchup ? <MatchupCard matchup={c.matchup} /> : null}

          <Card style={styles.members}>
            {c.members.map((m, i) => (
              <View key={m.id}>
                {i > 0 ? <Hairline /> : null}
                <MemberRow m={m} />
              </View>
            ))}
          </Card>

          {c.next.length ? (
            <>
              <Eyebrow gold={false} style={styles.section}>
                Next up
              </Eyebrow>
              {c.next.map((p) => (
                <PlanCardView key={p.id} card={p} clubId={c.id} />
              ))}
            </>
          ) : c.captain && !c.ended ? (
            <>
              <Eyebrow gold={false} style={styles.section}>
                Next up
              </Eyebrow>
              <View style={styles.plan}>
                <Button quiet label="Plan a session" onPress={() => router.push(`/club/${c.id}/plan` as Href)} />
                <Button quiet label="Plan a game" onPress={() => router.push(`/club/${c.id}/near` as Href)} />
              </View>
            </>
          ) : null}

          {c.results.length ? (
            <>
              <Eyebrow gold={false} style={styles.section}>
                Games
              </Eyebrow>
              {c.results.map((p) => (
                <PlanCardView key={p.id} card={p} clubId={c.id} />
              ))}
            </>
          ) : null}

          <Eyebrow gold={false} style={styles.section}>
            This week&apos;s photos
          </Eyebrow>
          {c.photos.length ? (
            <View style={styles.grid}>
              {c.photos.map((t) => (
                <Tile key={t.id} tile={t} onLocked={() => router.push("/post")} />
              ))}
            </View>
          ) : (
            <Body dim style={{ marginHorizontal: 20, marginTop: 8 }}>
              Post a photo of your training and your club sees it here.
            </Body>
          )}
          {c.photos.some((t) => t.state === "locked") ? (
            <Body dim size={13.5} style={{ marginHorizontal: 20, marginTop: 10 }}>
              Post a photo of your training today to see today&apos;s photos from your club.
            </Body>
          ) : null}
          <View style={{ marginHorizontal: 14, marginTop: 14 }}>
            <Button quiet label="Post my training" onPress={() => router.push("/post")} />
          </View>

          {c.share || c.captain ? (
          <Card style={styles.rows}>
            {c.share ? (
              <SettingRow
                label="Invite a teammate"
                detail={c.byCoach ? "Send the club's code. The coaches let them in." : "Send the club's code. The captain lets them in."}
                onPress={() => void Share.share({ message: c.share!.text }).catch(() => undefined)}
              />
            ) : null}
            {c.captain ? (
              <>
                {c.share ? <Hairline /> : null}
                <SettingRow
                  label="Manage"
                  detail={manageLine(c)}
                  onPress={() => router.push(`/club/${c.id}/manage` as Href)}
                />
              </>
            ) : null}
          </Card>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

// One number of the club's record on its picture.
function RecordChip({ big, small, says }: { big: string; small: string; says: string }) {
  return (
    <View style={styles.chip} accessible accessibilityLabel={says}>
      <Head size={22}>{big}</Head>
      <Body size={11.5} style={{ color: "rgba(242,239,232,0.72)" }}>
        {small}
      </Body>
    </View>
  );
}

// What waits on the captain, in words, or what Manage holds.
function manageLine(c: AppClubPage): string {
  const requests = c.manage?.requests.length ?? 0;
  const games = c.manage?.games.length ?? 0;
  const scores = c.results.filter((p) => p.result?.canEnter || p.result?.canAnswer).length;
  const parts = [
    requests ? `${requests} asking to join` : null,
    games ? (games === 1 ? "1 game request" : `${games} game requests`) : null,
    scores ? (scores === 1 ? "1 score to settle" : `${scores} scores to settle`) : null,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "Requests, plans, your county, the club's code";
}

function MemberRow({ m }: { m: ClubMemberRow }) {
  const name = m.you ? "You" : m.name;
  const said = [m.place ? `Number ${m.place}` : null, name, m.captain ? "captain" : null, m.starred ? STAR_LABEL : null, m.time ? `${m.time} this week` : null, m.today ? "trained today" : null]
    .filter(Boolean)
    .join(", ");
  return (
    <View style={styles.member} accessible accessibilityLabel={said}>
      <Label dim size={14} style={styles.place}>
        {m.place ?? ""}
      </Label>
      {m.you ? <MyAvatar uri={m.photo} initials={m.initials} size={42} /> : <Avatar uri={m.photo} initials={m.initials} size={42} />}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Label numberOfLines={1} style={{ flexShrink: 1 }}>
            {name}
          </Label>
          {m.starred ? <Star /> : null}
          {m.captain ? (
            <View style={styles.captain}>
              <Label size={11} style={{ color: color.black, letterSpacing: 1.1, textTransform: "uppercase" }}>
                Captain
              </Label>
            </View>
          ) : null}
        </View>
        {m.today ? (
          <Body dim size={12.5}>
            Trained today
          </Body>
        ) : null}
      </View>
      {m.time ? <Head size={22}>{m.time}</Head> : null}
    </View>
  );
}

// One training photo. A locked one (a teammate's post from today, before
// you have posted a photo today) is given no photo of the post to draw:
// whose it is, how long, and a lock. A tap goes to posting your own.
function Tile({ tile, onLocked }: { tile: AppClubTile; onLocked: () => void }) {
  if (tile.state === "locked") {
    return (
      <Press onPress={onLocked} style={[styles.tile, styles.lockedTile]} accessibilityLabel={`${tile.first} trained ${tile.time} today. Post yours to see the photo.`}>
        <Avatar uri={tile.photo} initials={tile.initials} size={40} ring />
        <Label size={13} style={{ marginTop: 8 }}>
          {tile.time}
        </Label>
        <View style={{ position: "absolute", top: 8, right: 8 }}>
          <Icon name="lock" size={15} stroke={color.dim} />
        </View>
      </Press>
    );
  }
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${tile.mine ? "Your" : `${tile.first}'s`} training photo, ${tile.time}`}>
      <Image source={{ uri: tile.photoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      <View style={styles.tileTime}>
        <Label size={12.5}>{tile.time}</Label>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20 },
  barButton: { width: 44, height: 44, justifyContent: "center" },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: color.bone },
  hero: {
    marginHorizontal: 14,
    marginTop: 4,
    borderRadius: radius.card,
    overflow: "hidden",
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: color.line,
    justifyContent: "flex-end",
  },
  // room for the picture above the words; a club with no photo yet is
  // only as tall as its words
  heroPhoto: { minHeight: 300 },
  heroIn: { padding: 20 },
  chips: { flexDirection: "row", gap: 8, marginTop: 14 },
  chip: { minWidth: 96, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.46)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  week: { marginHorizontal: 14, marginTop: 18, padding: 20 },
  members: { marginHorizontal: 14, marginTop: 14, padding: 0 },
  member: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14 },
  place: { width: 18, textAlign: "center" },
  captain: { backgroundColor: color.bone, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  section: { marginHorizontal: 20, marginTop: 28 },
  plan: { gap: 10, marginHorizontal: 14, marginTop: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginHorizontal: 14, marginTop: 10 },
  tile: { width: "32.4%", aspectRatio: 1, borderRadius: 12, overflow: "hidden", backgroundColor: color.fill2 },
  lockedTile: { alignItems: "center", justifyContent: "center", backgroundColor: "#1c1b17", borderWidth: 1, borderColor: color.line },
  tileTime: { position: "absolute", left: 6, bottom: 6, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  rows: { marginHorizontal: 14, marginTop: 28, padding: 0 },
});
