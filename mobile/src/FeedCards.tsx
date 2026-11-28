import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { CARD_WORDS } from "@shared/session-card";
import { fmtDuration } from "@shared/time-trained";
import { REPORT_REASONS, STAR_LABEL, lockedHeadline, lockedHeadlineLines, lockedLine, type LockedCard } from "@shared/tracker";
import type { AppOpenCard } from "@shared/app-contract";
import { NOT_TIMED } from "@shared/training-clock";
import { ApiError, OFFLINE_MESSAGE } from "./api/client";
import { blockPlayer, deleteEntry, reportPost, toggleProps } from "./api/free";
import { cardFromFeed, openCard } from "./card-source";
import { Avatar, MyAvatar, Star } from "./Avatar";
import { PlayerLink } from "./ProfileParts";
import { feel } from "./feel";
import { Shade } from "./Shade";
import { sheet } from "./sheet";
import { Body, Head, Label, Press } from "./ui";
import { color, radius } from "./theme";

// The two cards of the friends feed (the website's FriendsFeed).
//
// LOCKED: a friend's post from today, before you have posted a photo
// today. It says whose it is and how long they trained, and nothing else:
// the server sends no photo of the post and no note, so there is nothing
// here to peek at.
//
// OPEN: the photo full width, who and when, how long on the photo, the
// note, and one tap of props. The three dots open the iPhone's own sheet:
// Report this post and Block on anyone else's post; Make my card (the
// training card, app/card.tsx) and Delete on your own.
// A report or a block takes the post off this feed at once.
//
// A post timed by the clock shows its START photo small in the corner of
// the finish photo: the two photos the time was measured between. A post
// whose length was typed says "Not timed" beside the time.

export function LockedPost({ card, first, friendsToday }: { card: LockedCard; first: boolean; friendsToday: number }) {
  const [a, b] = lockedHeadlineLines(card.first, card.minutes, card.kind);
  return (
    <View style={[styles.locked, { height: first ? 400 : 190 }]} accessible accessibilityLabel={`${lockedHeadline(card.first, card.minutes, card.kind)}. ${first ? lockedLine(friendsToday) : ""}`}>
      <Avatar uri={card.photo} initials={card.initials} size={64} ring />
      <Head size={first ? 36 : 26} style={{ marginTop: 16, textAlign: "center" }}>
        {a}
      </Head>
      <Head size={first ? 36 : 26} style={{ textAlign: "center" }}>
        {b}
      </Head>
      {first ? (
        <Body dim style={{ marginTop: 10, textAlign: "center" }}>
          {lockedLine(friendsToday)}
        </Body>
      ) : null}
    </View>
  );
}

