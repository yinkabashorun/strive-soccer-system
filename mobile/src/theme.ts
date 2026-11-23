// The approved look (marketing/app-redesign/mock/mock4.html, Nov 20 2026)
// and the motion rules (marketing/app-redesign/experience.md), in one place.
//
//   type    Oswald Bold for headlines (upper case), Inter SemiBold tracked
//           for labels and numbers, Inter Medium for body
//   colour  deep black surfaces with hairline borders, bone text, champagne
//           gold #c8a858 with the metal gradient on what was EARNED only
//           (rings, ticks, medals, the current bar). Gold is never a button:
//           buttons are bone with black text.
//   motion  a tap answers within 0.15 s, screens 0.3 to 0.5 s, only the
//           rewards run longer; reduced motion turns every move into a fade
export const color = {
  black: "#000000",
  fill: "#0e0e0e",
  fill2: "#161616",
  line: "rgba(255,255,255,0.07)",
  bone: "#f2efe8",
  dim: "rgba(242,239,232,0.6)",
  faint: "rgba(242,239,232,0.34)",
  gold: "#c8a858",
  danger: "#ff6b5e",
} as const;

// The metal gradient, top-left to bottom-right.
export const metal = { from: "#f0dca0", mid: "#c8a858", to: "#8c6d2c" } as const;

export const font = {
  head: "Oswald-Bold",
  label: "Inter-SemiBold",
  body: "Inter-Medium",
} as const;

export const radius = { card: 30, tile: 24, button: 18, chip: 14 } as const;

export const motion = {
  tap: 120, // ms: a pressed control answers
  screen: 380, // ms: a screen or a sheet moves into place
  reward: 1100, // ms: the ring closing, the card rising
  countStep: 800,
} as const;

// The smallest type anywhere is 11 (Apple's floor, punch list A2) and every
// control is at least 44 tall (A3).
export const MIN_TYPE = 11;
export const MIN_TAP = 44;
