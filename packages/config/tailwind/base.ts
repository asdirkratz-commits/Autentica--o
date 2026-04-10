import type { Config } from "tailwindcss"

export const baseConfig: Config = {
  content: [],
  theme: {
    extend: {
      colors: {
        // Paleta Konto — teal escuro + ciano (extraído da logo)
        brand: {
          50:  "#e8f9fb",
          100: "#c6f0f5",
          200: "#8de0eb",
          300: "#4dcfe0",
          400: "#2bbfd3",
          500: "#1aa8bc",
          600: "#148fa0",
          700: "#0f7080",
          800: "#0d5a68",
          900: "#0d2b35",
          950: "#081c22",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}
