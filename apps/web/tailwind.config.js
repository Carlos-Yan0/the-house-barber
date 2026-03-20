/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        gold: {
          50: "#fdf9ed",
          100: "#f9f0cc",
          200: "#f3de8a",
          300: "#edc948",
          400: "#e8b923",
          500: "#d4920f",
          600: "#b8760b",
          700: "#93580d",
          800: "#784612",
          900: "#663b14",
        },
        dark: {
          50: "#2a2a2a",
          100: "#222222",
          200: "#1c1c1c",
          300: "#181818",
          400: "#141414",
          500: "#111111",
          600: "#0d0d0d",
          700: "#0a0a0a",
          800: "#080808",
          900: "#050505",
        },
      },
      fontFamily: {
        display: ["Playfair Display", "Georgia", "serif"],
        sans: ["DM Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-up": "slideUp 0.4s ease-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
        shimmer: "shimmer 1.5s infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideInRight: {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      backgroundImage: {
        "gold-gradient": "linear-gradient(135deg, #d4920f 0%, #e8b923 50%, #d4920f 100%)",
        "dark-gradient": "linear-gradient(180deg, #181818 0%, #111111 100%)",
        shimmer: "linear-gradient(90deg, #1c1c1c 25%, #2a2a2a 50%, #1c1c1c 75%)",
      },
    },
  },
  plugins: [],
};
