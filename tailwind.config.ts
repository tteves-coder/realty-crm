import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        coral: {
          50: "#fff1ef", 100: "#ffe0da", 200: "#ffc4b8",
          300: "#ff9d8a", 400: "#ff6b52", 500: "#f94021",
          600: "#e72a0c", 700: "#c2200a", 800: "#a01e0e", 900: "#841e12",
        },
        navy: {
          50: "#f0f4ff", 100: "#e0e9ff", 200: "#c7d6fe",
          300: "#a5bafd", 400: "#8196fa", 500: "#6171f5",
          600: "#4a50e9", 700: "#3c3fce", 800: "#3235a6", 900: "#1e1f6b",
          950: "#13144a",
        },
        gold: {
          50: "#fffbeb", 100: "#fef3c7", 200: "#fde68a",
          300: "#fcd34d", 400: "#fbbf24", 500: "#f59e0b",
          600: "#d97706", 700: "#b45309", 800: "#92400e", 900: "#78350f",
        },
        jade: {
          50: "#ecfdf5", 100: "#d1fae5", 200: "#a7f3d0",
          300: "#6ee7b7", 400: "#34d399", 500: "#10b981",
          600: "#059669", 700: "#047857", 800: "#065f46", 900: "#064e3b",
        },
      },
      fontFamily: {
        display: ["'Plus Jakarta Sans'", "system-ui", "sans-serif"],
        body: ["'DM Sans'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      backgroundImage: {
        "gradient-coral": "linear-gradient(135deg, #f94021 0%, #ff6b52 100%)",
        "gradient-navy": "linear-gradient(135deg, #1e1f6b 0%, #6171f5 100%)",
        "gradient-gold": "linear-gradient(135deg, #f59e0b 0%, #fcd34d 100%)",
        "gradient-jade": "linear-gradient(135deg, #047857 0%, #34d399 100%)",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
        "card-lg": "0 4px 16px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.06)",
        glow: "0 0 20px rgba(97,113,245,0.3)",
        "glow-coral": "0 0 20px rgba(249,64,33,0.3)",
      },
    },
  },
  plugins: [],
};
export default config;
