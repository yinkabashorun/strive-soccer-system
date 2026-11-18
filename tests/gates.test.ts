import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NO_PROFILE_GATE, membershipGate } from "@/lib/elite/gates";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

// App Store punch list A12: every screen that is not the happy path says
// what is happening and what happens next, and none is a dead end.
describe("the screens a member sees instead of the app", () => {
  it("an active or trialing member gets in", () => {
    expect(membershipGate("active")).toBeNull();
    expect(membershipGate("trialing")).toBeNull();
  });

  it("a family that has just signed up is not told its membership is paused", () => {
    const gate = membershipGate("none")!;
    expect(gate.title).not.toMatch(/paused/i);
    expect(gate.body).toContain("Your profile is saved");
    expect(gate.body).toContain("your first week shows up here");
    expect(gate.emailCoach).toBe(true);
    // An unknown or missing status is treated the same way, never let in.
    expect(membershipGate(null)).toEqual(gate);
    expect(membershipGate(undefined)).toEqual(gate);
  });

  it("a paused or lapsed member is told nothing is lost and how to come back", () => {
    for (const status of ["canceled", "past_due"]) {
      const gate = membershipGate(status)!;
      expect(gate.title).toBe("Membership paused");
      expect(gate.body).toContain("Everything you have trained is saved");
      expect(gate.body).toContain("Email your coach");
      expect(gate.emailCoach).toBe(true);
    }
  });

  it("a member whose profile is not set up yet is told what comes next, with no promise of an email", () => {
    expect(NO_PROFILE_GATE.body).toContain("shows up here the moment it is ready");
    expect(NO_PROFILE_GATE.body).not.toMatch(/email/i);
  });

  it("no gate mentions a price, a payment or a place to buy (App Store rule)", () => {
    const all = [NO_PROFILE_GATE, membershipGate("none")!, membershipGate("canceled")!];
    for (const g of all) {
      const words = `${g.title} ${g.body}`;
      expect(words).not.toMatch(/\$|pay|price|subscribe|billing|checkout|website|sign up/i);
      expect(words).not.toMatch(/—|\bAI\b|automated|algorithm/);
    }
  });

  it("the gate screen always offers a way on: email, sign out, Account", () => {
    const layout = read("app/(player)/layout.tsx");
    const screen = layout.slice(layout.indexOf("function GateScreen"));
    expect(screen).toContain("mailto:${SUPPORT_EMAIL}");
    expect(screen).toContain("Sign out");
    expect(screen).toContain('href="/account"');
  });
});

describe("empty states say what happens next", () => {
  it("no week built yet", () => {
    expect(read("app/(player)/dashboard/page.tsx")).toMatch(/It shows up here the\s+moment it is ready/);
    expect(read("components/elite/WeekList.tsx")).toContain("It lands here the moment it is ready");
  });

  it("no messages yet, on the member's side", () => {
    expect(read("app/(player)/messages/page.tsx")).toContain("the answer comes back right here");
  });

  it("no course yet", () => {
    expect(read("components/elite/CourseLibrary.tsx")).toContain("It shows up here the moment it is ready");
  });

  it("the week is finished", () => {
    const card = read("components/elite/TodaySession.tsx");
    expect(card).toContain("{nextWeekLine}");
    expect(card).toContain("Tap Extra work below to add a session");
  });

  it("offline, inside the App Store app", () => {
    const offline = read("native/www/offline.html");
    expect(offline).toContain("You're offline");
    expect(offline).toContain("Try again");
  });
});
