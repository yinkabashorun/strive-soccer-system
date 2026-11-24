import { Linking, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SUPPORT_EMAIL, concernMailto } from "@shared/support";
import { useMe } from "@/api/queries";
import { signOutEverywhere } from "@/account";
import { openSite } from "@/links";
import { usePrefs } from "@/prefs";
import { turnOffNotifications, turnOnNotifications } from "@/push";
import { Body, Card, Hairline, Head, Icon, Label, Press, SettingRow } from "@/ui";
import { color } from "@/theme";

// Settings: what this phone does (notifications, vibration, the timer's
// tones, drill demos), the account (password, sign out, delete), and help.
// Reachable from every screen of the app, the gate and the agreement
// included, so deleting the account is never behind anything.
export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const [p, set] = usePrefs();
  const name = me.data?.viewer.name ?? "";
  // A free account has no sessions: no set timer and no drill demos to
  // switch, and its notifications are about its friends.
  const free = me.data?.state.kind === "free";

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.black }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}>
      <Press onPress={() => router.back()} style={{ width: 44, height: 44, justifyContent: "center" }} accessibilityLabel="Back">
        <Icon name="back" />
      </Press>
      <Head size={40} style={{ marginTop: 8 }}>
        Settings
      </Head>
      {me.data ? (
        <Body dim size={13.5} style={{ marginTop: 6 }}>
          {me.data.viewer.email}
        </Body>
      ) : null}

      <Section title="This phone">
        <SettingRow
          label="Notifications"
          detail={free ? "A friend posts or gives you props, or your club plans a session or a game. Nothing else." : "Your new week, your coach, a Film Room. Nothing else."}
          value={p.pushOn}
          onValue={(v) => void (v ? turnOnNotifications() : turnOffNotifications())}
        />
        <Hairline />
        <SettingRow label="Vibration" value={p.vibration} onValue={(v) => set("vibration", v)} />
        {free ? null : (
          <>
            <Hairline />
            <SettingRow label="Timer sound" value={p.sound} onValue={(v) => set("sound", v)} />
            <Hairline />
            <SettingRow label="Play drill demos automatically" value={p.autoplay} onValue={(v) => set("autoplay", v)} />
          </>
        )}
      </Section>

      <Section title="Account">
        {me.data?.profileSetup ? (
          <>
            <SettingRow
              label="Username"
              detail={me.data.profileSetup.username ? `@${me.data.profileSetup.username}` : undefined}
              onPress={() => router.push("/profile-setup?edit=username")}
            />
            <Hairline />
            <SettingRow label="Profile photo" onPress={() => router.push("/profile-setup?edit=photo")} />
            <Hairline />
          </>
        ) : null}
        <SettingRow label="Change password" onPress={() => router.push("/change-password")} />
        <Hairline />
        <SettingRow label="Sign out" onPress={() => void signOutEverywhere()} />
        <Hairline />
        <SettingRow label="Delete my account" danger onPress={() => router.push("/delete-account")} />
      </Section>

      <Section title="Help">
        <SettingRow label="Support" detail={SUPPORT_EMAIL} onPress={() => openSite("/support")} />
        <Hairline />
        <SettingRow label="Report a concern" onPress={() => Linking.openURL(concernMailto(name))} />
        <Hairline />
        <SettingRow label="Privacy Policy" onPress={() => openSite("/privacy")} />
        <Hairline />
        <SettingRow label="Terms of Service" onPress={() => openSite("/terms")} />
      </Section>

      <Body dim size={12} style={{ textAlign: "center", marginTop: 24 }}>
        {`Strive Elite ${Constants.expoConfig?.version ?? ""}`}
      </Body>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 26 }}>
      <Label dim size={13} style={{ marginBottom: 8, marginLeft: 4 }}>
        {title}
      </Label>
      <Card style={{ padding: 0, overflow: "hidden" }}>{children}</Card>
    </View>
  );
}
