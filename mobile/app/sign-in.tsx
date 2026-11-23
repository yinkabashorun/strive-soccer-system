import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { signInWithPassword } from "@/auth/session";
import { queryClient } from "@/api/queryClient";
import { keys } from "@/api/queries";
import { API_BASE } from "@/config";
import { Body, Button, Head, Label, Press } from "@/ui";
import { color, font } from "@/theme";

// Sign in: the same email and password as the website. Forgot your
// password opens the website's own reset in a sheet inside the app (the
// emailed link is the website's too). There is no sign-up here: accounts
// are made by the coach's invite or on the website.
export default function SignIn() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    const problem = await signInWithPassword(email, password);
    setBusy(false);
    if (problem) setError(problem);
    else await queryClient.invalidateQueries({ queryKey: keys.me });
  }

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.body, { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 24 }]}>
        <Image source={require("../assets/splash.png")} style={styles.mark} contentFit="contain" accessibilityLabel="Strive" />
        <Head size={40} style={{ marginTop: 28 }}>
          Sign in
        </Head>
        <Body dim style={{ marginTop: 8 }}>
          Use the email and password you use on thestriveapp.com.
        </Body>

        <View style={{ marginTop: 28, gap: 12 }}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={color.faint}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            value={email}
            onChangeText={setEmail}
            returnKeyType="next"
            accessibilityLabel="Email"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={color.faint}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            returnKeyType="go"
            onSubmitEditing={go}
            accessibilityLabel="Password"
          />
        </View>
        {error ? (
          <View style={styles.error} accessibilityLiveRegion="polite">
            <Body size={14}>{error}</Body>
          </View>
        ) : null}
        <Button style={{ marginTop: 20 }} label="Sign in" busy={busy} onPress={go} />
        <Press
          style={styles.link}
          accessibilityRole="link"
          onPress={() => WebBrowser.openBrowserAsync(`${API_BASE}/forgot`, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET })}
        >
          <Label dim>Forgot your password?</Label>
        </Press>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.black },
  body: { flex: 1, paddingHorizontal: 24 },
  mark: { width: 64, height: 64 },
  input: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: color.fill,
    borderWidth: 1,
    borderColor: color.line,
    paddingHorizontal: 16,
    color: color.bone,
    fontFamily: font.body,
    fontSize: 16,
  },
  error: { marginTop: 14, padding: 14, borderRadius: 14, backgroundColor: "rgba(255,107,94,0.12)", borderWidth: 1, borderColor: "rgba(255,107,94,0.35)" },
  link: { alignSelf: "center", minHeight: 44, justifyContent: "center", paddingHorizontal: 12, marginTop: 10 },
});
