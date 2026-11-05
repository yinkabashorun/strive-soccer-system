import { describe, expect, it } from "vitest";
import {
  bookableSlots,
  canCancelSlot,
  checkinAnnouncement,
  clipsDueIso,
  defaultFilmRoom,
  filmRoomAnnouncement,
  fmtDayWindow,
  fmtWhen,
  generateSlots,
  monthKeyNY,
  nextSunday,
  nyLocalToIso,
} from "@/lib/elite/film-room";
import { filmRoomPath, ownsFilmRoomPath } from "@/lib/elite/clips";

const PLAYER = "11111111-1111-4111-8111-111111111111";
const ROOM = "22222222-2222-4222-8222-222222222222";

describe("NY wall time", () => {
  it("converts winter and summer correctly", () => {
    expect(nyLocalToIso("2026-11-08", "19:00")).toBe("2026-11-09T00:00:00.000Z"); // EST, UTC-5
    expect(nyLocalToIso("2026-07-12", "19:00")).toBe("2026-07-12T23:00:00.000Z"); // EDT, UTC-4
  });
  it("handles the Sunday the clocks fall back", () => {
    // Nov 1 2026: 2am EDT becomes 1am EST. 9am that day is EST.
    expect(nyLocalToIso("2026-11-01", "09:00")).toBe("2026-11-01T14:00:00.000Z");
    expect(nyLocalToIso("2026-10-31", "21:00")).toBe("2026-11-01T01:00:00.000Z");
  });
});

describe("the weekly Film Room", () => {
  it("defaults to the next Sunday at 7pm and keeps today when it is Sunday", () => {
    expect(nextSunday("2026-11-05")).toBe("2026-11-08"); // Thursday
    expect(nextSunday("2026-11-08")).toBe("2026-11-08"); // Sunday
    expect(nextSunday("2026-11-09")).toBe("2026-11-15"); // Monday
    expect(defaultFilmRoom("2026-11-05")).toEqual({ day: "2026-11-08", time: "19:00" });
  });
  it("asks for clips by Saturday 9pm ET", () => {
    expect(clipsDueIso("2026-11-08")).toBe("2026-11-08T02:00:00.000Z"); // Sat 9pm EST
    expect(fmtWhen(clipsDueIso("2026-11-08"))).toBe("Saturday, Nov 7 at 9:00 PM ET");
  });
  it("prints the time the way a family reads it", () => {
    expect(fmtWhen(nyLocalToIso("2026-11-08", "19:00"))).toBe("Sunday, Nov 8 at 7:00 PM ET");
  });
});

describe("check-in slots", () => {
  it("makes six 30-minute slots from 9 to 12", () => {
    const slots = generateSlots("2026-11-15", "09:00", "12:00", 30);
    expect(slots).toHaveLength(6);
    expect(slots[0]).toBe(nyLocalToIso("2026-11-15", "09:00"));
    expect(slots[5]).toBe(nyLocalToIso("2026-11-15", "11:30"));
  });
  it("never lets a slot run past the end", () => {
    expect(generateSlots("2026-11-15", "09:00", "10:45", 30)).toHaveLength(3);
    expect(generateSlots("2026-11-15", "09:00", "09:20", 30)).toHaveLength(0);
  });
  it("refuses bad input", () => {
    expect(generateSlots("nope", "09:00", "12:00", 30)).toEqual([]);
    expect(generateSlots("2026-11-15", "9am", "12:00", 30)).toEqual([]);
    expect(generateSlots("2026-11-15", "09:00", "12:00", 5)).toEqual([]);
  });
  it("caps a day at 24 slots", () => {
    expect(generateSlots("2026-11-15", "00:00", "23:59", 10).length).toBe(24);
  });
  it("labels the window", () => {
    expect(
      fmtDayWindow(nyLocalToIso("2026-11-15", "09:00"), nyLocalToIso("2026-11-15", "12:00"))
    ).toBe("Sunday, Nov 15, 9 AM to 12 PM ET");
  });
});

