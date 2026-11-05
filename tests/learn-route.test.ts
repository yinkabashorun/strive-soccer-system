import { beforeEach, describe, expect, it, vi } from "vitest";

// The private course route (Nov 5 2026): the login is the whole point.
const viewer = vi.fn();
const player = vi.fn();
vi.mock("@/lib/elite/session", () => ({ getViewer: () => viewer() }));
vi.mock("@/lib/elite/data", () => ({ getPlayer: (id: string) => player(id) }));

import { GET } from "@/app/learn/[slug]/[[...path]]/route";
import { NextRequest } from "next/server";

const call = (p: string[] | undefined) =>
  GET(new NextRequest("http://localhost/learn/dribbling-transformation/" + (p ?? []).join("/")), {
    params: { slug: "dribbling-transformation", path: p },
  });

describe("GET /learn/dribbling-transformation", () => {
  beforeEach(() => {
    viewer.mockReset();
    player.mockReset();
  });

  it("sends a signed-out visitor to sign in and serves nothing", async () => {
    viewer.mockResolvedValue(null);
    const res = await call(["index.html"]);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("sends a demo-tour visitor to sign in", async () => {
    viewer.mockResolvedValue({ role: "player", playerId: "p", demo: true });
    expect((await call(["index.html"])).status).toBe(307);
  });

  it("refuses a player whose membership is not active", async () => {
    viewer.mockResolvedValue({ role: "player", playerId: "p", demo: false });
    player.mockResolvedValue({ subscription_status: "none" });
    const res = await call(["index.html"]);
    expect(res.status).toBe(403);
    expect(await res.text()).not.toContain("Ball Mastery");
  });

  it("serves an active player the page, private and unindexed", async () => {
    viewer.mockResolvedValue({ role: "player", playerId: "p", demo: false });
    player.mockResolvedValue({ subscription_status: "active" });
    const res = await call(["slide_01_hero.html"]);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-robots-tag")).toContain("noindex");
    expect(await res.text()).toContain("Ball Mastery");
  });

  it("serves a coach without a membership check", async () => {
    viewer.mockResolvedValue({ role: "coach", playerId: null, demo: false });
    expect((await call(["index.html"])).status).toBe(200);
    expect(player).not.toHaveBeenCalled();
  });

  it("the bare folder redirects to the explicit index for a signed-in member", async () => {
    viewer.mockResolvedValue({ role: "admin", playerId: null, demo: false });
    const res = await call(undefined);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/learn/dribbling-transformation/index.html");
  });

  it("404s a file that is not in the site", async () => {
    viewer.mockResolvedValue({ role: "admin", playerId: null, demo: false });
    expect((await call(["serve.py"])).status).toBe(404);
    expect((await call(["nothere.html"])).status).toBe(404);
  });
});
