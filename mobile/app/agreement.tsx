import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConsent, useMe } from "@/api/queries";
import { ApiError } from "@/api/client";
import { openSite } from "@/links";
import { signOutEverywhere } from "@/account";
import { Body, Button, Head, Icon, Label, Press } from "@/ui";
import { color, font } from "@/theme";

// "Before you train" (068), once, and again when the Terms change: the
// three plain lines, both boxes ticked by the person (never by default),
// the name of the adult agreeing. Settings (and deleting the account) and
// signing out stay one tap away. The words are the server's, so they are
// the version being recorded.
export default function Agreement() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const me = useMe();
  const c = me.data?.consent;
  const consent = useConsent();
  const [guardian, setGuardian] = useState(false);
  const [terms, setTerms] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function agree() {
    setError(null);
    try {
      await consent.mutateAsync({ guardian, terms, guardianName: name });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save. Check your connection and try again.");
    }
  }

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 60, paddingBottom: insets.bottom + 30, paddingHorizontal: 24 }}>
        <Head size={40}>Before you train</Head>
        <View style={{ marginTop: 18, gap: 12 }}>
          {(c?.points ?? []).map((p) => (
            <Body key={p} dim>
              {p}
            </Body>
          ))}
        </View>
        <Box on={guardian} onPress={() => setGuardian(!guardian)} text={c?.guardian ?? ""} />
        <Box on={terms} onPress={() => setTerms(!terms)} text={c?.terms ?? ""} />
        <View style={{ flexDirection: "row", gap: 16, marginTop: 6 }}>
          <Press onPress={() => openSite("/terms")} accessibilityRole="link" style={styles.link}>
            <Label dim size={14}>Terms of Service</Label>
          </Press>
          <Press onPress={() => openSite("/privacy")} accessibilityRole="link" style={styles.link}>
            <Label dim size={14}>Privacy Policy</Label>
          </Press>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Full name of the adult agreeing"
          placeholderTextColor={color.faint}
          autoComplete="name"
          textContentType="name"
          value={name}
          onChangeText={setName}
          accessibilityLabel="Full name of the parent or guardian agreeing"
        />
        {error ? (
          <Body size={14} style={{ color: color.danger, marginTop: 12 }}>
            {error}
          </Body>
        ) : null}
        <Button style={{ marginTop: 20 }} label="Agree and continue" busy={consent.isPending} onPress={agree} />
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 18, marginTop: 14 }}>
          <Press onPress={() => router.push("/settings")} style={styles.link}>
            <Label dim size={14}>Settings</Label>
          </Press>
          <Press onPress={() => void signOutEverywhere()} style={styles.link}>
            <Label dim size={14}>Sign out</Label>
          </Press>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Box({ on, onPress, text }: { on: boolean; onPress: () => void; text: string }) {
  return (
    <Press onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={text} style={styles.box}>
      {/* A choice is bone, never gold: gold is only for what was earned. */}
      {on ? (
        <View style={[styles.empty, { backgroundColor: color.bone, borderColor: color.bone, alignItems: "center", justifyContent: "center" }]}>
          <Icon name="check" size={14} stroke={color.black} />
        </View>
      ) : (
        <View style={styles.empty} />
      )}
      <Body style={{ flex: 1 }}>{text}</Body>
    </Press>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.black },
  box: { flexDirection: "row", gap: 14, alignItems: "flex-start", marginTop: 20, minHeight: 44 },
  empty: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: color.faint },
  link: { minHeight: 44, justifyContent: "center" },
  input: {
    marginTop: 14,
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
});
