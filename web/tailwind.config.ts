import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config = {
  darkMode: "class",
  content: [
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./store/**/*.{ts,tsx}",
    "./contexts/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "var(--space-page-x)",
      screens: {
        "2xl": "1440px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", ...defaultTheme.fontFamily.sans],
        mono: ["var(--font-mono)", ...defaultTheme.fontFamily.mono],
        code: [
          "var(--font-code)",
          "var(--font-mono)",
          ...defaultTheme.fontFamily.mono,
        ],
      },
      /* Engineering 8-step type scale — use these instead of arbitrary [px] sizes. */
      fontSize: {
        micro: [
          "0.6875rem",
          { lineHeight: "1rem", letterSpacing: "0.04em" },
        ] /* 11/16 */,
        caption: ["0.75rem", { lineHeight: "1.125rem" }] /* 12/18 */,
        compact: ["0.8125rem", { lineHeight: "1.25rem" }] /* 13/20 */,
        body: ["0.875rem", { lineHeight: "1.375rem" }] /* 14/22 */,
        "base-plus": ["1rem", { lineHeight: "1.625rem" }] /* 16/26 */,
        "title-sm": [
          "1.125rem",
          { lineHeight: "1.5rem", letterSpacing: "-0.01em" },
        ] /* 18/24 */,
        title: [
          "1.375rem",
          { lineHeight: "1.75rem", letterSpacing: "-0.015em" },
        ] /* 22/28 */,
        display: [
          "1.75rem",
          { lineHeight: "2.25rem", letterSpacing: "-0.02em" },
        ] /* 28/36 */,

        /* Legacy alias kept for backward compat — prefer semantic names above */
        detail: ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.04em" }],
      },
      spacing: {
        "page-x": "var(--space-page-x)",
        "section-y": "var(--space-section-y)",
        group: "var(--space-group)",
        element: "var(--space-element)",
      },
      maxWidth: {
        page: "90rem" /* 1440px content cap */,
        content: "45rem" /* 720px reading column */,
      },
      zIndex: {
        // Fixed scale additions (avoid arbitrary `z-[...]`).
        60: "60",
        90: "90",
        100: "100",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.32, 0.72, 0, 1)",
        spring: "cubic-bezier(0.22, 1, 0.36, 1)",
        smooth: "cubic-bezier(0.25, 0.1, 0.25, 1)",
      },
      transitionDuration: {
        "120": "120ms",
        "180": "180ms",
        "220": "220ms",
        "280": "280ms",
      },
      colors: {
        border: "hsl(var(--border))",
        line: "hsl(var(--line))",
        input: "hsl(var(--input))",
        control: "hsl(var(--control))",
        ring: "hsl(var(--ring))",
        focus: "hsl(var(--focus))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        paper: "hsl(var(--engineering-paper))",
        canvas: "hsl(var(--engineering-canvas))",
        rail: "hsl(var(--engineering-rail))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          50: "hsl(var(--primary-50))",
          100: "hsl(var(--primary-100))",
          200: "hsl(var(--primary-200))",
          300: "hsl(var(--primary-300))",
          400: "hsl(var(--primary-400))",
          500: "hsl(var(--primary-500))",
          600: "hsl(var(--primary-600))",
          700: "hsl(var(--primary-700))",
          800: "hsl(var(--primary-800))",
          900: "hsl(var(--primary-900))",
        },
        ink: {
          DEFAULT: "hsl(var(--ink))",
          foreground: "hsl(var(--ink-foreground))",
        },
        selected: {
          DEFAULT: "hsl(var(--selected))",
          foreground: "hsl(var(--accent-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        teal: {
          DEFAULT: "hsl(var(--teal))",
          foreground: "hsl(var(--teal-foreground))",
        },
        orange: {
          DEFAULT: "hsl(var(--orange))",
          foreground: "hsl(var(--orange-foreground))",
        },
        rose: {
          DEFAULT: "hsl(var(--rose))",
          foreground: "hsl(var(--rose-foreground))",
        },
        indigo: {
          DEFAULT: "hsl(var(--indigo))",
          foreground: "hsl(var(--indigo-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        surface: {
          0: "hsl(var(--surface-0))",
          1: "hsl(var(--surface-1))",
          2: "hsl(var(--surface-2))",
          3: "hsl(var(--surface-3))",
          4: "hsl(var(--surface-4))",
          5: "hsl(var(--surface-5))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          border: "hsl(var(--sidebar-border))",
        },
      },
      /* One geometry: every named radius resolves to the 2px engineering radius. */
      borderRadius: {
        DEFAULT: "var(--radius)",
        "3xl": "var(--radius)",
        "2xl": "var(--radius)",
        xl: "var(--radius)",
        lg: "var(--radius)",
        md: "var(--radius)",
        sm: "var(--radius)",
      },
      boxShadow: {
        subtle: "var(--shadow-subtle)",
        soft: "var(--shadow-soft)",
        strong: "var(--shadow-strong)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "collapsible-down": {
          from: { height: "0" },
          to: { height: "var(--radix-collapsible-content-height)" },
        },
        "collapsible-up": {
          from: { height: "var(--radix-collapsible-content-height)" },
          to: { height: "0" },
        },
        /* State-change motion only: overlays and disclosures. No entrance effects. */
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up-fade": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down-fade": {
          "0%": { opacity: "0", transform: "translateY(-6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-fade-in": {
          "0%": { opacity: "0", transform: "scale(0.98)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "scale-fade-out": {
          "0%": { opacity: "1", transform: "scale(1)" },
          "100%": { opacity: "0", transform: "scale(0.98)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "collapsible-down": "collapsible-down 0.2s ease-out",
        "collapsible-up": "collapsible-up 0.2s ease-out",
        "fade-in": "fade-in 150ms ease-out forwards",
        "slide-up-fade":
          "slide-up-fade 180ms cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "slide-down-fade":
          "slide-down-fade 180ms cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "scale-fade-in":
          "scale-fade-in 180ms cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "scale-fade-out":
          "scale-fade-out 150ms cubic-bezier(0.4, 0, 1, 1) forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;

export default config;
