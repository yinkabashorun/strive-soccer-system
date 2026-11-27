import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { keys, useAddExtra, useExtra } from "@/api/queries";
import { queryClient } from "@/api/queryClient";
import { ApiError } from "@/api/client";
import { tick } from "@/feel";
import { Body, Button, Card, Head, Icon, Label, Press, Skeleton } from "@/ui";
import { color } from "@/theme";

// Extra work, both ways (the website's own rules, lib/elite/extra-actions.ts):
// one tap builds a session from a shelf, or pick up to six drills in the
// order you want them. The warm-up goes first and, when your plan calls for
// it, a strength finisher last. The new session opens in the player.
const MAX_PICKS = 6;

export default function Extra() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const extra = useExtra(true);
  const add = useAddExtra();
  const [mode, setMode] = useState<"shelf" | "pick">("shelf");
  const [picks, setPicks] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const x = extra.data;

  async function build(body: { shelf: string } | { drillIds: string[] }) {
    setError(null);
    try {
      const res = await add.mutateAsync(body);
      if (!res.ok) {
        setError(res.error ?? "That didn't work. Try again.");
        return;
      }
      // The new session is in the week before the player opens it.
      await queryClient.refetchQueries({ queryKey: keys.week });
      if (res.session) router.replace(`/session/${res.session}`);
      else router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work. Try again.");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.black }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 120 }}>
        <View style={styles.grabber} />
        <Head size={32}>Extra work</Head>
        <Body dim style={{ marginTop: 6 }}>
          On top of your week. It never counts against it.
        </Body>
        <View style={styles.switch}>
          {(["shelf", "pick"] as const).map((m) => (
            <Press key={m} onPress={() => setMode(m)} style={[styles.seg, mode === m ? styles.segOn : null]} accessibilityState={{ selected: mode === m }}>
              <Label size={14} style={{ color: mode === m ? color.black : color.dim }}>
                {m === "shelf" ? "Build it for me" : "Pick my own drills"}
              </Label>
            </Press>
          ))}
        </View>
        {!x ? (
          <View style={{ gap: 10, marginTop: 18 }}>
            <Skeleton height={76} />
            <Skeleton height={76} />
          </View>
        ) : mode === "shelf" ? (
          <View style={{ gap: 10, marginTop: 18 }}>
            {x.shelves.map((s) => (
              <Press key={s.key} onPress={() => build({ shelf: s.key })} disabled={add.isPending} accessibilityLabel={s.label}>
                <Card style={styles.shelf}>
                  <View style={{ flex: 1 }}>
                    <Label size={17}>{s.label}</Label>
                    <Body dim size={13} style={{ marginTop: 3 }}>
                      {s.blurb}
                    </Body>
                  </View>
                  <Icon name="chevron" size={18} stroke={color.faint} />
                </Card>
              </Press>
            ))}
          </View>
        ) : (
          <View style={{ marginTop: 18 }}>
            {x.groups.map((g) => (
              <View key={g.key} style={{ marginTop: 10 }}>
                <Label dim size={13}>{g.label}</Label>
                {g.drills.map((d) => {
                  const at = picks.indexOf(d.id);
                  return (
                    <Press
                      key={d.id}
                      onPress={() => {
                        tick();
                        setPicks((p) => (p.includes(d.id) ? p.filter((v) => v !== d.id) : p.length < MAX_PICKS ? [...p, d.id] : p));
                      }}
                      style={[styles.pick, at >= 0 ? styles.pickOn : null]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: at >= 0 }}
                      accessibilityLabel={d.title}
                    >
                      <View style={styles.still}>{d.poster ? <Image source={{ uri: d.poster }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
                      <View style={{ flex: 1 }}>
                        <Label numberOfLines={2}>{d.title}</Label>
                        <Body dim size={12}>{`${d.minutes} min${d.doneBefore ? " · Done before" : ""}`}</Body>
                      </View>
                      {at >= 0 ? (
                        <View style={styles.order}>
                          <Head size={15} style={{ color: color.black }}>{String(at + 1)}</Head>
                        </View>
                      ) : null}
                    </Press>
                  );
                })}
              </View>
            ))}
          </View>
        )}
        {error || x?.error ? (
          <Body size={14} style={{ color: color.danger, marginTop: 14 }}>
            {error ?? x?.error}
          </Body>
        ) : null}
      </ScrollView>
      {mode === "pick" ? (
        <View style={[styles.cta, { paddingBottom: insets.bottom + 16 }]}>
          <Button
            label={picks.length ? `Add ${picks.length} drill${picks.length === 1 ? "" : "s"}` : "Pick your drills"}
            disabled={!picks.length}
            busy={add.isPending}
            onPress={() => build({ drillIds: picks })}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grabber: { alignSelf: "center", width: 36, height: 5, borderRadius: 3, backgroundColor: color.fill2, marginBottom: 14 },
  switch: { flexDirection: "row", backgroundColor: color.fill, borderRadius: 14, padding: 4, marginTop: 18, borderWidth: 1, borderColor: color.line },
  seg: { flex: 1, minHeight: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  segOn: { backgroundColor: color.bone },
  shelf: { flexDirection: "row", alignItems: "center", minHeight: 76 },
  pick: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 72, marginTop: 8, padding: 10, borderRadius: 16, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line },
  pickOn: { borderColor: color.bone, borderWidth: 2 },
  still: { width: 56, height: 56, borderRadius: 12, overflow: "hidden", backgroundColor: color.fill2 },
  order: { width: 28, height: 28, borderRadius: 14, backgroundColor: color.bone, alignItems: "center", justifyContent: "center" },
  cta: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: color.black },
});
