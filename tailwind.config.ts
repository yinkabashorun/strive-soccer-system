import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          0: "#000000",
          50: "#0a0a0a",
          100: "#0f0f10",
          200: "#141416",
          300: "#1a1a1d",
          400: "#222226",
          500: "#2a2a2f",
          600: "#3a3a40",
        },
        // Strive gold — the site's single accent, used sparingly. A richer,
        // more metallic gold than the old flat lemon-yellow (#F5C518).
        accent: {
          DEFAULT: "#D4AF37",
          soft: "#E6C767",
          deep: "#9C7A24",
        },
        bone: "#F5F4EF",
        muted: "#8a8a92",
        // The member app (approved Nov 20 2026): champagne gold, used only
        // on what was earned (rings, medals, ticks, the current bar), and
        // the near-black fills its cards sit on. Gold is never a button.
        gold: {
          DEFAULT: "#c8a858",
          light: "#f0dca0",
          deep: "#8c6d2c",
        },
        fill: {
          DEFAULT: "#0e0e0e",
          2: "#161616",
        },
      },
      fontFamily: {
        // Barlow / Barlow Condensed = Strive Soccer FC brand type.
        // Loaded via <link> in app/layout.tsx (no build-time fetch).
        // Read through two variables (app/globals.css): Barlow everywhere,
        // Oswald and Inter inside the member app (the member-ui class).
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(212,175,55,0.15), 0 0 40px -10px rgba(212,175,55,0.35)",
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 30px 60px -30px rgba(0,0,0,0.8)",
        soft: "0 10px 40px -20px rgba(0,0,0,0.6)",
        lift: "0 20px 50px -25px rgba(0,0,0,0.85)",
      },
      backgroundImage: {
        "grid-faint":
          "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
        // The metal: gold that looks earned (rings, medals, ticks).
        metal: "linear-gradient(135deg, #f0dca0 0%, #c8a858 45%, #8c6d2c 100%)",
        "radial-spot":
          "radial-gradient(60% 60% at 50% 0%, rgba(212,175,55,0.10) 0%, rgba(0,0,0,0) 70%)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      animation: {
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
        marquee: "marquee 40s linear infinite",
        "fade-up": "fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in": "fade-in 0.5s ease-out both",
        // The session player (Nov 18 2026): short, precise, no bounce
        // beyond a touch on the check. All of them collapse to a plain
        // fade for reduced-motion users (globals.css).
        "sheet-in": "sheet-in 0.28s cubic-bezier(0.2,0,0,1) both",
        "drill-in": "drill-in 0.26s cubic-bezier(0.2,0,0,1) both",
        "check-pop": "check-pop 0.36s cubic-bezier(0.2,0.9,0.3,1.2) both",
        "ring-close": "ring-close 0.7s cubic-bezier(0.2,0,0,1) 0.1s both",
        "glow-once": "glow-once 1.2s ease-out both",
        rise: "rise 0.45s cubic-bezier(0.2,0,0,1) both",
        "bar-fill": "bar-fill 0.4s cubic-bezier(0.2,0,0,1) both",
        // The experience (Nov 21 2026, marketing/app-redesign/experience.md):
        // one soft ease-out for things moving into place, one small spring
        // for things that pop. Rewards are the only long ones.
        "card-rise": "card-rise 0.9s cubic-bezier(0.34,1.4,0.5,1) both",
        sheen: "sheen 1.3s cubic-bezier(0.4,0,0.2,1) 0.5s both",
        land: "land 0.62s cubic-bezier(0.34,1.4,0.5,1) both",
        "count-pop": "count-pop 0.8s cubic-bezier(0.22,1,0.36,1) both",
        spark: "spark 1.1s cubic-bezier(0.22,1,0.36,1) both",
        "tab-in": "fade-in 0.22s cubic-bezier(0.22,1,0.36,1) both",
        // A member screen coming in (Nov 23 2026, components/elite/TabEntrance):
        // from the side it was asked for, a little scale for depth, 280 ms.
        // "backwards" so no transform is left on the screen afterwards.
        "screen-in": "screen-in 0.28s cubic-bezier(0.22,1,0.36,1) backwards",
        "screen-from-right": "screen-from-right 0.28s cubic-bezier(0.22,1,0.36,1) backwards",
        "screen-from-left": "screen-from-left 0.28s cubic-bezier(0.22,1,0.36,1) backwards",
        "screen-nudge-right": "screen-nudge-right 0.24s cubic-bezier(0.22,1,0.36,1) backwards",
        "screen-nudge-left": "screen-nudge-left 0.24s cubic-bezier(0.22,1,0.36,1) backwards",
        "step-in": "step-in 0.4s cubic-bezier(0.22,1,0.36,1) both",
      },
      keyframes: {
        "pulse-soft": {
          "0%,100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "screen-in": {
          "0%": { opacity: "0", transform: "translate3d(0,8px,0) scale(0.985)" },
          "100%": { opacity: "1", transform: "none" },
        },
        "screen-from-right": {
          "0%": { opacity: "0", transform: "translate3d(28%,0,0) scale(0.96)" },
          "100%": { opacity: "1", transform: "none" },
        },
        "screen-from-left": {
          "0%": { opacity: "0", transform: "translate3d(-28%,0,0) scale(0.96)" },
          "100%": { opacity: "1", transform: "none" },
        },
        "screen-nudge-right": {
          "0%": { opacity: "0", transform: "translate3d(18px,0,0) scale(0.99)" },
          "100%": { opacity: "1", transform: "none" },
        },
        "screen-nudge-left": {
          "0%": { opacity: "0", transform: "translate3d(-18px,0,0) scale(0.99)" },
          "100%": { opacity: "1", transform: "none" },
        },
        "sheet-in": {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "drill-in": {
          "0%": { opacity: "0", transform: "translateX(18px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "check-pop": {
          "0%": { opacity: "0", transform: "scale(0.6)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "ring-close": {
          "0%": { strokeDashoffset: "var(--ring)" },
          "100%": { strokeDashoffset: "0" },
        },
        "glow-once": {
          "0%": { opacity: "0", transform: "scale(0.7)" },
          "40%": { opacity: "1" },
          "100%": { opacity: "0.35", transform: "scale(1.15)" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "bar-fill": {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
        "card-rise": {
          "0%": { opacity: "0", transform: "translateY(120px) rotateX(24deg) scale(0.94)" },
          "100%": { opacity: "1", transform: "none" },
        },
        sheen: {
          "0%": { transform: "translateX(-160px) rotate(18deg)" },
          "100%": { transform: "translateX(560px) rotate(18deg)" },
        },
        land: {
          "0%": { opacity: "0", transform: "translateY(40px) scale(0.96)" },
          "100%": { opacity: "1", transform: "none" },
        },
        "count-pop": {
          "0%": { opacity: "0", transform: "scale(1.5)" },
          "25%": { opacity: "1", transform: "scale(1)" },
          "80%": { opacity: "1", transform: "scale(0.96)" },
          "100%": { opacity: "0", transform: "scale(0.9)" },
        },
        spark: {
          "0%": { opacity: "0", transform: "translate(0,0) rotate(var(--r,0deg)) scale(0.4)" },
          "20%": { opacity: "1" },
          "100%": { opacity: "0", transform: "translate(var(--dx,0px), var(--dy,0px)) rotate(var(--r,0deg)) scale(1)" },
        },
        "step-in": {
          "0%": { opacity: "0", transform: "translateX(28px)" },
          "100%": { opacity: "1", transform: "none" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
