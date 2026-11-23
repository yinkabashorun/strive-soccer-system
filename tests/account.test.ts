import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  accountDeletedText,
  deleteGate,
  playerFilePrefixes,
  DELETE_BLOCKED_MESSAGE,
} from "@/lib/elite/account";
import { concernMailto, SUPPORT_EMAIL } from "@/lib/elite/support";

const root = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

describe("who can delete their own account in the app", () => {
  it("a player and a coach can", () => {
    expect(deleteGate({ role: "player", demo: false })).toEqual({ allowed: true });
    expect(deleteGate({ role: "coach", demo: false })).toEqual({ allowed: true });
  });

  it("the owner account, the example player and a signed-out visitor cannot", () => {
    expect(deleteGate({ role: "admin", demo: false })).toEqual({ allowed: false, reason: "owner" });
    expect(deleteGate({ role: "player", demo: true })).toEqual({ allowed: false, reason: "demo" });
    expect(deleteGate(null)).toEqual({ allowed: false, reason: "signed_out" });
    for (const m of Object.values(DELETE_BLOCKED_MESSAGE)) expect(m.length).toBeGreaterThan(10);
  });
});

describe("what a deletion removes and who is told", () => {
  it("empties every folder that holds the player's own videos", () => {
    expect(playerFilePrefixes("abc")).toEqual(["clips/abc", "progress/abc", "filmroom/abc"]);
  });

  it("tells the coaches billing is theirs to stop", () => {
    const t = accountDeletedText("Tim Kovalev", "player");
    expect(t).toContain("Tim Kovalev");
    expect(t).toContain("cancel it in Stripe");
    expect(t).not.toMatch(/—/);
    expect(accountDeletedText("", "coach")).toBe("A coach deleted their coach account in the app.");
  });

  it("a free training log account has no billing to stop, and the text says so by leaving it out", () => {
    const t = accountDeletedText("Anthony Example", "player", true);
    expect(t).toBe("Anthony Example deleted their free training log account in the app.");
    expect(t).not.toMatch(/Stripe|billing/i);
    const src = read("lib/elite/account-delete.ts");
    // known before the login is deleted, while the row still exists
    expect(src.indexOf("hasTracker(user.id)")).toBeLessThan(src.indexOf("auth.admin.deleteUser("));
    expect(read("app/account/delete/page.tsx")).toContain("every entry in your training log");
  });

  it("both delete paths remove the files before the login", () => {
    for (const f of ["lib/elite/account-delete.ts", "lib/elite/coach-actions.ts"]) {
      const src = read(f);
      const files = src.indexOf("removePlayerFiles(");
      const user = src.indexOf("auth.admin.deleteUser(");
      expect(files, f).toBeGreaterThan(-1);
      expect(user, f).toBeGreaterThan(files);
    }
  });

  it("the member's own delete asks for the password first", () => {
    const src = read("lib/elite/account-delete.ts");
    expect(src.indexOf("verifyPassword(")).toBeGreaterThan(-1);
    expect(src.indexOf("verifyPassword(")).toBeLessThan(src.indexOf("auth.admin.deleteUser("));
  });
});

describe("what the App Store asks every app with accounts to have", () => {
  it("delete is reachable from Account without emailing anyone", () => {
    const account = read("app/account/page.tsx");
    expect(account).toContain('href="/account/delete"');
    const del = read("app/account/delete/page.tsx");
    expect(del).toContain("<DeleteAccountForm");
    expect(del).toContain("What is deleted");
    expect(del).toContain("What is not");
  });

  it("the Account page links the privacy policy, the terms and support", () => {
    const account = read("app/account/page.tsx");
    for (const href of ['"/privacy"', '"/terms"', '"/support"']) expect(account).toContain(href);
    expect(account).toContain("Report a concern");
  });

  it("the Account page is outside the membership gate, so a paused member can reach it", () => {
    expect(() => read("app/account/page.tsx")).not.toThrow();
    expect(() => read("app/(player)/account/page.tsx")).toThrow();
  });

  it("the privacy policy says how to delete and what is kept", () => {
    const privacy = read("app/privacy/page.tsx");
    expect(privacy).toContain("Deleting your account");
    expect(privacy).toMatch(/Delete my account/);
    expect(privacy).toMatch(/payment/i);
    expect(privacy).not.toMatch(/most of whom are\s+under 13/);
    expect(privacy).not.toMatch(/don(&apos;|')t host the video file/);
  });

  it("the public support page has a real contact and the delete steps", () => {
    const support = read("app/support/page.tsx");
    expect(support).toContain("SUPPORT_EMAIL");
    expect(support).toContain('id="delete"');
    expect(SUPPORT_EMAIL).toMatch(/@/);
    expect(concernMailto("Tim K")).toBe(
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Report a concern (Tim K)")}`
    );
  });

  it("notifications can be turned off inside the app and are never required", () => {
    const settings = read("components/elite/DeviceSettings.tsx");
    expect(settings).toContain("removeSubscription");
    expect(settings).toContain("Turn off");
  });
});
