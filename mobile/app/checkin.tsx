import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCheckin, useMe } from "@/api/queries";
import { ApiError } from "@/api/client";
import { feel, tick } from "@/feel";
import { FormScreen } from "@/FormScreen";
import { LabeledField } from "@/LabeledField";
import { Body, Button, Head, Label, Press } from "@/ui";
import { color, font } from "@/theme";

// The weekly check-in that shapes the next week (the website's own action).
export default function Checkin() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const save = useCheckin();
  const [rating, setRating] = useState(0);
  const [energy, setEnergy] = useState(0);
  const [wentWell, setWentWell] = useState("");
  const [struggled, setStruggled] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function send() {
    setError(null);
    try {
      await save.mutateAsync({ rating, energy, went_well: wentWell, struggled, note });
      feel("drill");
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save. Try again.");
    }
  }

  if (done) {
    return (
      <View style={[styles.fill, { padding: 24, justifyContent: "center" }]}>
        <Head size={34}>Thanks, {me.data?.viewer.firstName ?? ""}.</Head>
        <Body dim style={{ marginTop: 10 }}>
          Next week is built from this and how your training went.
        </Body>
        <Button style={{ marginTop: 22 }} label="Done" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <FormScreen contentStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
        <Head size={32}>Weekly check-in</Head>
        <Body dim style={{ marginTop: 6 }}>
          A minute. It shapes next week.
        </Body>
        <Scale label="How did the week go?" value={rating} onChange={setRating} />
        <Scale label="Energy this week" value={energy} onChange={setEnergy} />
        <Field label="What went well" value={wentWell} onChange={setWentWell} />
        <Field label="What was hard" value={struggled} onChange={setStruggled} />
        <Field label="Anything else" value={note} onChange={setNote} />
        {error ? <Body style={{ color: color.danger, marginTop: 12 }}>{error}</Body> : null}
        <Button style={{ marginTop: 22 }} label="Send" busy={save.isPending} onPress={send} />
    </FormScreen>
  );
}

function Scale({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ marginTop: 22 }}>
      <Label dim size={14}>{label}</Label>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Press
            key={n}
            onPress={() => {
              tick();
              onChange(n);
            }}
            style={[styles.dot, value === n ? styles.dotOn : null]}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === n }}
            accessibilityLabel={`${label} ${n} of 5`}
          >
            <Head size={18} style={{ color: value === n ? color.black : color.dim }}>{String(n)}</Head>
          </Press>
        ))}
      </View>
    </View>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <LabeledField style={{ marginTop: 18 }} label={label} labelSize={14} gap={0} inputStyle={styles.input} value={value} onChangeText={onChange} multiline />;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.black },
  dot: { flex: 1, height: 48, borderRadius: 14, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line, alignItems: "center", justifyContent: "center" },
  dotOn: { backgroundColor: color.bone, borderColor: color.bone },
  input: { marginTop: 8, minHeight: 72, borderRadius: 16, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line, padding: 14, color: color.bone, fontFamily: font.body, fontSize: 16, textAlignVertical: "top" },
});
