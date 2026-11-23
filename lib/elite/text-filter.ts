// The word filter on everything a free player types that other players see:
// a post's note, a club's name, the "Playing for" line, a name (App Review
// guideline 1.2 asks an app with content shared between users for "a
// method for filtering objectionable material from being posted"; the
// report button, block and the coach queue at /coach/free are the rest).
//
// The word list and its look-alike handling (spacing, repeated letters,
// l33t spelling) come from the obscenity package's English set, MIT
// licensed, so no list of slurs is written into this public repository.
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";

// "dick" is left out on purpose: it is a first name and part of surnames
// (Dickson), and a filter that stops a real player's club or line is worse
// than the word it would catch. Names themselves are not filtered (a real
// surname can trip any list); a player shows as first name and last
// initial, and a profile can be reported.
const matcher = new RegExpMatcher({
  ...englishDataset.removePhrasesIf((p) => p.metadata?.originalWord === "dick").build(),
  ...englishRecommendedTransformers,
});

export function isOffensive(text: unknown): boolean {
  if (typeof text !== "string" || !text.trim()) return false;
  try {
    return matcher.hasMatch(text);
  } catch {
    return false;
  }
}

export const OFFENSIVE_MESSAGE = "That has words we don't allow. Change it and try again.";
