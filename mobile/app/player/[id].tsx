import { useEffect, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { STAR_LABEL } from "@shared/tracker";
import { ApiError, OFFLINE_MESSAGE } from "@/api/client";
import { blockPlayer, refreshFree, removeFriend, reportProfile, toggleProps, useProfile } from "@/api/free";
import { refreshClubs } from "@/api/clubs";
import { Avatar, Star } from "@/Avatar";
import { feel } from "@/feel";
import { ClubRow, LevelBar, PostGrid, TwoNumbers } from "@/ProfileParts";
import { useBelowClock } from "@/Screen";
import { choose } from "@/sheet";
import { Body, Button, Card, Head, Icon, Label, Press, Ring, Skeleton } from "@/ui";
import { color } from "@/theme";

// A friend's profile, opened from their face anywhere in the free app (the
// row of faces, a post, the friends board, a club): who they are, the level
// their training has earned, this week and all time, their clubs, and the
// training photos you may see.
//
// The server sends a profile only to the player, their friends and the
// coaches (lib/elite/tracker.ts mayViewProfile). Anyone else, and either
// side of a block, gets nothing back, and this screen says so plainly.
//
// No bio, no follower count, no age or grade, and nothing that says a
// player has not trained. Report, take off my friends and Block are behind
// the one menu; the player is never told.
export default function Player() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const belowClock = useBelowClock();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useProfile(id);
  const p = q.data;
  const [propped, setPropped] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);

  useEffect(() => {
    setPropped(p?.propsPost?.propped ?? false);
  }, [p?.propsPost?.id, p?.propsPost?.propped]);

  const gone = q.error instanceof ApiError && q.error.status === 404;

  // After anything that ends the friendship: the lists that named this
  // player are read again, and this screen closes.
  async function leave(run: () => Promise<{ ok: boolean; error?: string }>) {
    setNote(null);
    try {
      const res = await run();
      if (!res.ok) return setNote(res.error ?? "That did not go through. Try again.");
      void refreshFree();
      void refreshClubs();
      router.back();
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : OFFLINE_MESSAGE);
    }
  }

  async function report(what: "photo" | "line") {
    if (!p) return;
    setNote(null);
    try {
      const res = await reportProfile(p.id, what);
      setNote(res.ok ? "Sent to the coaches. Thank you." : res.error ?? "That did not go through. Try again.");
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : OFFLINE_MESSAGE);
    }
  }

  function give() {
    if (!p?.propsPost) return;
    const before = propped;
    setPropped(!before);
    feel("drill");
    toggleProps(p.propsPost.id)
      .then((r) => {
        if (!r.ok) setPropped(before);
        else void refreshFree();
      })
      .catch(() => setPropped(before));
  }

  function more() {
    if (!p || p.you) return;
    const first = p.first;
    choose({
      message: `${first} is not told if you report, remove or block them.`,
      choices: [
        ...(p.photo ? [{ label: "Report the profile photo", destructive: true, run: () => void report("photo") }] : []),
        ...(p.playingFor ? [{ label: "Report the Playing for line", destructive: true, run: () => void report("line") }] : []),
        ...(p.friend
          ? [
              {
                label: "Remove from my friends",
                run: () =>
                  Alert.alert(`Take ${first} off your friends?`, `You stop seeing each other's training. ${first} is not told. Their link can add you again.`, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Remove from my friends", style: "destructive", onPress: () => void leave(() => removeFriend(p.id)) },
                  ]),
              },
            ]
          : []),
        {
          label: `Block ${first}`,
          destructive: true,
          run: () =>
            Alert.alert(
              `Block ${first}?`,
              `You stop being friends and you stop seeing each other's training. ${first} is not told, and their link will not add you again. You can unblock them in Settings.`,
              [
                { text: "Cancel", style: "cancel" },
                { text: `Block ${first}`, style: "destructive", onPress: () => void leave(() => blockPlayer(p.id)) },
              ]
            ),
        },
      ],
    });
  }

  async function pull() {
    setPulling(true);
    try {
      await q.refetch();
    } finally {
      setPulling(false);
    }
  }

  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: color.black }, belowClock]}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 40 }}
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void pull()} tintColor={color.bone} />}
    >
      <View style={styles.bar}>
        <Press onPress={() => router.back()} style={styles.hit} accessibilityLabel="Back">
          <Icon name="back" />
        </Press>
        {p && !p.you ? (
          <Press onPress={more} style={[styles.hit, { alignItems: "flex-end" }]} accessibilityLabel={`More for ${p.first}`}>
            <View style={styles.dots}>
              <View style={styles.dot} />
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>
          </Press>
        ) : null}
      </View>

      {!p ? (
        gone ? (
          <View style={{ marginHorizontal: 20, marginTop: 20 }}>
            <Head size={30}>Not here</Head>
            <Body dim style={{ marginTop: 8 }}>
              You see a player&apos;s profile once you are friends.
            </Body>
          </View>
        ) : q.isError || q.isPaused ? (
          <View style={{ marginHorizontal: 20, marginTop: 20 }}>
            <Body dim>{OFFLINE_MESSAGE}</Body>
            <Button quiet style={{ marginTop: 16 }} label="Try again" busy={q.isFetching} onPress={() => void q.refetch()} />
          </View>
        ) : (
          <View style={{ marginHorizontal: 14, marginTop: 10 }}>
            <Skeleton height={300} r={30} />
          </View>
        )
      ) : (
        <>
          <Card style={styles.card}>
            <View style={styles.who}>
              <Ring size={104} stroke={5} value={p.aura.progress}>
                <Avatar uri={p.photo} initials={p.initials} size={88} />
              </Ring>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }} accessible accessibilityLabel={p.starred ? `${p.name}. ${STAR_LABEL}` : p.name}>
                  <Head size={28} numberOfLines={1}>
                    {p.name}
                  </Head>
                  {p.starred ? <Star size={16} /> : null}
                </View>
                {p.username ? (
                  <Body dim size={14} style={{ marginTop: 2 }}>
                    @{p.username}
                  </Body>
                ) : null}
                {p.level ? (
                  <Body dim size={13.5} style={{ marginTop: 6 }}>
                    {p.level}
                  </Body>
                ) : null}
                {p.playingFor ? (
                  <Body size={13.5} style={{ marginTop: 2 }} numberOfLines={2}>
                    Playing for {p.playingFor}
                  </Body>
                ) : null}
              </View>
            </View>
            <LevelBar aura={p.aura} />
            <TwoNumbers weekMinutes={p.weekMinutes} allMinutes={p.allMinutes} mine={p.you} />
          </Card>

          {p.propsPost && !p.you ? (
            <Press
              onPress={give}
              style={[styles.props, propped ? styles.propsOn : null]}
              accessibilityRole="button"
              accessibilityLabel={propped ? "Take your props back" : `Give ${p.first} props on their latest training`}
            >
              <Label size={15} style={propped ? { color: color.black } : null}>
                {propped ? "Props given" : `Give ${p.first} props`}
              </Label>
            </Press>
          ) : null}
          {note ? (
            <Body dim size={13.5} style={{ marginHorizontal: 20, marginTop: 12 }}>
              {note}
            </Body>
          ) : null}

          <ClubRow clubs={p.clubs} />
          <PostGrid posts={p.posts} first={p.first} mine={p.you} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20 },
  hit: { width: 44, height: 44, justifyContent: "center" },
  dots: { flexDirection: "row", gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: color.bone },
  card: { marginHorizontal: 14, marginTop: 6, padding: 20, overflow: "hidden", borderColor: "rgba(200,168,88,0.28)" },
  who: { flexDirection: "row", alignItems: "center", gap: 16 },
  props: {
    marginHorizontal: 14,
    marginTop: 14,
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(242,239,232,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  propsOn: { backgroundColor: color.bone, borderColor: color.bone },
});
