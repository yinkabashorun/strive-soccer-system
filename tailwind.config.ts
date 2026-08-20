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
        // Strive gold — the site's single accent, used sparingly.
        accent: {
          DEFAULT: "#F5C518",
          soft: "#E3B614",
          deep: "#B8940F",
        },
        bone: "#F5F4EF",
        muted: "#8a8a92",
      },
      fontFamily: {
        // Barlow / Barlow Condensed = Strive Soccer FC brand type.
        // Loaded via <link> in app/layout.tsx (no build-time fetch).
        sans: ["Barlow", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        body: ["Barlow", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["'Barlow Condensed'", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(245,197,24,0.15), 0 0 40px -10px rgba(245,197,24,0.35)",
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 30px 60px -30px rgba(0,0,0,0.8)",
        soft: "0 10px 40px -20px rgba(0,0,0,0.6)",
        lift: "0 20px 50px -25px rgba(0,0,0,0.85)",
      },
      backgroundImage: {
        "grid-faint":
          "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
        "radial-spot":
          "radial-gradient(60% 60% at 50% 0%, rgba(245,197,24,0.10) 0%, rgba(0,0,0,0) 70%)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      animation: {
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
        marquee: "marquee 40s linear infinite",
        "fade-up": "fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in": "fade-in 0.5s ease-out both",
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
      },
    },
  },
  plugins: [],
};

export default config;
