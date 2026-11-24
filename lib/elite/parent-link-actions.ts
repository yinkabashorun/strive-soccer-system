"use server";

import { headers } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";
import { startParentCheckout, type ParentStart } from "./parent-link-server";
import { PAYMENTS_OFF_MESSAGE } from "./pro";

// The parent's Start button (the page signs nobody in, so everything rides
// on the player's own code; ten tries per ten minutes per caller).
export async function startAsParent(input: {
  code: string;
  guardian: boolean;
  terms: boolean;
  guardianName: string;
  email: string;
}): Promise<ParentStart> {
  const h = headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`parent-start:${ip}`, 10, 10 * 60_000)) return { ok: false, error: PAYMENTS_OFF_MESSAGE };
  return startParentCheckout({
    code: input.code,
    guardian: input.guardian === true,
    terms: input.terms === true,
    guardianName: typeof input.guardianName === "string" ? input.guardianName : "",
    email: typeof input.email === "string" ? input.email.slice(0, 200) : "",
    userAgent: h.get("user-agent"),
  });
}
