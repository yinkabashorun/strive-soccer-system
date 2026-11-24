import { useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { planDays } from "@shared/club-app";
import {
  PLACE_HINT,
  PLACE_MAX,
  PLAN_MINUTES,
  PLAN_MINUTES_DEFAULT,
  PLAN_TIMES,
  PLAN_TIME_DEFAULT,
  PLAN_TITLE_MAX,
  organizedBy,
  timeLabel,
} from "@shared/club-teams";
import { fmtDuration } from "@shared/time-trained";
import { dayLabel } from "@shared/tracker";
import { ApiError, OFFLINE_MESSAGE } from "@/api/client";
import { planGame, planTraining, refreshClubs, useClub, useClubNear } from "@/api/clubs";
import { feel, tick } from "@/feel";
import { FormScreen } from "@/FormScreen";
import { withPlayTerms } from "@/play-terms";
import { Body, Button, Eyebrow, Head, Icon, Label, Press, Skeleton } from "@/ui";
import { color, font } from "@/theme";

// Plan, the captain only: a training session for the club (members only),
// or, opened from Clubs near you with a club picked, a game sent to that
// club, which its captain accepts or passes.
//
// The club organizes it, never Strive: the first time, the one-time
// organizer sheet is shown and recorded (src/play-terms.ts). The day is
// one of the next fourteen from the SERVER's day in New York, the time is
// on the half hour, and the place is typed: a public field or park. The
// server refuses anything that looks like a street address, and says so.
export default function Plan() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, vs } = useLocalSearchParams<{ id: string; vs?: string }>();
  const club = useClub(id);
  const near = useClubNear(vs ? id : undefined);
  const c = club.data;
  const other = vs ? near.data?.rows.find((r) => r.id === vs) ?? null : null;
  const game = Boolean(vs);

  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string>(PLAN_TIME_DEFAULT);
  const [minutes, setMinutes] = useState<number>(PLAN_MINUTES_DEFAULT);
  const [place, setPlace] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const days = c ? planDays(c.today) : [];
  // tomorrow to start with, as the website's form does
  const picked = day ?? days[1] ?? days[0] ?? null;
  const at = PLAN_TIMES.indexOf(time);
  const stepTime = (by: number) => {
    tick();
    setTime(PLAN_TIMES[Math.max(0, Math.min(PLAN_TIMES.length - 1, at + by))]);
  };

  async function send() {
    if (!c || !picked) return;
    if (game && !vs) return;
    setError(null);
    setBusy(true);
    try {
      const input = { day: picked, time, minutes, place, ...(game ? {} : { title }) };
      const res = await withPlayTerms(() => (game ? planGame(c.id, vs!, input) : planTraining(c.id, input)));
      if (res.ok) {
        feel("drill");
        await refreshClubs();
        if (game) setSent(true);
        else router.back();
      } else if (!res.declined) setError(res.error ?? "That did not go through. Try again.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : OFFLINE_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  const back = (
    <Press onPress={() => router.back()} style={{ width: 44, height: 44, justifyContent: "center" }} accessibilityLabel="Back">
      <Icon name="back" />
    </Press>
  );

  if (sent && other) {
    return (
      <FormScreen safeTop contentStyle={{ paddingTop: 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}>
        {back}
        <Eyebrow style={{ marginTop: 14 }}>Sent</Eyebrow>
        <Head size={36} style={{ marginTop: 10 }}>{`Your game is with ${other.name}'s captain`}</Head>
        <Body dim style={{ marginTop: 12 }}>
          {`${other.name}'s captain accepts or passes. Until then only your club sees it. When the captain accepts, both clubs see it and can say they are in.`}
        </Body>
        <Button style={{ marginTop: 24 }} label="Done" onPress={() => router.back()} />
      </FormScreen>
    );
  }

  return (
    <FormScreen safeTop contentStyle={{ paddingTop: 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}>
      {back}
      <Eyebrow style={{ marginTop: 14 }}>{game ? "Plan a game" : "Plan a session"}</Eyebrow>
      <Head size={36} style={{ marginTop: 10 }}>
        {game ? (other ? `Game against ${other.name}` : "Game against a club") : "Club training"}
      </Head>
      {!c ? (
        club.isError || club.isPaused ? (
          <View style={{ marginTop: 20 }}>
            <Body dim>{OFFLINE_MESSAGE}</Body>
            <Button quiet style={{ marginTop: 12 }} label="Try again" busy={club.isFetching} onPress={() => void club.refetch()} />
          </View>
        ) : (
          <Skeleton height={260} style={{ marginTop: 20 }} />
        )
      ) : (
        <>
          <Label dim size={13} style={styles.label}>
            Day
          </Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginHorizontal: -20 }} contentContainerStyle={styles.days}>
            {days.map((d, i) => {
              const on = d === picked;
              const [weekday, date] = dayLabel(d).split(", ");
              return (
                <Press
                  key={d}
                  onPress={() => {
                    tick();
                    setDay(d);
                  }}
                  style={[styles.day, on ? styles.on : null]}
                  accessibilityLabel={i === 0 ? `Today, ${dayLabel(d)}` : dayLabel(d)}
                  accessibilityState={{ selected: on }}
                >
                  <Label size={13} style={{ color: on ? color.black : color.dim }}>
                    {i === 0 ? "Today" : weekday}
                  </Label>
                  <Label size={15} style={{ color: on ? color.black : color.bone, marginTop: 2 }}>
                    {date}
                  </Label>
                </Press>
              );
            })}
          </ScrollView>

          <Label dim size={13} style={styles.label}>
            Starts
          </Label>
          <View style={styles.stepper}>
            <Press style={styles.step} disabled={at <= 0} onPress={() => stepTime(-1)} accessibilityLabel="Earlier">
              <View style={styles.minus} />
            </Press>
            <View style={{ flex: 1, alignItems: "center" }} accessible accessibilityLabel={`Starts at ${timeLabel(time)}, New York time`}>
              <Head size={34}>{timeLabel(time)}</Head>
            </View>
            <Press style={styles.step} disabled={at >= PLAN_TIMES.length - 1} onPress={() => stepTime(1)} accessibilityLabel="Later">
              <Icon name="plus" />
            </Press>
          </View>

          <Label dim size={13} style={styles.label}>
            How long
          </Label>
          <View style={styles.lengths}>
            {PLAN_MINUTES.map((m) => {
              const on = m === minutes;
              return (
                <Press
                  key={m}
                  onPress={() => {
                    tick();
                    setMinutes(m);
                  }}
                  style={[styles.length, on ? styles.on : null]}
                  accessibilityLabel={fmtDuration(m)}
                  accessibilityState={{ selected: on }}
                >
                  <Label size={14} style={{ color: on ? color.black : color.bone }}>
                    {fmtDuration(m)}
                  </Label>
                </Press>
              );
            })}
          </View>

          <Label dim size={13} style={styles.label}>
            Where
          </Label>
          <TextInput
            style={styles.input}
            value={place}
            onChangeText={(t) => setPlace(t.slice(0, PLACE_MAX))}
            maxLength={PLACE_MAX}
            placeholder="The field or park, and its town"
            placeholderTextColor={color.faint}
            autoCapitalize="words"
            returnKeyType="done"
            accessibilityLabel="Where: the field or park, and its town"
          />
          <Body dim size={12.5} style={{ marginTop: 6 }}>
            {PLACE_HINT}
          </Body>

          {game ? null : (
            <TextInput
              style={[styles.input, { marginTop: 14 }]}
              value={title}
              onChangeText={(t) => setTitle(t.slice(0, PLAN_TITLE_MAX))}
              maxLength={PLAN_TITLE_MAX}
              placeholder="Give it a name (you can leave this out)"
              placeholderTextColor={color.faint}
              returnKeyType="done"
              accessibilityLabel="A name for the session, if you want one"
            />
          )}

          <Body dim size={13} style={{ marginTop: 18 }}>
            {`${organizedBy(c.name)}. ${game ? "The other club's captain accepts or passes." : "Only your club's members see it."}`}
          </Body>
          {error ? (
            <Body size={13.5} style={{ color: color.danger, marginTop: 12 }}>
              {error}
            </Body>
          ) : null}
          <Button style={{ marginTop: 16 }} label={game ? "Send the game" : "Plan it"} busy={busy} disabled={!place.trim() || !picked} onPress={() => void send()} />
        </>
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 24, marginBottom: 8, marginLeft: 2 },
  days: { paddingHorizontal: 20, gap: 8 },
  day: { minWidth: 66, minHeight: 60, borderRadius: 14, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  on: { backgroundColor: color.bone, borderColor: color.bone },
  stepper: { flexDirection: "row", alignItems: "center", minHeight: 76, borderRadius: 22, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line, paddingHorizontal: 10 },
  step: { width: 52, height: 52, borderRadius: 26, backgroundColor: color.fill2, alignItems: "center", justifyContent: "center" },
  minus: { width: 16, height: 2, borderRadius: 1, backgroundColor: color.bone },
  lengths: { flexDirection: "row", gap: 6 },
  length: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line, alignItems: "center", justifyContent: "center" },
  input: { minHeight: 56, borderRadius: 16, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line, paddingHorizontal: 16, color: color.bone, fontFamily: font.body, fontSize: 16 },
});
