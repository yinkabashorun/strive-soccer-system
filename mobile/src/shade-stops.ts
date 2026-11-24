// Words on a photo always sit on the dark part of the fall. The fixed stops
// above were drawn for a short block of words; a taller one (a two-line
// headline with the goal under it) reached up into the clear part, and the
// small gold line over the headline sat on bare brick (simulator, Nov 24
// 2026). Given where the words start, as a fraction of the card's height,
// this is the fall that is already dark there. Held by mobile/tests.
export const WORDS_DARK = 0.72;
export function wordsShade(top: number): [number, number][] {
  const t = Math.min(0.78, Math.max(0.1, top));
  return [
    [Math.max(0, +(t - 0.18).toFixed(3)), 0],
    [+t.toFixed(3), WORDS_DARK],
    [+(t + 0.18).toFixed(3), 0.92],
    [0.98, 1],
  ];
}
