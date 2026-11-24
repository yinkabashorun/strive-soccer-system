"use server";

import { headers } from "next/headers";
import { getViewer } from "./session";
import { startPass } from "./squad-pass-server";
import { SQUAD_FAILED } from "./squad-pass";

// The website's Start my month (the iPhone app asks /api/app/free/pass).
export async function startMyPass(): Promise<{ ok: true } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "player" || viewer.demo) return { ok: false, error: SQUAD_FAILED };
  const res = await startPass(viewer, headers().get("user-agent"));
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}
