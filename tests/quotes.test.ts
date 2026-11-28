import { describe, expect, it } from "vitest";
import { QUOTES, quoteById } from "@/lib/elite/quotes";

// The quotes a player can put on the training card (lib/elite/quotes.ts).
// A quote is someone else's words: the wording, who said it and the order
// are Coach Yinka's brief of Nov 28 2026, held here word for word so
// nobody "improves" one.
const BRIEF: [string, string][] = [
  ["Here's how I'm going to beat you. I'm going to outwork you.", "Pat Summitt"],
  ["Effortless is a myth.", "Roger Federer"],
  ["I don't believe in talent.", "Carli Lloyd"],
  ["Pressure is a privilege.", "Billie Jean King"],
  ["Nothing is given. Everything is earned.", "LeBron James"],
  ["No human is limited.", "Eliud Kipchoge"],
  ["Make hard work your passion.", "Pat Summitt"],
  ["The score takes care of itself.", "Bill Walsh"],
  ["Every action you take is a vote for the type of person you wish to become.", "James Clear"],
  ["Champions are made when nobody is watching.", "Unknown"],
  ["The man who loves walking goes further than the man who only loves the destination.", "Unknown"],
  ["Effort counts twice.", "Angela Duckworth"],
  ["Enthusiasm is common. Endurance is rare.", "Angela Duckworth"],
  ["My advice: keep showing up.", "Des Linden"],
  ["The real race is always the same: it's me against my goals.", "Katie Ledecky"],
  ["The truth is, I had to work very hard to make it look easy.", "Roger Federer"],
  ["Be quick, but don't hurry.", "John Wooden"],
  ["Make each day your masterpiece.", "John Wooden"],
  ["Only the disciplined ones in life are free.", "Eliud Kipchoge"],
  ["You do not rise to the level of your goals. You fall to the level of your systems.", "James Clear"],
  ["Discipline yourself so no one else has to.", "Pat Summitt"],
  ["We have to change from doubter to believer.", "Jurgen Klopp"],
  ["Talent aside, you have to be willing to work hard.", "Zinedine Zidane"],
  ["Champions adjust.", "Billie Jean King"],
  ["I've failed over and over and over again in my life. And that is why I succeed.", "Michael Jordan"],
  ["Every disadvantage has its advantage.", "Johan Cruyff"],
];

describe("the quotes on the training card", () => {
  it("are the 26 of the brief, word for word, in its order", () => {
    expect(QUOTES).toHaveLength(26);
    expect(QUOTES.map((q) => [q.text, q.by])).toEqual(BRIEF);
  });
  it("each has its own id and who said it", () => {
    expect(new Set(QUOTES.map((q) => q.id)).size).toBe(QUOTES.length);
    for (const q of QUOTES) {
      expect(q.id, q.text).toMatch(/^[a-z]+(-[a-z]+)+$/);
      expect(q.by.trim().length, q.text).toBeGreaterThan(0);
    }
  });
  it("none is over 160 letters, and none has an exclamation mark, an emoji or a long dash", () => {
    for (const q of QUOTES) {
      expect(q.text.length, q.text).toBeLessThanOrEqual(160);
      for (const s of [q.text, q.by]) {
        expect(s, s).not.toMatch(/!/);
        expect(s, s).not.toMatch(/\p{Extended_Pictographic}/u);
        expect(s, s).not.toMatch(/[—–]/);
      }
    }
  });
  it("an id not on the list puts no quote on the card", () => {
    expect(quoteById("king-adjust")?.text).toBe("Champions adjust.");
    expect(quoteById(null)).toBeNull();
    expect(quoteById("")).toBeNull();
    expect(quoteById("made-up")).toBeNull();
  });
});
