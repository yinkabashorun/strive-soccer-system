import { hasFreeApp } from "@/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  APP_API,
  appClubNearPath,
  appClubPath,
  appPlanPath,
  type AppClubAnswer,
  type AppClubNear,
  type AppClubPage,
  type AppClubs,
} from "@shared/app-contract";
import type { PlanReportReason } from "@shared/club-teams";
import { api } from "./client";
import { useMe } from "./queries";
import { queryClient } from "./queryClient";

// Clubs, in the free app (app/api/app/free/clubs, /plans, /play-terms).
// Every rule is the website's own, on the server; these only carry what
// was tapped. A club is only ever sent to one of its own members.

export const clubKeys = {
  // every clubs query starts with this, so one call refreshes them all
  all: ["free", "clubs"] as const,
  list: ["free", "clubs", "list"] as const,
  one: (id: string) => ["free", "clubs", "one", id] as const,
  near: (id: string) => ["free", "clubs", "near", id] as const,
};

function useInFreeApp(): boolean {
  // a free account in the free app, or a Pro member who keeps it (one-app.ts)
  return hasFreeApp(useMe().data?.state, "ready");
}

export function useClubs() {
  const free = useInFreeApp();
  return useQuery({ queryKey: clubKeys.list, queryFn: () => api<AppClubs>(APP_API.freeClubs), enabled: free });
}

export function useClub(id: string | undefined) {
  const free = useInFreeApp();
  return useQuery({
    queryKey: clubKeys.one(id ?? ""),
    queryFn: async () => (await api<{ club: AppClubPage }>(appClubPath(id ?? ""))).club,
    enabled: free && Boolean(id),
  });
}

export function useClubNear(id: string | undefined) {
  const free = useInFreeApp();
  return useQuery({
    queryKey: clubKeys.near(id ?? ""),
    queryFn: async () => (await api<{ near: AppClubNear }>(appClubNearPath(id ?? ""))).near,
    enabled: free && Boolean(id),
  });
}

// Anything done to a club or a plan changes what the tab and the page show.
export function refreshClubs(): Promise<unknown> {
  return queryClient.invalidateQueries({ queryKey: clubKeys.all });
}

const post = (path: string, body: unknown) => api<AppClubAnswer>(path, { method: "POST", body });

export const startClub = (name: string, county: string | null) => post(APP_API.freeClubs, { name, county });
export const askToJoin = (code: string) => post(APP_API.freeClubJoin, { code });
export const acceptPlayTerms = (kind: "organizer" | "player") => post(APP_API.freePlayTerms, { kind });

// A member, or the captain, on a club.
export const leaveClub = (id: string) => post(appClubPath(id), { do: "leave" });
export const reportClub = (id: string) => post(appClubPath(id), { do: "report" });
export const renameClub = (id: string, name: string) => post(appClubPath(id), { do: "rename", name });
export const removeMember = (id: string, member: string) => post(appClubPath(id), { do: "remove", member });
export const makeCaptain = (id: string, member: string) => post(appClubPath(id), { do: "captain", member });
export const newClubLink = (id: string) => post(appClubPath(id), { do: "link" });
export const setClubCounty = (id: string, county: string | null, open: boolean) => post(appClubPath(id), { do: "county", county, open });
export const endClub = (id: string) => post(appClubPath(id), { do: "end" });
export const answerJoinRequest = (id: string, player: string, accept: boolean) => post(appClubPath(id), { do: "request", player, accept });

// A session or a game.
export type PlanInput = { day: string; time: string; minutes: number; place: string; title?: string };
export const planTraining = (club: string, input: PlanInput) => post(APP_API.freePlans, { club, kind: "training", ...input });
export const planGame = (club: string, opponent: string, input: PlanInput) => post(APP_API.freePlans, { club, kind: "game", opponent, ...input });
export const setImIn = (plan: string, isIn: boolean) => post(appPlanPath(plan), { do: isIn ? "in" : "out" });
export const answerGame = (plan: string, accept: boolean) => post(appPlanPath(plan), { do: accept ? "accept" : "pass" });
export const cancelPlan = (plan: string) => post(appPlanPath(plan), { do: "cancel" });
export const enterScore = (plan: string, club: number, opponent: number) => post(appPlanPath(plan), { do: "score", club, opponent });
export const answerScore = (plan: string, confirm: boolean) => post(appPlanPath(plan), { do: confirm ? "confirm" : "dispute" });
export const reportPlan = (plan: string, reason: PlanReportReason) => post(appPlanPath(plan), { do: "report", reason });
