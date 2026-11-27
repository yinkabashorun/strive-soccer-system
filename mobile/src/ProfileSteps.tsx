import { useEffect, useRef, useState } from "react";
import { Linking, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { SETUP_COPY } from "@shared/account-profile";
import { USERNAME_MESSAGES, normalizeUsername, usernameProblem } from "@shared/username";
import { AVATAR_MESSAGE } from "@shared/tracker";
import { ApiError } from "./api/client";
import { checkUsername, savePhoto, saveUsername } from "./profile-api";
import { tick } from "./feel";
import { Body, Button, Head, Label, Press } from "./ui";
import { color, font } from "./theme";

// The two screens of the profile set-up (081), used by the quiz's last two
// screens and by the one-time screen for members who joined before: the
// @username (checked as they type, taken on Next) and the profile photo
// (taken or picked, cut square, saved). No skip: both are required, and the
// server refuses onboarding without them. The words are the website's.

export function UsernameStep({ ideas, initial, onDone }: { ideas: string[]; initial?: string | null; onDone: (name: string) => void }) {
  const [value, setValue] = useState(initial ?? "");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  // The shape is answered at once; whether it is free, once typing settles.
  useEffect(() => {
    const name = normalizeUsername(value);
    if (!name) return setStatus(null);
    const problem = usernameProblem(name);
    if (problem) return setStatus({ ok: false, text: USERNAME_MESSAGES[problem] });
    if (name === initial) return setStatus({ ok: true, text: `@${name} is yours.` });
    const n = ++seq.current;
    const id = setTimeout(() => {
      checkUsername(name)
        .then((r) => n === seq.current && setStatus(r.ok ? { ok: true, text: `@${r.name} is free.` } : { ok: false, text: r.error }))
        .catch(() => n === seq.current && setStatus({ ok: false, text: USERNAME_MESSAGES.offline }));
    }, 400);
    return () => clearTimeout(id);
  }, [value, initial]);

  async function take() {
    setBusy(true);
    try {
      const r = await saveUsername(value);
      if (r.ok) onDone(r.name);
      else setStatus({ ok: false, text: r.error });
    } catch (e) {
      setStatus({ ok: false, text: e instanceof ApiError ? e.message : USERNAME_MESSAGES.offline });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <Head size={36}>{SETUP_COPY.username.title}</Head>
      <Body dim style={{ marginTop: 10 }}>
        {SETUP_COPY.username.lead}
      </Body>
      <View style={styles.field}>
        <Label size={17} dim>
          @
        </Label>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={(v) => setValue(normalizeUsername(v))}
          placeholder="username"
          placeholderTextColor={color.faint}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username-new"
          textContentType="username"
          maxLength={20}
          accessibilityLabel="Username"
        />
      </View>
      {status ? (
        <Body size={13.5} style={{ marginTop: 8, color: status.ok ? color.bone : color.danger }}>
          {status.text}
        </Body>
      ) : null}
      {ideas.length && !value ? (
        <View style={styles.ideas}>
          {ideas.slice(0, 4).map((i) => (
            <Press
              key={i}
              onPress={() => {
                tick();
                setValue(i);
              }}
              style={styles.idea}
              accessibilityLabel={`Use @${i}`}
            >
              <Label size={14}>@{i}</Label>
            </Press>
          ))}
        </View>
      ) : null}
      <Button style={{ marginTop: 24 }} label="Next" busy={busy} disabled={!status?.ok} onPress={take} />
    </View>
  );
}

export function PhotoStep({ seenBy, initialUri, onDone }: { seenBy: string; initialUri?: string | null; onDone: () => void }) {
  const [uri, setUri] = useState<string | null>(initialUri ?? null);
  const [saved, setSaved] = useState(Boolean(initialUri));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The camera opens only once the phone has said yes to it: the picker
  // does not ask on its own, it just refuses. A no is said plainly, with
  // the way to change it, and choosing from photos still works without it.
  const [cameraOff, setCameraOff] = useState(false);

  async function choose(camera: boolean) {
    setError(null);
    setCameraOff(false);
    let res: ImagePicker.ImagePickerResult;
    try {
      if (camera) {
        const asked = await ImagePicker.requestCameraPermissionsAsync();
        if (!asked.granted) return setCameraOff(true);
      }
      res = camera
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.9, cameraType: ImagePicker.CameraType.front })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
    } catch {
      return setError(camera ? "The camera didn't open. Choose from your photos instead." : "Your photos didn't open. Try again.");
    }
    if (res.canceled || !res.assets[0]) return;
    setUri(res.assets[0].uri);
    setSaved(false);
    setBusy(true);
    try {
      await savePhoto(res.assets[0].uri);
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : AVATAR_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <Head size={36}>{SETUP_COPY.photo.title}</Head>
      <Body dim style={{ marginTop: 10 }}>
        {SETUP_COPY.photo.lead(seenBy)}
      </Body>
      <View style={styles.photo}>{uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}</View>
      <View style={{ gap: 10 }}>
        <Button quiet label="Take a photo" onPress={() => void choose(true)} disabled={busy} />
        <Button quiet label="Choose from photos" onPress={() => void choose(false)} disabled={busy} />
      </View>
      {cameraOff ? (
        <View style={{ marginTop: 12 }}>
          <Body style={{ color: color.danger }}>The camera is turned off for Strive Elite. Turn it on in Settings, or choose from your photos.</Body>
          <Press onPress={() => void Linking.openSettings()} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }} accessibilityRole="link">
            <Label size={14}>Open Settings</Label>
          </Press>
        </View>
      ) : null}
      {error ? <Body style={{ color: color.danger, marginTop: 12 }}>{error}</Body> : null}
      <Button style={{ marginTop: 24 }} label="Next" busy={busy} disabled={!saved} onPress={onDone} />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 24, minHeight: 56, borderRadius: 16, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line, paddingHorizontal: 16 },
  input: { flex: 1, color: color.bone, fontFamily: font.body, fontSize: 17, minHeight: 54 },
  ideas: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  idea: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: color.fill2, justifyContent: "center" },
  photo: { width: 168, height: 168, borderRadius: 84, alignSelf: "center", marginVertical: 26, backgroundColor: color.fill2, overflow: "hidden", borderWidth: 1, borderColor: color.line },
});