describe("one call a month, give it back with notice", () => {
  const slot = (day: string, time: string, player: string | null = null) => ({
    starts_at: nyLocalToIso(day, time),
    player_id: player,
  });
  const now = new Date("2026-11-05T12:00:00Z").getTime();
  it("offers open future slots only", () => {
    const slots = [slot("2026-11-15", "09:00"), slot("2026-11-15", "09:30", PLAYER), slot("2026-11-01", "09:00")];
    expect(bookableSlots(slots, [], now)).toHaveLength(1);
  });
  it("offers nothing in a month the player already has a call", () => {
    const slots = [slot("2026-11-15", "09:00"), slot("2026-12-13", "09:00")];
    const open = bookableSlots(slots, ["2026-11"], now);
    expect(open).toHaveLength(1);
    expect(monthKeyNY(open[0].starts_at)).toBe("2026-12");
  });
  it("lets a call go back until 24 hours before", () => {
    const start = nyLocalToIso("2026-11-15", "09:00");
    const t = new Date(start).getTime();
    expect(canCancelSlot(start, t - 25 * 3_600_000)).toBe(true);
    expect(canCancelSlot(start, t - 23 * 3_600_000)).toBe(false);
  });
});

describe("the announcements", () => {
  const film = filmRoomAnnouncement({
    parentName: "Tatsiana Kovalev",
    playerName: "Tim Kovalev",
    scheduledAt: nyLocalToIso("2026-11-08", "19:00"),
    clipsDueAt: clipsDueIso("2026-11-08"),
    appUrl: "https://thestriveapp.com",
  });
  it("tells the family when, how many clips, by when and where", () => {
    expect(film.sms).toContain("Hey Tatsiana,");
    expect(film.sms).toContain("Sunday, Nov 8 at 7:00 PM ET");
    expect(film.sms).toContain("3 to 5 clips of Tim");
    expect(film.sms).toContain("Saturday, Nov 7 at 9:00 PM ET");
    expect(film.sms).toContain("tap Film");
    expect(film.sms).toContain("https://thestriveapp.com/film");
  });
  it("keeps to the house voice and fits one text", () => {
    for (const s of [film.sms, film.pushBody, film.inAppBody]) {
      expect(s).not.toMatch(/—|!/);
      expect(s).not.toMatch(/\b(AI|automated|algorithm|generated)\b/);
    }
    expect(film.sms.length).toBeLessThanOrEqual(480);
  });
  it("falls back to the player's first name when there is no parent name", () => {
    const m = filmRoomAnnouncement({
      playerName: "Tim Kovalev",
      scheduledAt: nyLocalToIso("2026-11-08", "19:00"),
      clipsDueAt: clipsDueIso("2026-11-08"),
      appUrl: "https://thestriveapp.com",
    });
    expect(m.sms.startsWith("Hey Tim,")).toBe(true);
  });
  it("announces check-in days with the window and the length", () => {
    const m = checkinAnnouncement({
      parentName: "Tatsiana",
      playerName: "Tim Kovalev",
      startsAt: nyLocalToIso("2026-11-15", "09:00"),
      endsAt: nyLocalToIso("2026-11-15", "12:00"),
      minutes: 30,
      appUrl: "https://thestriveapp.com",
    });
    expect(m.sms).toContain("Sunday, Nov 15, 9 AM to 12 PM ET");
    expect(m.sms).toContain("30 minutes");
    expect(m.sms).not.toMatch(/—|!/);
    expect(m.sms.length).toBeLessThanOrEqual(480);
  });
});

describe("Film Room storage paths", () => {
  it("accepts only the player's own folder for that room", () => {
    const path = filmRoomPath(PLAYER, ROOM, "mp4", 1730000000000);
    expect(path).toBe(`filmroom/${PLAYER}/${ROOM}/1730000000000.mp4`);
    expect(ownsFilmRoomPath(path, PLAYER, ROOM)).toBe(true);
    expect(ownsFilmRoomPath(path, "33333333-3333-4333-8333-333333333333", ROOM)).toBe(false);
    expect(ownsFilmRoomPath(path, PLAYER, "44444444-4444-4444-8444-444444444444")).toBe(false);
    expect(ownsFilmRoomPath(`clips/${PLAYER}/${ROOM}/1.mp4`, PLAYER, ROOM)).toBe(false);
    expect(ownsFilmRoomPath(`filmroom/${PLAYER}/${ROOM}/../1.mp4`, PLAYER, ROOM)).toBe(false);
    expect(ownsFilmRoomPath(`filmroom/${PLAYER}/${ROOM}/1.exe`, PLAYER, ROOM)).toBe(false);
  });
});
