import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
  ZoomIn,
  useReducedMotion,
} from "react-native-reanimated";
import { COUNT_IN_INTRO_MS, COUNT_IN_STEP_MS, countInNext, countInWanted, nextMilestone, type CountInState } from "@shared/experience";
import { afterSessionLine, milestoneCrossed, milestoneLabel, nextStep } from "@shared/session-flow";
import { parseReps } from "@shared/set-timer";
import { fmtDuration } from "@shared/time-trained";
import type { AppSession, AppWeek } from "@shared/app-contract";
import { useMe, useToggleDrill, useWeek } from "@/api/queries";
import { DrillVideo } from "@/DrillVideo";
import { SetTimer } from "@/SetTimer";
import { Shade } from "@/Shade";
import { drillEyebrow, repsTiles } from "@/drill-view";
import { cue, feel, tick } from "@/feel";
import { usePrefs } from "@/prefs";
import { turnOnNotifications } from "@/push";
import { Body, Button, Disc, Eyebrow, Head, Icon, Label, Press, Ring } from "@/ui";
import { color } from "@/theme";

// The session player (approved mock v4, screens 2 to 4): "Grab your ball"
// and a 3, 2, 1 count-in (a tap skips it), then one drill at a time with
// its demo looping on mute, the coach's sets, the set timer and one big
// Done. Done turns into a check with a light tap, the next drill slides in;
// the last one opens the finish: the ring closes, the minutes count up, the
// next milestone. The screen stays awake the whole time.
export default function SessionPlayer() {
  useKeepAwake();
  const { n } = useLocalSearchParams<{ n: string }>();
  const router = useRouter();
  const week = useWeek().data;
  const session = week?.sessions.find((s) => String(s.n) === n) ?? null;

  if (!week || !session) {
    return (
      <View style={[styles.fill, { alignItems: "center", justifyContent: "center", padding: 24 }]}>
        <Body dim style={{ textAlign: "center" }}>
          This session is not in your week any more.
        </Body>
        <Button style={{ marginTop: 18, alignSelf: "stretch" }} label="Back home" onPress={() => router.back()} />
      </View>
    );
  }
  return <Player week={week} session={session} />;
}

type Phase = "count" | "drill" | "finish";

