import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import Animated, { FadeIn } from "react-native-reanimated";
import { lockedHeadline, lockedHeadlineLines, lockedLine, type LockedCard } from "@shared/tracker";
import { Avatar } from "@/Avatar";
import { HERO_SHADE, Shade } from "@/Shade";
import { Body, Button, Eyebrow, Head } from "@/ui";
import { color, radius } from "@/theme";

// Friends opens the way Train does: ONE card, ONE button (the social half
// polished to the training loop's standard, Nov 24 2026).
//
// Before a player has posted today, the first thing they see is who has
// trained and the one way in: post yours. This card is the feed's own
// locked post (lib/elite/tracker.ts lockedHeadline, lockedLine), given the
// room of a hero and the Post button, so the faces, the reason and the
// action are one thing instead of three stacked lists.
//
// The button opens the training clock (app/post.tsx) and says where the
// clock stands: "Start training", "Finish my training", "Post my training".
//
// What is behind the words is the friend's PROFILE photo, blurred: a photo
// the player already sees on every row. The server still sends nothing of
// the locked post itself, so there is nothing here to peek at.
//
// Nobody is named as not having trained: with no friend's post waiting,
// the card only says today is open.
export type HeroFace = { id: string; photo?: string | null; initials: string };

export function TodayHero({
  locked,
  faces,
  friendsToday,
  label,
  onPost,
}: {
  // the first of today's locked posts, when a friend has trained
  locked: LockedCard | null;
  // the friends who trained today, to show their faces together
  faces: HeroFace[];
  friendsToday: number;
  // what the one button says (src/ClockRow.tsx useClockButton)
  label: string;
  onPost: () => void;
}) {
  const lines = locked ? lockedHeadlineLines(locked.first, locked.minutes, locked.kind) : null;
  const said = locked
    ? `${lockedHeadline(locked.first, locked.minutes, locked.kind)}. ${lockedLine(friendsToday)}`
    : TODAY_OPEN_HEAD;
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.hero}>
      {locked?.photo ? (
        <Image source={{ uri: locked.photo }} style={[StyleSheet.absoluteFill, { opacity: 0.55 }]} contentFit="cover" blurRadius={28} transition={250} cachePolicy="disk" />
      ) : null}
      <Shade id="today-hero" stops={HERO_SHADE} />
      <View style={styles.in} accessible accessibilityLabel={said}>
        {faces.length ? (
          <View style={styles.faces}>
            {faces.slice(0, 4).map((f, i) => (
              <View key={f.id} style={{ marginLeft: i === 0 ? 0 : -14 }}>
                <Avatar uri={f.photo} initials={f.initials} size={56} ring />
              </View>
            ))}
          </View>
        ) : null}
        <Eyebrow style={{ marginTop: 16 }}>{locked ? todayEyebrow(friendsToday) : "Today"}</Eyebrow>
        {lines ? (
          <>
            <Head size={36} style={{ marginTop: 8 }} numberOfLines={1}>
              {lines[0]}
            </Head>
            <Head size={36} numberOfLines={1}>
              {lines[1]}
            </Head>
          </>
        ) : (
          <Head size={36} style={{ marginTop: 8 }}>
            {TODAY_OPEN_HEAD}
          </Head>
        )}
        <Body style={{ marginTop: 8, color: "rgba(242,239,232,0.8)" }}>{locked ? TODAY_LOCKED_LINE : TODAY_OPEN_LINE}</Body>
      </View>
      <View style={styles.cta}>
        <Button label={label} onPress={onPost} />
      </View>
    </Animated.View>
  );
}

// "2 friends trained": the count of friends with a post today.
export function todayEyebrow(friendsToday: number): string {
  return friendsToday === 1 ? "Today · 1 friend trained" : `Today · ${friendsToday} friends trained`;
}

export const TODAY_LOCKED_LINE = "Post yours to see theirs.";
export const TODAY_OPEN_HEAD = "Be the first to post today";
export const TODAY_OPEN_LINE = "Start the clock with a photo. Your friends see your training when you finish.";

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: 14,
    marginTop: 18,
    minHeight: 388,
    borderRadius: radius.card,
    overflow: "hidden",
    backgroundColor: "#16140f",
    borderWidth: 1,
    borderColor: color.line,
    justifyContent: "flex-end",
  },
  in: { paddingHorizontal: 20 },
  faces: { flexDirection: "row", alignItems: "center" },
  cta: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20 },
});
