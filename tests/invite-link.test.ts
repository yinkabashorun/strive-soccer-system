import { describe, expect, it } from "vitest";
import { INVITE_USED_NOTICE, inviteLanding } from "@/lib/elite/invite-link";

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
