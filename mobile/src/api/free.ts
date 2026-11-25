import { hasFreeApp } from "@/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  APP_API,
  appProfilePath,
  type AppBlocked,
  type AppFreeFeed,
  type AppFreePlan,
  type AppFreeWeek,
  type AppFreeYou,
  type AppJoinOpen,
  type AppOffer,
  type AppProfile,
  type AppUpgradeStart,
} from "@shared/app-contract";
import type { FreeAnswers } from "@shared/free-intake";
import type { Kind } from "@shared/tracker";
import type { Multipart } from "@shared/upload-body";
import { ApiError, api } from "./client";
import { keys, useMe } from "./queries";
import { queryClient } from "./queryClient";

// The free app's calls (app/api/app/free/*). Every rule is the website's
// own, on the server; these only carry what was tapped.

export const freeKeys = {
  open: ["free", "open"] as const,
  offer: ["free", "offer"] as const,
  plan: ["free", "plan"] as const,
  feed: ["free", "feed"] as const,
  week: ["free", "week"] as const,
  you: ["free", "you"] as const,
  profiles: ["free", "profile"] as const,
  profile: (id: string) => ["free", "profile", id] as const,
  blocked: ["free", "blocked"] as const,
};

// Is free sign-up open? Asked from the sign-in screen, signed out.
export function useJoinOpen() {
  return useQuery({
    queryKey: freeKeys.open,
    queryFn: () => api<AppJoinOpen>(APP_API.freeOpen, { open: true }),
    staleTime: 60_000,
    retry: 1,
  });
}

function useIsFree(stage?: "ready"): boolean {
  return hasFreeApp(useMe().data?.state, stage);
}

export function useOffer() {
  const free = useIsFree();
  return useQuery({ queryKey: freeKeys.offer, queryFn: () => api<AppOffer>(APP_API.freeOffer), enabled: free, staleTime: 60_000 });
}

export function usePlan() {
  const free = useIsFree();
  return useQuery({ queryKey: freeKeys.plan, queryFn: () => api<AppFreePlan>(APP_API.freePlan), enabled: free, staleTime: 0 });
}

export function useFeed() {
  const free = useIsFree("ready");
  return useQuery({ queryKey: freeKeys.feed, queryFn: () => api<AppFreeFeed>(APP_API.freeFeed), enabled: free });
}

export function useFreeWeek() {
  const free = useIsFree("ready");
  return useQuery({ queryKey: freeKeys.week, queryFn: () => api<AppFreeWeek>(APP_API.freeWeek), enabled: free });
}

export function useFreeYou() {
  const free = useIsFree("ready");
  return useQuery({ queryKey: freeKeys.you, queryFn: () => api<AppFreeYou>(APP_API.freeYou), enabled: free });
}

// One player's profile ("me" is your own): only you, your friends and the
// coaches are ever sent one, so anyone else is a 404 and the screen says so.
export function useProfile(id: string | undefined) {
  const free = useIsFree("ready");
  return useQuery({
    queryKey: freeKeys.profile(id ?? ""),
    queryFn: async () => (await api<{ profile: AppProfile }>(appProfilePath(id as string))).profile,
    enabled: free && Boolean(id),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  });
}

// The players you blocked, so a block can be taken back (Settings).
export function useBlocked() {
  const free = useIsFree("ready");
  return useQuery({ queryKey: freeKeys.blocked, queryFn: () => api<AppBlocked>(APP_API.freeBlocked), enabled: free });
}

// Everything the free tabs show changes when something is logged.
export function refreshFree(): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: freeKeys.feed }),
    queryClient.invalidateQueries({ queryKey: freeKeys.week }),
    queryClient.invalidateQueries({ queryKey: freeKeys.you }),
    queryClient.invalidateQueries({ queryKey: freeKeys.profiles }),
    queryClient.invalidateQueries({ queryKey: freeKeys.blocked }),
  ]);
}

type Ok = { ok: boolean; error?: string };

export const saveIntake = (answers: FreeAnswers) => api<Ok>(APP_API.freeIntake, { method: "POST", body: { answers } });
export const savePlan = (target: number, days: number[]) => api<Ok>(APP_API.freePlan, { method: "POST", body: { target, days } });
export const startUpgrade = () => api<AppUpgradeStart>(APP_API.freeUpgrade, { method: "POST", timeoutMs: 30_000 });
export const confirmUpgrade = () => api<{ active: boolean }>(APP_API.freeUpgradeConfirm, { method: "POST", timeoutMs: 30_000 });
export const sendPost = (upload: Multipart) => api<Ok & { id?: string }>(APP_API.freePost, { method: "POST", upload, timeoutMs: 90_000 });
export const logTraining = (minutes: number, kind: Kind) => api<Ok>(APP_API.freeLog, { method: "POST", body: { minutes, kind } });
export const deleteEntry = (id: string) => api<Ok>(APP_API.freeLog, { method: "DELETE", body: { id } });
export const toggleProps = (id: string) => api<Ok & { propped?: boolean }>(APP_API.freeProps, { method: "POST", body: { id } });
export const reportPost = (id: string, reason: string) => api<Ok>(APP_API.freeReport, { method: "POST", body: { id, reason } });
export const blockPlayer = (id: string) => api<Ok>(APP_API.freeBlock, { method: "POST", body: { id } });
export const removeFriend = (id: string) => api<Ok>(appProfilePath(id), { method: "POST", body: { do: "remove" } });
export const reportProfile = (id: string, what: "photo" | "line") => api<Ok>(appProfilePath(id), { method: "POST", body: { do: what === "photo" ? "report_photo" : "report_line" } });
export const unblockPlayer = (id: string) => api<Ok>(APP_API.freeBlocked, { method: "POST", body: { id } });
export const answerFriend = (id: string, accept: boolean) => api<Ok>(APP_API.freeFriend, { method: "POST", body: { id, accept } });

// After anything that can change where this account belongs (the quiz, the
// week's set-up, a checkout): read who this is again and let the
// gatekeeper follow it.
export function rereadMe(): Promise<unknown> {
  return queryClient.invalidateQueries({ queryKey: keys.me });
}
