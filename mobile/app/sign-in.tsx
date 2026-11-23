import { useRef, useState, type ComponentRef } from "react";
import { Keyboard, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { signInWithPassword } from "@/auth/session";
import { queryClient } from "@/api/queryClient";
import { keys } from "@/api/queries";
import { API_BASE } from "@/config";
import { FormScreen } from "@/FormScreen";
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
  const passwordField = useRef<ComponentRef<typeof TextInput>>(null);

  async function go() {
    Keyboard.dismiss();
    setBusy(true);
    setError(null);
    const problem = await signInWithPassword(email, password);
    setBusy(false);
    if (problem) setError(problem);
    else await queryClient.invalidateQueries({ queryKey: keys.me });
  }

  return (
    <FormScreen contentStyle={{ paddingHorizontal: 24, paddingTop: insets.top + 44, paddingBottom: insets.bottom + 24 }}>
      <Image source={require("../assets/splash.png")} style={styles.mark} contentFit="contain" accessibilityLabel="Strive" />
      <Head size={40} style={{ marginTop: 22 }}>
        Strive <Text style={{ color: color.gold }}>Elite</Text>
      </Head>
      <Body dim style={{ marginTop: 8 }}>
        Sign in to your Strive Elite account with the email and password you use on thestriveapp.com.
      </Body>

      <View style={{ marginTop: 24, gap: 12 }}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={color.faint}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
          value={email}
          onChangeText={setEmail}
          returnKeyType="next"
          onSubmitEditing={() => passwordField.current?.focus()}
          submitBehavior="submit"
          accessibilityLabel="Email"
        />
        <TextInput
          ref={passwordField}
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
      <Button style={{ marginTop: 18 }} label="Sign in" busy={busy} onPress={go} />
      <Press
        style={styles.link}
        accessibilityRole="link"
        onPress={() => WebBrowser.openBrowserAsync(`${API_BASE}/forgot`, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET })}
      >
        <Label dim>Forgot your password?</Label>
      </Press>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  mark: { width: 56, height: 56 },
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
