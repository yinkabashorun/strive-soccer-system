import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  APP_API,
  appCoursePath,
  type AppBootstrap,
  type AppCourse,
  type AppCourseList,
  type AppExtra,
  type AppFirstWeek,
  type AppInbox,
  type AppNoticePrefs,
  type AppNoticePrefsSaved,
  type AppWeek,
  type AppYou,
} from "@shared/app-contract";
import type { QuizAnswers } from "@shared/quiz";
import { useAuth } from "@/auth/session";
import { api } from "./client";
import { queryClient } from "./queryClient";
import { overlay } from "@/outbox-core";
import { tickDrill, useTicks } from "@/outbox";

export const keys = {
  me: ["me"] as const,
  week: ["week"] as const,
  you: ["you"] as const,
  extra: ["extra"] as const,
  // every Courses query starts with this, so one call refreshes them all
  courses: ["courses"] as const,
  inbox: ["inbox"] as const,
  noticePrefs: ["notice-prefs"] as const,
};

export function useMe() {
  const { signedIn } = useAuth();
  return useQuery({
    queryKey: keys.me,
    queryFn: () => api<AppBootstrap>(APP_API.me),
    // who this is and which screen they belong on is read on every open
    staleTime: 0,
    enabled: signedIn,
  });
}

export function useInApp(): boolean {
  const me = useMe();
  return me.data?.state.kind === "ok";
}

// The week: the server's copy with the ticks this phone has not sent yet
// laid over it (src/outbox-core.ts), so a drill ticked with no signal stays
// ticked through a refresh and is never shown as undone.
export function useWeek() {
  const inApp = useInApp();
  const q = useQuery({
    queryKey: keys.week,
    queryFn: async () => (await api<{ week: AppWeek }>(APP_API.week)).week,
    enabled: inApp,
  });
  const ticks = useTicks();
  const data = useMemo(() => (q.data ? overlay(q.data, ticks) : q.data), [q.data, ticks]);
  return { ...q, data };
}

export function useYou() {
  const inApp = useInApp();
  return useQuery({
    queryKey: keys.you,
    queryFn: async () => (await api<{ you: AppYou }>(APP_API.you)).you,
    enabled: inApp,
  });
}

// The Courses library changes when a coach edits it, not while a player
// trains: it is drawn from the phone's copy and looked up again after five
// minutes, or at once on a pull.
const LIBRARY_STALE_MS = 5 * 60_000;

// The shelf. A member gets it open; any other signed-in account gets the
// same shelf locked (lib/elite/app-courses.ts). The two are kept apart on
// the phone, so an account that becomes a member never opens on its old
// locked shelf.
export function useCourses() {
  const { signedIn } = useAuth();
  const me = useMe();
  const member = me.data?.state.kind === "ok";
  return useQuery({
    queryKey: [...keys.courses, member ? "open" : "locked"],
    queryFn: () => api<AppCourseList>(APP_API.courses),
    enabled: signedIn && Boolean(me.data),
    staleTime: LIBRARY_STALE_MS,
  });
}

// One course: a member's only (the server refuses anyone else, so nobody
// else asks). A course that is no longer in the library answers 404, which
// asking again does not change.
export function useCourse(slug: string | undefined) {
  const inApp = useInApp();
  return useQuery({
    queryKey: [...keys.courses, "course", slug ?? ""],
    queryFn: async () => (await api<{ course: AppCourse }>(appCoursePath(slug ?? ""))).course,
    enabled: inApp && Boolean(slug),
    staleTime: LIBRARY_STALE_MS,
    retry: (count, error) => {
      const status = (error as { status?: number })?.status ?? 0;
      return status !== 401 && status !== 403 && status !== 404 && count < 2;
    },
  });
}

export function useExtra(enabled: boolean) {
  return useQuery({ queryKey: keys.extra, queryFn: () => api<AppExtra>(APP_API.extra), enabled, staleTime: 0 });
}

// A drill done (or undone): on screen at once, kept on the phone and sent
// until the server answers (src/outbox.ts). Never sent once and forgotten.
export function useToggleDrill() {
  return { mutate: (v: { id: string; completed: boolean; seconds?: number }) => tickDrill(v.id, v.completed, v.seconds) };
}