function Player({ week, session }: { week: AppWeek; session: AppSession }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const me = useMe();
  const [prefs] = usePrefs();
  const toggle = useToggleDrill();
  const drills = session.drills;
  const firstOpen = drills.findIndex((d) => !d.completed);
  const [index, setIndex] = useState(firstOpen === -1 ? 0 : firstOpen);
  const [phase, setPhase] = useState<Phase>(() =>
    countInWanted(drills, {}, firstOpen === -1 ? 0 : firstOpen) ? "count" : "drill"
  );
  const [count, setCount] = useState<CountInState>("intro");
  const [timerOpen, setTimerOpen] = useState(false);
  const before = useRef(week.totalMinutes);
  // The minutes this sitting adds: the drills ticked since the session opened.
  const doneHere = useRef(new Set<string>());
  const [finish, setFinish] = useState<{ added: number; total: number; weekDone: boolean; left: number } | null>(null);

  // The count-in: the session's name, then 3, 2, 1 with a tap felt on each.
  useEffect(() => {
    if (phase !== "count") return;
    if (count === "go") {
      setPhase("drill");
      return;
    }
    const id = setTimeout(() => setCount((c) => countInNext(c, "tick")), count === "intro" ? COUNT_IN_INTRO_MS : COUNT_IN_STEP_MS);
    if (count !== "intro") {
      tick();
      cue("tick");
    }
    return () => clearTimeout(id);
  }, [phase, count]);

  const drill = drills[index];
  const skills = drills.filter((d) => d.kind === "skill");
  const plan = useMemo(() => (drill ? parseReps(drill.reps) : null), [drill]);

  function done() {
    if (!drill) return;
    if (!drill.completed) {
      feel("drill");
      doneHere.current.add(drill.id);
      toggle.mutate({ id: drill.id, completed: true });
    }
    const doneMap = Object.fromEntries(drills.map((d) => [d.id, d.id === drill.id ? true : d.completed]));
    // nextStep reads only each row's id and completed (lib/elite/session-flow.ts)
    const next = nextStep(drills as unknown as Parameters<typeof nextStep>[0], doneMap, index);
    if (next === -1) {
      const added = drills.filter((d) => doneHere.current.has(d.id)).reduce((sum, d) => sum + d.minutes, 0);
      const plan = week.sessions.filter((s) => !s.extra);
      const left = plan.filter((s) => !s.complete && s.n !== session.n).length;
      const weekDone = !session.extra && left === 0;
      setFinish({ added, total: before.current + added, weekDone, left });
      setPhase("finish");
      setTimeout(() => feel(weekDone ? "week" : "session"), 450);
    } else {
      setIndex(next);
    }
  }

  if (phase === "count") {
    return (
      <Pressable style={[styles.fill, styles.center]} onPress={() => setCount("go")} accessibilityLabel="Skip the count-in">
        {count === "intro" ? (
          <Animated.View entering={FadeIn.duration(300)} style={{ alignItems: "center" }}>
            <Eyebrow>{session.name}</Eyebrow>
            <Head size={44} style={{ marginTop: 12, textAlign: "center" }}>
              Grab your ball
            </Head>
          </Animated.View>
        ) : count !== "go" ? (
          <Animated.View key={String(count)} entering={reduce ? FadeIn : ZoomIn.springify().damping(14)} exiting={FadeOut.duration(120)}>
            <Head size={160}>{String(count)}</Head>
          </Animated.View>
        ) : null}
        <Body dim size={13} style={{ position: "absolute", bottom: insets.bottom + 30 }}>
          Tap to start now
        </Body>
      </Pressable>
    );
  }

  if (phase === "finish" && finish) {
    return (
      <Finish
        name={me.data?.viewer.firstName ?? ""}
        week={week}
        finish={finish}
        askPush={!prefs.pushAsked}
        onHome={() => router.back()}
      />
    );
  }

  const tiles = drill ? repsTiles(drill.reps, drill.minutes) : [];
  return (
    <View style={styles.fill}>
      <View style={styles.video}>
        <DrillVideo key={drill?.id} src={drill?.video ?? null} poster={drill?.poster ?? null} autoplay={prefs.autoplay} />
        <Shade id="vid" stops={[[0, 0.55], [0.22, 0], [0.62, 0], [1, 1]]} />
      </View>

      <View style={[styles.topBar, { top: insets.top + 6 }]}>
        <Press onPress={() => router.back()} style={styles.close} accessibilityLabel="Close the session. Your place is kept.">
          <Icon name="close" />
        </Press>
        <View style={styles.segs}>
          {drills.map((d, i) => (
            <Pressable key={d.id} onPress={() => setIndex(i)} style={styles.segHit} accessibilityLabel={`${d.name}${d.completed ? ", done" : ""}`}>
              <View style={[styles.seg, d.completed ? { backgroundColor: color.gold } : i === index ? { backgroundColor: color.bone } : null]} />
            </Pressable>
          ))}
        </View>
      </View>

      {drill ? (
        <Animated.View
          key={drill.id}
          entering={reduce ? FadeIn.duration(200) : SlideInRight.duration(360)}
          exiting={reduce ? FadeOut.duration(150) : SlideOutLeft.duration(300)}
          style={styles.info}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Eyebrow>{drillEyebrow(drill.kind, skills.findIndex((s) => s.id === drill.id), skills.length)}</Eyebrow>
            {drill.completed ? (
              <Animated.View entering={ZoomIn.duration(250)}>
                <Disc size={22} earned>
                  <Icon name="check" size={12} stroke="#1a1408" />
                </Disc>
              </Animated.View>
            ) : null}
          </View>
          <Head size={34} style={{ marginTop: 8 }} numberOfLines={3}>
            {drill.name}
          </Head>
          <View style={styles.tiles}>
            {tiles.map((t) => (
              <View key={t.small} style={styles.tile}>
                <Head size={t.big.length > 14 ? 17 : 24} numberOfLines={2}>
                  {t.big}
                </Head>
                <Body dim size={12}>
                  {t.small}
                </Body>
              </View>
            ))}
          </View>
          {drill.notes ? (
            <Body dim size={13.5} style={{ marginTop: 12 }} numberOfLines={3}>
              {drill.notes}
            </Body>
          ) : null}
        </Animated.View>
      ) : null}

      <View style={[styles.cta, { bottom: insets.bottom + 20 }]}>
        {plan ? (
          <Press onPress={() => setTimerOpen(true)} style={styles.timerBtn} accessibilityLabel="Start the set timer">
            <Icon name="timer" size={26} />
          </Press>
        ) : null}
        <Button style={{ flex: 1 }} label={drill?.completed ? "Next" : "Done"} onPress={done} />
      </View>
      {drill?.completed ? (
        <Pressable
          onPress={() => toggle.mutate({ id: drill.id, completed: false })}
          style={[styles.undo, { bottom: insets.bottom + 88 }]}
          accessibilityRole="button"
        >
          <Label dim size={13}>
            Not done yet
          </Label>
        </Pressable>
      ) : null}

      {timerOpen && plan && drill ? <SetTimer plan={plan} name={drill.name} onClose={() => setTimerOpen(false)} /> : null}
    </View>
  );
}

