// The intake, exactly as completeOnboarding (lib/elite/player-actions.ts)
// stores it. Its own file, with no imports beyond the shared types, so the
// quiz rules (lib/elite/quiz.ts) can be read by the native iPhone app
// (mobile/) without pulling in anything that runs on the server.
import type { TrainingLoad, TrainingSpace } from "./types";

export type OnboardingInput = {
  age: number;
  position: string;
  level: string;
  club: string;
  dominant_foot: string;
  gender: "boy" | "girl";
  goals: string[];
  weaknesses: string[];
  self_assessment: Record<string, number>;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  has_wall: boolean;
  has_goal: boolean;
  training_load: TrainingLoad; // 033
  space: TrainingSpace; // 033
};
