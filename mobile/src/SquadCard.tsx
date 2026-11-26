import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { APP_API } from "@shared/app-contract";
import { SQUAD_FAILED, SQUAD_SEND, SQUAD_START, runningLine, type Squad } from "@shared/squad-pass";
import { api } from "@/api/client";
import { keys } from "@/api/queries";
import { freeKeys } from "@/api/free";
import { queryClient } from "@/api/queryClient";
import { Body, Button, Card, Disc, Head, Icon, Label } from "@/ui";
import { color } from "@/theme";

// Bring your squad (lib/elite/squad-pass.ts): the three places toward a
// month of Strive Pro, where "Send my link" has always been. A place turns
// gold when that teammate has posted their first training (gold is for
// what was earned). An earned month is started from here, with no card;
// the app then reads who this is again and moves to the member's side.
export function SquadCard({ squad, onSend }: { squad: Squad; onSend: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await api<{ ok: boolean }>(APP_API.freePass, { method: "POST" });
      await queryClient.invalidateQueries({ queryKey: keys.me });
      // the card itself changes too (the month is used, the line appears)
      await queryClient.invalidateQueries({ queryKey: freeKeys.feed });
    } catch (e) {
      setError((e as { message?: string })?.message || SQUAD_FAILED);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={styles.card}>
      <Head size={24}>{squad.title}</Head>
      <Body dim size={14} style={{ marginTop: 8 }}>
        {squad.body}
      </Body>

      {squad.ready === 0 && squad.canEarnMore ? (
        <>
          <View style={styles.slots}>
            {squad.slots.map((s, i) => (
              <View
                key={i}
                style={[styles.slot, s.state === "trained" ? styles.trained : null]}
                accessible
                accessibilityLabel={s.state === "trained" ? `${s.name} trained` : s.state === "joined" ? `${s.name} joined, no training post yet` : "Open place"}
              >
                {s.state === "trained" ? (
                  <Disc size={22} earned>
                    <Icon name="check" size={11} stroke="#1a1408" />
                  </Disc>
                ) : null}
                <Label size={13} numberOfLines={1} style={{ color: s.state === "open" ? color.faint : color.bone, marginTop: s.state === "trained" ? 5 : 0 }}>
                  {s.state === "open" ? "Open" : s.name}
                </Label>
                {s.state === "joined" ? (
                  <Body dim size={11}>
                    joined
                  </Body>
                ) : null}
              </View>
            ))}
          </View>
          {squad.waiting ? (
            <Body dim size={13} style={{ marginTop: 12 }}>
              {squad.waiting}
            </Body>
          ) : null}
        </>
      ) : null}

      {squad.runningUntil ? (
        <Body dim size={13} style={{ marginTop: 12 }}>
          {runningLine(squad.runningUntil)}
        </Body>
      ) : null}
      {/* a player who pays: their next month is free (squad-pass.ts) */}
      {squad.note ? (
        <Body size={13} style={{ marginTop: 12 }}>
          {squad.note}
        </Body>
      ) : null}
      {error ? (
        <Body size={13} style={{ marginTop: 12 }}>
          {error}
        </Body>
      ) : null}

      <View style={{ gap: 10, marginTop: 16 }}>
        {squad.ready > 0 ? <Button label={squad.start ?? SQUAD_START} onPress={start} busy={busy} /> : null}
        {squad.canEarnMore ? <Button quiet={squad.ready > 0} label={SQUAD_SEND} onPress={onSend} /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 14, marginTop: 18, padding: 20 },
  slots: { flexDirection: "row", gap: 8, marginTop: 16 },
  slot: {
    flex: 1,
    height: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(242,239,232,0.22)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  trained: { borderStyle: "solid", borderColor: "rgba(200,168,88,0.6)", backgroundColor: "rgba(200,168,88,0.1)" },
});
