import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import { dropDue, shortDate, todayName } from "@shared/experience";
import { fmtDuration } from "@shared/time-trained";
import type { AppSession, AppWeek } from "@shared/app-contract";
import { keys, useMe, useWeek } from "@/api/queries";
import { queryClient } from "@/api/queryClient";
import { seenWeek } from "@/prefs";
import { PAGE_TOP, Screen } from "@/Screen";
import { useMyPhoto } from "@/usePhoto";
import { HERO_SHADE, Shade } from "@/Shade";
import { Body, Button, Card, Disc, Eyebrow, Head, Icon, Label, Press, Ring, Skeleton } from "@/ui";
import { color, radius } from "@/theme";
import { tick } from "@/feel";

// Home (approved mock v4): one photo card, one button. The day and the
// week at the top, today's session as the card with why it matters (the
// goal ladder) and Start, then the week's sessions as circles and the time
// trained, all time. Nothing counts what was missed.
export default function Home() {
  const router = useRouter();
  const me = useMe();
  const week = useWeek();
  const photo = useMyPhoto();
  const w = week.data;

  // The Monday drop, once per new week, before anything in it is done.
  useFocusEffect(
    useCallback(() => {
      const pid = me.data?.player?.id;
      if (!w || !pid || w.onBreak) return;
      const plan = w.sessions.filter((s) => !s.extra);
      const anyDone = w.sessions.some((s) => s.done > 0);
      void seenWeek(pid).then((seen) => {
        if (dropDue({ seenWeek: seen, week: w.week, sessions: plan.length, anyDone })) router.push("/drop");
      });
    }, [w, me.data?.player?.id, router])
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: keys.week });
  const firstName = me.data?.viewer.firstName ?? "";
  const planSessions = w?.sessions.filter((s) => !s.extra) ?? [];
  const doneShare = planSessions.length ? planSessions.filter((s) => s.complete).length / planSessions.length : 0;
  const current = w?.sessions.find((s) => s.n === w.current) ?? null;

  return (
    <Screen onRefresh={refresh}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Head size={40}>{todayName()}</Head>
          <Body dim size={13.5} style={{ marginTop: 6 }}>
            {w && w.week > 0 ? `Week ${w.week} · ` : ""}
            {shortDate()}
          </Body>
        </View>
        <Press onPress={() => router.navigate("/you")} accessibilityLabel="You">
          <Ring size={58} stroke={4} value={doneShare} animate={false}>
            <View style={styles.initials}>
              {photo ? (
                <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" />
              ) : (
                <Label size={14}>{initials(me.data?.viewer.name ?? "")}</Label>
              )}
            </View>
          </Ring>
        </Press>
      </View>

      {!w ? (
        <View style={{ marginHorizontal: 14, marginTop: 18, gap: 14 }}>
          <Skeleton height={452} r={radius.card} />
          <Skeleton height={46} width="70%" r={23} />
        </View>
      ) : w.onBreak ? (
        <Card style={styles.note}>
          <Head size={28}>{w.onBreak.line}</Head>
          <Body dim style={{ marginTop: 10 }}>
            Everything you have trained is saved. Your week picks back up when you are back.
          </Body>
        </Card>
      ) : w.week === 0 ? (
        <Card style={styles.note}>
          <Head size={30}>Your first week is coming, {firstName}</Head>
          <Body dim style={{ marginTop: 12 }}>
            It is being built around your answers. It shows up here the moment it is ready, and you get a notification when it does.
          </Body>
        </Card>
      ) : current ? (
        <Animated.View entering={FadeIn.duration(300)}>
          <Hero week={w} session={current} onStart={() => router.push(`/session/${current.n}`)} />
        </Animated.View>
      ) : (
        <WeekComplete week={w} onCheckin={() => router.push("/checkin")} />
      )}

      {w && w.week > 0 && !w.onBreak ? (
        <View style={styles.weekline}>
          <View style={styles.dots}>
            {planSessions.map((s) => (
              <Press key={s.n} onPress={() => router.push(`/session/${s.n}`)} accessibilityLabel={`${s.name}${s.complete ? ", done" : ""}`}>
                {s.complete ? (
                  <Disc size={46} earned>
                    <Icon name="check" size={18} stroke="#1a1408" />
                  </Disc>
                ) : (
                  <View style={[styles.dot, s.n === w.current ? styles.dotNow : null]}>
                    <Head size={17} style={{ color: s.n === w.current ? color.bone : color.faint }}>
                      {String(s.n)}
                    </Head>
                  </View>
                )}
              </Press>
            ))}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Head size={28}>{fmtDuration(w.totalMinutes)}</Head>
            <Body dim size={12.5}>trained, all time</Body>
          </View>
        </View>
      ) : null}

      {w && w.week > 0 && !w.onBreak ? (
        <View style={styles.more}>
          {w.oneMore ? (
            <Body dim size={14} style={{ textAlign: "center", marginBottom: 4 }}>
              {w.oneMore}
            </Body>
          ) : null}
          <Press
            onPress={() => {
              tick();
              router.push("/extra");
            }}
            style={styles.quietRow}
            accessibilityLabel="Extra work"
          >
            <Icon name="plus" size={18} />
            <Label style={{ flex: 1 }}>Extra work</Label>
            <Icon name="chevron" size={16} stroke={color.faint} />
          </Press>
        </View>
      ) : null}
    </Screen>
  );
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

