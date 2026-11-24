import { useState } from "react";
import { ScrollView, Share, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { fmtDuration } from "@shared/time-trained";
import { ApiError, OFFLINE_MESSAGE } from "@/api/client";
import { answerFriend, refreshFree, useFeed } from "@/api/free";
import { Avatar, MyAvatar, Star } from "@/Avatar";
import { LockedPost, OpenPost } from "@/FeedCards";
import { PAGE_TOP, Screen } from "@/Screen";
import { Body, Button, Card, Eyebrow, Hairline, Head, Label, Press, Ring, Skeleton } from "@/ui";
import { color } from "@/theme";
import { SquadCard } from "@/SquadCard";

// Friends (the free app's first tab; the website's /log): who trained
// today, friend requests, and the feed. A friend's post from today stays
// locked until you have posted a photo today; the server sends nothing of
// a locked post but whose it is and how long, so posting yours is the only
// way to see theirs. Earlier days are always open.
//
// There is no upgrade wording on this screen.
export default function Friends() {
  const router = useRouter();
  const feed = useFeed();
  const f = feed.data;
  // posts taken off the feed here (reported, blocked, deleted) and requests
  // answered, until the next read says the same
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [requestError, setRequestError] = useState<string | null>(null);
  const hide = (id: string) => {
    setGone((g) => new Set([...g, id]));
    void refreshFree();
  };

  async function answer(id: string, accept: boolean) {
    setRequestError(null);
    try {
      const res = await answerFriend(id, accept);
      if (!res.ok) return setRequestError(res.error ?? "That did not go through. Try again.");
      hide(`r:${id}`);
    } catch (e) {
      setRequestError(e instanceof ApiError ? e.message : OFFLINE_MESSAGE);
    }
  }

  const post = () => router.push("/post");
  const invite = () => f && void Share.share({ url: f.invite }).catch(() => undefined);

  if (!f) {
    return (
      <Screen onRefresh={refreshFree}>
        <View style={{ paddingHorizontal: 20, paddingTop: PAGE_TOP }}>
          <Head size={40}>Today</Head>
        </View>
        {feed.isError || feed.isPaused ? (
          <View style={{ margin: 20 }}>
            <Body dim>{OFFLINE_MESSAGE}</Body>
            <Button quiet style={{ marginTop: 16 }} label="Try again" busy={feed.isFetching} onPress={() => void feed.refetch()} />
          </View>
        ) : (
          <View style={{ margin: 14, gap: 14 }}>
            <Skeleton height={84} />
            <Skeleton height={400} r={30} />
          </View>
        )}
      </Screen>
    );
  }

  const cards = f.cards.filter((c) => !gone.has(c.id));
  const requests = f.requests.filter((r) => !gone.has(`r:${r.id}`));
  const firstLocked = cards.find((c) => c.state === "locked")?.id;
  const me = f.faces.find((x) => x.you);

  return (
    <Screen onRefresh={refreshFree}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Head size={40}>Today</Head>
          <Body dim size={13.5} style={{ marginTop: 6 }}>
            {f.date}
          </Body>
        </View>
        <Press
          onPress={() => router.navigate("/(free)/my-week")}
          accessibilityLabel={`Your week: ${fmtDuration(f.week.minutes)} of ${fmtDuration(f.week.target)}`}
          style={{ minWidth: 52, minHeight: 52, alignItems: "center", justifyContent: "center" }}
        >
          <Ring size={52} stroke={3} value={f.week.target > 0 ? f.week.minutes / f.week.target : 0}>
            <MyAvatar uri={me?.photo} initials={me?.initials ?? ""} size={40} />
          </Ring>
        </Press>
      </View>

      {f.faces.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.faces} accessibilityLabel="Who trained today">
          {f.faces.map((x) => (
            <View key={x.id} style={styles.face} accessible accessibilityLabel={`${x.first}${x.active ? ", trained today" : ""}`}>
              {x.you ? <MyAvatar uri={x.photo} initials={x.initials} size={56} /> : <Avatar uri={x.photo} initials={x.initials} size={56} lit={x.active} />}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 6 }}>
                <Label size={12} dim={!x.active} numberOfLines={1}>
                  {x.first}
                </Label>
                {x.starred ? <Star size={10} /> : null}
              </View>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <View style={{ marginHorizontal: 14, marginTop: 16 }}>
        <Button quiet={f.unlocked} label="Post my training" onPress={post} />
      </View>

      {requests.length ? (
        <Card style={{ marginHorizontal: 14, marginTop: 16, padding: 0 }}>
          <Eyebrow style={{ marginLeft: 16, marginTop: 14 }}>{requests.length === 1 ? "Request" : "Requests"}</Eyebrow>
          {requests.map((r, i) => (
            <View key={r.id}>
              {i > 0 ? <Hairline /> : null}
              <View style={styles.request}>
                <Avatar initials={r.initials} size={40} />
                <View style={{ flex: 1 }}>
                  <Label numberOfLines={1}>{r.name}</Label>
                  <Body dim size={12.5}>
                    Wants to be friends
                  </Body>
                </View>
                <Press onPress={() => void answer(r.id, false)} style={styles.answer} accessibilityLabel={`Decline ${r.name}`}>
                  <Label dim size={14}>
                    Decline
                  </Label>
                </Press>
                <Press onPress={() => void answer(r.id, true)} style={[styles.answer, styles.accept]} accessibilityLabel={`Accept ${r.name}`}>
                  <Label size={14} style={{ color: color.black }}>
                    Accept
                  </Label>
                </Press>
              </View>
            </View>
          ))}
          {requestError ? (
            <Body size={13.5} style={{ color: color.danger, paddingHorizontal: 16, paddingBottom: 12 }}>
              {requestError}
            </Body>
          ) : null}
        </Card>
      ) : null}

      {f.friendCount === 0 ? (
        <Card style={styles.empty}>
          <Head size={28} style={{ textAlign: "center" }}>
            Your friends' training lands here
          </Head>
          <Body dim style={{ textAlign: "center", marginTop: 10 }}>
            Send your link to a teammate. When they join, accept their friend request and you see each other's training every day.
          </Body>
          {f.squad ? null : <Button quiet style={{ marginTop: 18 }} label="Send my link" onPress={invite} />}
        </Card>
      ) : cards.length === 0 ? (
        <Card style={styles.empty}>
          <Head size={28} style={{ textAlign: "center" }}>
            Nobody has posted yet this week
          </Head>
          <Body dim style={{ textAlign: "center", marginTop: 10 }}>
            Post a photo of your training and be the first your friends see.
          </Body>
        </Card>
      ) : (
        <View style={{ gap: 14, marginTop: 16 }}>
          {cards.map((c) =>
            c.state === "locked" ? (
              <LockedPost key={c.id} card={c} first={c.id === firstLocked} friendsToday={f.friendsToday} />
            ) : (
              <OpenPost key={c.id} card={c} onGone={() => hide(c.id)} />
            )
          )}
        </View>
      )}

      {/* Bring your squad: one card, where the invite has always been. */}
      {f.squad ? (
        <SquadCard squad={f.squad} onSend={invite} />
      ) : f.friendCount > 0 ? (
        <Press onPress={invite} style={styles.invite} accessibilityLabel="Send my link to a teammate">
          <Label dim size={14}>
            Send my link to a teammate
          </Label>
        </Press>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 20, paddingTop: PAGE_TOP },
  faces: { paddingHorizontal: 20, gap: 14, paddingTop: 18 },
  face: { alignItems: "center", width: 60 },
  request: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, minHeight: 64 },
  answer: { minHeight: 44, paddingHorizontal: 12, justifyContent: "center", borderRadius: 14 },
  accept: { backgroundColor: color.bone, paddingHorizontal: 16 },
  empty: { marginHorizontal: 14, marginTop: 16, paddingVertical: 30, paddingHorizontal: 22 },
  invite: { minHeight: 44, alignSelf: "center", justifyContent: "center", marginTop: 18 },
});
