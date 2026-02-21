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
        "navy-bg": "#0B1E3B",
        "navy-surface": "#112240",
        "electric-cyan": "#00D4FF",
        "neon-green": "#39FF14",
        "slate-text": "#94A3B8",
      },
      fontFamily: {
        sans: ["system-ui", "sans-serif"],
        mono: ["monospace"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      boxShadow: {
        cyan: "0 0 20px rgba(0, 212, 255, 0.4)",
        green: "0 0 20px rgba(57, 255, 20, 0.4)",
        "cyan-lg": "0 0 40px rgba(0, 212, 255, 0.6)",
      },
      animation: {
        "pulse-cyan": "pulse-cyan 2s ease-in-out infinite",
        "fade-in": "fade-in 0.5s ease-in-out",
        "slide-up": "slide-up 0.4s ease-out",
      },
      keyframes: {
        "pulse-cyan": {
          "0%, 100%": { boxShadow: "0 0 10px rgba(0, 212, 255, 0.3)" },
          "50%": { boxShadow: "0 0 30px rgba(0, 212, 255, 0.8)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