function Hero({ week, session, onStart }: { week: AppWeek; session: AppSession; onStart: () => void }) {
  const plan = week.sessions.filter((s) => !s.extra);
  const index = plan.findIndex((s) => s.n === session.n);
  const eyebrow = session.extra ? "Today · Extra session" : `Today · Session ${index + 1} of ${plan.length}`;
  const ladder = week.ladder.filter((r) => r.key !== "week");
  return (
    <View style={styles.hero}>
      {session.image ? <Image source={{ uri: session.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} /> : null}
      <Shade id="hero" stops={HERO_SHADE} />
      <View style={styles.heroIn}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <Head size={36} style={{ marginTop: 8 }} numberOfLines={2}>
          {session.headline ?? "Today's session"}
        </Head>
        {ladder.length ? (
          <View style={{ marginTop: 10, gap: 3 }}>
            {ladder.map((r) => (
              <Body key={r.key} size={13} numberOfLines={1} style={{ color: "rgba(242,239,232,0.8)" }}>
                <Body size={13} dim>{`${r.label}  `}</Body>
                {r.value}
              </Body>
            ))}
          </View>
        ) : null}
        <View style={styles.chips}>
          <Chip text={`${session.minutesTotal} min`} />
          <Chip text={`${session.total} drills`} />
          {session.done > 0 ? <Chip text={`${session.done} done`} /> : null}
        </View>
        <View style={styles.thumbs}>
          {session.drills.slice(0, 4).map((d) => (
            <View key={d.id} style={styles.thumb}>
              {d.poster ? <Image source={{ uri: d.poster }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              {d.kind === "warmup" ? (
                <Label size={11} style={styles.thumbLabel}>
                  Warm-up
                </Label>
              ) : null}
            </View>
          ))}
        </View>
        <Button
          style={{ marginTop: 16 }}
          label={session.done > 0 ? "Keep going" : "Start session"}
          icon={<Icon name="play" size={20} fill={color.black} />}
          onPress={onStart}
        />
      </View>
    </View>
  );
}

function Chip({ text }: { text: string }) {
  return (
    <View style={styles.chip}>
      <Label size={12.5}>{text}</Label>
    </View>
  );
}

function WeekComplete({ week, onCheckin }: { week: AppWeek; onCheckin: () => void }) {
  return (
    <Card style={[styles.note, { alignItems: "center" }]}>
      <Ring size={150} stroke={10} value={1}>
        <Head size={30}>{`Week ${week.week}`}</Head>
      </Ring>
      <Head size={32} style={{ marginTop: 18, textAlign: "center" }}>
        Week complete
      </Head>
      <Body dim style={{ marginTop: 8, textAlign: "center" }}>
        {week.nextWeekLine}
      </Body>
      <Button style={{ marginTop: 18, alignSelf: "stretch" }} quiet label="Weekly check-in" onPress={onCheckin} />
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 20, paddingTop: PAGE_TOP },
  initials: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#1c1c1c", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  hero: { marginHorizontal: 14, marginTop: 18, height: 452, borderRadius: radius.card, overflow: "hidden", backgroundColor: color.fill },
  heroIn: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 20 },
  chips: { flexDirection: "row", gap: 8, marginTop: 12 },
  chip: { height: 28, paddingHorizontal: 12, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center" },
  thumbs: { flexDirection: "row", gap: 8, marginTop: 16 },
  thumb: { flex: 1, height: 64, borderRadius: 14, overflow: "hidden", backgroundColor: color.fill2 },
  thumbLabel: { position: "absolute", left: 6, bottom: 5, textShadowColor: "#000", textShadowRadius: 4 },
  weekline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: 20, marginTop: 18 },
  dots: { flexDirection: "row", gap: 8 },
  dot: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: color.fill2, borderWidth: 1, borderColor: color.line },
  dotNow: { backgroundColor: color.black, borderWidth: 2.5, borderColor: color.bone },
  note: { marginHorizontal: 14, marginTop: 18, padding: 24 },
  more: { marginHorizontal: 14, marginTop: 22, gap: 8 },
  quietRow: { minHeight: 56, borderRadius: 18, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18 },
});
