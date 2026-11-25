import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { useRouter, type Href } from "expo-router";
import { fmtDuration } from "@shared/time-trained";
import type { AppProfile } from "@shared/app-contract";
import { Crest } from "@/Crest";
import { Body, Eyebrow, Head, Label, Press } from "@/ui";
import { color } from "@/theme";

// The pieces a profile is made of, shared by the You tab (your own) and a
// friend's profile (app/player/[id].tsx), so the two can never drift.

// A player, wherever they are shown (the row of faces, a post, the friends
// board, a club): a tap opens their profile. Your own face is not a link;
// your profile is the You tab. `said` is what a screen reader says of the
// row, and the link adds what the tap does.
export function PlayerLink({ id, you, first, said, style, children }: { id: string; you: boolean; first: string; said: string; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const router = useRouter();
  if (you || !id) {
    return (
      <View style={style} accessible accessibilityLabel={said}>
        {children}
      </View>
    );
  }
  return (
    <Press style={style} onPress={() => router.push(`/player/${id}` as Href)} accessibilityRole="button" accessibilityLabel={`${said}. Open ${first}'s profile.`}>
      {children}
    </Press>
  );
}

// The level a player's training has earned. It only goes up. What the next
// level takes is said only to the player themselves.
export function LevelBar({ aura }: { aura: AppProfile["aura"] }) {
  return (
    <View style={styles.level} accessible accessibilityLabel={[aura.label, aura.next].filter(Boolean).join(". ")}>
      <Eyebrow>{aura.label}</Eyebrow>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(Math.min(1, Math.max(0, aura.progress)) * 100)}%` }]} />
      </View>
      {aura.next ? (
        <Body dim size={12.5} style={{ marginTop: 7 }}>
          {aura.next}
        </Body>
      ) : null}
    </View>
  );
}

// Training this week, and all time.
export function TwoNumbers({ weekMinutes, allMinutes, mine }: { weekMinutes: number; allMinutes: number; mine: boolean }) {
  return (
    <View style={styles.numbers}>
      <View style={styles.number}>
        <Head size={36}>{fmtDuration(weekMinutes)}</Head>
        <Body dim size={13}>
          this week
        </Body>
      </View>
      <View style={styles.divider} />
      <View style={styles.number}>
        <Head size={36}>{fmtDuration(allMinutes)}</Head>
        <Body dim size={13}>
          {mine ? "all time. It only ever goes up." : "all time"}
        </Body>
      </View>
    </View>
  );
}

// A player's clubs, side by side. A club the viewer is in too opens its
// page; any other is only named (its page is its members').
export function ClubRow({ clubs }: { clubs: AppProfile["clubs"] }) {
  const router = useRouter();
  if (clubs.length === 0) return null;
  return (
    <View style={{ marginTop: 26 }}>
      <Label dim size={12} style={styles.section}>
        Clubs
      </Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 18 }} style={{ marginTop: 12 }}>
        {clubs.map((c) => {
          const inside = (
            <>
              <Crest club={c} size={58} />
              <Label size={12.5} numberOfLines={2} style={{ textAlign: "center", marginTop: 8 }}>
                {c.name}
              </Label>
            </>
          );
          return c.mine ? (
            <Press key={c.id} style={styles.club} onPress={() => router.push(`/club/${c.id}` as Href)} accessibilityRole="button" accessibilityLabel={`${c.name}. Open the club.`}>
              {inside}
            </Press>
          ) : (
            <View key={c.id} style={styles.club} accessible accessibilityLabel={c.name}>
              {inside}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// Their training photos, newest first, three across, the time on each.
// Only the photos the viewer may see are ever sent (today's stay locked
// until the viewer has posted today), and when there is none to show the
// grid is simply not there: nobody is ever shown as not having trained.
export function PostGrid({ posts, first, mine }: { posts: AppProfile["posts"]; first: string; mine: boolean }) {
  const { width } = useWindowDimensions();
  if (posts.length === 0) return null;
  const gap = 3;
  const side = Math.floor((width - gap * 2) / 3);
  return (
    <View style={{ marginTop: 28 }}>
      <Label dim size={12} style={styles.section}>
        {mine ? "Your training photos" : "Training photos"}
      </Label>
      <View style={[styles.grid, { gap }]}>
        {posts.map((p) => {
          const time = fmtDuration(p.minutes);
          return (
            <View
              key={p.id}
              style={{ width: side, height: side, backgroundColor: color.fill2 }}
              accessible
              accessibilityRole="image"
              accessibilityLabel={`${mine ? "Your" : `${first}'s`} ${p.kind === "gym" ? "gym" : "training"} photo, ${time}`}
            >
              <Image source={{ uri: p.photoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} cachePolicy="disk" />
              <View style={styles.time}>
                <Label size={12}>{time}</Label>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  level: { marginTop: 20 },
  track: { height: 6, borderRadius: 3, backgroundColor: color.fill2, marginTop: 9, overflow: "hidden" },
  // earned by training and by nothing else: gold
  fill: { height: 6, borderRadius: 3, backgroundColor: color.gold },
  numbers: { flexDirection: "row", alignItems: "stretch", marginTop: 20, paddingTop: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  number: { flex: 1 },
  divider: { width: StyleSheet.hairlineWidth, backgroundColor: color.line, marginHorizontal: 16 },
  section: { letterSpacing: 1.6, textTransform: "uppercase", marginHorizontal: 20 },
  club: { width: 76, minHeight: 44, alignItems: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 12 },
  time: { position: "absolute", left: 6, bottom: 6, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.62)" },
});
