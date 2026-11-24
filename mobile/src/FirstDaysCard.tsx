import { StyleSheet, View } from "react-native";
import { FIRST_DAYS_HIDE, type FirstDays, type FirstStep } from "@shared/first-days";
import { usePrefs } from "@/prefs";
import { Card, Disc, Head, Icon, Label, Press } from "@/ui";
import { color } from "@/theme";

// Your first days (lib/elite/first-days.ts): four things a new player does
// once, each one tap from here. A done row turns gold and stays (gold is
// for what was earned). The list is gone when all four are done or the
// first days are over; "Hide this list" puts it away on this phone.
export function FirstDaysCard({
  list,
  onPost,
  onInvite,
  onClubs,
}: {
  list: FirstDays;
  onPost: () => void;
  onInvite: () => void;
  onClubs: () => void;
}) {
  const [prefs, setPref] = usePrefs();
  if (prefs.firstDaysHidden) return null;
  const go: Record<FirstStep["key"], (() => void) | null> = { post: onPost, friends: onInvite, club: onClubs, props: null };

  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <Head size={20}>{list.title}</Head>
        <Label size={13} dim>{`${list.done} of ${list.total}`}</Label>
      </View>
      {list.steps.map((s) => {
        const onPress = s.done ? null : go[s.key];
        const row = (
          <View style={styles.row}>
            {s.done ? (
              <Disc size={28} earned>
                <Icon name="check" size={13} stroke="#1a1408" />
              </Disc>
            ) : (
              <View style={styles.open} />
            )}
            <Label size={15} style={{ flex: 1, color: s.done ? color.dim : color.bone }}>
              {s.label}
            </Label>
            {!s.done && s.note ? (
              <Label size={13} dim>
                {s.note}
              </Label>
            ) : null}
            {onPress ? <Icon name="chevron" size={16} stroke={color.faint} /> : null}
          </View>
        );
        const label = `${s.label}${s.done ? ", done" : s.note ? `, ${s.note}` : ""}`;
        return onPress ? (
          <Press key={s.key} onPress={onPress} accessibilityLabel={label}>
            {row}
          </Press>
        ) : (
          <View key={s.key} accessible accessibilityLabel={label}>
            {row}
          </View>
        );
      })}
      <Press onPress={() => setPref("firstDaysHidden", true)} accessibilityLabel={FIRST_DAYS_HIDE} style={styles.hide}>
        <Label size={13} dim>
          {FIRST_DAYS_HIDE}
        </Label>
      </Press>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 14, marginTop: 16, paddingTop: 16, paddingBottom: 2 },
  top: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 4 },
  row: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  open: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: "rgba(242,239,232,0.3)" },
  hide: { minHeight: 44, alignItems: "center", justifyContent: "center" },
});
