import { useMutation, useQuery } from "@tanstack/react-query";
import {
  APP_API,
  appCoursePath,
  type AppBootstrap,
  type AppCourse,
  type AppCourseList,
  type AppExtra,
  type AppFirstWeek,
  type AppWeek,
  type AppYou,
} from "@shared/app-contract";
import type { QuizAnswers } from "@shared/quiz";
import { useAuth } from "@/auth/session";
import { api } from "./client";
import { queryClient } from "./queryClient";
import { applyDone } from "@/week-cache";

export const keys = {
  me: ["me"] as const,
  week: ["week"] as const,
  you: ["you"] as const,
  extra: ["extra"] as const,
  // every Courses query starts with this, so one call refreshes them all
  courses: ["courses"] as const,
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

export function useWeek() {
  const inApp = useInApp();
  return useQuery({
    queryKey: keys.week,
    queryFn: async () => (await api<{ week: AppWeek }>(APP_API.week)).week,
    enabled: inApp,
  });
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

// A drill done (or undone): on screen at once, saved behind it, put back
// if the server says no. The all-time minutes come back with the answer.
export function useToggleDrill() {
  return useMutation({
    mutationFn: (v: { id: string; completed: boolean }) =>
      api<{ ok: true; totalMinutes: number }>(APP_API.drill, { method: "POST", body: v }),
    onMutate: async (v) => {
      await queryClient.cancelQueries({ queryKey: keys.week });
      const before = queryClient.getQueryData<AppWeek>(keys.week);
      if (before) queryClient.setQueryData(keys.week, applyDone(before, v.id, v.completed));
      return { before };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.before) queryClient.setQueryData(keys.week, ctx.before);
    },
    onSuccess: (res) => {
      const w = queryClient.getQueryData<AppWeek>(keys.week);
      if (w) queryClient.setQueryData(keys.week, { ...w, totalMinutes: res.totalMinutes });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: keys.you });
    },
  });
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
