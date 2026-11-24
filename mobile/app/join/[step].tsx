import { useState } from "react";
import { Keyboard, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { APP_API } from "@shared/app-contract";
import { TERMS_STATEMENT } from "@shared/legal";
import { nyToday } from "@shared/time";
import {
  BIRTH_REQUIRED_MESSAGE,
  FREE_AGE_STATEMENT,
  FREE_AGREEMENT_POINTS,
  MONTH_NAMES,
  UNDER_AGE_LINE,
  UNDER_AGE_TITLE,
  birthYears,
  cleanBirth,
  joinProblem,
  oldEnough,
  type JoinStep,
} from "@shared/tracker";
import { ApiError, api } from "@/api/client";
import { keys } from "@/api/queries";
import { queryClient } from "@/api/queryClient";
import { signInAfterJoin } from "@/auth/session";
import { FormScreen } from "@/FormScreen";
import { tick } from "@/feel";
import { JOIN_STEPS, clearJoin, isJoinStep, setJoin, useJoin, type JoinStepId } from "@/join-draft";
import { openSite } from "@/links";
import { Body, Button, Head, Icon, Label, Press } from "@/ui";
import { color, font } from "@/theme";

// Join free, one question a screen: the same rules as the website's free
// sign-up (lib/elite/tracker.ts joinProblem, the website's own route). The
// month and year of birth come first, before anything else is typed: the
// free app is for players 13 and older, and an answer under 13 ends here
// with nothing sent and nothing kept. The account is made on the last
// screen, then this phone signs in with the email and password just chosen.
const YEARS_SHOWN = 24;
const TICK_BOTH = "Tick both boxes to go on.";

export default function Join() {
  const { step } = useLocalSearchParams<{ step: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const d = useJoin();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [allYears, setAllYears] = useState(false);

  if (!isJoinStep(step)) return null;
  const id: JoinStepId = step;
  const index = JOIN_STEPS.indexOf(id);
  const today = nyToday();

  if (d.young) {
    return (
      <View style={[styles.young, { paddingTop: insets.top + 120, paddingBottom: insets.bottom + 24 }]}>
        <Head size={40}>{UNDER_AGE_TITLE}</Head>
        <Body dim style={{ marginTop: 12 }}>
          {UNDER_AGE_LINE}
        </Body>
        <Button quiet style={{ marginTop: 28 }} label="Back to sign in" onPress={() => router.replace("/sign-in")} />
      </View>
    );
  }

  function go(to: JoinStepId) {
    setError(null);
    router.push(`/join/${to}`);
  }

  function next() {
    Keyboard.dismiss();
    setError(null);
    if (id === "age") {
      const birth = cleanBirth({ month: d.month, year: d.year }, today);
      if (!birth) return setError(BIRTH_REQUIRED_MESSAGE);
      if (!oldEnough(birth, today)) return setJoin({ young: true });
      return go("name");
    }
    if (id === "agree") return void create();
    const problem = joinProblem(d, id as JoinStep);
    if (problem) return setError(problem.message);
    go(JOIN_STEPS[index + 1]);
  }

  async function create() {
    if (!d.agreedAge || !d.agreedTerms) return setError(TICK_BOTH);
    setBusy(true);
    try {
      await api(APP_API.freeJoin, {
        method: "POST",
        open: true,
        timeoutMs: 30_000,
        body: {
          firstName: d.firstName,
          lastName: d.lastName,
          email: d.email,
          phone: d.phone,
          password: d.password,
          birth: { month: d.month, year: d.year },
          agreed: { guardian: d.agreedAge, terms: d.agreedTerms },
        },
      });
    } catch (e) {
      setBusy(false);
      const data = e instanceof ApiError ? e.data : null;
      if (data?.reason === "age") return setJoin({ young: true });
      // a typed detail was turned down: back to the screen it is on
      if (data?.reason === "field" && isJoinStep(String(data.step))) {
        setJoin({ problem: { step: String(data.step) as JoinStepId, message: e instanceof ApiError ? e.message : "Check this and try again." } });
        return router.navigate(`/join/${String(data.step)}`);
      }
      return setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    }
    const problem = await signInAfterJoin(d.email, d.password);
    if (problem) {
      // the account exists; the sign-in screen is the way in
      setBusy(false);
      clearJoin();
      return router.replace("/sign-in");
    }
    clearJoin();
    await queryClient.invalidateQueries({ queryKey: keys.me });
  }

  const sent = d.problem?.step === id ? d.problem.message : null;
  const shown = error ?? sent;
  const years = birthYears(today);

  return (
    <FormScreen
      contentStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
      header={
        <View style={[styles.head, { paddingTop: insets.top + 8 }]}>
          <Press onPress={() => router.back()} style={styles.back} accessibilityLabel="Back">
            <Icon name="back" />
          </Press>
          <View style={styles.progress} accessible accessibilityLabel={`Step ${index + 1} of ${JOIN_STEPS.length}`}>
            <View style={[styles.progressFill, { width: `${((index + 1) / JOIN_STEPS.length) * 100}%` }]} />
          </View>
        </View>
      }
      footer={
        <View style={[styles.cta, { paddingBottom: insets.bottom + 16 }]}>
          {shown ? (
            <View style={styles.error} accessibilityLiveRegion="polite">
              <Body size={14}>{shown}</Body>
            </View>
          ) : null}
          {id === "age" ? (
            <Body dim size={13} style={{ textAlign: "center", marginBottom: 10 }}>
              For players 13 and older
            </Body>
          ) : null}
          <Button label={id === "agree" ? "Create my account" : "Next"} busy={busy} onPress={next} />
        </View>
      }
    >
      <Animated.View entering={FadeInDown.duration(320)}>
        {id === "age" ? (
          <>
            <Question title="When were you born?" line="Month and year only. It's never shown to anyone." />
            <Label dim size={13} style={{ marginTop: 22 }}>
              Month
            </Label>
            <View style={styles.grid}>
              {MONTH_NAMES.map((name, i) => (
                <Tile key={name} label={name.slice(0, 3)} said={name} on={d.month === i + 1} onPress={() => setJoin({ month: i + 1 })} />
              ))}
            </View>
            <Label dim size={13} style={{ marginTop: 22 }}>
              Year
            </Label>
            <View style={styles.grid}>
              {(allYears ? years : years.slice(0, YEARS_SHOWN)).map((y) => (
                <Tile key={y} label={String(y)} said={String(y)} on={d.year === y} onPress={() => setJoin({ year: y })} />
              ))}
            </View>
            {!allYears ? (
              <Press onPress={() => setAllYears(true)} style={styles.more} accessibilityLabel="Earlier years">
                <Label dim size={14}>
                  Earlier years
                </Label>
              </Press>
            ) : null}
          </>
        ) : id === "name" ? (
          <>
            <Question title="What's your name?" line="Your friends see your first name and last initial." />
            <View style={styles.fields}>
              <Field label="First name" value={d.firstName} onChange={(firstName) => setJoin({ firstName })} content="givenName" capitalize="words" />
              <Field label="Last name" value={d.lastName} onChange={(lastName) => setJoin({ lastName })} content="familyName" capitalize="words" />
            </View>
          </>
        ) : id === "contact" ? (
          <>
            <Question title="How do we reach you?" line="Your email signs you in. Your friends never see either." />
            <View style={styles.fields}>
              <Field label="Email" value={d.email} onChange={(email) => setJoin({ email })} content="username" keyboard="email-address" />
              <Field label="Phone, so a coach can reach you" value={d.phone} onChange={(phone) => setJoin({ phone })} content="telephoneNumber" keyboard="phone-pad" />
            </View>
          </>
        ) : id === "password" ? (
          <>
            <Question title="Make a password" line="At least 8 characters." />
            <View style={styles.fields}>
              <Field label="Password" value={d.password} onChange={(password) => setJoin({ password })} content="newPassword" secure />
            </View>
          </>
        ) : (
          <>
            <Question title="One last thing" line="Read these, then tick both boxes." />
            <View style={{ marginTop: 18, gap: 8 }}>
              {FREE_AGREEMENT_POINTS.map((line) => (
                <View key={line} style={styles.point}>
                  <View style={styles.bullet} />
                  <Body dim size={13.5} style={{ flex: 1 }}>
                    {line}
                  </Body>
                </View>
              ))}
            </View>
            <View style={{ marginTop: 16, gap: 10 }}>
              <Box label={FREE_AGE_STATEMENT} on={d.agreedAge} onPress={() => setJoin({ agreedAge: !d.agreedAge })} />
              <Box label={TERMS_STATEMENT} on={d.agreedTerms} onPress={() => setJoin({ agreedTerms: !d.agreedTerms })} />
            </View>
            <View style={styles.links}>
              <Press onPress={() => void openSite("/terms")} style={styles.link} accessibilityRole="link">
                <Label dim size={14}>
                  Terms of Service
                </Label>
              </Press>
              <Press onPress={() => void openSite("/privacy")} style={styles.link} accessibilityRole="link">
                <Label dim size={14}>
                  Privacy Policy
                </Label>
              </Press>
            </View>
          </>
        )}
      </Animated.View>
    </FormScreen>
  );
}

function Question({ title, line }: { title: string; line: string }) {
  return (
    <View style={{ marginTop: 18 }}>
      <Head size={36}>{title}</Head>
      <Body dim style={{ marginTop: 10 }}>
        {line}
      </Body>
    </View>
  );
}

function Tile({ label, said, on, onPress }: { label: string; said: string; on: boolean; onPress: () => void }) {
  return (
    <Press
      onPress={() => {
        tick();
        onPress();
      }}
      style={[styles.tile, on ? styles.tileOn : null]}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={said}
    >
      <Label size={15} style={{ color: on ? color.black : color.bone }}>
        {label}
      </Label>
    </Press>
  );
}

function Box({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Press
      onPress={() => {
        tick();
        onPress();
      }}
      style={styles.box}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
    >
      <View style={[styles.check, on ? styles.checkOn : null]}>{on ? <Icon name="check" size={14} stroke={color.black} /> : null}</View>
      <Body size={15} style={{ flex: 1 }}>
        {label}
      </Body>
    </Press>
  );
}

function Field({
  label,
  value,
  onChange,
  content,
  keyboard,
  capitalize = "none",
  secure,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  content: "givenName" | "familyName" | "username" | "telephoneNumber" | "newPassword";
  keyboard?: "email-address" | "phone-pad";
  capitalize?: "none" | "words";
  secure?: boolean;
}) {
  return (
    <View>
      <Label dim size={13} style={{ marginBottom: 8 }}>
        {label}
      </Label>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholderTextColor={color.faint}
        keyboardType={keyboard}
        autoCapitalize={capitalize}
        autoCorrect={false}
        textContentType={content}
        secureTextEntry={secure}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  young: { flex: 1, backgroundColor: color.black, paddingHorizontal: 24 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14 },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  progress: { flex: 1, height: 4, borderRadius: 2, backgroundColor: color.fill2, overflow: "hidden", marginRight: 10 },
  progressFill: { height: 4, backgroundColor: color.bone },
  cta: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: color.black },
  error: { marginBottom: 12, padding: 14, borderRadius: 14, backgroundColor: "rgba(255,107,94,0.12)", borderWidth: 1, borderColor: "rgba(255,107,94,0.35)" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  tile: { width: "23%", minHeight: 48, borderRadius: 14, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line, alignItems: "center", justifyContent: "center" },
  tileOn: { backgroundColor: color.bone, borderColor: color.bone },
  more: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start", marginTop: 6 },
  fields: { marginTop: 24, gap: 14 },
  input: { minHeight: 56, borderRadius: 16, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line, paddingHorizontal: 16, color: color.bone, fontFamily: font.body, fontSize: 16 },
  point: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  bullet: { width: 4, height: 4, borderRadius: 2, backgroundColor: color.bone, marginTop: 8 },
  box: { minHeight: 56, borderRadius: 16, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: color.faint, alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: color.bone, borderColor: color.bone },
  links: { flexDirection: "row", gap: 22, marginTop: 6 },
  link: { minHeight: 44, justifyContent: "center" },
});
