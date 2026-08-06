import { createClient } from "./supabase/server";
import {
  DEMO_ACHIEVEMENTS,
  DEMO_FILM,
  DEMO_HOMEWORK,
  DEMO_MESSAGES,
  DEMO_NOTES,
  DEMO_PARENT_REPORTS,
  DEMO_PLAYERS,
  DEMO_PROGRESS,
} from "./demo";
import type {
  Achievement,
  CoachNote,
  FilmUpload,
  Homework,
  Message,
  ParentReport,
  Player,
  Progress,
} from "./types";

// Server-side data access for Strive Elite. Reads from Supabase when
// configured, otherwise returns the demo dataset. The UI is identical in
// both modes so the deployed app is fully tourable before wiring Supabase.

export async function getPlayers(): Promise<Player[]> {
  const supabase = createClient();
  if (!supabase) return DEMO_PLAYERS;
  const { data } = await supabase
    .from("players")
    .select("*")
    .order("full_name");
  return (data as Player[] | null) ?? [];
}

export async function getPlayer(id: string): Promise<Player | null> {
  const supabase = createClient();
  if (!supabase) return DEMO_PLAYERS.find((p) => p.id === id) ?? null;
  const { data } = await supabase
    .from("players")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as Player | null) ?? null;
}

export async function getHomework(playerId: string): Promise<Homework[]> {
  const supabase = createClient();
  if (!supabase)
    return DEMO_HOMEWORK.filter((h) => h.player_id === playerId).sort(
      (a, b) => a.sort - b.sort
    );
  const { data } = await supabase
    .from("homework")
    .select("*")
    .eq("player_id", playerId)
    .order("sort");
  return (data as Homework[] | null) ?? [];
}

export async function getProgress(playerId: string): Promise<Progress[]> {
  const supabase = createClient();
  if (!supabase) return DEMO_PROGRESS.filter((p) => p.player_id === playerId);
  const { data } = await supabase
    .from("progress")
    .select("*")
    .eq("player_id", playerId);
  return (data as Progress[] | null) ?? [];
}

export async function getFilm(playerId: string): Promise<FilmUpload[]> {
  const supabase = createClient();
  if (!supabase)
    return DEMO_FILM.filter((f) => f.player_id === playerId).sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );
  const { data } = await supabase
    .from("film_uploads")
    .select("*")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false });
  return (data as FilmUpload[] | null) ?? [];
}

export async function getNotes(playerId: string): Promise<CoachNote[]> {
  const supabase = createClient();
  if (!supabase)
    return DEMO_NOTES.filter((n) => n.player_id === playerId).sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );
  const { data } = await supabase
    .from("coach_notes")
    .select("*")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false });
  return (data as CoachNote[] | null) ?? [];
}

export async function getMessages(playerId: string): Promise<Message[]> {
  const supabase = createClient();
  if (!supabase)
    return DEMO_MESSAGES.filter((m) => m.player_id === playerId).sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false });
  return (data as Message[] | null) ?? [];
}

export async function getAchievements(playerId: string): Promise<Achievement[]> {
  const supabase = createClient();
  if (!supabase)
    return DEMO_ACHIEVEMENTS.filter((a) => a.player_id === playerId).sort(
      (a, b) => b.earned_at.localeCompare(a.earned_at)
    );
  const { data } = await supabase
    .from("achievements")
    .select("*")
    .eq("player_id", playerId)
    .order("earned_at", { ascending: false });
  return (data as Achievement[] | null) ?? [];
}

export async function getParentReports(
  playerId: string
): Promise<ParentReport[]> {
  const supabase = createClient();
  if (!supabase)
    return DEMO_PARENT_REPORTS.filter((r) => r.player_id === playerId).sort(
      (a, b) => b.created_at.localeCompare(a.created_at)
    );
  const { data } = await supabase
    .from("parent_reports")
    .select("*")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false });
  return (data as ParentReport[] | null) ?? [];
}

// Derived stats used across the dashboards.
export function homeworkCompletion(hw: Homework[]): number {
  if (!hw.length) return 0;
  return Math.round((hw.filter((h) => h.completed).length / hw.length) * 100);
}

export function overallProgress(progress: Progress[]): number {
  if (!progress.length) return 0;
  return Math.round(
    progress.reduce((s, p) => s + p.value, 0) / progress.length
  );
}
