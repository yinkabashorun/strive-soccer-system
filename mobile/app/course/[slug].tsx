import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, SectionList, StyleSheet, View, type ListViewToken } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppCourse, AppCourseLevel, AppCourseStep } from "@shared/app-contract";
import { OFFLINE_MESSAGE } from "@/api/client";
import { keys, useCourse } from "@/api/queries";
import { queryClient } from "@/api/queryClient";
import { clipOrder, clipsInView, liveClip, pickedAfterScroll, pickedAfterTap, type Picked } from "@/course-view";
import { DrillVideo } from "@/DrillVideo";
import { openLink } from "@/links";
import { usePrefs } from "@/prefs";
import { Shade } from "@/Shade";
import { Body, Button, Eyebrow, Head, Icon, Label, Press, Skeleton } from "@/ui";
import { color, radius } from "@/theme";

// One course (the website's CourseView): its levels in order, each with
// its name. A drill step is its clip, the drill's own name, the beginner
// or advanced tag, one cue and the pass mark; a lesson is a page of
// words, set to be read (and copied: the templates are selectable), with
// its clip and its download when it has them.
//
// One clip plays at a time (src/course-view.ts): the top one on screen
// when "Play drill demos automatically" is on, otherwise the one tapped.
//
// A library: nothing here is ticked, counted or tracked.
export default function CourseScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const found = useCourse(typeof slug === "string" ? slug : undefined);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/courses"));
  // Past the course's picture and name, the top of the page is a solid bar
  // with the course's name: the words that scroll up go under it, never
  // under the back button and the clock (simulator, Nov 24 2026: the back
  // arrow sat on top of a drill's name).
  const [barred, setBarred] = useState(false);

  if (found.data) {
    return (
      <View style={styles.fill}>
        <Course course={found.data} barHeight={insets.top + BAR} onPastTop={setBarred} />
        {barred ? (
          <View style={[styles.bar, { height: insets.top + BAR, paddingTop: insets.top }]} pointerEvents="none">
            <Label size={15} numberOfLines={1} style={styles.barName}>
              {found.data.name}
            </Label>
          </View>
        ) : (
          <TopShade height={insets.top + 64} />
        )}
        <BackButton top={insets.top + 6} onPress={back} />
      </View>
    );
  }

  const gone = (found.error as { status?: number } | null)?.status === 404;
  const unread = !gone && (found.isError || found.isPaused);
  return (
    <View style={[styles.fill, { paddingTop: insets.top + 62, paddingHorizontal: 20 }]}>
      {gone ? (
        <>
          <Head size={30}>Not in the library any more</Head>
          <Body dim style={{ marginTop: 10 }}>
            This course was taken off the shelf. Everything else is still on your Courses tab.
          </Body>
          <Button style={{ marginTop: 22 }} label="Back to Courses" onPress={back} />
        </>
      ) : unread ? (
        <>
          <Body dim>{OFFLINE_MESSAGE}</Body>
          <Button quiet style={{ marginTop: 16 }} label="Try again" busy={found.isFetching} onPress={() => void found.refetch()} />
        </>
      ) : (
        <View style={{ gap: 12 }}>
          <Skeleton height={44} width="70%" r={12} />
          <Skeleton height={18} width="50%" r={9} />
          <Skeleton height={360} r={radius.tile} style={{ marginTop: 18 }} />
          <Skeleton height={120} r={radius.tile} />
        </View>
      )}
      <BackButton top={insets.top + 6} onPress={back} />
    </View>
  );
}

function BackButton({ top, onPress }: { top: number; onPress: () => void }) {
  return (
    <Press onPress={onPress} style={[styles.back, { top }]} accessibilityLabel="Back to Courses">
      <Icon name="back" />
    </Press>
  );
}

// Pinned over the top of the page: what scrolls up fades out under the
// status bar and the back button instead of running into them.
function TopShade({ height }: { height: number }) {
  return (
    <View style={[styles.topShade, { height }]} pointerEvents="none">
      <Shade id="course-top" stops={TOP_SHADE} />
    </View>
  );
}

type Level = AppCourseLevel & { data: AppCourseStep[] };

