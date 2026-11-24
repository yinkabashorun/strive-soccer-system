import { useState } from "react";
import { StyleSheet, TextInput } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CLUB_CODE_MESSAGE, clubCodeFrom } from "@shared/club-app";
import { ApiError, OFFLINE_MESSAGE } from "@/api/client";
import { askToJoin, refreshClubs } from "@/api/clubs";
import { FormScreen } from "@/FormScreen";
import { Body, Button, Eyebrow, Head, Icon, Press } from "@/ui";
import { color, font } from "@/theme";

// "Have a club code?": the app's own way into a club. A club's link opens
// the website, so a player types the code their captain sent, or pastes
// the whole link (the code is read out of it by the one shared rule,
// lib/elite/club-app.ts clubCodeFrom).
//
// It ASKS to join. The club's captain lets the player in; until then the
// screen says exactly that, in the website's own words.
export default function JoinClub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ line: string; id?: string } | null>(null);

  async function ask() {
    const clean = clubCodeFrom(code);
    if (!clean) return setError(CLUB_CODE_MESSAGE);
    setError(null);
    setBusy(true);
    try {
      const res = await askToJoin(clean);
      if (!res.ok) return setError(res.error ?? "That did not go through. Try again.");
      await refreshClubs();
      setDone({ line: res.line ?? "Request sent.", id: res.id });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : OFFLINE_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  const back = (
    <Press onPress={() => router.back()} style={{ width: 44, height: 44, justifyContent: "center" }} accessibilityLabel="Back">
      <Icon name="back" />
    </Press>
  );

  if (done) {
    return (
      <FormScreen contentStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}>
        {back}
        <Eyebrow style={{ marginTop: 14 }}>{done.id ? "Your club" : "Asked"}</Eyebrow>
        <Head size={32} style={{ marginTop: 10 }}>
          {done.line}
        </Head>
        {done.id ? null : (
          <Body dim style={{ marginTop: 12 }}>
            The club shows up on your Clubs tab the moment you are let in.
          </Body>
        )}
        <Button style={{ marginTop: 24 }} label={done.id ? "Open the club" : "Done"} onPress={() => (done.id ? router.replace(`/club/${done.id}` as Href) : router.back())} />
      </FormScreen>
    );
  }

  return (
    <FormScreen contentStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}>
      {back}
      <Head size={40} style={{ marginTop: 8 }}>
        Join a club
      </Head>
      <Body dim style={{ marginTop: 10 }}>
        Type the club code your captain sent you, or paste the whole link. The captain lets you in.
      </Body>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={setCode}
        placeholder="Club code"
        placeholderTextColor={color.faint}
        autoCapitalize="characters"
        autoCorrect={false}
        spellCheck={false}
        returnKeyType="go"
        onSubmitEditing={() => void ask()}
        accessibilityLabel="Club code"
      />
      {error ? (
        <Body size={13.5} style={{ color: color.danger, marginTop: 14 }}>
          {error}
        </Body>
      ) : null}
      <Button style={{ marginTop: 20 }} label="Ask to join" busy={busy} disabled={!code.trim()} onPress={() => void ask()} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  input: { marginTop: 20, minHeight: 60, borderRadius: 16, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line, paddingHorizontal: 16, color: color.bone, fontFamily: font.label, fontSize: 20, letterSpacing: 2 },
});
