// THE QUOTES A PLAYER CAN PUT ON THEIR TRAINING CARD (Coach Yinka, Nov 28
// 2026: "an option to add a quote to it, then you can push it to your
// story"). Picked from the 70 checked quotes (Nov 28 2026, each traced to a
// source); the wording and the order are his brief's, word
// for word. tests/quotes.test.ts holds every line, so nobody "improves" a
// quote: a quote is someone else's words.
//
// `by` is who said it, shown small under the quote. "Unknown" is said as
// it is: never a famous name put on words nobody can trace to them.
//
// Pure: no imports. Shared with the phone ("@shared/quotes").

export type Quote = { id: string; text: string; by: string };

export const QUOTES: readonly Quote[] = [
  { id: "summitt-outwork", text: "Here's how I'm going to beat you. I'm going to outwork you.", by: "Pat Summitt" },
  { id: "federer-effortless", text: "Effortless is a myth.", by: "Roger Federer" },
  { id: "lloyd-talent", text: "I don't believe in talent.", by: "Carli Lloyd" },
  { id: "king-pressure", text: "Pressure is a privilege.", by: "Billie Jean King" },
  { id: "james-earned", text: "Nothing is given. Everything is earned.", by: "LeBron James" },
  { id: "kipchoge-limited", text: "No human is limited.", by: "Eliud Kipchoge" },
  { id: "summitt-passion", text: "Make hard work your passion.", by: "Pat Summitt" },
  { id: "walsh-score", text: "The score takes care of itself.", by: "Bill Walsh" },
  { id: "clear-vote", text: "Every action you take is a vote for the type of person you wish to become.", by: "James Clear" },
  { id: "unknown-watching", text: "Champions are made when nobody is watching.", by: "Unknown" },
  { id: "unknown-walking", text: "The man who loves walking goes further than the man who only loves the destination.", by: "Unknown" },
  { id: "duckworth-twice", text: "Effort counts twice.", by: "Angela Duckworth" },
  { id: "duckworth-endurance", text: "Enthusiasm is common. Endurance is rare.", by: "Angela Duckworth" },
  { id: "linden-showing-up", text: "My advice: keep showing up.", by: "Des Linden" },
  { id: "ledecky-race", text: "The real race is always the same: it's me against my goals.", by: "Katie Ledecky" },
  { id: "federer-easy", text: "The truth is, I had to work very hard to make it look easy.", by: "Roger Federer" },
  { id: "wooden-quick", text: "Be quick, but don't hurry.", by: "John Wooden" },
  { id: "wooden-masterpiece", text: "Make each day your masterpiece.", by: "John Wooden" },
  { id: "kipchoge-free", text: "The disciplined ones in life are free.", by: "Eliud Kipchoge" },
  { id: "clear-systems", text: "You do not rise to the level of your goals. You fall to the level of your systems.", by: "James Clear" },
  { id: "summitt-discipline", text: "Discipline yourself so no one else has to.", by: "Pat Summitt" },
  { id: "klopp-believer", text: "We have to change from doubter to believer.", by: "Jurgen Klopp" },
  { id: "zidane-work", text: "Talent aside, you have to be willing to work hard.", by: "Zinedine Zidane" },
  { id: "king-adjust", text: "Champions adjust.", by: "Billie Jean King" },
  { id: "jordan-failed", text: "I've failed over and over and over again in my life. And that is why I succeed.", by: "Michael Jordan" },
  { id: "cruyff-advantage", text: "Every disadvantage has its advantage.", by: "Johan Cruyff" },
];

// The quote by its id, or null: an id that is not on the list (an old
// pick, a typo) puts no quote on the card rather than a wrong one.
export function quoteById(id: string | null | undefined): Quote | null {
  if (!id) return null;
  return QUOTES.find((q) => q.id === id) ?? null;
}
