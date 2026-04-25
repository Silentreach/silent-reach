import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0a",
        "bg-deep": "#050505",
        surface: "#141414",
        "surface-2": "#1c1c1c",
        border: "#2a2a2a",
        "border-strong": "#3a3a3a",
        text: "#f5f5f5",
        muted: "#9a9a9a",
        gold: "#d4af37",
        "gold-light": "#e8c764",
        "gold-dim": "#a88a2a",
        cream: "#f5efe7",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Fraunces", "Cormorant Garamond", "Georgia", "serif"],
      },
      letterSpacing: {
        "tightest-2": "-0.04em",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.85" },
          "50%": { opacity: "0.55" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s ease-out both",
        "pulse-soft": "pulse-soft 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
