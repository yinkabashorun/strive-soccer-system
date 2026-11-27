import { useState } from "react";
import { CLUB_GAMES_IN_APP } from "@shared/club-games";
import { Share, StyleSheet, TextInput, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { clubShareText } from "@shared/club-app";
import { CLUB_NAME_MAX, CLUBS_PER_PLAYER } from "@shared/tracker";
import { ApiError, OFFLINE_MESSAGE } from "@/api/client";
import { refreshClubs, startClub } from "@/api/clubs";
import { API_BASE } from "@/config";
import { CountyPicker } from "@/CountyPicker";
import { feel } from "@/feel";
import { FormScreen } from "@/FormScreen";
import { withPlayTerms } from "@/play-terms";
import { Body, Button, Card, Eyebrow, Head, Icon, Label, Press } from "@/ui";
import { color, font } from "@/theme";

// Start a club: its name (the website's own rule and word filter, on the
// server), its county from the list if you want other clubs to find you,
// and the captain's one-time organizer acceptance, shown and recorded
// exactly as the website does it (src/play-terms.ts). You are its captain
// and its first member.
//
// Then the club's code, big, and one button to send it: the share sheet
// carries the code AND the link. Players who use it ASK to join; you let
// each one in.
export default function StartClub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [county, setCounty] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<{ id: string; code: string; name: string } | null>(null);

  async function start() {
    setError(null);
    setBusy(true);
    try {
      const res = await withPlayTerms(() => startClub(name, county));
      if (res.ok && res.id && res.code) {
        feel("session");
        await refreshClubs();
        setMade({ id: res.id, code: res.code, name: name.trim().replace(/\s+/g, " ") });
      } else if (!res.declined) setError(res.error ?? "That didn't go through. Try again.");
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

  if (made) {
    return (
      <FormScreen safeTop contentStyle={{ paddingTop: 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}>
        {back}
        <Eyebrow style={{ marginTop: 14 }}>Your club is ready</Eyebrow>
        <Head size={36} style={{ marginTop: 10 }}>
          {made.name}
        </Head>
        <Body dim style={{ marginTop: 12 }}>
          Send your club&apos;s code to your teammates. Each one asks to join, and you let them in. Then they are friends with everyone in the club.
        </Body>
        <Card style={styles.code}>
          <Body dim size={12.5}>
            Club code
          </Body>
          <Head size={40} style={{ letterSpacing: 4, marginTop: 4 }}>
            {made.code}
          </Head>
        </Card>
        <Button
          style={{ marginTop: 20 }}
          label="Send the club's code"
          onPress={() => void Share.share({ message: clubShareText({ name: made.name, code: made.code, appUrl: API_BASE }) }).catch(() => undefined)}
        />
        <Button quiet style={{ marginTop: 10 }} label="Open my club" onPress={() => router.replace(`/club/${made.id}` as Href)} />
      </FormScreen>
    );
  }

  return (
    <FormScreen safeTop contentStyle={{ paddingTop: 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}>
      {back}
      <Head size={40} style={{ marginTop: 8 }}>
        Start a club
      </Head>
      <Body dim style={{ marginTop: 10 }}>
        {`Your team. Your pickup crew. The players you train with. You're the captain. You let each player in, and everyone in the club becomes friends. You can be in ${CLUBS_PER_PLAYER} clubs.`}
      </Body>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={(t) => setName(t.slice(0, CLUB_NAME_MAX))}
        maxLength={CLUB_NAME_MAX}
        placeholder="Club name"
        placeholderTextColor={color.faint}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        accessibilityLabel="Club name"
      />
      <View style={{ marginTop: 12 }}>
        <CountyPicker value={county} onChange={setCounty} />
      </View>
      <Label dim size={12.5} style={{ marginTop: 8, lineHeight: 18, fontFamily: font.body }}>
        {CLUB_GAMES_IN_APP
          ? "Clubs play games against clubs in the same county. You can leave it out and set it later."
          : "Your club's weekly matchup is with a club in your county first. You can leave it out and set it later."}
      </Label>
      {error ? (
        <Body size={13.5} style={{ color: color.danger, marginTop: 14 }}>
          {error}
        </Body>
      ) : null}
      <Button style={{ marginTop: 20 }} label="Start the club" busy={busy} disabled={!name.trim()} onPress={() => void start()} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  input: { marginTop: 20, minHeight: 56, borderRadius: 16, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line, paddingHorizontal: 16, color: color.bone, fontFamily: font.body, fontSize: 16 },
  code: { marginTop: 22, alignItems: "center", paddingVertical: 22 },
});
