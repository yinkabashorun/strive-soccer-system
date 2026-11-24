import { Linking, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SUPPORT_EMAIL } from "@shared/support";
import { useMe } from "@/api/queries";
import { signOutEverywhere } from "@/account";
import { openSite } from "@/links";
import { Body, Button, Head, Label, Press } from "@/ui";
import { color } from "@/theme";

// The screens a member sees instead of the app (lib/elite/gates.ts, the
// website's own words): one says what is happening and what comes next,
// and never leaves them with nothing to do. Coaches are on the website in
// this version of the app. A free account lives in the app (app/(free));
// it only lands here while the server cannot store its quiz yet (the stage
// "web": the database is a step behind the app), when its training log is
// still the website's.
export default function Gate() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const state = useMe().data?.state;

  const copy =
    state && "gate" in state
      ? state.gate
      : state?.kind === "coach"
        ? { title: "The coach side is on the website", body: "Rosters, plans and calls live at thestriveapp.com. This app is for players.", emailCoach: false }
        : state?.kind === "free"
          ? { title: "Your friends and your week are on the website", body: "They open in this app soon. Until then they are at thestriveapp.com.", emailCoach: false }
          : { title: "Almost there", body: "", emailCoach: false };

  return (
    <View style={[styles.fill, { paddingTop: insets.top + 90, paddingBottom: insets.bottom + 24 }]}>
      <Image source={require("../assets/splash.png")} style={styles.mark} contentFit="contain" />
      <Head size={34} style={{ marginTop: 28, textAlign: "center" }}>
        {copy.title}
      </Head>
      <Body dim style={{ marginTop: 12, textAlign: "center" }}>
        {copy.body}
      </Body>
      <View style={{ marginTop: 28, alignSelf: "stretch", gap: 10 }}>
        {state?.kind === "pro_checkout" ? (
          // The membership is bought on the website (no purchase inside the
          // app): the account page opens in a sheet over the app.
          <Button label="Continue on the website" onPress={() => openSite("/dashboard")} />
        ) : null}
        {state?.kind === "coach" || state?.kind === "free" ? <Button label="Open thestriveapp.com" onPress={() => openSite("/")} /> : null}
        {copy.emailCoach ? <Button label="Email your coach" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} /> : null}
        <Button quiet label="Sign out" onPress={() => void signOutEverywhere()} />
      </View>
      <Press onPress={() => router.push("/settings")} style={styles.link}>
        <Label dim size={14}>Settings</Label>
      </Press>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.black, alignItems: "center", paddingHorizontal: 24 },
  mark: { width: 64, height: 64 },
  link: { minHeight: 44, justifyContent: "center", marginTop: 12 },
});
