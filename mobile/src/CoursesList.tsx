import { ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useRouter, type Href } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import type { AppCourseCard } from "@shared/app-contract";
import { OFFLINE_MESSAGE } from "@/api/client";
import { useCourses } from "@/api/queries";
import { Shade } from "@/Shade";
import { Body, Button, Card, Eyebrow, Head, Icon, Label, Press, Skeleton } from "@/ui";
import { color, radius } from "@/theme";

// The Courses shelf (approved mock v4, screen 6; the website's CourseList):
// the first course as one large photo card, every other one in a row of
// tall photo cards with its line under it. The pictures are the course's
// own cover, or the still of its first filmed drill; a course of written
// pages with no cover shows as type on black.
//
// The body only, so any tab can show it inside its own page (src/Screen.tsx).
// A member's cards open the course. A locked card (an account that is not a
// member is sent the whole shelf locked) carries a small lock and opens the
// offer; a locked shelf never asks the server for a course.
//
// A library: nothing here is ticked, counted or tracked.
export function CoursesList() {
  const router = useRouter();
  const shelf = useCourses();
  const list = shelf.data;

  if (!list) {
    if (shelf.isError || shelf.isPaused) {
      return (
        <View style={styles.note}>
          <Body dim>{OFFLINE_MESSAGE}</Body>
          <Button quiet style={{ marginTop: 16 }} label="Try again" busy={shelf.isFetching} onPress={() => void shelf.refetch()} />
        </View>
      );
    }
    return (
      <View>
        <Skeleton height={FEATURED_HEIGHT} r={radius.card} style={{ marginHorizontal: 14, marginTop: 18 }} />
        <View style={[styles.row, { marginTop: 30 }]}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={SMALL_HEIGHT} width={SMALL_WIDTH} r={22} />
          ))}
        </View>
      </View>
    );
  }

  const [featured, ...rest] = list.courses;
  if (!featured) {
    return (
      <Card style={styles.empty}>
        <Body dim>The first course is on its way. It shows up here the moment it's ready.</Body>
      </Card>
    );
  }

  const open = (c: AppCourseCard) => router.push((c.locked ? "/offer" : `/course/${c.slug}`) as Href);

  return (
    <Animated.View entering={FadeIn.duration(300)}>
      <View style={{ marginHorizontal: 14, marginTop: 18 }}>
        <CourseCard course={featured} featured onPress={() => open(featured)} />
      </View>
      {rest.length > 0 ? (
        <>
          <Label size={17} style={{ marginHorizontal: 20, marginTop: 26 }}>
            All courses
          </Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={{ marginTop: 12 }}>
            {rest.map((c) => (
              <View key={c.slug} style={{ width: SMALL_WIDTH }}>
                <CourseCard course={c} onPress={() => open(c)} />
              </View>
            ))}
          </ScrollView>
        </>
      ) : null}
    </Animated.View>
  );
}

function CourseCard({ course: c, featured = false, onPress }: { course: AppCourseCard; featured?: boolean; onPress: () => void }) {
  const said = [c.name, c.subtitle, c.locked ? "Locked" : null].filter(Boolean).join(". ");
  return (
    <View>
      <Press onPress={onPress} accessibilityLabel={said} style={[styles.photo, featured ? styles.featured : styles.small]}>
        {c.cover ? <Image source={{ uri: c.cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
        <Shade id={`course-${c.slug}`} stops={featured ? FEATURED_SHADE : SMALL_SHADE} />
        <View style={featured ? styles.featuredText : styles.smallText}>
          {featured && !c.locked ? <Eyebrow>Start here</Eyebrow> : null}
          <Head size={featured ? 32 : 19} numberOfLines={3} style={featured ? { marginTop: 6 } : null}>
            {c.name}
          </Head>
          {featured && c.subtitle ? (
            <Body size={14} style={{ marginTop: 6, color: "rgba(242,239,232,0.8)" }}>
              {c.subtitle}
            </Body>
          ) : null}
        </View>
        {c.locked ? (
          <View style={styles.lock}>
            <Icon name="lock" size={16} />
          </View>
        ) : null}
      </Press>
      {!featured && c.subtitle ? (
        <Body dim size={12.5} numberOfLines={2} style={{ marginTop: 6, paddingHorizontal: 2 }}>
          {c.subtitle}
        </Body>
      ) : null}
    </View>
  );
}

const FEATURED_HEIGHT = 300;
const SMALL_HEIGHT = 200;
const SMALL_WIDTH = 150;
// The website's falls: clear over the picture, dark under the words.
const FEATURED_SHADE: [number, number][] = [
  [0.3, 0],
  [1, 0.92],
];
const SMALL_SHADE: [number, number][] = [
  [0.45, 0],
  [1, 0.85],
];

const styles = StyleSheet.create({
  photo: { overflow: "hidden", backgroundColor: color.fill2, borderWidth: 1, borderColor: color.line },
  featured: { height: FEATURED_HEIGHT, borderRadius: radius.card },
  small: { height: SMALL_HEIGHT, borderRadius: 22 },
  featuredText: { position: "absolute", left: 18, right: 18, bottom: 18 },
  smallText: { position: "absolute", left: 12, right: 12, bottom: 12 },
  lock: { position: "absolute", top: 12, right: 12, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", gap: 10, paddingHorizontal: 14 },
  note: { marginHorizontal: 20, marginTop: 18 },
  empty: { marginHorizontal: 14, marginTop: 18, padding: 20 },
});
