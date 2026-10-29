import { describe, expect, it } from "vitest";
import {
  INVITE_USED_NOTICE,
  inviteLanding,
  inviteRoleOf,
  redeemFieldsComplete,
  signupLanding,
} from "@/lib/elite/invite-link";

// Oct 29 2026 (054): a code carries the role it creates. Every code
// before 054 is a player code; only an explicit 'coach' makes a coach.
describe("coach invites", () => {
  it("reads any value but 'coach' as a player code", () => {
    expect(inviteRoleOf("coach")).toBe("coach");
    expect(inviteRoleOf("player")).toBe("player");
    expect(inviteRoleOf(null)).toBe("player");
    expect(inviteRoleOf(undefined)).toBe("player");
    expect(inviteRoleOf("admin")).toBe("player");
  });
  it("lands a new coach on the coach dashboard and a player on theirs", () => {
    expect(signupLanding("coach")).toBe("/coach");
    expect(signupLanding("player")).toBe("/dashboard");
  });
  it("needs the parent phone for a family, not for a coach", () => {
    const base = { fullName: "Gary Grigoryan", email: "g@example.com", password: "longenough" };
    expect(redeemFieldsComplete("coach", { ...base, phone: "" })).toBe(true);
    expect(redeemFieldsComplete("player", { ...base, phone: "" })).toBe(false);
    expect(redeemFieldsComplete("player", { ...base, phone: "7035550100" })).toBe(true);
    expect(redeemFieldsComplete("coach", { ...base, phone: "", password: "short" })).toBe(false);
    expect(redeemFieldsComplete("coach", { ...base, phone: "", fullName: " " })).toBe(false);
  });
});

// Oct 19 2026: an invite link tapped twice must never dead-end on
// "invalid invite code".
describe("invite link landing", () => {
  it("sends a signed-in player to the app, never the sign-up form", () => {
    expect(inviteLanding({ viewerRole: "player", demo: false, inviteUsed: false })).toBe("/dashboard");
    expect(inviteLanding({ viewerRole: "player", demo: false, inviteUsed: true })).toBe("/dashboard");
  });
  it("sends staff to the coach app", () => {
    expect(inviteLanding({ viewerRole: "coach", demo: false, inviteUsed: false })).toBe("/coach");
    expect(inviteLanding({ viewerRole: "admin", demo: false, inviteUsed: true })).toBe("/coach");
  });
  it("sends a used code to sign-in with the notice", () => {
    expect(inviteLanding({ viewerRole: null, demo: false, inviteUsed: true })).toBe(
      `/login?notice=${INVITE_USED_NOTICE}`
    );
  });
  it("shows the form for a fresh code or no code", () => {
    expect(inviteLanding({ viewerRole: null, demo: false, inviteUsed: false })).toBeNull();
  });
  it("ignores a demo session so a prospect can still sign up", () => {
    expect(inviteLanding({ viewerRole: "player", demo: true, inviteUsed: false })).toBeNull();
    expect(inviteLanding({ viewerRole: "player", demo: true, inviteUsed: true })).toBe(
      `/login?notice=${INVITE_USED_NOTICE}`
    );
  });
});