function Course({ course, barHeight, onPastTop }: { course: AppCourse; barHeight: number; onPastTop: (past: boolean) => void }) {
  const insets = useSafeAreaInsets();
  // where the picture (or, with no picture, the name) has gone under the bar
  const pastAt = pastTopAt(Boolean(course.cover), barHeight);
  const past = useRef(false);
  const [prefs] = usePrefs();
  const [refreshing, setRefreshing] = useState(false);
  const sections = useMemo<Level[]>(() => course.levels.map((l) => ({ ...l, data: l.steps })), [course]);

  // Which clip is live (src/course-view.ts).
  const order = useMemo(() => clipOrder(course), [course]);
  const orderNow = useRef(order);
  useEffect(() => {
    orderNow.current = order;
  }, [order]);
  const [inView, setInView] = useState<string[]>([]);
  const [picked, setPicked] = useState<Picked>(undefined);
  // The list keeps the first function it is given, so this one never changes.
  const onViewable = useRef(({ viewableItems }: { viewableItems: ListViewToken[] }) => {
    // a level's heading is reported too (with no place in its level): steps only
    const visible = viewableItems.filter((t) => t.isViewable && t.index != null).map((t) => String((t.item as AppCourseStep).id));
    const next = clipsInView(orderNow.current, visible);
    setInView(next);
    setPicked((p) => pickedAfterScroll(p, next));
  }).current;
  const viewability = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const live = liveClip({ autoplay: prefs.autoplay, picked, inView });

  return (
    <SectionList<AppCourseStep, Level>
      style={styles.fill}
      sections={sections}
      // a level's heading comes through here too, and has no id of its own
      keyExtractor={(item, index) => (item as Partial<AppCourseStep>).id ?? `heading-${index}`}
      stickySectionHeadersEnabled={false}
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      scrollEventThrottle={32}
      onScroll={(e) => {
        const now = e.nativeEvent.contentOffset.y > pastAt;
        if (now !== past.current) {
          past.current = now;
          onPastTop(now);
        }
      }}
      initialNumToRender={4}
      windowSize={9}
      onViewableItemsChanged={onViewable}
      viewabilityConfig={viewability}
      refreshControl={
        <RefreshControl
          tintColor={color.bone}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await queryClient.invalidateQueries({ queryKey: [...keys.courses, "course", course.slug] }).catch(() => undefined);
            setRefreshing(false);
          }}
        />
      }
      ListHeaderComponent={<Top course={course} top={insets.top} />}
      renderSectionHeader={({ section }) => (
        <View style={styles.level}>
          {section.name ? <Eyebrow>{section.label}</Eyebrow> : null}
          <Head size={28} style={section.name ? { marginTop: 6 } : null}>
            {section.name ?? section.label}
          </Head>
        </View>
      )}
      renderItem={({ item }) => (
        <Step step={item} live={live === item.id} onClip={() => setPicked(pickedAfterTap(live, item.id))} />
      )}
    />
  );
}

