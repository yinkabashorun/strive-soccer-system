"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { DEMO_COOKIE } from "./session";
import type { Role } from "./types";

// Enter demo mode as a given role (no Supabase required). Sets a cookie the
// middleware + session resolver read, then routes to the right home.
export async function enterDemo(role: Role, next?: string) {
  cookies().set(DEMO_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect(next || (role === "coach" ? "/coach" : "/dashboard"));
}

// Convenience wrappers usable directly as <form action={...}> handlers.
export async function enterDemoPlayer() {
  await enterDemo("player");
}
export async function enterDemoCoach() {
  await enterDemo("coach");
}

export async function signOut() {
  const supabase = createClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  cookies().delete(DEMO_COOKIE);
  redirect("/login");
}
