import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import type { PlanCard } from "@shared/app-contract";
import { PLAN_REPORT_REASONS, inCountLine, organizedBy, planLabel, planScore, planSides } from "@shared/club-teams";
import { fmtDuration } from "@shared/time-trained";
import { ApiError, OFFLINE_MESSAGE } from "./api/client";
import { cancelPlan, refreshClubs, reportPlan, setImIn } from "./api/clubs";
import { Crest } from "./Crest";
import { feel } from "./feel";
import { withPlayTerms } from "./play-terms";
import { choose } from "./sheet";
import { Body, Card, Eyebrow, Head, Label, Press } from "./ui";
import { color } from "./theme";

// One session or game on a club's page (the website's PlanCardView): what
// it is, when and where, who organized it ("Organized by" a club, never
// Strive), who is in, and one button, "I'm in".
//
// The names are the server's: only players in for the viewer's own club,
// never across a block; everyone else is a count. A first "I'm in" shows
// the one-time player sheet (src/play-terms.ts) and goes in after the tap.
// The three dots report it (the place, or anything else wrong with it),
// and let a captain call it off before it starts.
export function PlanCardView({ card, clubId }: { card: PlanCard; clubId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imIn, setIn] = useState(card.imIn);
  const [gone, setGone] = useState<string | null>(null);
  const { ours, theirs } = planSides(card, clubId);
  const score = planScore(card, clubId);

  async function act(run: () => Promise<{ ok: boolean; error?: string; declined?: boolean }>, done: () => void) {
    setError(null);
    setBusy(true);
    try {
      const res = await run();
      if (res.ok) {
        done();
        void refreshClubs();
      } else if (!res.declined) setError(res.error ?? "That didn't go through. Try again.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : OFFLINE_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  const toggle = () =>
    void act(
      () => withPlayTerms(() => setImIn(card.id, !imIn)),
      () => {
        if (!imIn) feel("drill");
        setIn(!imIn);
      }
    );

  function more() {
    choose({
      choices: [
        {
          label: card.kind === "game" ? "Report this game" : "Report this session",
          destructive: true,
          run: () =>
            choose({
              title: "What is wrong with it?",
              message: "A coach looks at it. Nobody is told who reported it.",
              choices: PLAN_REPORT_REASONS.map((r) => ({
                label: r.label,
                run: () => void act(() => reportPlan(card.id, r.id), () => setGone("Sent to the coaches. Thank you.")),
              })),
            }),
        },
        ...(card.canCancel
          ? [
              {
                label: "Call it off",
                destructive: true,
                run: () =>
                  Alert.alert("Call it off?", "It comes off the calendar for everyone in it.", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Call it off", style: "destructive", onPress: () => void act(() => cancelPlan(card.id), () => setGone("Called off.")) },
                  ]),
              },
            ]
          : []),
      ],
    });
  }

  if (gone) {
    return (
      <Card style={styles.card}>
        <Body dim>{gone}</Body>
      </Card>
    );
  }

  const what = card.kind === "training" ? card.title ?? "Club training" : theirs ? `${ours.name} against ${theirs.name}` : ours.name;
  const count = inCountLine(card.ins + (imIn && !card.imIn ? 1 : !imIn && card.imIn ? -1 : 0));
  const names = imIn === card.imIn ? card.names : imIn ? ["You", ...card.names] : card.names.filter((n) => n !== "You");
  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <Eyebrow gold={false} style={{ flex: 1 }}>
          {planLabel(card)}
        </Eyebrow>
        <Press onPress={more} style={styles.more} accessibilityLabel={`${what}: more`}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </Press>
      </View>
      {card.kind === "training" || !theirs ? (
        <Head size={26}>{card.title ?? "Club training"}</Head>
      ) : (
        <View style={styles.versus} accessible accessibilityLabel={score ? `${ours.name} ${score[0]}, ${theirs.name} ${score[1]}` : what}>
          <View style={styles.side}>
            <Crest club={ours} size={36} />
            <Label size={14} numberOfLines={2} style={{ flex: 1 }}>
              {ours.name}
            </Label>
          </View>
          {score ? <Head size={26}>{`${score[0]} - ${score[1]}`}</Head> : <Label dim size={13}>VS</Label>}
          <View style={[styles.side, { justifyContent: "flex-end" }]}>
            <Label size={14} numberOfLines={2} style={{ flex: 1, textAlign: "right" }}>
              {theirs.name}
            </Label>
            <Crest club={theirs} size={36} />
          </View>
        </View>
      )}
      <Label size={15} style={{ marginTop: 10 }}>
        {card.when}
      </Label>
      <Body dim size={14} style={{ marginTop: 2 }}>
        {`${card.place} · ${fmtDuration(card.minutes)}`}
      </Body>
      <Body dim size={12.5} style={{ marginTop: 4 }}>
        {organizedBy(card.organizer.name)}
      </Body>
      {card.result?.line ? (
        <Body size={13.5} style={{ marginTop: 6 }}>
          {card.result.line}
        </Body>
      ) : null}
      {card.status === "on" && !card.result ? (
        <View style={styles.bottom}>
          <View style={{ flex: 1 }}>
            <Label size={14}>{count}</Label>
            {names.length ? (
              <Body dim size={13} numberOfLines={2}>
                {names.join(", ")}
              </Body>
            ) : null}
          </View>
          {card.canJoin ? (
            <Press
              onPress={toggle}
              disabled={busy}
              style={[styles.in, imIn ? styles.inOn : null]}
              accessibilityLabel={imIn ? "You're in" : "I'm in"}
              accessibilityState={{ selected: imIn, busy }}
            >
              <Label size={15} style={{ color: imIn ? color.bone : color.black }}>
                {imIn ? "You're in" : "I'm in"}
              </Label>
            </Press>
          ) : null}
        </View>
      ) : null}
      {error ? (
        <Body size={13.5} style={{ color: color.danger, marginTop: 8 }}>
          {error}
        </Body>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 14, marginTop: 10 },
  top: { flexDirection: "row", alignItems: "center", minHeight: 30 },
  more: { width: 44, height: 44, marginRight: -12, marginTop: -8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3.5 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: color.dim },
  versus: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  side: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  bottom: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 },
  in: { minHeight: 48, minWidth: 104, paddingHorizontal: 22, borderRadius: 16, backgroundColor: color.bone, alignItems: "center", justifyContent: "center" },
  inOn: { backgroundColor: "transparent", borderWidth: 1, borderColor: "rgba(242,239,232,0.3)" },
});
