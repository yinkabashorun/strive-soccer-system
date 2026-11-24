import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { cleanAnswers, emptyAnswers } from "@shared/quiz";
import { cleanFreeAnswers, type FreeAnswers } from "@shared/free-intake";

// The quiz answers while they are being given, kept on the phone so a
// quiz left halfway picks up where it was (read back through the same
// cleanAnswers the server uses, so a stale draft can hold nothing odd).
// One draft serves a member's quiz and a free account's: the free quiz is
// the same answers plus its own two taps (the grade and what they are
// working toward), which a member's quiz simply never reads.
const KEY = "strive.quiz.v1";

type Draft = { answers: FreeAnswers; set: (patch: Partial<FreeAnswers>) => void; clear: () => Promise<void> };
const DraftContext = createContext<Draft | null>(null);

export function QuizDraftProvider({ children, knownParentPhone }: { children: ReactNode; knownParentPhone: string }) {
  const [answers, setAnswers] = useState<FreeAnswers>(() => emptyAnswers(knownParentPhone));
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) {
          const kept: unknown = JSON.parse(raw);
          const a = cleanAnswers(kept);
          const own = cleanFreeAnswers(kept);
          setAnswers({ ...a, grade: own.grade, aim: own.aim, parentPhone: a.parentPhone || knownParentPhone });
        }
      })
      .catch(() => undefined)
      .finally(() => {
        loaded.current = true;
      });
  }, [knownParentPhone]);

  const value = useMemo<Draft>(
    () => ({
      answers,
      set: (patch) =>
        setAnswers((prev) => {
          const next = { ...prev, ...patch, attrs: { ...prev.attrs, ...(patch.attrs ?? {}) } };
          if (loaded.current) void AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
          return next;
        }),
      clear: async () => {
        await AsyncStorage.removeItem(KEY).catch(() => undefined);
      },
    }),
    [answers]
  );
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft(): Draft {
  const d = useContext(DraftContext);
  if (!d) throw new Error("useDraft outside the quiz");
  return d;
}
