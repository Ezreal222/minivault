/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fraunces"', "ui-serif", "Georgia", "serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        ink: {
          50: "#f5efe1",
          100: "#e8e1cc",
          200: "#cdc4ae",
          400: "#7a7464",
          500: "#5a5447",
          700: "#2a2620",
          800: "#1a1814",
          900: "#100e09",
          950: "#0a0905",
        },
        flame: {
          400: "#ffb200",
          500: "#ff8a00",
          600: "#d96a00",
        },
        moss: {
          400: "#3dd68c",
          500: "#1fae6c",
        },
        rust: {
          400: "#ff5a4d",
          500: "#d93a2a",
        },
      },
      letterSpacing: {
        display: "-0.04em",
        widest: "0.22em",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "ticker": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.25" },
        },
        "pulse-flame": {
          "0%, 100%": { color: "var(--tw-prose-body)", textShadow: "none" },
          "50%": { color: "#ffb200", textShadow: "0 0 16px rgba(255, 178, 0, 0.5)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) both",
        "fade-in": "fade-in 0.5s ease-out both",
        "ticker": "ticker 40s linear infinite",
        "blink": "blink 1.6s ease-in-out infinite",
        "pulse-flame": "pulse-flame 1.4s ease-in-out 1",
      },
    },
  },
  plugins: [],
};
