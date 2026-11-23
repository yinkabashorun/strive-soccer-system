import { API_BASE, FIXTURES } from "@/config";
import { accessToken, signOutHere } from "@/auth/session";
import { fixtureResponse } from "./fixtures";

// Every call to the site's app API (app/api/app/*): the Supabase access
// token as a bearer header, JSON both ways, a time limit, and one meaning
// for the answers the server gives:
//   401  the sign-in is gone: this phone signs out
//   403  the member gate moved (the agreement is due, the membership was
//        switched off): the caller refetches "me" and the app follows it
//   429  too many in a row: said plainly
export class ApiError extends Error {
  status: number;
  code: string | null;
  constructor(status: number, code: string | null, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const OFFLINE_MESSAGE = "We could not reach Strive. Check your connection and try again.";

type Options = { method?: "GET" | "POST" | "DELETE"; body?: unknown; timeoutMs?: number };

let onGateMoved: (() => void) | null = null;
export function setGateListener(fn: () => void) {
  onGateMoved = fn;
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const method = opts.method ?? "GET";
  if (FIXTURES) return fixtureResponse(path, method) as T;

  const token = await accessToken();
  if (!token) throw new ApiError(401, "signed_out", "Sign in again.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000);
  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, "offline", OFFLINE_MESSAGE);
  } finally {
    clearTimeout(timer);
  }

  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.ok) return data as T;

  const code = typeof data?.error === "string" ? data.error : null;
  if (res.status === 401) {
    await signOutHere();
    throw new ApiError(401, code, "Sign in again.");
  }
  if (res.status === 403 && code === "gate") onGateMoved?.();
  if (res.status === 429) throw new ApiError(429, code, "Too many tries in a row. Wait a minute, then try again.");
  // A server line meant for the member (a sentence, not a code) is shown as is.
  const message = code && /\s/.test(code) ? code : "Something went wrong. Try again in a minute.";
  throw new ApiError(res.status, code, message);
}
