import { useSyncExternalStore } from "react";

// What is typed while joining free, one question a screen (app/join). Held
// in memory only, for as long as the app is open: nothing typed here is
// kept on the phone, and nothing is sent until "Create my account".
//
// `young` is an answer under 13 on the first screen: the join ends there,
// nothing is sent or stored, and it stays ended until the app is closed
// (the website keeps the same answer for the length of the visit), so the
// form cannot simply be filled in again with another date.
export const JOIN_STEPS = ["age", "name", "contact", "password", "agree"] as const;
export type JoinStepId = (typeof JOIN_STEPS)[number];

export function isJoinStep(v: string | undefined): v is JoinStepId {
  return (JOIN_STEPS as readonly string[]).includes(v ?? "");
}

export type JoinDraft = {
  month: number | null;
  year: number | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  agreedAge: boolean;
  agreedTerms: boolean;
  young: boolean;
  // a typed detail the server turned down, and the screen it is on
  problem: { step: JoinStepId; message: string } | null;
};

const EMPTY: JoinDraft = {
  month: null,
  year: null,
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
  agreedAge: false,
  agreedTerms: false,
  young: false,
  problem: null,
};

let draft: JoinDraft = EMPTY;
const listeners = new Set<() => void>();

export function setJoin(patch: Partial<JoinDraft>): void {
  draft = { ...draft, ...patch };
  listeners.forEach((l) => l());
}

// After the account is made: nothing typed is left behind.
export function clearJoin(): void {
  draft = { ...EMPTY, young: draft.young };
  listeners.forEach((l) => l());
}

export function useJoin(): JoinDraft {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    () => draft,
    () => draft
  );
}
