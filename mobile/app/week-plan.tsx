import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fmtDuration } from "@shared/time-trained";
import { DAY_NAMES, DAY_SHORT, TARGET_MAX, TARGET_MIN, splitLine, stepTarget } from "@shared/tracker";
import { useMe } from "@/api/queries";
import { ApiError, OFFLINE_MESSAGE } from "@/api/client";
import { freeKeys, refreshFree, rereadMe, savePlan, usePlan } from "@/api/free";
import { queryClient } from "@/api/queryClient";
import { tick } from "@/feel";
import { Body, Button, Eyebrow, Head, Icon, Label, Press, Skeleton } from "@/ui";
import { useBelowClock } from "@/Screen";
import { color } from "@/theme";

// Your week: how much training on your own to aim for, and the days you
// train. It opens after the offer the first time (saving it is what opens
// the free app), and again from the Week tab to change either.
//
// The target starts at what we recommend for the season the quiz gave
// (the coaches' own table, on the server); the player can move it. A day
// that is not picked is not a day missed: nothing here or after it counts
// what was not done.
export default function WeekPlan() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const belowClock = useBelowClock();
  const me = useMe();
  const plan = usePlan();
  const first = me.data?.state.kind === "free" && me.data.state.stage === "offer";
  const [target, setTarget] = useState<number | null>(null);
  const [days, setDays] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // What is set now (or the recommendation), once it is read.
  const loaded = plan.data;
  useEffect(() => {
    if (!loaded || target !== null) return;
    setTarget(loaded.target ?? loaded.recommended);
    setDays(loaded.days);
  }, [loaded, target]);

  function toggle(day: number) {
    tick();
    setDays((d) => (d.includes(day) ? d.filter((x) => x !== day) : [...d, day].sort((x, y) => x - y)));
  }

  async function save() {
    if (target === null) return;
    setError(null);
    setBusy(true);
    try {
      const res = await savePlan(target, days);
      if (!res.ok) return setError(res.error ?? "That did not save. Try again.");
      await queryClient.invalidateQueries({ queryKey: freeKeys.plan });
      await refreshFree();
      if (first) await rereadMe();
      else router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : OFFLINE_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  const split = target !== null ? splitLine(target, days.length) : null;

  return (
    <View style={{ flex: 1, backgroundColor: color.black }}>
      <ScrollView
        style={[{ flex: 1 }, belowClock]}
        contentContainerStyle={{ paddingTop: 8, paddingHorizontal: 24, paddingBottom: 24 }}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
      >
        <Press onPress={() => router.back()} style={{ width: 44, height: 44, justifyContent: "center" }} accessibilityLabel="Back">
          <Icon name="back" />
        </Press>
        <Eyebrow style={{ marginTop: 14 }}>Your week</Eyebrow>
        <Head size={36} style={{ marginTop: 10 }}>
          How much will you train on your own?
        </Head>
        {loaded ? (
          <Body dim style={{ marginTop: 10 }}>
            {loaded.line}
          </Body>
        ) : null}

        {target === null ? (
          <Skeleton height={96} style={{ marginTop: 24 }} />
        ) : (
          <View style={styles.stepper}>
            <Press
              style={styles.step}
              disabled={target <= TARGET_MIN}
              onPress={() => {
                tick();
                setTarget(stepTarget(target, -1));
              }}
              accessibilityLabel="Less"
            >
              <View style={styles.minus} />
            </Press>
            <View style={{ flex: 1, alignItems: "center" }} accessible accessibilityLabel={`${fmtDuration(target)} a week`}>
              <Head size={48}>{fmtDuration(target)}</Head>
              <Body dim size={13}>a week</Body>
            </View>
            <Press
              style={styles.step}
              disabled={target >= TARGET_MAX}
              onPress={() => {
                tick();
                setTarget(stepTarget(target, 1));
              }}
              accessibilityLabel="More"
            >
              <Icon name="plus" />
            </Press>
          </View>
        )}

        <Head size={24} style={{ marginTop: 32 }}>
          Which days do you train?
        </Head>
        <View style={styles.days}>
          {DAY_SHORT.map((d, i) => {
            const on = days.includes(i);
            return (
              <Press
                key={DAY_NAMES[i]}
                style={[styles.day, on ? styles.dayOn : null]}
                onPress={() => toggle(i)}
                accessibilityLabel={DAY_NAMES[i]}
                accessibilityState={{ selected: on }}
              >
                <Label size={13} style={{ color: on ? color.black : color.bone }}>
                  {d}
                </Label>
              </Press>
            );
          })}
        </View>
        {split ? (
          <Body dim style={{ marginTop: 14 }}>
            {split}
          </Body>
        ) : null}
        {plan.isError && !loaded ? (
          <View style={{ marginTop: 20 }}>
            <Body dim>{OFFLINE_MESSAGE}</Body>
            <Button quiet style={{ marginTop: 12 }} label="Try again" busy={plan.isFetching} onPress={() => void plan.refetch()} />
          </View>
        ) : null}
      </ScrollView>
      <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: insets.bottom + 16 }}>
        {error ? (
          <Body size={13.5} style={{ color: color.danger, marginBottom: 10 }}>
            {error}
          </Body>
        ) : null}
        <Button label={first ? "Start my week" : "Save"} busy={busy} disabled={target === null || days.length === 0} onPress={() => void save()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: "row", alignItems: "center", marginTop: 24, minHeight: 96, borderRadius: 22, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line, paddingHorizontal: 10 },
  step: { width: 60, height: 60, borderRadius: 30, backgroundColor: color.fill2, alignItems: "center", justifyContent: "center" },
  minus: { width: 16, height: 2, borderRadius: 1, backgroundColor: color.bone },
  days: { flexDirection: "row", gap: 6, marginTop: 16 },
  day: { flex: 1, minHeight: 52, borderRadius: 14, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line, alignItems: "center", justifyContent: "center" },
  dayOn: { backgroundColor: color.bone, borderColor: color.bone },
});
