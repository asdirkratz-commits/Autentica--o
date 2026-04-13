import type { Config } from "tailwindcss"

export const baseConfig: Config = {
  content: [],
  theme: {
    extend: {
      colors: {
        // Paleta Konto — mapeada para CSS custom properties para suporte a temas por tenant.
        // Os valores padrão (fallback) ficam em globals.css (:root { --k-brand-* }).
        // A área protegida injeta overrides via inline style no layout wrapper.
        brand: {
          50:  "var(--k-brand-50, #e8f9fb)",
          100: "var(--k-brand-100, #c6f0f5)",
          200: "var(--k-brand-200, #8de0eb)",
          300: "var(--k-brand-300, #4dcfe0)",
          400: "var(--k-brand-400, #2bbfd3)",
          500: "var(--k-brand-500, #1aa8bc)",
          600: "var(--k-brand-600, #148fa0)",
          700: "var(--k-brand-700, #0f7080)",
          800: "var(--k-brand-800, #0d5a68)",
          900: "var(--k-brand-900, #0d2b35)",
          950: "var(--k-brand-950, #081c22)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}
