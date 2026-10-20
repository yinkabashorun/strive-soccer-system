import { describe, expect, it } from "vitest";
import {
  cleanRoute,
  errorReport,
  parseErrorReport,
  summarizeAppErrors,
  ERROR_MESSAGE_MAX,
  ERROR_ROUTE_MAX,
  ERROR_STACK_MAX,
} from "@/lib/elite/app-errors";
import type { AppError } from "@/lib/elite/types";

// Oct 19 2026: an error page after a publish left no record anywhere.
// These pin what every report must carry and what it must never carry.
describe("cleanRoute", () => {
  it("keeps the path and drops query strings, hashes and the origin", () => {
    expect(cleanRoute("https://thestriveapp.com/auth/reset?token=abc#x")).toBe("/auth/reset");
    expect(cleanRoute("/coach/players/123?tab=film")).toBe("/coach/players/123");
    expect(cleanRoute("")).toBe("/");
  });
  it("caps the length", () => {
    expect(cleanRoute("/" + "a".repeat(1000)).length).toBe(ERROR_ROUTE_MAX);
  });
});

describe("errorReport", () => {
  it("a client error keeps its message and stack, side client, no digest", () => {
    const err = new Error("Failed to fetch");
    const r = errorReport(err, "https://thestriveapp.com/coach/players/1");
    expect(r.side).toBe("client");
    expect(r.digest).toBeNull();
    expect(r.message).toBe("Failed to fetch");
    expect(r.stack).toContain("Failed to fetch");
    expect(r.route).toBe("/coach/players/1");
  });
  it("a server error is keyed by its digest and carries no stack", () => {
    const err = Object.assign(new Error("An error occurred in the Server Components render."), {
      digest: "1234567890",
    });
    const r = errorReport(err, "/dashboard");
    expect(r.side).toBe("server");
    expect(r.digest).toBe("1234567890");
    expect(r.stack).toBeNull();
  });
  it("caps message and stack and never produces an empty message", () => {
    const err = { message: "m".repeat(5000), stack: "s".repeat(10000) };
    const r = errorReport(err, "/");
    expect(r.message.length).toBe(ERROR_MESSAGE_MAX);
    expect(r.stack?.length).toBe(ERROR_STACK_MAX);
    expect(errorReport(null, "/x").message).toBe("Unknown error");
    expect(errorReport({ name: "ChunkLoadError" }, "/x").message).toBe("ChunkLoadError");
  });
});

describe("parseErrorReport (what the API accepts)", () => {
  it("rejects junk and anything without a message", () => {
    expect(parseErrorReport(null)).toBeNull();
    expect(parseErrorReport("x")).toBeNull();
    expect(parseErrorReport({ route: "/a" })).toBeNull();
    expect(parseErrorReport({ message: "   " })).toBeNull();
  });
  it("derives the side from the digest, never from the body's own claim", () => {
    const client = parseErrorReport({ side: "server", message: "boom", route: "/a?b=1", stack: "st" });
    expect(client).toEqual({ side: "client", route: "/a", digest: null, message: "boom", stack: "st" });
    const server = parseErrorReport({ side: "client", message: "boom", digest: "d1", stack: "st" });
    expect(server?.side).toBe("server");
    expect(server?.stack).toBeNull();
    expect(server?.digest).toBe("d1");
  });
  it("caps every field", () => {
    const r = parseErrorReport({ message: "m".repeat(9999), stack: "s".repeat(99999), route: "/" + "r".repeat(9999) });
    expect(r?.message.length).toBe(ERROR_MESSAGE_MAX);
    expect(r?.stack?.length).toBe(ERROR_STACK_MAX);
    expect(r?.route.length).toBe(ERROR_ROUTE_MAX);
  });
});

describe("summarizeAppErrors", () => {
  const now = Date.parse("2026-10-20T12:00:00Z");
  const row = (hoursAgo: number, id: string): AppError => ({
    id,
    occurred_at: new Date(now - hoursAgo * 3600e3).toISOString(),
    side: "client",
    route: "/",
    digest: null,
    message: "x",
    stack: null,
    viewer_role: null,
    player_id: null,
    user_agent: null,
  });
  it("counts the last 24 hours and the last 7 days and finds the latest", () => {
    const s = summarizeAppErrors([row(2, "a"), row(30, "b"), row(100, "c"), row(200, "d")], now);
    expect(s.last24h).toBe(1);
    expect(s.last7d).toBe(3);
    expect(s.latest?.id).toBe("a");
  });
  it("is empty on no rows", () => {
    expect(summarizeAppErrors([], now)).toEqual({ last24h: 0, last7d: 0, latest: null });
  });
});
