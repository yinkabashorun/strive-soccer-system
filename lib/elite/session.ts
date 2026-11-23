import { cookies } from "next/headers";
import {
  createClient,
  createServiceClient,
  isSupabaseConfigured,
} from "./supabase/server";
import type { Profile, Role } from "./types";
import { DEMO_COACH, DEMO_PLAYERS, DEMO_PLAYER_ID } from "./demo";
import { perRequest } from "./request-cache";
import { NO_SETUP, setupFromRow, type ProfileSetup } from "./account-profile";

// Resolves the current viewer for Strive Elite. Uses real Supabase auth
// when configured; otherwise falls back to a demo cookie set on the login
// screen so the deployed app is instantly tourable.

export const DEMO_COOKIE = "strive_demo_role";

// Emails that should always be coaches. Set STRIVE_COACH_EMAILS in the
// environment (comma-separated). This is how the owner - and any future
// assistant coaches - get coach access without touching the database.
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
  // The profile photo and @username this account owes, if any (081). Read
  // from the same profile row, so it costs no extra trip.
  setup: ProfileSetup;
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
      setup: NO_SETUP,
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
    setup: NO_SETUP,
  };
}

// Read once per request: the member shell, its page and anything they call
// all ask who is signed in (request-cache.ts).
export const getViewer = perRequest(readViewer);

async function readViewer(): Promise<Viewer | null> {
  const supabase = createClient();

  // Real auth path
  if (supabase && isSupabaseConfigured()) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      // The profile and the player row are read side by side: a coach has
      // no player row, so the second read simply finds nothing.
      const [{ data: profile }, { data: playerRow }] = await Promise.all([
        supabase.from("elite_profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("elite_players").select("id").eq("profile_id", user.id).maybeSingle(),
      ]);

      let role: Role = (profile?.role as Role) ?? "player";

      // Owner bootstrap: an allowlisted email is always an ADMIN - the head
      // coach who sees every player across all coaches. Self-heal the profile
      // row (via the service role) so RLS grants full access. Idempotent.
      if (role !== "admin" && isAllowlistedCoach(user.email)) {
        const admin = createServiceClient();
        if (admin) {
          await admin.from("elite_profiles").upsert(
            {
              id: user.id,
              role: "admin",
              full_name:
                profile?.full_name ||
                (user.user_metadata?.full_name as string) ||
                "Coach",
              email: user.email ?? "",
              avatar_color: profile?.avatar_color ?? "#D4AF37",
            },
            { onConflict: "id" }
          );
        }
        role = "admin";
      }

      let playerId: string | null = null;
      if (role === "player") playerId = (playerRow?.id as string | undefined) ?? null;
      return {
        profile: {
          id: user.id,
          role,
          full_name: profile?.full_name ?? user.email ?? "Player",
          email: profile?.email ?? user.email ?? "",
          avatar_color: profile?.avatar_color ?? "#D4AF37",
        },
        role,
        playerId,
        demo: false,
        setup: setupFromRow(profile as Record<string, unknown> | null, user.id),
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
