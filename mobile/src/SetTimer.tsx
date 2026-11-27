import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { clock, planKey, planLine, skipLabel, stepSeconds, timerNext, timerStart, type RepsPlan, type TimerStep } from "@shared/set-timer";
import { cue, feel } from "./feel";
import { Body, Button, Head, Eyebrow, Ring } from "./ui";
import { color } from "./theme";

// The drill's sets, timed (approved mock v4, screen 3): the website's own
// rules (lib/elite/set-timer.ts) walk the sets, a tone and a felt tap at
// every change. It never ticks the drill for the player and never invents a
// time the coach did not write.
const WORD: Record<TimerStep["phase"], string> = {
  ready: "Get ready",
  work: "Go",
  rest: "Rest",
  between: "Ready when you are",
  done: "All sets done",
};

export function SetTimer({ plan, name, onClose }: { plan: RepsPlan; name: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<TimerStep>(() => timerStart(plan));
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const lastTick = useRef<number | null>(null);

  const enter = useCallback(
    (next: TimerStep) => {
      const secs = stepSeconds(plan, next);
      setStep(next);
      setPausedLeft(null);
      // the screen's own clock is brought up to this moment too, or the first
      // frame of a step counts the time the player spent before tapping
      const t = Date.now();
      setNow(t);
      setEndsAt(secs === null ? null : t + secs * 1000);
      lastTick.current = null;
      if (next.phase === "work") cue("go");
      else if (next.phase === "rest" || next.phase === "between") cue("rest");
      else if (next.phase === "done") cue("done");
      if (next.phase !== "ready") feel("drill");
    },
    [plan]
  );

  // The timer starts once for a drill's sets. It is keyed on what the sets
  // ARE (planKey), not on the object: the session behind it redraws with a
  // new object whenever a tick saves, and that must never restart a set.
  const key = planKey(plan);
  const enterRef = useRef(enter);
  enterRef.current = enter;
  const planRef = useRef(plan);
  planRef.current = plan;
  useEffect(() => {
    enterRef.current(timerStart(planRef.current));
  }, [key]);

  useEffect(() => {
    if (endsAt === null || pausedLeft !== null) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [endsAt, pausedLeft]);

  const total = stepSeconds(plan, step);
  const left = pausedLeft ?? (endsAt === null ? null : Math.max(0, (endsAt - now) / 1000));

  useEffect(() => {
    if (left === null || pausedLeft !== null) return;
    const whole = Math.ceil(left);
    if (whole <= 3 && whole >= 1 && lastTick.current !== whole) {
      lastTick.current = whole;
      cue("tick");
    }
    if (left <= 0) enter(timerNext(plan, step));
  }, [left, pausedLeft, enter, plan, step]);

  const waiting = left === null && step.phase !== "done";
  // a rest, and the short count before a set, can always be cut short
  const skip = skipLabel(step);
  const value = total && left !== null ? left / total : step.phase === "done" ? 1 : 0;
  const after =
    step.phase === "work" && step.set < plan.sets
      ? plan.restSec
        ? `Then ${plan.restSec} seconds of rest`
        : "Then the next set when you're ready"
      : step.phase === "rest" || step.phase === "between"
        ? `Next: set ${step.set + 1} of ${plan.sets}`
        : step.phase === "work"
          ? "Last set"
          : step.phase === "ready"
            ? planLine(plan)
            : "";

  return (
    <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(200)} style={[StyleSheet.absoluteFill, styles.wrap]}>
      <View style={{ alignItems: "center", marginTop: insets.top + 60, paddingHorizontal: 24 }}>
        <Head size={24} style={{ textAlign: "center" }} numberOfLines={2}>
          {name}
        </Head>
        <Body dim size={13} style={{ marginTop: 4 }}>
          {`Set ${Math.min(step.set, plan.sets)} of ${plan.sets}`}
        </Body>
      </View>
      <View style={{ alignItems: "center", marginTop: 40 }}>
        <Ring size={300} stroke={14} value={value} animate={false}>
          <Head size={84}>{left === null ? (step.phase === "done" ? "Done" : "Go") : clock(left)}</Head>
          <Eyebrow style={{ marginTop: 4 }}>{WORD[step.phase]}</Eyebrow>
        </Ring>
      </View>
      <View style={styles.sets}>
        {Array.from({ length: plan.sets }, (_, i) => (
          <View
            key={i}
            style={[
              styles.set,
              i + 1 < step.set || step.phase === "done" ? { backgroundColor: color.gold } : null,
              i + 1 === step.set && step.phase !== "done" ? { backgroundColor: color.bone } : null,
            ]}
          />
        ))}
      </View>
      <Body dim style={{ textAlign: "center", marginTop: 20 }}>
        {after}
      </Body>
      <View style={[styles.buttons, { bottom: insets.bottom + 24 }]}>
        {step.phase === "done" ? (
          <Button style={{ flex: 1 }} label="Back to the drill" onPress={onClose} />
        ) : (
          <>
            <Button style={{ flex: 1 }} quiet label="Close" onPress={onClose} />
            {waiting ? (
              <Button
                style={{ flex: 1 }}
                label={step.phase === "work" ? "Set done" : "Start set"}
                onPress={() => enter(timerNext(plan, step))}
              />
            ) : skip ? (
              <Button style={{ flex: 1 }} label={skip} onPress={() => enter(timerNext(plan, step))} />
            ) : (
              <Button
                style={{ flex: 1 }}
                label={pausedLeft !== null ? "Resume" : "Pause"}
                onPress={() => {
                  if (pausedLeft !== null) {
                    const t = Date.now();
                    setNow(t);
                    setEndsAt(t + pausedLeft * 1000);
                    setPausedLeft(null);
                  } else if (left !== null) setPausedLeft(left);
                }}
              />
            )}
          </>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: "#060503", zIndex: 20 },
  sets: { flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 34 },
  set: { width: 46, height: 8, borderRadius: 4, backgroundColor: color.fill2 },
  buttons: { position: "absolute", left: 20, right: 20, flexDirection: "row", gap: 10 },
});