function Finish({
  name,
  week,
  finish,
  askPush,
  onHome,
}: {
  name: string;
  week: AppWeek;
  finish: { added: number; total: number; weekDone: boolean; left: number };
  askPush: boolean;
  onHome: () => void;
}) {
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? finish.added : 0);
  const [push, setPush] = useState<"ask" | "done" | "skip">(askPush ? "ask" : "skip");

  // The minutes count up while the ring closes.
  useEffect(() => {
    if (reduce) return;
    const start = Date.now();
    const id = setInterval(() => {
      const k = Math.min(1, (Date.now() - start) / 1100);
      setShown(Math.round(finish.added * (1 - Math.pow(1 - k, 3))));
      if (k >= 1) clearInterval(id);
    }, 33);
    return () => clearInterval(id);
  }, [finish.added, reduce]);

  const crossed = milestoneCrossed(finish.total - finish.added, finish.total);
  const next = nextMilestone(finish.total);
  const plan = week.sessions.filter((s) => !s.extra);
  const doneCount = plan.length - finish.left;

  return (
    <View style={[styles.fill, { backgroundColor: "#050403" }]}>
      {!reduce ? <Sparks /> : null}
      <View style={{ alignItems: "center", marginTop: insets.top + 70 }}>
        <Ring size={240} stroke={12} value={1} track="rgba(200,168,88,0.16)">
          <Head size={72} style={{ color: color.gold }}>{`+${shown}`}</Head>
          <Eyebrow gold={false}>Minutes</Eyebrow>
        </Ring>
        <Animated.View entering={FadeIn.delay(500).duration(400)} style={{ alignItems: "center", paddingHorizontal: 24 }}>
          <Head size={38} style={{ marginTop: 22, textAlign: "center" }}>
            {finish.weekDone ? `Week ${week.week} complete` : `Session done, ${name}`}
          </Head>
          <Body dim style={{ marginTop: 8, textAlign: "center" }}>
            {afterSessionLine(finish.left)}
          </Body>
        </Animated.View>
      </View>
      <Animated.View entering={FadeIn.delay(700).duration(400)} style={styles.stats}>
        <View style={styles.stat}>
          <Head size={26}>{`${doneCount} / ${plan.length}`}</Head>
          <Body dim size={12}>sessions this week</Body>
        </View>
        <View style={styles.stat}>
          <Head size={26}>{fmtDuration(finish.total)}</Head>
          <Body dim size={12}>trained, all time</Body>
        </View>
      </Animated.View>
      {crossed || next ? (
        <Animated.View entering={FadeIn.delay(900).duration(400)} style={styles.medal}>
          <Disc size={52} earned={Boolean(crossed)}>
            <Head size={18} style={{ color: crossed ? "#1a1408" : color.faint }}>{`${crossed ?? next!.hours}H`}</Head>
          </Disc>
          <View style={{ flex: 1 }}>
            <Label size={16}>{crossed ? milestoneLabel(crossed) : `Next up: ${milestoneLabel(next!.hours)}`}</Label>
            <Body dim size={13}>
              {crossed ? "Earned today. It stays yours." : `${fmtDuration(next!.minutesAway)} away.`}
            </Body>
          </View>
        </Animated.View>
      ) : null}
      <View style={[styles.cta, { bottom: insets.bottom + 20, flexDirection: "column" }]}>
        {push === "ask" ? (
          <View style={styles.ask}>
            <Label>Turn on notifications?</Label>
            <Body dim size={13} style={{ marginTop: 4 }}>
              So you know the moment your new week is live, your coach messages you, or a Film Room is announced. Nothing else.
            </Body>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <Button style={{ flex: 1 }} quiet label="Not now" onPress={() => setPush("skip")} />
              <Button
                style={{ flex: 1 }}
                label="Turn on"
                onPress={() => {
                  void turnOnNotifications().finally(() => setPush("done"));
                }}
              />
            </View>
          </View>
        ) : null}
        <Button label="Back home" onPress={onHome} />
      </View>
    </View>
  );
}

