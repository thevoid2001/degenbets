import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        degen: {
          green: "rgb(var(--degen-green) / <alpha-value>)",
          red: "rgb(var(--degen-red) / <alpha-value>)",
          dark: "rgb(var(--degen-bg) / <alpha-value>)",
          card: "rgb(var(--degen-card) / <alpha-value>)",
          border: "rgb(var(--degen-border) / <alpha-value>)",
          muted: "rgb(var(--degen-muted) / <alpha-value>)",
          accent: "rgb(var(--degen-accent) / <alpha-value>)",
          "accent-alt": "rgb(var(--degen-accent-alt) / <alpha-value>)",
          text: "rgb(var(--degen-text) / <alpha-value>)",
          "text-secondary": "rgb(var(--degen-text-secondary) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Orbitron", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
