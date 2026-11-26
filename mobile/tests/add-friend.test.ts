import { beforeEach, describe, expect, it } from "vitest";
import { APP_API } from "@shared/app-contract";
import { doorCodeFrom } from "@shared/free-door";
import { ADD_NOT_FOUND, usernameToFind } from "@shared/friend-add";
import { INVITE_ROUTE, inviteFromLink, inviteRoute } from "@shared/friend-link";
import { joinLink } from "@shared/tracker";
import { dropInvite, heldInvite, holdInvite, takeInvite } from "@/invite";
import { areaFor, inArea } from "@/navigation";
import { QUIET_ZONE, qrModules, qrPath } from "@/qr";
import { redirectSystemPath } from "../app/+native-intent";

// Adding a friend in person (Nov 26 2026): the phone's own small rules.
// The server's side, and what a link may and may not do, are held in the
// site's tests/add-friend.test.ts; here are the pieces that only run on
// the phone: the QR code's squares, the invite the app keeps, and what the
// router is told when a link arrives.

const LINK = joinLink("https://thestriveapp.com", "ABCD2345");

describe("my code", () => {
  const modules = qrModules(LINK);

  it("is a real QR code of the invite link", () => {
    expect(LINK).toBe("https://thestriveapp.com/join?ref=ABCD2345");
    const n = modules.length;
    // a square grid of a QR size (21, 25, 29 ...), small enough to read from arm's length
    expect(modules.every((row) => row.length === n)).toBe(true);
    expect((n - 21) % 4).toBe(0);
    expect(n).toBeLessThanOrEqual(37);
    // the three corner marks every QR code has: a dark 7 by 7 ring with a dark 3 by 3 middle
    const finder = (r0: number, c0: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const edge = r === 0 || r === 6 || c === 0 || c === 6;
          const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          expect(modules[r0 + r][c0 + c], `${r0 + r},${c0 + c}`).toBe(edge || core);
        }
      }
    };
    finder(0, 0);
    finder(0, n - 7);
    finder(n - 7, 0);
    // the fourth corner has none
    expect(modules[n - 1][n - 1] && modules[n - 7][n - 7] && modules[n - 1][n - 7] && modules[n - 7][n - 1]).toBe(false);
  });

  it("is the same code every time, and a different one for a different player", () => {
    expect(qrModules(LINK)).toEqual(modules);
    expect(qrModules(joinLink("https://thestriveapp.com", "WXYZ6789"))).not.toEqual(modules);
  });

  it("is drawn with the white margin a camera needs, every dark square and no other", () => {
    const { size, d } = qrPath(modules);
    expect(QUIET_ZONE).toBe(4);
    expect(size).toBe(modules.length + 8);
    // put the path back on a grid: it is exactly the dark squares, moved in by the margin
    const drawn = Array.from({ length: size }, () => Array.from({ length: size }, () => false));
    for (const m of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-(\d+)z/g)) {
      expect(m[3]).toBe(m[4]);
      for (let i = 0; i < Number(m[3]); i++) drawn[Number(m[2])][Number(m[1]) + i] = true;
    }
    expect(d.replace(/M\d+ \d+h\d+v1h-\d+z/g, "")).toBe("");
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const inside = r >= 4 && c >= 4 && r < size - 4 && c < size - 4;
        expect(drawn[r][c], `${r},${c}`).toBe(inside ? modules[r - 4][c - 4] : false);
      }
    }
  });
});

describe("an invite the app is keeping", () => {
  beforeEach(() => dropInvite());

  it("is one invite, the newest, handed over once", () => {
    expect(heldInvite()).toBeNull();
    holdInvite({ code: "ABCD2345", kind: "friend" });
    holdInvite({ code: "WXYZ6789", kind: "club" });
    expect(heldInvite()).toEqual({ code: "WXYZ6789", kind: "club" });
    expect(takeInvite()).toEqual({ code: "WXYZ6789", kind: "club" });
    expect(takeInvite()).toBeNull();
    expect(heldInvite()).toBeNull();
  });

  it("what the door types in for a new player is a code the door takes", () => {
    holdInvite({ code: "ABCD2345", kind: "friend" });
    expect(doorCodeFrom(heldInvite()?.code)).toEqual({ code: "ABCD2345", kind: null });
  });
});

describe("a link the iPhone hands the app", () => {
  beforeEach(() => dropInvite());

  it("an invite is kept; the app opens at home when the link started it, and stays put when it was open", () => {
    expect(redirectSystemPath({ path: LINK, initial: true })).toBe("/");
    expect(heldInvite()).toEqual({ code: "ABCD2345", kind: "friend" });
    dropInvite();
    expect(redirectSystemPath({ path: "https://thestriveapp.com/join?club=WXYZ6789", initial: false })).toBeNull();
    expect(heldInvite()).toEqual({ code: "WXYZ6789", kind: "club" });
  });

  it("the app started from its icon, or by any other link, opens as it always did and keeps nothing", () => {
    for (const path of ["striveelite:///", "striveelite://", "/", "", "garbage", "https://thestriveapp.com/join", "https://thestriveapp.com/join?ref=nope", "https://evil.example/join?ref=ABCD2345"]) {
      expect(redirectSystemPath({ path, initial: true }), path).toBe("/");
      expect(redirectSystemPath({ path, initial: false }), path).toBeNull();
    }
    expect(heldInvite()).toBeNull();
    // and it never throws, whatever it is handed
    expect(redirectSystemPath({ path: undefined as unknown as string, initial: true })).toBe("/");
  });

  it("the screen an invite opens is one the gatekeeper lets a free player reach, and nobody else", () => {
    const route = inviteRoute(inviteFromLink(LINK)!);
    expect(route).toBe("/friend/link?code=ABCD2345&kind=friend");
    expect(INVITE_ROUTE).toBe("/friend/link");
    const seg = ["friend", "link"];
    expect(inArea("free", seg)).toBe(true);
    expect(inArea("free", ["friend", "add"])).toBe(true);
    expect(inArea("free", ["friend", "code"])).toBe(true);
    for (const area of ["sign-in", "agreement", "onboarding", "gate", "profile", "app", "free-quiz", "free-offer"] as const) {
      expect(inArea(area, seg), area).toBe(false);
    }
    // signed out, the link's screen is never where the app belongs
    expect(areaFor(false, null)).toBe("sign-in");
  });

  it("the calls are the free app's own routes", () => {
    expect(APP_API.freeFriendAsk).toBe("/api/app/free/friend/ask");
    expect(APP_API.freeCode).toBe("/api/app/free/code");
    expect(usernameToFind("@Kai.M")).toBe("kai.m");
    expect(ADD_NOT_FOUND).toBe("We could not find that @username. Check the spelling.");
  });
});
