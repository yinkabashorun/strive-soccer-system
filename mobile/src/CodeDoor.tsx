import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  DOOR_BODY,
  DOOR_FIELD,
  DOOR_KEEP_GOING,
  DOOR_NOT_A_CODE,
  DOOR_NO_CODE,
  DOOR_PLACEHOLDER,
  DOOR_TITLE,
  DOOR_TO_FRIENDS,
  DOOR_USE,
  DOOR_WORKED,
  doorCodeFrom,
} from "@shared/free-door";
import { ApiError, OFFLINE_MESSAGE } from "@/api/client";
import { enterCode, rereadMe } from "@/api/free";
import { signOutEverywhere } from "@/account";
import { FormScreen } from "@/FormScreen";
import { openHome } from "@/go-home";
import { dropInvite, heldInvite, useHeldInvite } from "@/invite";
import { LabeledField } from "@/LabeledField";
import { Body, Button, Eyebrow, Head, Label, Press } from "@/ui";
import { color, font } from "@/theme";

// THE DOOR (lib/elite/free-door.ts): the one screen a new free account
// meets after its photo. "Have a code from a teammate or a club?"
//
// A real code asks the way the website's link does (a teammate gets a
// friend request, a club's captain a request to let the player in) and the
// server says whether this player skips the quiz (`skipped`). Then one
// button: on to their friends, or on to the quiz.
//
// No code: `onNoCode`, and the path is exactly what it always was.
//
// The button that sends the code is never switched off: a tap with an
// empty box says what a code looks like, so nobody is left tapping a dim
// button with no word of why. Both ways on are the page's footer, so they
// ride on the keyboard while the code is typed (FormScreen: a button under
// a box was behind the keyboard three times before this screen existed).
//
// A player who opened a teammate's or a club's invite LINK before they had
// an account (lib/elite/friend-link.ts) finds that code already typed here:
// the app kept it (src/invite.ts). It is still theirs to send or to clear;
// nothing is sent until "Use my code" is tapped.
export function CodeDoor({ onNoCode }: { onNoCode: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const held = useHeldInvite();
  const [code, setCode] = useState(() => heldInvite()?.code ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ line: string; skipped: boolean } | null>(null);

  // a link opened while this screen is up: its code is typed in, unless the
  // player has typed one of their own
  useEffect(() => {
    if (held) setCode((typed) => (typed.trim() ? typed : held.code));
  }, [held]);

  // going on with no code: an invite the app was keeping is not brought up again
  function noCode() {
    dropInvite();
    onNoCode();
  }

  async function use() {
    if (!doorCodeFrom(code)) return setError(DOOR_NOT_A_CODE);
    setError(null);
    setBusy(true);
    try {
      const res = await enterCode(code);
      if (!res.ok) return setError(res.error);
      // the invite the app was keeping is used: it is not offered a second time
      dropInvite();
      setDone({ line: res.line, skipped: res.skipped });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : OFFLINE_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  // The code asked. A player the server let past the quiz is read again
  // and taken to the free app (this screen is inside its area too, so
  // nothing else would move them: src/go-home.ts); anyone else goes on to
  // the quiz as before.
  async function onward() {
    if (!done?.skipped) return onNoCode();
    setBusy(true);
    try {
      await rereadMe();
      openHome(router);
    } catch {
      setBusy(false);
      setError(OFFLINE_MESSAGE);
    }
  }

  const pad = { paddingTop: 52, paddingHorizontal: 24, paddingBottom: 24 };
  const foot = { paddingHorizontal: 24, paddingTop: 10, paddingBottom: insets.bottom + 16 };

  if (done) {
    return (
      <FormScreen
        safeTop
        contentStyle={pad}
        footer={
          <View style={foot}>
            {error ? (
              <Body size={13.5} style={{ color: color.danger, marginBottom: 12 }}>
                {error}
              </Body>
            ) : null}
            <Button label={done.skipped ? DOOR_TO_FRIENDS : DOOR_KEEP_GOING} busy={busy} onPress={() => void onward()} />
          </View>
        }
      >
        <Animated.View entering={FadeInDown.duration(320)}>
          <Eyebrow>{DOOR_WORKED}</Eyebrow>
          <Head size={32} style={{ marginTop: 10 }}>
            {done.line}
          </Head>
        </Animated.View>
      </FormScreen>
    );
  }

  return (
    <FormScreen
      safeTop
      contentStyle={pad}
      footer={
        <View style={foot}>
          {error ? (
            <View accessibilityLiveRegion="polite">
              <Body size={13.5} style={{ color: color.danger, marginBottom: 12 }}>
                {error}
              </Body>
            </View>
          ) : null}
          <Button label={DOOR_USE} busy={busy} onPress={() => void use()} />
          <Button quiet style={{ marginTop: 10 }} label={DOOR_NO_CODE} onPress={noCode} />
        </View>
      }
    >
      <Animated.View entering={FadeInDown.duration(320)}>
        <Head size={36}>{DOOR_TITLE}</Head>
        <Body dim style={{ marginTop: 12 }}>
          {DOOR_BODY}
        </Body>
        <LabeledField
          label={DOOR_FIELD}
          style={{ marginTop: 22 }}
          inputStyle={styles.input}
          value={code}
          onChangeText={(t) => {
            setCode(t);
            if (error) setError(null);
          }}
          placeholder={DOOR_PLACEHOLDER}
          autoCapitalize="characters"
          autoCorrect={false}
          spellCheck={false}
          returnKeyType="go"
          onSubmitEditing={() => void use()}
        />
        <View style={styles.out}>
          <Press onPress={() => router.push("/settings")} style={styles.link}>
            <Label dim size={14}>Settings</Label>
          </Press>
          <Press onPress={() => void signOutEverywhere()} style={styles.link}>
            <Label dim size={14}>Sign out</Label>
          </Press>
        </View>
      </Animated.View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 60, borderRadius: 16, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line, paddingHorizontal: 16, color: color.bone, fontFamily: font.label, fontSize: 20, letterSpacing: 2 },
  out: { flexDirection: "row", justifyContent: "center", gap: 18, marginTop: 24 },
  link: { minHeight: 44, justifyContent: "center" },
});
