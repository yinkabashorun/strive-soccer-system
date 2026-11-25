import { describe, expect, it } from "vitest";
import { APP_API } from "@shared/app-contract";
import { PNG_DATA_PREFIX } from "@shared/week-card";
import {
  SHARE_WEEK_FAILED,
  SHARE_WEEK_ROW,
  SHARE_WEEK_WORDS_WITH_PICTURE,
  cardPicture,
  isCardFile,
  shareWeekContent,
  shareWeekShown,
} from "@/share-week";

// Share my week (Nov 25 2026): the one row under the friends board on the
// free Week tab. The picture and its words are the server's; these are the
// phone's own small rules.

const TEXT = "My week of training on Strive. Train with me: https://thestriveapp.com/join?ref=ABCD2345&src=share";
const FILE = "file:///var/mobile/Containers/Data/Application/1A2B/Library/Caches/ImageManipulator/0F3C9A7E-1B2D-4C5E-8F90-ABCDEF123456.png";

describe("share my week", () => {
  it("asks the free app's own route for the card", () => {
    expect(APP_API.freeWeekCard).toBe("/api/app/free/week/card");
  });

  it("the row says what it does, short, to the player", () => {
    expect(SHARE_WEEK_ROW).toEqual({ title: "Share my week", detail: "Put your week on your story." });
    for (const line of [SHARE_WEEK_ROW.title, SHARE_WEEK_ROW.detail, SHARE_WEEK_FAILED]) {
      expect(line).not.toContain("—");
      expect(line).not.toMatch(/\bAI\b|automated|algorithm|streak|missed|upgrade|Strive Pro|\$/i);
      expect(line.length).toBeLessThanOrEqual(64);
    }
  });

  it("is there once the player has trained this week, and not before", () => {
    expect(shareWeekShown(0)).toBe(false);
    expect(shareWeekShown(1)).toBe(true);
    expect(shareWeekShown(160)).toBe(true);
  });

  it("takes only a PNG data URI for a picture", () => {
    const png = PNG_DATA_PREFIX + "iVBORw0KGgo".repeat(12);
    expect(cardPicture(png)).toBe(png);
    expect(cardPicture("")).toBeNull();
    expect(cardPicture(null)).toBeNull();
    expect(cardPicture("https://thestriveapp.com/api/app/free/week/card")).toBeNull();
  });

  it("takes only a PNG file on this phone for the share sheet", () => {
    expect(isCardFile(FILE)).toBe(true);
    expect(isCardFile(FILE.replace(/\.png$/, ".jpg"))).toBe(false);
    expect(isCardFile("https://thestriveapp.com/card.png")).toBe(false);
    expect(isCardFile(PNG_DATA_PREFIX + "AAAA")).toBe(false);
    expect(isCardFile(null)).toBe(false);
  });

  it("hands the share sheet the picture alone, so a story takes it", () => {
    expect(SHARE_WEEK_WORDS_WITH_PICTURE).toBe(false);
    expect(shareWeekContent({ text: TEXT, file: FILE })).toEqual({ url: FILE });
  });

  it("with no picture, shares the words, which end with the player's own link", () => {
    for (const file of [null, "", "https://thestriveapp.com/card.png"]) {
      const out = shareWeekContent({ text: TEXT, file });
      expect(out).toEqual({ message: TEXT });
    }
    expect(TEXT).toMatch(/Train with me: https:\/\/thestriveapp\.com\/join\?ref=ABCD2345&src=share$/);
  });
});
