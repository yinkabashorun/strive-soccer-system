import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OFFLINE_MESSAGE } from "@/api/client";
import { signOutEverywhere } from "@/account";
import { Body, Button } from "@/ui";
import { color } from "@/theme";

// What the app's first screen shows while it is not yet known where this
// person belongs (signed out, the agreement, the quiz, a gate, the app).
//
// It is black and empty while that is being read, which takes a moment on a
// first open and nothing at all after it (the answer is kept on the phone).
// Before this existed the first screen was Home itself: a new member saw the
// Home tabs flash for half a second before "You're in" (filmed in the
// simulator, Nov 24 2026), and a member with no connection and nothing
// saved sat on an empty Home with no word of why.
//
// When the answer cannot be read at all it says so, with a way to try again
// and a way out.
export function Holding({ failed, busy, retry }: { failed: boolean; busy: boolean; retry: () => void }) {
  const insets = useSafeAreaInsets();
  if (!failed) return <View style={styles.fill} />;
  return (
    <View style={[styles.fill, { paddingTop: insets.top + 90, paddingBottom: insets.bottom + 24 }]}>
      <Image source={require("../assets/splash.png")} style={styles.mark} contentFit="contain" />
      <Body style={{ marginTop: 28, textAlign: "center" }}>{OFFLINE_MESSAGE}</Body>
      <View style={{ marginTop: 28, alignSelf: "stretch", gap: 10 }}>
        <Button label="Try again" busy={busy} onPress={retry} />
        <Button quiet label="Sign out" onPress={() => void signOutEverywhere()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.black, alignItems: "center", paddingHorizontal: 24 },
  mark: { width: 64, height: 64 },
});
