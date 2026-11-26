import { StyleSheet, View } from "react-native";
import { recapDue, type WeekRecap } from "@shared/week-recap";
import { setPref, usePrefs } from "@/prefs";
import { Star } from "@/Avatar";
import { Body, Card, Label, Press } from "@/ui";
import { color } from "@/theme";

// The Monday moment (lib/elite/week-recap.ts): last week in a few lines,
// at the top of Week. The server decides what is said (and sends nothing
// for a week with nothing in it); this phone only remembers, per week,
// that "Got it" was tapped, so the card shows once a week and is gone for
// good once put away. Next week brings its own card. No notification.
export function MondayCard({ recap, onDismiss }: { recap: WeekRecap | null | undefined; onDismiss?: (recap: WeekRecap) => void }) {
  const [prefs] = usePrefs();
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
          // earned: the small gold mark, never a gold button
          <View style={styles.best}>
            <Star size={14} />
            <Label size={14.5} style={{ color: color.gold }}>
              {recap.best}
            </Label>
          </View>
        ) : null}
      </View>
      <Press
        onPress={() => {
          void setPref("recapSeen", recap.week);
          onDismiss?.(recap);
        }}
        style={styles.got}
        accessibilityLabel={recap.dismiss}
      >
        <Label dim size={14}>
          {recap.dismiss}
        </Label>
      </Press>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, marginTop: 18, padding: 16 },
  best: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  got: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start", marginTop: 4 },
});