export function useAddExtra() {
  return useMutation({
    mutationFn: (v: { shelf: string } | { drillIds: string[] }) =>
      api<{ ok: boolean; session?: number | null; error?: string }>(APP_API.extra, { method: "POST", body: v }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.week }),
  });
}

export function useCheckin() {
  return useMutation({
    mutationFn: (v: { rating: number; energy: number; went_well: string; struggled: string; note: string }) =>
      api<{ ok: boolean }>(APP_API.checkin, { method: "POST", body: v }),
  });
}

export function useConsent() {
  return useMutation({
    mutationFn: (v: { guardian: boolean; terms: boolean; guardianName: string }) =>
      api<{ ok: boolean }>(APP_API.consent, { method: "POST", body: v }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.me }),
  });
}

export function useSubmitQuiz() {
  return useMutation({
    mutationFn: (answers: QuizAnswers) => api<{ ok: boolean }>(APP_API.onboarding, { method: "POST", body: { answers } }),
  });
}

export function buildFirstWeek(): Promise<AppFirstWeek> {
  return api<AppFirstWeek>(APP_API.firstWeek, { method: "POST", timeoutMs: 130_000 });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (v: { current: string; next: string }) => api<{ ok: boolean }>(APP_API.accountPassword, { method: "POST", body: v }),
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: (password: string) => api<{ ok: boolean }>(APP_API.accountDelete, { method: "POST", body: { password }, timeoutMs: 60_000 }),
  });
}

// The Inbox: the same notes as the website's bell (lib/elite/bell.ts).
// Read fresh each time it is opened.
export function useInbox() {
  const inApp = useInApp();
  return useQuery({
    queryKey: keys.inbox,
    queryFn: async () => (await api<AppInbox>(APP_API.notices)).notices,
    enabled: inApp,
    staleTime: 0,
  });
}

// Opening the Inbox is reading it: every note is marked read on the
// server and Home's gold dot goes. The rows already on screen keep their
// own dots until the Inbox is left, so the player can see which were new.
export function markInboxRead(): Promise<void> {
  return api<{ ok: boolean }>(APP_API.notices, { method: "POST" })
    .then(() => {
      queryClient.setQueryData<AppBootstrap>(keys.me, (me) => (me ? { ...me, unread: 0 } : me));
    })
    .catch(() => undefined);
}

// What this person may be told about, and when the one reminder comes
// (lib/elite/notice-prefs.ts): a member and a free account alike.
export function useNoticePrefs() {
  const { signedIn } = useAuth();
  return useQuery({
    queryKey: keys.noticePrefs,
    queryFn: async () => (await api<AppNoticePrefs>(APP_API.noticePrefs)).prefs,
    enabled: signedIn,
    staleTime: 0,
  });
}

type Prefs = AppNoticePrefs["prefs"];

// One tap, saved at once. The switch moves on screen first; a save that
// does not go through puts it back.
export function useSaveNoticePrefs() {
  return useMutation({
    mutationFn: (v: { topic: string; on: boolean } | { reminder: string }) =>
      api<AppNoticePrefsSaved>(APP_API.noticePrefs, { method: "POST", body: v }),
    onMutate: async (v) => {
      await queryClient.cancelQueries({ queryKey: keys.noticePrefs });
      const before = queryClient.getQueryData<Prefs>(keys.noticePrefs);
      if (before) {
        queryClient.setQueryData<Prefs>(
          keys.noticePrefs,
          "topic" in v
            ? { ...before, topics: before.topics.map((t) => (t.key === v.topic ? { ...t, on: v.on } : t)) }
            : before.reminder
              ? { ...before, reminder: { ...before.reminder, chosen: v.reminder as NonNullable<Prefs["reminder"]>["chosen"] } }
              : before
        );
      }
      return { before };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.before) queryClient.setQueryData(keys.noticePrefs, ctx.before);
    },
    onSuccess: (saved) => {
      if (saved.ok) queryClient.setQueryData(keys.noticePrefs, saved.prefs);
    },
  });
}
