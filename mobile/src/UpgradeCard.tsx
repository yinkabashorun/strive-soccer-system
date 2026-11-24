import { useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { UPGRADE_CARD_KEY, parseDismissedAt, upgradeCard, type UpgradePlace } from "@shared/upgrade-card";
import { Body, Card, Label, Press } from "./ui";
import { color } from "./theme";

// The one upgrade prompt in the free app. Whether it shows and what it
// says is decided by lib/elite/upgrade-card.ts alone (one place, the Week
// tab; never for a member; put away for thirty days by "Not now"). This
// only draws it: a quiet card in the page, never a pop-up, never in the
// way of anything.
export function UpgradeCard({ place, member, area, sessions }: { place: UpgradePlace; member: boolean; area: string | null; sessions: number }) {
  const router = useRouter();
  // Unknown until the phone's own note is read: nothing is drawn before
  // then, so a card put away never flashes back.
  const [dismissedAt, setDismissedAt] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(UPGRADE_CARD_KEY)
      .then((raw) => alive && setDismissedAt(parseDismissedAt(raw)))
      .catch(() => alive && setDismissedAt(null));
    return () => {
      alive = false;
    };
  }, []);
  if (dismissedAt === undefined) return null;
  const copy = upgradeCard({ place, member, area, sessions, dismissedAt, now: Date.now() });
  if (!copy) return null;

  function putAway() {
    const now = Date.now();
    setDismissedAt(now);
    void AsyncStorage.setItem(UPGRADE_CARD_KEY, String(now)).catch(() => undefined);
  }

  return (
    <Card style={{ marginHorizontal: 20, marginTop: 26 }}>
      <Label size={17}>{copy.title}</Label>
      <Body dim size={13.5} style={{ marginTop: 6 }}>
        {copy.line}
      </Body>
      <View style={{ flexDirection: "row", gap: 22, marginTop: 6 }}>
        <Press onPress={() => router.push("/offer")} style={{ minHeight: 44, justifyContent: "center" }} accessibilityLabel={copy.action}>
          <Label size={15}>{copy.action}</Label>
        </Press>
        <Press onPress={putAway} style={{ minHeight: 44, justifyContent: "center" }} accessibilityLabel={copy.dismiss}>
          <Label size={15} style={{ color: color.dim }}>
            {copy.dismiss}
          </Label>
        </Press>
      </View>
    </Card>
  );
}
