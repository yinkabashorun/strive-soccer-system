import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  PARENT_DONE,
  PARENT_GUARDIAN,
  PARENT_PATH,
  PARENT_SEND,
  PARENT_WHAT,
  cleanParentCode,
  parentHeadline,
  parentLink,
  parentShareText,
  parentStart,
} from "@/lib/elite/parent-link";
import { PRO_PARENT_PARAM, PRO_SESSION_PARAM, proCheckoutParams } from "@/lib/elite/pro";

// SEND TO A PARENT (Nov 24 2026), the second referral loop: the player is
// not the one who pays, so the offer can be sent to the one who does.
const root = path.resolve(__dirname, "..");
const read = (f: string) => readFileSync(path.join(root, f), "utf8");
const CODE = "abcdefghijklmnopqrstuvwxyz"; // 26 of a-z2-7

describe("the link", () => {
  it("is the player's own long random code and nothing else", () => {
    expect(cleanParentCode(CODE)).toBe(CODE);
    for (const no of ["", "short", CODE.toUpperCase(), `${CODE}a`, "abcdefghijklmnopqrstuvwxy1", null, 7, "../../etc"]) expect(cleanParentCode(no), String(no)).toBeNull();
    expect(parentLink("https://thestriveapp.com/", CODE)).toBe(`https://thestriveapp.com${PARENT_PATH}/${CODE}`);
    const server = read("lib/elite/parent-link-server.ts");
    expect(server).toContain("randomBytes(26)");
    // made once and kept: only an account with no code takes one
    expect(server).toContain('.is("parent_code", null)');
    expect(read("supabase/migrations/086_squad_pass.sql")).toContain("'^[a-z2-7]{26}$'");
  });

  it("is sent in the player's own words, with no price and no promise", () => {
    expect(PARENT_SEND).toBe("Send to a parent");
    const text = parentShareText("https://thestriveapp.com/pro/for/x");
    expect(text).toBe("Can you look at this for me? It is the soccer training I want to do. https://thestriveapp.com/pro/for/x");
    expect(text).not.toMatch(/\$|guarantee|—/);
  });
});

describe("the parent's page", () => {
  const page = read("app/(public)/pro/for/[code]/page.tsx");
  const form = read("components/elite/ParentStartForm.tsx");
  const server = read("lib/elite/parent-link-server.ts");

  it("says who asked, what it is and what it costs, and invents nothing", () => {
    expect(parentHeadline("Marcus")).toBe("Marcus asked for Strive Pro.");
    expect(parentStart("Marcus")).toBe("Start Marcus's membership");
    const words = [...PARENT_WHAT, PARENT_GUARDIAN, ...Object.values(PARENT_DONE)].join(" ");
    expect(words).not.toMatch(/—|guarantee|refund|limited|spots|AI\b|automated|algorithm|your child|your kid/i);
    expect(words).toContain("your player");
    // the price is the one constant, never typed on the page
    expect(page).toContain("{page.price}");
    expect(page + form).not.toMatch(/\$\d/);
    expect(server).toContain("price: PRO_PRICE_LINE");
  });

  it("signs nobody in and shows only a first name", () => {
    expect(page).not.toMatch(/getViewer|createClient\(/);
    expect(server).toContain('owner.fullName.trim().split(/\\s+/)[0]');
    expect(server).not.toMatch(/phone:\s*owner|birth/);
  });

  it("the parent agrees as the parent: two boxes never ticked for them, and their name", () => {
    expect(form.match(/useState\(false\)/g)?.length).toBe(2);
    expect(form).toContain("PARENT_GUARDIAN");
    expect(form).toContain('<AppLink href="/terms"');
    expect(form).toContain('<AppLink href="/privacy"');
    // checked again on the server, and recorded with the name
    expect(server).toContain("if (!input.guardian || !input.terms || name.length < 3)");
    expect(server).toContain('recordConsent({ profileId: owner.profileId, source: "signup", guardianName: name');
  });

  it("the checkout is opened for THAT player and comes back to a page that needs no app", () => {
    const params = proCheckoutParams({ profileId: "p1", email: "mum@example.com", appUrl: "https://thestriveapp.com", returnTo: "parent", cancelPath: `${PARENT_PATH}/${CODE}` });
    expect(params.client_reference_id).toBe("p1");
    expect(params.success_url).toBe(`https://thestriveapp.com/pro/done?${PRO_PARENT_PARAM}=1&${PRO_SESSION_PARAM}={CHECKOUT_SESSION_ID}`);
    expect(params.cancel_url).toBe(`https://thestriveapp.com${PARENT_PATH}/${CODE}`);
    const done = read("app/(public)/pro/done/page.tsx");
    expect(done).toContain("PARENT_DONE.paid");
    expect(PARENT_DONE.paid).not.toMatch(/Tap Done/);
    // the player's own checkout is unchanged
    const own = proCheckoutParams({ profileId: "p1", email: "a@b.c", appUrl: "https://thestriveapp.com", returnTo: "app" });
    expect(own.success_url).toBe(`https://thestriveapp.com/pro/done?${PRO_SESSION_PARAM}={CHECKOUT_SESSION_ID}`);
  });

  it("a card can be started over an earned month, and nothing is switched off while the parent pays", () => {
    expect(server).toContain("overEarnedMonth = true");
    expect(server).not.toMatch(/subscription_status: "none"/);
    expect(read("lib/elite/pro-server.ts")).toContain('player.subscription_status === "trialing" && input.overEarnedMonth === true');
  });

  it("is a page for a browser, never opened inside the iPhone app", () => {
    expect(read("lib/elite/app-review.ts")).toContain('{ path: "/pro/for/[code]", since: WEBSITE_ONLY }');
    expect(read("lib/elite/parent-link-actions.ts")).toContain("rateLimit(`parent-start:${ip}`, 10, 10 * 60_000)");
  });
});

describe("where the player finds it", () => {
  it("on the offer, beside Start, and on an earned month that is running: nowhere else", () => {
    expect(read("mobile/app/offer.tsx")).toContain("Share.share({ message: o.parent!.text })");
    expect(read("mobile/app/(tabs)/you.tsx")).toContain("y.earned.parent");
    expect(read("lib/elite/free-app-server.ts")).toContain("parent: { label: PARENT_SEND, text: parentShareText(link) }");
    expect(read("lib/elite/app-data.ts")).toContain('player.subscription_status !== "trialing"');
  });
});

describe("the proof on the parent's page", () => {
  it("says the training the player already logged this week, and nothing when there is none", async () => {
    const { parentProofLine } = await import("../lib/elite/parent-link");
    expect(parentProofLine("Marcus", 130, "2h 10m")).toBe("Marcus has already logged 2h 10m of training on their own this week.");
    expect(parentProofLine("Marcus", 0, "0m")).toBeNull();
    expect(parentProofLine("Marcus", Number.NaN, "")).toBeNull();
  });
});
