import { StyleSheet, View } from "react-native";
import type { NoticePrefs } from "@shared/notice-prefs";
import { REMINDER_ROW_LABEL } from "@shared/notice-prefs";
import { useNoticePrefs, useSaveNoticePrefs } from "@/api/queries";
import { Body, Hairline, Label, Press, SettingRow } from "@/ui";
import { color } from "@/theme";
import { tick } from "@/feel";

// What this person may be told about, as their own choices (the shape is
// lib/elite/notice-prefs.ts, the same one the website's Account page
// draws): one switch per kind of notification the account can get, and for
// a member the time of the one daily reminder. Every tap saves at once.
//
// A switch that is off stops that kind of notification on every phone the
// account uses. The note itself is still kept in the Inbox.
//
// Draws nothing while the choices cannot be read or stored (before
// migration 088, or with no connection).
export function NoticeChoices({ children }: { children: (rows: React.ReactNode) => React.ReactNode }) {
  const prefs = useNoticePrefs();
  const save = useSaveNoticePrefs();
  const p = prefs.data;
  if (!p || (p.topics.length === 0 && !p.reminder)) return null;

  return children(
    <>
      {p.topics.map((t, i) => (
        <View key={t.key}>
          {i > 0 ? <Hairline /> : null}
          <SettingRow label={t.label} detail={t.detail} value={t.on} onValue={(on) => save.mutate({ topic: t.key, on })} />
        </View>
      ))}
      {p.reminder ? (
        <>
          {p.topics.length > 0 ? <Hairline /> : null}
          <View style={styles.reminder}>
            <Label>{REMINDER_ROW_LABEL}</Label>
            <Body dim size={13} style={{ marginTop: 2 }}>
              {p.reminder.question}
            </Body>
            <ReminderChips choices={p.reminder.choices} chosen={p.reminder.chosen} onPick={(key) => save.mutate({ reminder: key })} />
          </View>
        </>
      ) : null}
      {save.isError ? (
        <Body size={13} style={{ color: color.danger, paddingHorizontal: 16, paddingBottom: 14 }}>
          That could not be saved. Try again in a minute.
        </Body>
      ) : null}
    </>
  );
}

type Choice = NonNullable<NoticePrefs["reminder"]>["choices"][number];

// The four answers to "When do you usually train?", one tap each. In
// Settings, and on the finish screen right after a yes to notifications.
export function ReminderChips({
  choices,
  chosen,
  onPick,
  disabled,
}: {
  choices: readonly Choice[];
  chosen: string | null;
  onPick: (key: Choice["key"]) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.chips}>
      {choices.map((c) => {
        const on = chosen === c.key;
        return (
          <Press
            key={c.key}
            disabled={disabled}
            onPress={() => {
              tick();
              onPick(c.key);
            }}
            accessibilityLabel={c.label}
            accessibilityState={{ selected: on }}
            style={[styles.chip, on ? styles.chipOn : null]}
          >
            <Label size={14} style={on ? { color: color.black } : null}>
              {c.label}
            </Label>
          </Press>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  reminder: { paddingHorizontal: 16, paddingVertical: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  // two to a row, each at least 44 tall
  chip: {
    flexGrow: 1,
    flexBasis: "46%",
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.fill2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  chipOn: { backgroundColor: color.bone, borderColor: color.bone },
});
