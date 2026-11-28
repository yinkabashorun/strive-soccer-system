import { StyleSheet, View } from "react-native";
import { recapDue, weekCardDue, weekCardLines, type WeekCard, type WeekRecap } from "@shared/week-recap";
import { setPref, usePrefs } from "@/prefs";
import { Star } from "@/Avatar";
import { Body, Card, Label, Press } from "@/ui";
import { color } from "@/theme";

// The week's card (lib/elite/week-recap.ts weekCard): Sunday from noon New
// York about the week so far, and Monday about the week closed, at the top
// of Week. The server decides what is said and when (and sends nothing for
// a week with nothing in it); this phone only remembers, per week the card
// is about, that "Got it" was tapped, so one tap covers Sunday's card and
// Monday's. No notification.
//
// A server from before the week's card sends only `recap` (the Monday
// moment): then that card is drawn as it always was.
export function MondayCard({
  card,
  recap,
  onDismiss,
}: {
  card?: WeekCard | null;
  recap?: WeekRecap | null;
  onDismiss?: (best: boolean) => void;
}) {
  const [prefs] = usePrefs();
  if (card !== undefined) {
    if (!card || !weekCardDue(card, prefs.recapSeen)) return null;
    return (
      <Card style={styles.card}>
        <View accessible accessibilityLabel={weekCardLines(card).join(" ")}>
          {card.best ? (
            // earned: the small gold mark, never a gold button
            <View style={styles.bestRow}>
              <Star size={14} />
              <Label size={17} style={{ color: color.gold }}>
                {card.headline}
              </Label>
            </View>
          ) : (
            <Label size={17}>{card.headline}</Label>
          )}
          {card.gym ? (
            <Body dim size={14} style={{ marginTop: 4 }}>
              {card.gym}
            </Body>
          ) : null}
          {card.friends ? (
            <Body size={14.5} style={{ marginTop: 6 }}>
              {card.friends}
            </Body>
          ) : null}
          <Label size={14.5} style={{ marginTop: 6 }}>
            {card.close}
          </Label>
        </View>
        <GotIt
          label={card.dismiss}
          onPress={() => {
            void setPref("recapSeen", card.week);
            onDismiss?.(card.best);
          }}
        />
      </Card>
    );
  }
  if (!recap || !recapDue(recap, prefs.recapSeen)) return null;
  const said = [recap.trained, recap.gym, recap.place, recap.best].filter(Boolean).join(" ");
  return (
    <Card style={styles.card}>
      <View accessible accessibilityLabel={said}>
        <Label size={17}>{recap.trained}</Label>
        {recap.gym ? (
          <Body dim size={14} style={{ marginTop: 4 }}>
            {recap.gym}
          </Body>
        ) : null}
        {recap.place ? (
          <Body size={14.5} style={{ marginTop: 6 }}>
            {recap.place}
          </Body>
        ) : null}
        {recap.best ? (
          <View style={styles.best}>
            <Star size={14} />
            <Label size={14.5} style={{ color: color.gold }}>
              {recap.best}
            </Label>
          </View>
        ) : null}
      </View>
      <GotIt
        label={recap.dismiss}
        onPress={() => {
          void setPref("recapSeen", recap.week);
          onDismiss?.(Boolean(recap.best));
        }}
      />
    </Card>
  );
}

function GotIt({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} style={styles.got} accessibilityLabel={label}>
      <Label dim size={14}>
        {label}
      </Label>
    </Press>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, marginTop: 18, padding: 16 },
  best: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  bestRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  got: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start", marginTop: 4 },
});
