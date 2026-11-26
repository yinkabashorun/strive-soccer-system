import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CODE_LENGTH, CONFIRM_COPY, RESEND_SECONDS, cleanCode, type ConfirmAnswer } from "@shared/email-confirm";
import { keys, useMe } from "@/api/queries";
import { queryClient } from "@/api/queryClient";
import { ApiError, OFFLINE_MESSAGE } from "@/api/client";
import { changeEmailAddress, confirmEmailCode, sendEmailCode } from "@/email-api";
import { signOutEverywhere } from "@/account";
import { FormScreen } from "@/FormScreen";
import { LabeledField } from "@/LabeledField";
import { tick } from "@/feel";
import { Body, Button, Eyebrow, Head, Label, Press } from "@/ui";
import { color, font } from "@/theme";

// "Check your email" (093): a new account types the 6 digit code from its
// email before anything else (src/navigation.ts puts it first; the server
// refuses every other route until it is typed, lib/elite/app-api.ts). One
// box for the code, which iOS fills from Mail on its own (oneTimeCode),
// Confirm on the keyboard, Send a new code (once a minute, with the time
// said plainly), and Wrong email? Change it, a second state of the same
// screen. Delete my account and Sign out stay one tap away. Every word is
// lib/elite/email-confirm.ts CONFIRM_COPY, the website's own.
// Where the code box rests when the keyboard comes up: far enough down
// that the title and "We sent a 6 digit code to <email>" stay on screen.
// The page's default brought the box to the top, which scrolled the
// address a player is checking out of sight (seen in the simulator's
// picture, Nov 26 2026). The box sits about this far down the page, so
// the page does not move at all.
const CODE_REVEAL_TOP = 240;