// A few gold flecks drifting up: the reward, nothing more.
function Sparks() {
  const flecks = [
    { l: 60, t: 150, w: 6, h: 14, r: "30deg" },
    { l: 320, t: 130, w: 5, h: 12, r: "-25deg" },
    { l: 44, t: 300, w: 4, h: 10, r: "60deg" },
    { l: 338, t: 290, w: 6, h: 6, r: "0deg" },
    { l: 110, t: 96, w: 5, h: 5, r: "0deg" },
    { l: 270, t: 84, w: 4, h: 11, r: "15deg" },
  ];
  return (
    <>
      {flecks.map((f, i) => (
        <Animated.View
          key={i}
          entering={ZoomIn.delay(300 + i * 70).duration(500)}
          style={{ position: "absolute", left: f.l, top: f.t, width: f.w, height: f.h, borderRadius: 2, backgroundColor: color.gold, transform: [{ rotate: f.r }], opacity: 0.85 }}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.black },
  center: { alignItems: "center", justifyContent: "center" },
  video: { position: "absolute", left: 0, right: 0, top: 0, height: 560 },
  topBar: { position: "absolute", left: 14, right: 20, flexDirection: "row", alignItems: "center", gap: 12 },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  segs: { flex: 1, flexDirection: "row", gap: 5 },
  segHit: { flex: 1, height: 44, justifyContent: "center" },
  seg: { height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.28)" },
  info: { position: "absolute", left: 0, right: 0, top: 440, paddingHorizontal: 20 },
  tiles: { flexDirection: "row", gap: 10, marginTop: 16 },
  tile: { flex: 1, minHeight: 70, borderRadius: 18, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line, paddingHorizontal: 14, paddingVertical: 12 },
  cta: { position: "absolute", left: 20, right: 20, flexDirection: "row", gap: 10 },
  timerBtn: { width: 60, height: 60, borderRadius: 18, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line, alignItems: "center", justifyContent: "center" },
  undo: { position: "absolute", alignSelf: "center", minHeight: 44, paddingHorizontal: 16, justifyContent: "center" },
  stats: { flexDirection: "row", gap: 10, marginHorizontal: 20, marginTop: 28 },
  stat: { flex: 1, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: color.line, padding: 14 },
  medal: { flexDirection: "row", alignItems: "center", gap: 14, marginHorizontal: 20, marginTop: 12, padding: 14, borderRadius: 20, borderWidth: 1, borderColor: "rgba(200,168,88,0.38)", backgroundColor: "rgba(200,168,88,0.08)" },
  ask: { borderRadius: 20, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line, padding: 16 },
});

