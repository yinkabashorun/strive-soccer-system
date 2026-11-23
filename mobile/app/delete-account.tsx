import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDeleteAccount } from "@/api/queries";
import { ApiError } from "@/api/client";
import { leaveDeletedAccount } from "@/account";
import { Body, Button, Card, Eyebrow, Head, Icon, Press } from "@/ui";
import { color, font } from "@/theme";

// "Delete my account" inside the app (App Review 5.1.1(v)): what goes, what
// does not, the password, one button. Self-serve and immediate, nobody to
// email or call. The website's own deletion runs on the server.
export default function DeleteAccount() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const del = useDeleteAccount();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    if (!password) return setError("Enter your password to confirm.");
    Alert.alert("Delete your account?", "This is permanent and happens right away.", [
      { text: "Keep my account", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void go() },
    ]);
  }

  async function go() {
    setError(null);
    try {
      await del.mutateAsync(password);
      await leaveDeletedAccount();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something stopped the deletion and nothing was removed. Try again.");
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.black }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}>
        <Press onPress={() => router.back()} style={{ width: 44, height: 44, justifyContent: "center" }} accessibilityLabel="Back">
          <Icon name="back" />
        </Press>
        <Head size={36} style={{ marginTop: 8 }}>
          Delete my account
        </Head>
        <Body dim style={{ marginTop: 10 }}>
          This is permanent and happens right away. It cannot be undone.
        </Body>
        <Card style={{ marginTop: 20, padding: 18 }}>
          <Eyebrow gold={false}>What is deleted</Eyebrow>
          <View style={{ marginTop: 10, gap: 6 }}>
            {[
              "Your login.",
              "The player's profile, training weeks and history.",
              "Progress, time trained and achievements.",
              "Every message with the coach.",
              "Every clip and video the player uploaded.",
            ].map((l) => (
              <Body key={l} size={14}>{`·  ${l}`}</Body>
            ))}
          </View>
          <Eyebrow gold={false} style={{ marginTop: 18 }}>
            What is not
          </Eyebrow>
          <View style={{ marginTop: 10, gap: 6 }}>
            {[
              "Payment records. They are held by our payment processor and kept as long as tax and accounting rules require.",
              "Monthly billing. Deleting the account does not stop a payment by itself. We are told the moment you delete, and we stop it.",
              "Texts already delivered to your phone.",
            ].map((l) => (
              <Body key={l} size={14} dim>{`·  ${l}`}</Body>
            ))}
          </View>
        </Card>
        <TextInput
          style={styles.input}
          placeholder="Your password"
          placeholderTextColor={color.faint}
          secureTextEntry
          textContentType="password"
          value={password}
          onChangeText={setPassword}
          accessibilityLabel="Your password"
        />
        {error ? <Body style={{ marginTop: 12, color: color.danger }}>{error}</Body> : null}
        <Press onPress={confirm} disabled={del.isPending} style={styles.danger} accessibilityLabel="Delete my account">
          <Head size={18} style={{ color: color.danger, letterSpacing: 1.4 }}>
            {del.isPending ? "Deleting" : "Delete my account"}
          </Head>
        </Press>
        <Button style={{ marginTop: 10 }} quiet label="Keep my account" onPress={() => router.back()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  input: { marginTop: 18, minHeight: 56, borderRadius: 16, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line, paddingHorizontal: 16, color: color.bone, fontFamily: font.body, fontSize: 16 },
  danger: { marginTop: 20, minHeight: 60, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,107,94,0.5)", alignItems: "center", justifyContent: "center" },
});
