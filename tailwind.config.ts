import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-foreground": "rgb(var(--accent-foreground) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        input: "rgb(var(--input) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        "muted-foreground": "rgb(var(--muted-foreground) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        "card-alt": "rgb(var(--card-alt) / <alpha-value>)",
        "card-foreground": "rgb(var(--card-foreground) / <alpha-value>)",
        subtle: "rgb(var(--subtle) / <alpha-value>)",
        faint: "rgb(var(--faint) / <alpha-value>)",
        ghost: "rgb(var(--ghost) / <alpha-value>)",
        success: "rgb(var(--success) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        cardio: "rgb(var(--cardio) / <alpha-value>)",
        "pr-weight": "rgb(var(--pr-weight) / <alpha-value>)",
        "pr-rep": "rgb(var(--pr-rep) / <alpha-value>)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Satoshi", "var(--font-display)", "sans-serif"],
        display: ["Satoshi", "var(--font-display)", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      keyframes: {
        prpop: {
          "0%": { transform: "scale(.7) translateY(8px)", opacity: "0" },
          "50%": { transform: "scale(1.06) translateY(0)", opacity: "1" },
          "100%": { transform: "scale(1) translateY(0)", opacity: "1" },
        },
        synpulse: {
          "0%,100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        prpop: "prpop 0.32s cubic-bezier(0.2, 0.8, 0.2, 1)",
        synpulse: "synpulse 1.1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
