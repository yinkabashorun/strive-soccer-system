"use server";

import { getViewer } from "./session";
import { rateLimit } from "@/lib/rate-limit";
import { changeEmail, confirmCode, sendCode } from "./email-confirm-server";
import { CONFIRM_COPY, type ConfirmAnswer } from "./email-confirm";

// The website's confirm-email page (app/confirm-email): the same server
// functions the iPhone app's routes call (app/api/app/email/*), for the
// signed-in account only, limited per account (never per network address:
// a whole team signs up on one Wi-Fi, lib/rate-limit.ts).

const SLOW: ConfirmAnswer = { ok: false, reason: "wait", error: CONFIRM_COPY.tooMany, waitSeconds: 60 };
const SIGNED_OUT: ConfirmAnswer = { ok: false, reason: "off", error: "Sign in first." };

async function who(name: string, limit: number): Promise<string | ConfirmAnswer> {
  const viewer = await getViewer();
  if (!viewer || viewer.demo) return SIGNED_OUT;
  if (!rateLimit(`email-${name}:${viewer.profile.id}`, limit, 10 * 60_000)) return SLOW;
  return viewer.profile.id;
}

export async function sendMyCode(): Promise<ConfirmAnswer> {
  const id = await who("send", 10);
  return typeof id === "string" ? sendCode(id) : id;
}

export async function confirmMyCode(code: string): Promise<ConfirmAnswer> {
  const id = await who("confirm", 20);
  return typeof id === "string" ? confirmCode(id, typeof code === "string" ? code.slice(0, 32) : null) : id;
}

export async function changeMyEmail(email: string): Promise<ConfirmAnswer> {
  const id = await who("change", 6);
  return typeof id === "string" ? changeEmail(id, typeof email === "string" ? email.slice(0, 320) : null) : id;
}