export default function ConfirmEmail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useMe().data;
  const [email, setEmail] = useState(me?.emailConfirm?.email ?? me?.viewer.email ?? "");
  const [code, setCode] = useState("");
  const [changing, setChanging] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [line, setLine] = useState<{ text: string; bad: boolean } | null>(null);
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const sentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);
  useEffect(() => () => {
    if (sentTimer.current) clearTimeout(sentTimer.current);
  }, []);

  // Show what the server said. True when it went through.
  function show(r: ConfirmAnswer, okText?: string): boolean {
    if (r.email) setEmail(r.email);
    if (r.ok) {
      if (okText) {
        setLine({ text: okText, bad: false });
        if (sentTimer.current) clearTimeout(sentTimer.current);
        sentTimer.current = setTimeout(() => setLine(null), 4000);
      }
      return true;
    }
    setLine({ text: r.error, bad: r.reason !== "expired" });
    if (r.waitSeconds) setWait(r.waitSeconds);
    else if (r.reason === "expired") setWait(RESEND_SECONDS);
    return false;
  }

  async function run(call: () => Promise<ConfirmAnswer>, okText?: string): Promise<boolean> {
    setBusy(true);
    try {
      return show(await call(), okText);
    } catch (e) {
      setLine({ text: e instanceof ApiError ? e.message : OFFLINE_MESSAGE, bad: true });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!cleanCode(code)) return setLine({ text: CONFIRM_COPY.badCode, bad: true });
    if (await run(() => confirmEmailCode(code))) {
      tick();
      // the gatekeeper (app/_layout.tsx) moves them on from the new "me"
      await queryClient.invalidateQueries({ queryKey: keys.me });
    } else {
      setCode("");
    }
  }

  async function resend() {
    if (wait > 0) return setLine({ text: CONFIRM_COPY.resendWait(wait), bad: false });
    if (await run(sendEmailCode, CONFIRM_COPY.resent)) setWait(RESEND_SECONDS);
  }

  async function change() {
    if (await run(() => changeEmailAddress(newEmail), CONFIRM_COPY.resent)) {
      setChanging(false);
      setNewEmail("");
      setCode("");
      setWait(RESEND_SECONDS);
    }
  }

  return (
    <FormScreen
      safeTop
      revealTop={CODE_REVEAL_TOP}
      contentStyle={{ paddingTop: 52, paddingHorizontal: 24, paddingBottom: 24 }}
      footer={
        <View style={[styles.cta, { paddingBottom: insets.bottom + 16 }]}>
          {line ? (
            <View style={line.bad ? styles.error : styles.note} accessibilityLiveRegion="polite">
              <Body size={14}>{line.text}</Body>
            </View>
          ) : null}
          {changing ? (
            <Button label={CONFIRM_COPY.changeButton} busy={busy} onPress={() => void change()} />
          ) : (
            <Button label={CONFIRM_COPY.confirm} busy={busy} onPress={() => void confirm()} />
          )}
        </View>
      }
    >
      <Animated.View key={changing ? "change" : "code"} entering={FadeInDown.duration(320)}>
        <Eyebrow>{CONFIRM_COPY.eyebrow}</Eyebrow>
        {!changing ? (
          <>
            <Head size={36} style={{ marginTop: 10 }}>
              {CONFIRM_COPY.title}
            </Head>
            <Body dim style={{ marginTop: 10 }}>
              {CONFIRM_COPY.body(email)}
            </Body>
            <LabeledField
              label={CONFIRM_COPY.field}
              style={{ marginTop: 28 }}
              inputStyle={[styles.input, styles.code]}
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, CODE_LENGTH))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={CODE_LENGTH}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => void confirm()}
            />
            <View style={styles.links}>
              <Press onPress={() => void resend()} disabled={busy} style={styles.link} accessibilityLabel={CONFIRM_COPY.resend}>
                <Label size={14}>{CONFIRM_COPY.resend}</Label>
              </Press>
              {wait > 0 ? (
                <Body dim size={13}>
                  {CONFIRM_COPY.resendWait(wait)}
                </Body>
              ) : null}
              <Press
                onPress={() => {
                  setChanging(true);
                  setLine(null);
                }}
                style={styles.link}
                accessibilityLabel={CONFIRM_COPY.changeLink}
              >
                <Label dim size={14}>{CONFIRM_COPY.changeLink}</Label>
              </Press>
            </View>
          </>
        ) : (
          <>
            <Head size={36} style={{ marginTop: 10 }}>
              {CONFIRM_COPY.changeTitle}
            </Head>
            <Body dim style={{ marginTop: 10 }}>
              {CONFIRM_COPY.changeBody}
            </Body>
            <LabeledField
              label={CONFIRM_COPY.changeField}
              style={{ marginTop: 28 }}
              inputStyle={styles.input}
              value={newEmail}
              onChangeText={setNewEmail}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="send"
              onSubmitEditing={() => void change()}
            />
            <View style={styles.links}>
              <Press
                onPress={() => {
                  setChanging(false);
                  setLine(null);
                }}
                style={styles.link}
                accessibilityLabel={CONFIRM_COPY.changeBack}
              >
                <Label dim size={14}>{CONFIRM_COPY.changeBack}</Label>
              </Press>
            </View>
          </>
        )}
        <View style={styles.account}>
          <Press onPress={() => router.push("/delete-account")} style={styles.link}>
            <Label dim size={13}>{CONFIRM_COPY.deleteAccount}</Label>
          </Press>
          <Press onPress={() => void signOutEverywhere()} style={styles.link}>
            <Label dim size={13}>{CONFIRM_COPY.signOut}</Label>
          </Press>
        </View>
      </Animated.View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  cta: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: color.black },
  error: { marginBottom: 12, padding: 14, borderRadius: 14, backgroundColor: "rgba(255,107,94,0.12)", borderWidth: 1, borderColor: "rgba(255,107,94,0.35)" },
  note: { marginBottom: 12, padding: 14, borderRadius: 14, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line },
  input: { minHeight: 56, borderRadius: 16, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line, paddingHorizontal: 16, color: color.bone, fontFamily: font.body, fontSize: 16 },
  code: { fontFamily: font.head, fontSize: 30, letterSpacing: 12, textAlign: "center" },
  links: { marginTop: 18, alignItems: "flex-start", gap: 2 },
  link: { minHeight: 44, justifyContent: "center" },
  account: { flexDirection: "row", gap: 22, marginTop: 36 },
});
