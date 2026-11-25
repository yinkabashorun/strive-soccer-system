import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AGES,
  FEET,
  LEVELS,
  POSITIONS,
  QUIZ_QUESTIONS,
  QUIZ_STEPS,
  RATING_MAX,
  RATING_MIN,
  RATING_WORDS,
  SPACES,
  TEAM_TRAINING,
  attributesIn,
  lowestAttributes,
  stepReady,
  stillToRate,
  type QuizStepId,
  canSkip,
} from "@shared/quiz";
import { FREE_QUESTIONS, FREE_STEPS, freeStepReady, type FreeAnswers, type FreeStepId } from "@shared/free-intake";
import { GOALS, GRADES } from "@shared/tracker";
import { weakSpotPhrase } from "@shared/experience";
import { sessionsFor, sessionsWord } from "@shared/training";
import { useMe, useSubmitQuiz } from "@/api/queries";
import { rereadMe, saveIntake } from "@/api/free";
import { ApiError } from "@/api/client";
import { FormScreen, useRevealOnFocus } from "@/FormScreen";
import { MEDIA_BASE } from "@/config";
import { tick } from "@/feel";
import { useDraft } from "@/quiz-draft";
import { isStep, nextStepId, quizStepIds, stepPosition } from "@/quiz-steps";
import { Body, Button, Eyebrow, Head, Icon, Label, Press } from "@/ui";
import { color, font } from "@/theme";

