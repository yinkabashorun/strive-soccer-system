import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError, OFFLINE_MESSAGE } from "@/api/client";
import { refreshFree, unblockPlayer, useBlocked } from "@/api/free";
import { useBelowClock } from "@/Screen";
import { Body, Button, Card, Hairline, Head, Icon, Label, Press, Skeleton } from "@/ui";
import { color } from "@/theme";

// The players you blocked, from Settings: a block can be taken back here.
// Unblocking does not make the two of you friends again; that takes a new
// friend request. The other player is never told either way.
export default function Blocked() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const belowClock = useBelowClock();
  const q = useBlocked();
  const rows = q.data?.blocked;
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function unblock(id: string) {
    setBusy(id);
    setNote(null);
    try {
      const res = await unblockPlayer(id);
      if (!res.ok) setNote(res.error ?? "That didn't go through. Try again.");
      else await refreshFree();
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : OFFLINE_MESSAGE);
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: color.black }, belowClock]}
      contentContainerStyle={{ paddingTop: 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
    >
      <Press onPress={() => router.back()} style={{ width: 44, height: 44, justifyContent: "center" }} accessibilityLabel="Back">
        <Icon name="back" />
      </Press>
      <Head size={40} style={{ marginTop: 8 }}>
        Blocked players
      </Head>
      <Body dim size={13.5} style={{ marginTop: 6 }}>
        A player you blocked cannot see your training and you cannot see theirs. They are not told.
      </Body>
      {!rows ? (
        q.isError || q.isPaused ? (
          <View style={{ marginTop: 20 }}>
            <Body dim>{OFFLINE_MESSAGE}</Body>
            <Button quiet style={{ marginTop: 16 }} label="Try again" busy={q.isFetching} onPress={() => void q.refetch()} />
          </View>
        ) : (
          <Skeleton height={120} style={{ marginTop: 20 }} />
        )
      ) : rows.length === 0 ? (
        <Body dim style={{ marginTop: 28 }}>
          You have not blocked anyone.
        </Body>
      ) : (
        <Card style={{ padding: 0, marginTop: 20 }}>
          {rows.map((r, i) => (
            <View key={r.id}>
              {i > 0 ? <Hairline /> : null}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 10, minHeight: 64 }}>
                <Label style={{ flex: 1 }} numberOfLines={1}>
                  {r.name}
                </Label>
                <Button quiet label="Unblock" busy={busy === r.id} disabled={busy !== null && busy !== r.id} onPress={() => void unblock(r.id)} style={{ minWidth: 104 }} />
              </View>
            </View>
          ))}
        </Card>
      )}
      {note ? (
        <Body dim size={13.5} style={{ marginTop: 12 }}>
          {note}
        </Body>
      ) : null}
      {rows && rows.length > 0 ? (
        <Body dim size={12.5} style={{ marginTop: 14 }}>
          Unblocking does not make you friends again. That takes a new friend request.
        </Body>
      ) : null}
    </ScrollView>
  );
}
