/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0B0D12",
        sidebar: "#0F1219",
        card: "#141923",
        elevated: "#191F2B",
        border: "#262D3A",
        ink: "#F3F5F9",
        muted: "#9AA4B2",
        purple: { DEFAULT: "#8B7CFF" },
        teal: { DEFAULT: "#35D6C4" },
        success: "#35C98A",
        warning: "#F3B65B",
        danger: "#FF6B78",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      keyframes: {
        fadeUp: { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "none" } },
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        pop: { from: { opacity: 0, transform: "scale(.97)" }, to: { opacity: 1, transform: "none" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        gradientShift: { "0%,100%": { backgroundPosition: "0% 50%" }, "50%": { backgroundPosition: "100% 50%" } },
        indeterminate: { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(350%)" } },
        blink: { "0%,80%,100%": { opacity: 0.25 }, "40%": { opacity: 1 } },
      },
      animation: {
        "fade-up": "fadeUp .5s ease-out both",
        "fade-in": "fadeIn .3s ease-out both",
        pop: "pop .18s ease-out both",
        gradient: "gradientShift 12s ease infinite",
        indeterminate: "indeterminate 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
