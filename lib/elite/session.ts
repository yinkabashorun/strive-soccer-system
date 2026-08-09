import { cookies } from "next/headers";
import {
  createClient,
  createServiceClient,
  isSupabaseConfigured,
} from "./supabase/server";
import type { Profile, Role } from "./types";
import { DEMO_COACH, DEMO_PLAYERS, DEMO_PLAYER_ID } from "./demo";

// Resolves the current viewer for Strive Elite. Uses real Supabase auth
// when configured; otherwise falls back to a demo cookie set on the login
// screen so the deployed app is instantly tourable.

export const DEMO_COOKIE = "strive_demo_role";

// Emails that should always be coaches. Set STRIVE_COACH_EMAILS in the
// environment (comma-separated). This is how the owner — and any future
// assistant coaches — get coach access without touching the database.
const COACH_EMAILS = (process.env.STRIVE_COACH_EMAILS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function isAllowlistedCoach(email?: string | null): boolean {
  return Boolean(email && COACH_EMAILS.includes(email.toLowerCase()));
}

export type Viewer = {
  profile: Profile;
  role: Role;
  playerId: string | null; // set when the viewer is a player
  demo: boolean;
};

function demoViewer(role: Role): Viewer {
  if (role === "player") {
    const p = DEMO_PLAYERS.find((x) => x.id === DEMO_PLAYER_ID)!;
    return {
      profile: {
        id: p.profile_id,
        role: "player",
        full_name: p.full_name,
        email: p.parent_email,
        avatar_color: p.avatar_color,
      },
      role: "player",
      playerId: p.id,
      demo: true,
    };
  }
  return {
    profile: {
      id: DEMO_COACH.id,
      role: "coach",
      full_name: DEMO_COACH.full_name,
      email: DEMO_COACH.email,
      avatar_color: DEMO_COACH.avatar_color,
    },
    role: "coach",
    playerId: null,
    demo: true,
  };
}

export async function getViewer(): Promise<Viewer | null> {
  const supabase = createClient();

  // Real auth path
  if (supabase && isSupabaseConfigured()) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("elite_profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      let role: Role = (profile?.role as Role) ?? "player";

      // Coach bootstrap: an allowlisted email is always a coach. Self-heal
      // the profile row (via the service role) so RLS also grants coach
      // access, then treat this request as a coach. Idempotent.
      if (role !== "coach" && isAllowlistedCoach(user.email)) {
        const admin = createServiceClient();
        if (admin) {
          await admin.from("elite_profiles").upsert(
            {
              id: user.id,
              role: "coach",
              full_name:
                profile?.full_name ||
                (user.user_metadata?.full_name as string) ||
                "Coach",
              email: user.email ?? "",
              avatar_color: profile?.avatar_color ?? "#E5FF3D",
            },
            { onConflict: "id" }
          );
        }
        role = "coach";
      }

      let playerId: string | null = null;
      if (role === "player") {
        const { data: player } = await supabase
          .from("elite_players")
          .select("id")
          .eq("profile_id", user.id)
          .maybeSingle();
        playerId = player?.id ?? null;
      }
      return {
        profile: {
          id: user.id,
          role,
          full_name: profile?.full_name ?? user.email ?? "Player",
          email: profile?.email ?? user.email ?? "",
          avatar_color: profile?.avatar_color ?? "#E5FF3D",
        },
        role,
        playerId,
        demo: false,
      };
    }
  }

  // Demo path
  const demoRole = cookies().get(DEMO_COOKIE)?.value as Role | undefined;
  if (demoRole === "player" || demoRole === "coach" || demoRole === "admin") {
    return demoViewer(demoRole);
  }

  return null;
}

export function isDemoMode(): boolean {
  return !isSupabaseConfigured();
}
