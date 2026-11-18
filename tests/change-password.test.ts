import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PASSWORD_CHANGED_MESSAGE,
  PASSWORD_MIN,
  passwordChangeProblem,
} from "@/lib/elite/account";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

// App Store punch list A9: a member changes their password inside the
// app, without signing out and going through "Forgot your password".
describe("change password", () => {
  it("needs the current password and a new one of at least eight characters", () => {
    expect(PASSWORD_MIN).toBe(8);
    expect(passwordChangeProblem({ current: "", next: "longenough1" })).toMatch(/current password/i);
    expect(passwordChangeProblem({ current: "oldpassword", next: "short" })).toMatch(/at least 8/);
    expect(passwordChangeProblem({ current: "oldpassword", next: "1234567" })).toMatch(/at least 8/);
    expect(passwordChangeProblem({ current: "oldpassword", next: "12345678" })).toBeNull();
  });

  it("refuses a new password that is the same as the current one", () => {
    expect(passwordChangeProblem({ current: "samepassword", next: "samepassword" })).toMatch(/same/i);
  });

  it("accepts a current password of any length (older accounts have short ones)", () => {
    expect(passwordChangeProblem({ current: "soccer", next: "a-new-longer-one" })).toBeNull();
  });

  it("the action checks the current password before changing anything", () => {
    const src = read("lib/elite/account-actions.ts");
    const fn = src.slice(src.indexOf("export async function changeMyPassword"));
    expect(fn).toContain("passwordChangeProblem(");
    expect(fn.indexOf("verifyPassword(")).toBeGreaterThan(-1);
    expect(fn.indexOf("verifyPassword(")).toBeLessThan(fn.indexOf("updateUserById("));
    // The example player has no password to change.
    expect(fn.indexOf("viewer.demo")).toBeLessThan(fn.indexOf("verifyPassword("));
  });

  it("is reachable from Account, and not offered to the example player", () => {
    const account = read("app/account/page.tsx");
    expect(account).toMatch(/\{!viewer\.demo && \(\s*<Group title="Sign-in">\s*<Row href="\/account\/password" label="Change password" \/>/);
    const page = read("app/account/password/page.tsx");
    expect(page).toContain("<ChangePasswordForm />");
    expect(page).toContain("viewer.demo");
  });

  it("the wording follows the house rules", () => {
    const copy = [
      PASSWORD_CHANGED_MESSAGE,
      read("components/elite/ChangePasswordForm.tsx"),
      read("app/account/password/page.tsx"),
    ].join("\n");
    expect(copy).not.toMatch(/—|\bAI\b|automated|algorithm/);
  });
});