export function OpenPost({ card, onGone }: { card: AppOpenCard; onGone: () => void }) {
  const router = useRouter();
  const [props, setProps] = useState({ count: card.props, on: card.propped });
  const [error, setError] = useState<string | null>(null);

  function give() {
    const before = props;
    setProps({ count: before.count + (before.on ? -1 : 1), on: !before.on });
    feel("drill");
    toggleProps(card.id)
      .then((r) => !r.ok && setProps(before))
      .catch(() => setProps(before));
  }

  // One answer for the three things that take a post off the feed.
  async function act(run: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    try {
      const res = await run();
      if (!res.ok) return setError(res.error ?? "That didn't go through. Try again.");
      onGone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : OFFLINE_MESSAGE);
    }
  }

  function report() {
    const labels = REPORT_REASONS.map((r) => r.label);
    sheet(
      {
        title: "What is wrong with it?",
        message: `The post leaves your feed and a coach looks at it. ${card.first} isn't told who reported it.`,
        options: [...labels, "Cancel"],
        cancelButtonIndex: labels.length,
      },
      (i) => {
        const reason = REPORT_REASONS[i];
        if (reason) void act(() => reportPost(card.id, reason.id));
      }
    );
  }

  function block() {
    Alert.alert(
      `Block ${card.first}?`,
      `You stop being friends and you stop seeing each other's training. ${card.first} isn't told, and ${card.first}'s link won't add you again.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: `Block ${card.first}`, style: "destructive", onPress: () => void act(() => blockPlayer(card.ownerId)) },
      ]
    );
  }

  function remove() {
    Alert.alert("Delete your post?", "The photo is deleted and the time comes off your week.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete my post", style: "destructive", onPress: () => void act(() => deleteEntry(card.id)) },
    ]);
  }

  function more() {
    if (card.mine) {
      // your own post: make its training card again (app/card.tsx), or delete it
      return sheet({ options: [CARD_WORDS.make, "Delete my post", "Cancel"], destructiveButtonIndex: 1, cancelButtonIndex: 2 }, (i) =>
        i === 0 ? openCard(router, cardFromFeed(card)) : i === 1 ? remove() : undefined
      );
    }
    sheet(
      {
        message: `${card.first} is never told about a report or a block.`,
        options: ["Report this post", `Block ${card.first}`, "Cancel"],
        destructiveButtonIndex: [0, 1],
        cancelButtonIndex: 2,
      },
      (i) => (i === 0 ? report() : i === 1 ? block() : undefined)
    );
  }

  const time = fmtDuration(card.minutes);
  return (
    <View style={styles.open}>
      <View style={styles.who}>
        {/* the face and the name open that player's profile */}
        <PlayerLink
          id={card.ownerId}
          you={card.mine}
          first={card.first}
          said={`${card.starred ? `${card.name}. ${STAR_LABEL}` : card.name}. ${card.ago}`}
          style={styles.whoLink}
        >
          {card.mine ? <MyAvatar uri={card.photo} initials={card.initials} size={38} /> : <Avatar uri={card.photo} initials={card.initials} size={38} />}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Label numberOfLines={1}>{card.name}</Label>
              {card.starred ? <Star /> : null}
            </View>
            <Body dim size={12.5}>
              {card.ago}
            </Body>
          </View>
        </PlayerLink>
        <Press onPress={more} style={styles.more} accessibilityLabel={card.mine ? "Your post: more" : `${card.first}'s post: more`}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </Press>
      </View>
      <View style={styles.photo}>
        <Image
          source={{ uri: card.photoUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          accessibilityLabel={`${card.mine ? "Your" : `${card.first}'s`} ${card.kind === "gym" ? "gym" : "training"} photo`}
        />
        <Shade id={`post-${card.id}`} stops={POST_SHADE} />
        {card.startPhotoUrl ? (
          <View style={styles.startInset}>
            <Image source={{ uri: card.startPhotoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessibilityLabel="The start photo" />
          </View>
        ) : null}
        <View style={styles.onPhoto}>
          <Label size={12} dim style={{ letterSpacing: 1.6, textTransform: "uppercase" }}>
            {[card.kind === "gym" ? "Gym" : "Training", card.timed === false ? NOT_TIMED : null].filter(Boolean).join(" · ")}
          </Label>
          <Head size={34}>{time}</Head>
        </View>
      </View>
      <View style={styles.under}>
        <View style={{ flex: 1 }}>
          {card.caption ? <Body>{card.caption}</Body> : null}
          {card.together ? (
            <Body dim size={13}>
              {card.together}
            </Body>
          ) : null}
        </View>
        {card.mine ? (
          props.count > 0 ? (
            <Label dim size={14}>{`${props.count} props`}</Label>
          ) : null
        ) : (
          <Press
            onPress={give}
            style={[styles.props, props.on ? styles.propsOn : null]}
            accessibilityLabel={props.on ? "Take your props back" : `Give ${card.first} props`}
            accessibilityState={{ selected: props.on }}
          >
            <Label size={14} style={{ color: props.on ? color.black : color.bone }}>
              {props.count > 0 ? `Props ${props.count}` : "Props"}
            </Label>
          </Press>
        )}
      </View>
      {error ? (
        <Body size={13.5} style={{ color: color.danger, paddingHorizontal: 16, paddingBottom: 12 }}>
          {error}
        </Body>
      ) : null}
    </View>
  );
}

// Dark only under the words on the photo: the rest of it is left as taken.
const POST_SHADE: [number, number][] = [
  [0.55, 0],
  [1, 0.78],
];

const styles = StyleSheet.create({
  locked: { marginHorizontal: 14, borderRadius: radius.card, backgroundColor: "#1c1b17", borderWidth: 1, borderColor: color.line, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  open: { marginHorizontal: 14, borderRadius: radius.card, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line, overflow: "hidden" },
  who: { flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 14, paddingRight: 4, minHeight: 62 },
  whoLink: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  more: { width: 44, height: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3.5 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: color.dim },
  photo: { width: "100%", aspectRatio: 4 / 5, backgroundColor: color.fill2 },
  onPhoto: { position: "absolute", left: 16, bottom: 14 },
  // the start photo, small, in the corner of the finish photo
  startInset: { position: "absolute", left: 12, top: 12, width: "26%", aspectRatio: 4 / 5, borderRadius: 12, overflow: "hidden", borderWidth: 2, borderColor: color.black, backgroundColor: color.fill2 },
  under: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, minHeight: 64 },
  props: { minHeight: 44, paddingHorizontal: 18, borderRadius: 22, borderWidth: 1, borderColor: "rgba(242,239,232,0.3)", alignItems: "center", justifyContent: "center" },
  propsOn: { backgroundColor: color.bone, borderColor: color.bone },
});
