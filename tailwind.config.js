const path = require("path");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./apps/frontend/src/**/*.{js,ts,jsx,tsx,mdx}",
    "./apps/frontend/src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./apps/frontend/src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./apps/frontend/src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#F8FAFC",
        foreground: "#0F172A",
        brand: {
          emerald: "#008F75",
          dark: "#007A65",
          light: "#E8F7F2",
          border: "#D9E5E1",
          navy: "#0F172A",
          slate: "#475569",
          muted: "#64748B",
          status: "#10B981",
        },
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#0F172A",
        },
        border: "#D9E5E1",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.25rem",
      },
    },
  },
  plugins: [],
};