// The course's picture with its name over it; a course with no picture
// starts with its name under the back button.
function Top({ course, top }: { course: AppCourse; top: number }) {
  const words = (
    <>
      <Head size={40}>{course.name}</Head>
      {course.subtitle ? (
        <Body dim size={14.5} style={{ marginTop: 8 }}>
          {course.subtitle}
        </Body>
      ) : null}
    </>
  );
  return (
    <View>
      {course.cover ? (
        <View style={styles.cover}>
          <Image source={{ uri: course.cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          <Shade id="course-cover" stops={COVER_SHADE} />
          <View style={styles.coverWords}>{words}</View>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 20, paddingTop: top + 62 }}>{words}</View>
      )}
      {course.intro.length > 0 ? (
        <View style={styles.intro}>
          {course.intro.map((line, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 12 }}>
              <Label dim size={14.5} style={{ width: 16 }}>
                {String(i + 1)}
              </Label>
              <Body dim size={14.5} style={{ flex: 1 }}>
                {line}
              </Body>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Step({ step, live, onClip }: { step: AppCourseStep; live: boolean; onClip: () => void }) {
  const download = step.download;
  return (
    <View style={styles.step}>
      {step.video ? (
        <Press onPress={onClip} style={styles.clip} accessibilityLabel={`${live ? "Pause" : "Play"} ${step.title}`}>
          {live ? (
            <DrillVideo src={step.video} poster={step.poster} autoplay />
          ) : (
            <>
              {step.poster ? <Image source={{ uri: step.poster }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
              <View style={styles.play}>
                <Icon name="play" size={20} fill={color.black} />
              </View>
            </>
          )}
        </Press>
      ) : null}
      <View style={styles.words}>
        {step.tag ? (
          <View style={[styles.tag, step.tag === "advanced" ? styles.tagAdvanced : null]}>
            <Eyebrow gold={step.tag === "advanced"} style={{ letterSpacing: 1.6 }}>
              {step.tag}
            </Eyebrow>
          </View>
        ) : null}
        <Head size={22}>{step.title}</Head>
        {step.cue ? (
          <Body dim style={{ marginTop: 8 }}>
            {step.cue}
          </Body>
        ) : null}
        {step.passMark ? (
          <Body style={{ marginTop: 8 }}>
            <Body dim>Pass: </Body>
            <Label>{step.passMark}</Label>
          </Body>
        ) : null}
        {step.blocks.map((b, i) => (
          <View key={i} style={{ marginTop: i === 0 ? 14 : 18 }}>
            {b.heading ? (
              <Eyebrow gold={false} style={styles.heading}>
                {b.heading}
              </Eyebrow>
            ) : null}
            {b.text ? (
              <Body selectable size={16} style={[styles.reading, b.heading ? { marginTop: 6 } : null]}>
                {b.text}
              </Body>
            ) : null}
          </View>
        ))}
        {download ? (
          <Press onPress={() => void openLink(download)} style={styles.download} accessibilityLabel={`Download: ${step.title}`}>
            <Icon name="download" size={18} />
            <Label size={14.5}>Download</Label>
          </Press>
        ) : null}
      </View>
    </View>
  );
}

// The bar under the status bar once the page is scrolled past its top.
const BAR = 56;
const COVER_HEIGHT = 340;
// With a picture: when the picture's words reach the bar. Without one: when
// the name, which starts just under the back button, has gone under it.
function pastTopAt(cover: boolean, barHeight: number): number {
  return cover ? COVER_HEIGHT - barHeight : 70;
}

const TOP_SHADE: [number, number][] = [
  [0, 0.85],
  [0.5, 0.6],
  [1, 0],
];
const COVER_SHADE: [number, number][] = [
  [0.3, 0],
  [0.58, 0.4],
  [1, 1],
];

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.black },
  topShade: { position: "absolute", left: 0, right: 0, top: 0 },
  back: { position: "absolute", left: 14, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  bar: { position: "absolute", left: 0, right: 0, top: 0, backgroundColor: color.black, alignItems: "center", justifyContent: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.1)" },
  barName: { maxWidth: "62%", textAlign: "center" },
  cover: { height: COVER_HEIGHT, backgroundColor: color.fill },
  coverWords: { position: "absolute", left: 20, right: 20, bottom: 6 },
  intro: { marginHorizontal: 20, marginTop: 18, gap: 8 },
  level: { paddingHorizontal: 20, marginTop: 34, marginBottom: 14 },
  step: { marginHorizontal: 14, marginBottom: 12, borderRadius: radius.tile, overflow: "hidden", backgroundColor: color.fill, borderWidth: 1, borderColor: color.line },
  clip: { aspectRatio: 4 / 5, backgroundColor: color.fill2, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  play: { width: 56, height: 56, borderRadius: 28, backgroundColor: color.bone, alignItems: "center", justifyContent: "center" },
  words: { padding: 18 },
  tag: { alignSelf: "flex-start", height: 24, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", justifyContent: "center", marginBottom: 10 },
  tagAdvanced: { borderColor: "rgba(200,168,88,0.45)" },
  heading: { fontSize: 12, letterSpacing: 1.8, color: color.bone },
  reading: { lineHeight: 25, color: "rgba(242,239,232,0.84)" },
  download: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, marginTop: 12, alignSelf: "flex-start" },
});
