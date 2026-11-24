import { useState } from "react";
import { Linking, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CAPTION_MAX, KINDS, LOG_CHIPS, NO_PHOTO_LINK, POST_RULES_LINE, chipLabel, type Kind } from "@shared/tracker";
import { POST_SESSION_DETAIL, POST_SESSION_ROW } from "@shared/one-app";
import { useMe } from "@/api/queries";
import { ApiError, OFFLINE_MESSAGE } from "@/api/client";
import { logTraining, refreshFree } from "@/api/free";
import { feel, tick } from "@/feel";
import { FormScreen } from "@/FormScreen";
import { postTraining, type PickedPhoto } from "@/post-api";
import { setPref, usePrefs } from "@/prefs";
import { turnOnNotifications } from "@/push";
import { Body, Button, Head, Icon, Label, Press } from "@/ui";
import { color, font } from "@/theme";

// Post my training (the website's composer): a photo, how long, and one
// optional line. The post IS the log: the time goes on the week the moment
// it is posted, and a photo posted today is what opens today's posts from
// friends.
//
// The camera opens only once the phone has said yes to it; a no is said
// plainly with the way to change it, and choosing from the library needs
// no permission. Training can also be logged without a photo (it counts
// toward the week, and unlocks nothing).
//
// The first time a post goes up, the phone asks once whether to say when
// a friend posts, with the reason. Nothing else is asked or offered here.
//
// Opened from a finished session's "Post it to your friends" (a member
// with the free app: lib/elite/one-app.ts) it carries `session`: only the
// photo and the line are asked. The time is already on the week, counted
// by the server from the session itself, so there is no length to pick and
// it can never count twice.
export default function Post() {
  const router = useRouter();
  const { session: sessionParam } = useLocalSearchParams<{ session?: string }>();
  const session = typeof sessionParam === "string" && /^\d{1,3}-\d{1,2}$/.test(sessionParam) ? sessionParam : null;
  const insets = useSafeAreaInsets();
  const me = useMe();
  const [prefs] = usePrefs();
  const gym = me.data?.free?.gym === true;
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [plain, setPlain] = useState(false);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [kind, setKind] = useState<Kind>("training");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraOff, setCameraOff] = useState(false);
  const [asking, setAsking] = useState(false);
  const [turningOn, setTurningOn] = useState(false);

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
        ? await ImagePicker.launchCameraAsync({ quality: 0.9 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
    } catch {
      return setError(camera ? "The camera did not open. Choose from your photos instead." : "Your photos did not open. Try again.");
    }
    const a = res.canceled ? null : res.assets[0];
    if (!a) return;
    setPlain(false);
    setPhoto({ uri: a.uri, width: a.width, height: a.height });
  }

  async function done() {
    await refreshFree();
    router.back();
  }

  async function send() {
    if (session ? !photo : minutes === null) return;
    setError(null);
    setBusy(true);
    try {
      if (photo && session) {
        await postTraining({ photo, session, caption });
      } else if (photo && minutes !== null) {
        await postTraining({ photo, minutes, kind, caption });
      } else if (minutes !== null) {
        const res = await logTraining(minutes, kind);
        if (!res.ok) throw new ApiError(400, null, res.error ?? "Your time was not saved. Try again.");
      }
      feel("drill");
      // asked once, after the first photo that went up
      if (photo && !prefs.pushAsked) {
        void refreshFree();
        return setAsking(true);
      }
      await done();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : OFFLINE_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  if (asking) {
    return (
      <View style={[styles.fill, { paddingTop: insets.top + 90, paddingBottom: insets.bottom + 24, paddingHorizontal: 24 }]}>
        <Head size={34}>Know the moment your friends post?</Head>
        <Body dim style={{ marginTop: 12 }}>
          We tell you when a friend posts or gives you props. Never more than that, and never late at night.
        </Body>
        <Body dim size={13} style={{ marginTop: 10 }}>
          You can change this any time in Settings.
        </Body>
        <View style={{ flex: 1 }} />
        <Button
          label="Turn on notifications"
          busy={turningOn}
          onPress={() => {
            setTurningOn(true);
            void turnOnNotifications()
              .catch(() => false)
              .then(done);
          }}
        />
        <Button
          quiet
          style={{ marginTop: 10 }}
          label="Not now"
          onPress={() => {
            void setPref("pushAsked", true).then(done);
          }}
        />
      </View>
    );
  }

  const ready = photo !== null || plain;

  return (
    <FormScreen
      header={
        <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 12 }}>
          <Press onPress={() => router.back()} style={{ width: 44, height: 44, justifyContent: "center", alignItems: "center" }} accessibilityLabel="Close">
            <Icon name="close" />
          </Press>
        </View>
      }
      contentStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
    >
      {photo ? (
        <View style={styles.preview}>
          <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Your training photo" />
        </View>
      ) : null}

      {!ready ? (
        <>
          <Head size={36} style={{ marginTop: 12 }}>
            {session ? POST_SESSION_ROW : "Post my training"}
          </Head>
          <Body dim style={{ marginTop: 10 }}>
            {session ? POST_SESSION_DETAIL : POST_RULES_LINE}
          </Body>
          <View style={{ gap: 10, marginTop: 24 }}>
            <Button label="Take a photo" onPress={() => void choose(true)} />
            <Button quiet label="Choose from photos" onPress={() => void choose(false)} />
          </View>
          {cameraOff ? (
            <View style={{ marginTop: 12 }}>
              <Body style={{ color: color.danger }}>The camera is turned off for Strive Elite. Turn it on in Settings, or choose from your photos.</Body>
              <Press onPress={() => void Linking.openSettings()} style={styles.link} accessibilityRole="link">
                <Label size={14}>Open Settings</Label>
              </Press>
            </View>
          ) : null}
          {error ? <Body style={{ color: color.danger, marginTop: 12 }}>{error}</Body> : null}
          {session ? null : (
            <Press
              onPress={() => {
                setError(null);
                setPlain(true);
              }}
              style={[styles.link, { alignSelf: "center", marginTop: 14 }]}
              accessibilityLabel={NO_PHOTO_LINK}
            >
              <Label dim size={14}>
                {NO_PHOTO_LINK}
              </Label>
            </Press>
          )}
        </>
      ) : (
        <>
          <Head size={36} style={{ marginTop: 18 }}>
            {session ? "Your session, your photo" : "How long did you train?"}
          </Head>
          {session ? (
            <Body dim style={{ marginTop: 10 }}>
              Your time is already on your week.
            </Body>
          ) : null}

          {gym && !session ? (
            <View style={styles.kinds} accessibilityRole="radiogroup" accessibilityLabel="What you are posting">
              {KINDS.map((k) => (
                <Press
                  key={k.id}
                  style={[styles.kind, kind === k.id ? styles.kindOn : null]}
                  onPress={() => {
                    tick();
                    setKind(k.id);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: kind === k.id }}
                  accessibilityLabel={k.label}
                >
                  <Label style={{ color: kind === k.id ? color.bone : color.dim }}>{k.label}</Label>
                </Press>
              ))}
            </View>
          ) : null}

          <View style={[styles.chips, session ? { display: "none" } : null]} accessibilityRole="radiogroup" accessibilityLabel="How long">
            {LOG_CHIPS.map((m) => (
              <Press
                key={m}
                style={[styles.chip, minutes === m ? styles.chipOn : null]}
                onPress={() => {
                  tick();
                  setMinutes(m);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: minutes === m }}
                accessibilityLabel={chipLabel(m)}
              >
                <Head size={22} style={{ color: minutes === m ? color.black : color.bone, textTransform: "none" }}>
                  {chipLabel(m)}
                </Head>
              </Press>
            ))}
          </View>

          {photo ? (
            <>
              <TextInput
                style={styles.note}
                value={caption}
                onChangeText={(v) => setCaption(v.replace(/[\r\n]+/g, " "))}
                placeholder="What did you work on?"
                placeholderTextColor={color.faint}
                maxLength={CAPTION_MAX}
                returnKeyType="done"
                accessibilityLabel="One line about your training"
              />
              <Body dim size={12} style={{ marginTop: 10 }}>
                {POST_RULES_LINE}
              </Body>
            </>
          ) : null}

          {error ? <Body style={{ color: color.danger, marginTop: 12 }}>{error}</Body> : null}
          <Button style={{ marginTop: 16 }} label={photo ? "Post to my friends" : "Log my training"} busy={busy} disabled={session ? !photo : minutes === null} onPress={() => void send()} />
          <Press
            onPress={() => {
              setPhoto(null);
              setPlain(false);
              setError(null);
            }}
            disabled={busy}
            style={[styles.link, { alignSelf: "center", marginTop: 6 }]}
          >
            <Label dim size={14}>
              {photo ? "Use another photo" : "Add a photo instead"}
            </Label>
          </Press>
        </>
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.black },
  preview: { width: "62%", alignSelf: "center", aspectRatio: 4 / 5, borderRadius: 24, overflow: "hidden", backgroundColor: color.fill2, marginTop: 6 },
  link: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  kinds: { flexDirection: "row", marginTop: 18, padding: 4, borderRadius: 16, backgroundColor: color.fill2, borderWidth: 1, borderColor: color.line },
  kind: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  kindOn: { backgroundColor: "#2b2b2b" },
  chips: { flexDirection: "row", gap: 8, marginTop: 14 },
  chip: { flex: 1, minHeight: 64, borderRadius: 18, backgroundColor: color.fill2, borderWidth: 1, borderColor: color.line, alignItems: "center", justifyContent: "center" },
  chipOn: { backgroundColor: color.bone, borderColor: color.bone },
  note: { marginTop: 14, minHeight: 54, borderRadius: 16, backgroundColor: color.fill2, borderWidth: 1, borderColor: color.line, paddingHorizontal: 16, color: color.bone, fontFamily: font.body, fontSize: 16 },
});
