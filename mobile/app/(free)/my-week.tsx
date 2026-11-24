import { useEffect, useState } from "react";
import { Alert, Share, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { fmtDuration } from "@shared/time-trained";
import { BOARD_EMPTY_LINE, BOARD_TITLE, STAR_LABEL, initialsOf, stripDayLabel } from "@shared/tracker";
import { PRO_ENDED_DISMISS, PRO_ENDED_LINE } from "@shared/one-app";
import { OFFLINE_MESSAGE } from "@/api/client";
import { useMe } from "@/api/queries";
import { hasTrain } from "@/navigation";
import { setPref, usePrefs } from "@/prefs";
import { deleteEntry, refreshFree, useFreeWeek } from "@/api/free";
import { Avatar, MyAvatar, Star } from "@/Avatar";
import { PAGE_TOP, Screen } from "@/Screen";
import { UpgradeCard } from "@/UpgradeCard";
import { Body, Button, Card, Hairline, Head, Label, Press, Ring, Skeleton } from "@/ui";
import { color } from "@/theme";

// Week (the website's /log/week): this week's training against the target
// the player set, the seven days, today's line, what was logged, and the
// board of friends. A day with nothing on it is just a day: nothing here
// counts what was not done, and there is no streak.
//
// The ONE upgrade prompt of the free app sits on this screen, under the
// week (src/UpgradeCard.tsx; lib/elite/upgrade-card.ts decides whether it
// shows). There is none anywhere else.
export default function MyWeek() {
  const router = useRouter();
  const week = useFreeWeek();
  const w = week.data;
  const me = useMe();
  const [prefs] = usePrefs();
  // Strive Pro is on: this is a member, and the one upgrade card is not
  // for them. Strive Pro ended: one calm line, put away with a tap.
  const train = hasTrain(me.data?.state);
  const ended = me.data?.free?.proEnded === true && !prefs.proEndedSeen;
  // Strive Pro is on again: if it ever ends again, the line is said again.
  useEffect(() => {
    if (train && prefs.proEndedSeen) void setPref("proEndedSeen", false);
  }, [train, prefs.proEndedSeen]);
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());

  function remove(id: string) {
    Alert.alert("Delete this entry?", "The time comes off your week.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          void deleteEntry(id)
            .then((r) => {
              if (!r.ok) return;
              setGone((g) => new Set([...g, id]));
              return refreshFree();
            })
            .catch(() => undefined),
      },
    ]);
  }

  if (!w) {
    return (
      <Screen onRefresh={refreshFree}>
        <View style={{ paddingHorizontal: 20, paddingTop: PAGE_TOP }}>
          <Head size={40}>Your week</Head>
        </View>
        {week.isError || week.isPaused ? (
          <View style={{ margin: 20 }}>
            <Body dim>{OFFLINE_MESSAGE}</Body>
            <Button quiet style={{ marginTop: 16 }} label="Try again" busy={week.isFetching} onPress={() => void week.refetch()} />
          </View>
        ) : (
          <View style={{ margin: 20, gap: 14 }}>
            <Skeleton height={150} />
            <Skeleton height={90} />
          </View>
        )}
      </Screen>
    );
  }

  const entries = w.entries.filter((e) => !gone.has(e.id));
  const alone = w.board.length <= 1;
  const invite = () => void Share.share({ url: w.invite }).catch(() => undefined);

  return (
    <Screen onRefresh={refreshFree}>
      <View style={{ paddingHorizontal: 20, paddingTop: PAGE_TOP }}>
        <Head size={40}>Your week</Head>
        <Body dim size={13.5} style={{ marginTop: 6 }}>
          {w.label}
        </Body>
      </View>

      {ended ? (
        <Card style={styles.ended}>
          <Body size={14.5}>{PRO_ENDED_LINE}</Body>
          <Press onPress={() => void setPref("proEndedSeen", true)} style={styles.endedGot} accessibilityLabel={PRO_ENDED_DISMISS}>
            <Label dim size={14}>
              {PRO_ENDED_DISMISS}
            </Label>
          </Press>
        </Card>
      ) : null}

      <View style={styles.ringRow}>
        <Ring size={132} stroke={10} value={w.target > 0 ? w.minutes / w.target : 0}>
          <Head size={28}>{fmtDuration(w.minutes)}</Head>
          <Body dim size={11.5}>{`of ${fmtDuration(w.target)}`}</Body>
        </Ring>
        <View style={{ flex: 1 }}>
          {w.todayLine ? (
            <>
              {w.todayLine.strong ? <Label size={17}>{w.todayLine.strong}</Label> : null}
              {w.todayLine.rest ? (
                <Body dim size={14} style={{ marginTop: 4 }}>
                  {w.todayLine.rest}
                </Body>
              ) : null}
            </>
          ) : null}
          {w.gymLine ? (
            <Body dim size={14} style={{ marginTop: 6 }}>
              {w.gymLine}
            </Body>
          ) : null}
        </View>
      </View>

      <View style={styles.strip}>
        {w.strip.map((d) => (
          <View key={d.day} style={styles.day} accessible accessibilityLabel={stripDayLabel(d)}>
            <Label size={12} style={{ color: d.today ? color.bone : color.faint }}>
              {d.letter}
            </Label>
            <View style={[styles.mark, d.trained ? styles.trained : d.planned ? styles.planned : null]} />
          </View>
        ))}
      </View>
      <View style={styles.planRow}>
        <Body dim size={13.5} style={{ flex: 1 }}>
          {w.splitLine ?? ""}
        </Body>
        <Press onPress={() => router.push("/week-plan")} style={{ minHeight: 44, justifyContent: "center" }} accessibilityLabel="Change your target and days">
          <Label dim size={14}>
            Change
          </Label>
        </Press>
      </View>

      <UpgradeCard place="week" member={train} area={w.upgrade.area} sessions={w.upgrade.sessions} />

      <View style={{ marginHorizontal: 20, marginTop: 26 }}>
        <Label size={17}>{BOARD_TITLE}</Label>
        <Card style={{ marginTop: 10, padding: 0 }}>
          {w.board.map((r, i) => (
            <View key={r.id}>
              {i > 0 ? <Hairline /> : null}
              <View style={styles.row} accessible accessibilityLabel={`${r.place}. ${r.me ? "You" : r.name}${r.starred ? `, ${STAR_LABEL}` : ""}. ${r.time}`}>
                <Label dim size={14} style={{ width: 22 }}>
                  {r.place}
                </Label>
                {r.me ? <MyAvatar uri={r.photo} initials={initialsOf(r.name)} size={36} /> : <Avatar uri={r.photo} initials={initialsOf(r.name)} size={36} />}
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Label numberOfLines={1} style={{ color: r.me ? color.bone : color.dim }}>
                    {r.me ? "You" : r.name}
                  </Label>
                  {r.starred ? <Star /> : null}
                </View>
                <Label>{r.time}</Label>
              </View>
            </View>
          ))}
        </Card>
        {alone ? (
          <>
            <Body dim size={13.5} style={{ marginTop: 10 }}>
              {BOARD_EMPTY_LINE}
            </Body>
            <Button quiet style={{ marginTop: 12 }} label="Send my link" onPress={invite} />
          </>
        ) : null}
      </View>

      {entries.length ? (
        <View style={{ marginHorizontal: 20, marginTop: 26 }}>
          <Label size={17}>Logged this week</Label>
          <Card style={{ marginTop: 10, padding: 0 }}>
            {entries.map((e, i) => (
              <View key={e.id}>
                {i > 0 ? <Hairline /> : null}
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Label>{e.label}</Label>
                    <Body dim size={12.5}>
                      {[e.kind === "gym" ? "Gym" : "Training", e.photo ? "posted" : null].filter(Boolean).join(", ")}
                    </Body>
                  </View>
                  <Label>{fmtDuration(e.minutes)}</Label>
                  <Press onPress={() => remove(e.id)} style={{ minHeight: 44, minWidth: 44, alignItems: "flex-end", justifyContent: "center" }} accessibilityLabel={`Delete ${e.label}, ${fmtDuration(e.minutes)}`}>
                    <Label dim size={13}>
                      Delete
                    </Label>
                  </Press>
                </View>
              </View>
            ))}
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  ringRow: { flexDirection: "row", alignItems: "center", gap: 18, marginHorizontal: 20, marginTop: 22 },
  strip: { flexDirection: "row", marginHorizontal: 20, marginTop: 22 },
  day: { flex: 1, alignItems: "center", gap: 8 },
  mark: { width: 22, height: 22, borderRadius: 11, backgroundColor: color.fill2 },
  planned: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: "rgba(242,239,232,0.45)" },
  trained: { backgroundColor: color.gold },
  planRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginTop: 8 },
  ended: { marginHorizontal: 20, marginTop: 18, padding: 16 },
  endedGot: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start", marginTop: 4 },
  row: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16 },
});