// One question a screen (experience.md, moment 2). A question with one
// answer moves on by itself the moment it is tapped; a question with
// several (the ratings, what is near, the typed ones) has one Next button.
//
// The same screens serve a member and a free account (src/quiz-steps.ts
// says which ones each is shown). A member's answers go to the intake and
// their week is built; a free account's are stored whole, and the offer
// that follows is named from them. The photo and the @username are their
// own screen (app/profile-setup.tsx), never part of this.
export default function QuizStep() {
  const { step } = useLocalSearchParams<{ step: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const free = me.data?.state.kind === "free";
  // Fixed for the whole quiz: the list does not change under the player.
  const [order] = useState<string[]>(() => quizStepIds(me.data));
  const { answers: a, set, clear } = useDraft();
  const submit = useSubmitQuiz();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isStep(step, order)) return null;
  const id = step;
  const quiz = free ? FREE_STEPS.find((s) => s.id === id) : QUIZ_STEPS.find((s) => s.id === id);
  if (!quiz) return null;
  const question = free ? FREE_QUESTIONS[quiz.id as FreeStepId] : QUIZ_QUESTIONS[quiz.id as QuizStepId];
  const { index, total } = stepPosition(id, order);
  const readyOf = (s: string, of: FreeAnswers) => (free ? freeStepReady(s as FreeStepId, of) : stepReady(s as QuizStepId, of));
  const readyAt = (s: string) => readyOf(s, a);

  // `now` is the answers INCLUDING what the last tap just answered. The
  // draft is saved a moment after a tap, so reading it here would miss the
  // last screen's own answer: on the free quiz, whose last screen is "What
  // is near where you train?", the first tap on Finish found that screen
  // still unanswered and opened it again, and only a second tap went on.
  async function finish(now: FreeAnswers) {
    // a screen skipped on the way is asked for, never saved blank
    const missing = order.find((s) => !readyOf(s, now));
    if (missing) {
      router.push(`/onboarding/${missing}`);
      return;
    }
    setError(null);
    if (free) {
      // Stored, then this account is read again: the gatekeeper takes it
      // on (the photo and @username if they are owed, then the offer).
      setSaving(true);
      try {
        await saveIntake(now);
        await clear();
        await rereadMe();
      } catch (e) {
        setSaving(false);
        setError(e instanceof ApiError ? e.message : "That did not save. Check your connection and try again.");
      }
      return;
    }
    try {
      await submit.mutateAsync(now);
      await clear();
      // The building screen names their own weak spot and their week.
      const load = TEAM_TRAINING.find((t) => t.id === now.team)?.load;
      router.replace({
        pathname: "/onboarding/building",
        params: { spot: weakSpotPhrase(lowestAttributes(now.attrs)) ?? "you", sessions: sessionsWord(sessionsFor(load)) },
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save. Check your connection and try again.");
    }
  }

  function next(patch?: Partial<FreeAnswers>) {
    if (patch) set(patch);
    const n = nextStepId(id, order);
    if (n) router.push(`/onboarding/${n}`);
    else void finish(patch ? { ...a, ...patch } : a);
  }

  // A tap is the answer: a light tick and the next question comes up.
  // On the last screen the tap only answers; Finish saves it.
  function pick(patch: Partial<FreeAnswers>) {
    tick();
    set(patch);
    if (!last) setTimeout(() => next(), 180);
  }

  const ready = readyAt(id);
  // A rating page says which row is still open, right above Next.
  const toRate = id === "onBall" || id === "offBall" ? stillToRate(id === "onBall" ? "on" : "off", a.attrs) : null;
  const last = nextStepId(id, order) === null;

  return (
    <FormScreen
      contentStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
      header={
          <View style={[styles.head, { paddingTop: insets.top + 8 }]}>
            <Press onPress={() => router.back()} style={styles.back} accessibilityLabel="Back">
              <Icon name="back" />
            </Press>
            <View style={styles.progress} accessible accessibilityLabel={`Question ${index + 1} of ${total}`}>
              <View style={[styles.progressFill, { width: `${((index + 1) / total) * 100}%` }]} />
            </View>
          </View>
      }
      footer={
          // a question a tap answers has no button, unless it is the last one
          !quiz.autoAdvance || last ? (
            <View style={[styles.cta, { paddingBottom: insets.bottom + 16 }]}>
              {toRate ? (
                <Body dim size={13} style={styles.toRate}>
                  {toRate}
                </Body>
              ) : null}
              <NextButton ready={ready || id === "nearby"} last={last} skip={canSkip(id, a)} busy={submit.isPending || saving} onNext={() => next(id === "nearby" ? { nearbyAnswered: true } : undefined)} />
            </View>
          ) : null
      }
    >
        <Animated.View entering={FadeInDown.duration(320)}>
          <Eyebrow style={{ marginTop: 18 }}>{quiz.section}</Eyebrow>
          <Head size={36} style={{ marginTop: 10 }}>
            {question.title}
          </Head>
          {question.sub ? (
            <Body dim style={{ marginTop: 10 }}>
              {question.sub}
            </Body>
          ) : null}
        </Animated.View>
        <View style={{ marginTop: 24 }}>
          <Answers id={quiz.id} a={a} pick={pick} set={set} />
        </View>
        {error ? (
          <Body size={14} style={{ color: color.danger, marginTop: 14 }}>
            {error}
          </Body>
        ) : null}
    </FormScreen>
  );
}

// "Skip" while a question that may be left empty is empty (lib/elite/quiz.ts
// canSkip): a player with no team is never left wondering what to type.
function NextButton({ ready, last, skip, busy, onNext }: { ready: boolean; last: boolean; skip: boolean; busy: boolean; onNext: () => void }) {
  return <Button label={last ? "Finish" : skip ? "Skip" : "Next"} busy={busy} disabled={!ready} onPress={onNext} />;
}

function Choice({ label, line, on, onPress, image }: { label: string; line?: string; on: boolean; onPress: () => void; image?: string }) {
  return (
    <Press onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={label} style={[styles.choice, image ? styles.tile : null, on ? styles.choiceOn : null]}>
      {image ? <Image source={{ uri: image }} style={[StyleSheet.absoluteFill, { opacity: 0.5 }]} contentFit="cover" /> : null}
      <View style={{ flex: 1 }}>
        <Label size={17}>{label}</Label>
        {line ? (
          <Body dim size={13} style={{ marginTop: 3 }}>
            {line}
          </Body>
        ) : null}
      </View>
      {on ? (
        <View style={styles.tickOn}>
          <Icon name="check" size={14} stroke={color.black} />
        </View>
      ) : null}
    </Press>
  );
}

function Answers({ id, a, pick, set }: { id: QuizStepId | FreeStepId; a: FreeAnswers; pick: (p: Partial<FreeAnswers>) => void; set: (p: Partial<FreeAnswers>) => void }) {
  switch (id) {
    // the free quiz's own two questions (lib/elite/free-intake.ts)
    case "grade":
      return (
        <View style={{ gap: 10 }}>
          {GRADES.map((g) => (
            <Choice key={g.id} label={g.label} on={a.grade === g.id} onPress={() => pick({ grade: g.id })} />
          ))}
        </View>
      );
    case "aim":
      return (
        <View style={{ gap: 10 }}>
          {GOALS.map((g) => (
            <Choice key={g.id} label={g.label} on={a.aim === g.id} onPress={() => pick({ aim: g.id })} />
          ))}
        </View>
      );
    case "gender":
      return (
        <View style={{ gap: 10 }}>
          <Choice label="Boy" on={a.gender === "boy"} onPress={() => pick({ gender: "boy" })} />
          <Choice label="Girl" on={a.gender === "girl"} onPress={() => pick({ gender: "girl" })} />
        </View>
      );
    case "age":
      return (
        <View style={styles.grid}>
          {AGES.map((n) => (
            <Press key={n} onPress={() => pick({ age: n })} style={[styles.age, a.age === n ? styles.choiceOn : null]} accessibilityState={{ selected: a.age === n }} accessibilityLabel={`${n}`}>
              <Head size={24}>{String(n)}</Head>
            </Press>
          ))}
        </View>
      );
    case "position":
      return (
        <View style={{ gap: 10 }}>
          {POSITIONS.map((p) => (
            <Choice key={p} label={p} on={a.position === p} onPress={() => pick({ position: p })} />
          ))}
        </View>
      );
    case "foot":
      return (
        <View style={{ gap: 10 }}>
          {FEET.map((f) => (
            <Choice key={f} label={f} on={a.foot === f} onPress={() => pick({ foot: f })} />
          ))}
        </View>
      );
    case "level":
      return (
        <View style={{ gap: 10 }}>
          {LEVELS.map((l) => (
            <Choice key={l} label={l} on={a.level === l} onPress={() => pick({ level: l })} />
          ))}
        </View>
      );
    case "team":
      return (
        <View style={{ gap: 10 }}>
          {TEAM_TRAINING.map((t) => (
            <Choice key={t.id} label={t.label} on={a.team === t.id} onPress={() => pick({ team: t.id })} />
          ))}
        </View>
      );
    case "space":
      return (
        <View style={{ gap: 10 }}>
          {SPACES.map((s) => (
            <Choice key={s.id} label={s.label} line={s.line} image={`${MEDIA_BASE}${s.image}`} on={a.space === s.id} onPress={() => pick({ space: s.id })} />
          ))}
        </View>
      );
    case "nearby":
      return (
        <View style={{ gap: 10 }}>
          <Choice label="A wall" line="To pass and receive against." on={a.wall} onPress={() => { tick(); set({ wall: !a.wall }); }} />
          <Choice label="A goal" line="Any size, to shoot at." on={a.goal} onPress={() => { tick(); set({ goal: !a.goal }); }} />
          <Body dim size={13}>Neither is fine too.</Body>
        </View>
      );
    case "club":
      return <Field value={a.club} onChange={(club) => set({ club })} placeholder="Club and age group" />;
    case "goals":
      return <Field value={a.goals} onChange={(goals) => set({ goals })} placeholder="Make the A team" multiline />;
    case "onBall":
    case "offBall":
      return (
        <View style={{ gap: 18 }}>
          {attributesIn(id === "onBall" ? "on" : "off").map((x) => (
            <View key={x.id}>
              <Label size={16}>{x.label}</Label>
              <Body dim size={13} style={{ marginTop: 2 }}>
                {x.line}
              </Body>
              <View style={styles.scale}>
                {Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, i) => i + RATING_MIN).map((v) => {
                  const on = a.attrs[x.id] === v;
                  return (
                    <Press
                      key={v}
                      onPress={() => {
                        tick();
                        set({ attrs: { [x.id]: v } });
                      }}
                      style={[styles.dot, on ? styles.dotOn : null]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${x.label} ${v} of ${RATING_MAX}`}
                    >
                      <Head size={18} style={{ color: on ? color.black : color.dim }}>{String(v)}</Head>
                    </Press>
                  );
                })}
              </View>
              <View style={styles.scaleWords}>
                <Body dim size={11}>{RATING_WORDS[1]}</Body>
                <Body dim size={11}>{RATING_WORDS[3]}</Body>
                <Body dim size={11}>{RATING_WORDS[5]}</Body>
              </View>
            </View>
          ))}
        </View>
      );
    case "parent":
      return (
        <View style={{ gap: 12 }}>
          <Field value={a.parentName} onChange={(parentName) => set({ parentName })} placeholder="Their full name" />
          <Field value={a.parentEmail} onChange={(parentEmail) => set({ parentEmail })} placeholder="Their email (optional)" keyboard="email-address" />
          <Field value={a.parentPhone} onChange={(parentPhone) => set({ parentPhone })} placeholder="Their phone" keyboard="phone-pad" />
        </View>
      );
    default:
      return null;
  }
}

function Field({
  value,
  onChange,
  placeholder,
  multiline,
  keyboard,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboard?: "email-address" | "phone-pad";
}) {
  // the box that takes the cursor is scrolled into reach (FormScreen)
  const reveal = useRevealOnFocus();
  return (
    <TextInput
      style={[styles.input, multiline ? { minHeight: 120, textAlignVertical: "top", paddingTop: 16 } : null]}
      value={value}
      onChangeText={onChange}
      onFocus={reveal}
      placeholder={placeholder}
      placeholderTextColor={color.faint}
      multiline={multiline}
      keyboardType={keyboard}
      autoCapitalize={keyboard ? "none" : "sentences"}
      accessibilityLabel={placeholder}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.black },
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14 },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  progress: { flex: 1, height: 4, borderRadius: 2, backgroundColor: color.fill2, overflow: "hidden", marginRight: 10 },
  progressFill: { height: 4, backgroundColor: color.bone },
  choice: { minHeight: 60, borderRadius: 18, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line, paddingHorizontal: 18, paddingVertical: 14, flexDirection: "row", alignItems: "center", overflow: "hidden" },
  tile: { minHeight: 120, alignItems: "flex-end" },
  choiceOn: { borderColor: color.bone, borderWidth: 2 },
  tickOn: { width: 26, height: 26, borderRadius: 13, backgroundColor: color.bone, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  age: { width: "22%", minHeight: 64, borderRadius: 18, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line, alignItems: "center", justifyContent: "center" },
  scale: { flexDirection: "row", gap: 8, marginTop: 10 },
  dot: { flex: 1, height: 48, borderRadius: 14, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line, alignItems: "center", justifyContent: "center" },
  dotOn: { backgroundColor: color.bone, borderColor: color.bone },
  scaleWords: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  input: { minHeight: 56, borderRadius: 16, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line, paddingHorizontal: 16, color: color.bone, fontFamily: font.body, fontSize: 16 },
  // In the page's own flow, never pinned with position absolute: a pinned
  // button ignores the room the page makes for the keyboard and sits BEHIND
  // it (the simulator, Nov 24 2026: "What team do you play for?" with the
  // keyboard up and no Next to tap). In the flow it rides on the keyboard.
  cta: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: color.black },
  toRate: { textAlign: "center", marginBottom: 10 },
});
