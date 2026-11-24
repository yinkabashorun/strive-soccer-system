import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError, OFFLINE_MESSAGE } from "@/api/client";
import { useClubNear } from "@/api/clubs";
import { Crest } from "@/Crest";
import { Body, Button, Card, Hairline, Head, Icon, Label, Press, Skeleton } from "@/ui";
import { color } from "@/theme";

// Clubs near you, the captain only (the server sends it to nobody else):
// the clubs in the club's own county that chose to be open to games, each
// with its crest, name, record and how many players, and "Send a game".
// Never a player's name. Clubs never message each other: a captain sends a
// game, and the other captain accepts or passes.
export default function Near() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const near = useClubNear(id);
  const n = near.data;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.black }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
    >
      <Press onPress={() => router.back()} style={{ width: 44, height: 44, justifyContent: "center" }} accessibilityLabel="Back">
        <Icon name="back" />
      </Press>
      <Head size={40} style={{ marginTop: 8 }}>
        Clubs near you
      </Head>
      {!n ? (
        near.isError || near.isPaused ? (
          <View style={{ marginTop: 20 }}>
            <Body dim>{near.error instanceof ApiError && near.error.status === 404 ? "Only the club's captain can send a game." : OFFLINE_MESSAGE}</Body>
            <Button quiet style={{ marginTop: 16 }} label="Try again" busy={near.isFetching} onPress={() => void near.refetch()} />
          </View>
        ) : (
          <Skeleton height={220} style={{ marginTop: 20 }} />
        )
      ) : (
        <>
          <Body dim size={13.5} style={{ marginTop: 6 }}>
            {n.club.countyName ? `Open to games in ${n.club.countyName}.` : "Pick your club's county in Manage first. Clubs play clubs in their own county."}
          </Body>
          {n.club.county && !n.club.open ? (
            <Body dim size={13.5} style={{ marginTop: 8 }}>
              Your club is not open to games, so other captains cannot find it. You can switch that on in Manage.
            </Body>
          ) : null}
          {n.fullLine ? (
            <Label size={14} style={{ marginTop: 10, lineHeight: 20 }}>
              {n.fullLine}
            </Label>
          ) : null}

          {n.rows.length === 0 ? (
            n.club.county ? (
              <Body dim style={{ marginTop: 28, textAlign: "center" }}>
                No other club in your county is open to games yet. Send your club&apos;s code to the captains you know.
              </Body>
            ) : null
          ) : (
            <Card style={{ padding: 0, marginTop: 20 }}>
              {n.rows.map((r, i) => (
                <View key={r.id}>
                  {i > 0 ? <Hairline /> : null}
                  <View style={styles.row} accessible={false}>
                    <Crest club={r} size={46} />
                    <View style={{ flex: 1 }}>
                      <Label numberOfLines={1}>{r.name}</Label>
                      <Body dim size={13}>
                        {r.played ? "You have played this club" : `${r.record} · ${r.members} ${r.members === 1 ? "player" : "players"}`}
                      </Body>
                      {r.refusal && !n.fullLine ? (
                        <Body dim size={12.5}>
                          {r.refusal}
                        </Body>
                      ) : null}
                    </View>
                    {r.refusal ? null : (
                      <Press onPress={() => router.push(`/club/${n.club.id}/plan?vs=${r.id}` as Href)} style={styles.send} accessibilityLabel={`Send ${r.name} a game`}>
                        <Label size={14} style={{ color: color.black }}>
                          Send a game
                        </Label>
                      </Press>
                    )}
                  </View>
                </View>
              ))}
            </Card>
          )}
          <Body dim size={12.5} style={{ marginTop: 18, textAlign: "center" }}>
            Clubs choose to be on this list. Only captains can send a game, and clubs never message each other.
          </Body>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  send: { minHeight: 44, paddingHorizontal: 16, borderRadius: 14, backgroundColor: color.bone, alignItems: "center", justifyContent: "center" },
});
