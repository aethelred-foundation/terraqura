/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.5rem",
        lg: "2rem",
        xl: "2.5rem",
      },
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1440px",
        "3xl": "1920px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
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
        // TerraQura Brand Colors - Premium Palette
        terra: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
          950: "#022c22",
        },
        midnight: {
          50: "#f0f1f4",
          100: "#d1d5e0",
          200: "#a3aac0",
          300: "#747fa0",
          400: "#4a5680",
          500: "#2d3654",
          600: "#1e2640",
          700: "#141b30",
          800: "#0c1220",
          900: "#080d18",
          950: "#050810",
        },
        surface: {
          950: "#080a0f",
          900: "#0c1220",
          800: "#111827",
          700: "#1a2235",
          600: "#242b3d",
          500: "#2d3548",
        },
        // Consistent emerald green brand color
        brand: {
          DEFAULT: "#10b981",
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
          950: "#022c22",
        },
        neon: {
          emerald: "#10b981",
          cyan: "#06b6d4",
          blue: "#3b82f6",
          violet: "#8b5cf6",
          amber: "#f59e0b",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      fontFamily: {
        sans: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
        body: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
        display: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Fluid typography scale
        "display-2xl": ["clamp(3rem, 2rem + 5vw, 6rem)", { 
          lineHeight: "1.05", 
          letterSpacing: "-0.03em", 
          fontWeight: "700" 
        }],
        "display-xl": ["clamp(2.5rem, 1.8rem + 3.5vw, 4.5rem)", { 
          lineHeight: "1.1", 
          letterSpacing: "-0.025em", 
          fontWeight: "700" 
        }],
        "display-lg": ["clamp(2rem, 1.5rem + 2.5vw, 3.5rem)", { 
          lineHeight: "1.15", 
          letterSpacing: "-0.02em", 
          fontWeight: "700" 
        }],
        "display": ["clamp(1.75rem, 1.3rem + 2vw, 2.75rem)", { 
          lineHeight: "1.2", 
          letterSpacing: "-0.02em", 
          fontWeight: "700" 
        }],
        "display-sm": ["clamp(1.5rem, 1.2rem + 1.5vw, 2.25rem)", { 
          lineHeight: "1.25", 
          letterSpacing: "-0.015em", 
          fontWeight: "600" 
        }],
        "body-xl": ["clamp(1.25rem, 1.1rem + 0.75vw, 1.75rem)", { 
          lineHeight: "1.6", 
          fontWeight: "400" 
        }],
        "body-lg": ["clamp(1.125rem, 1rem + 0.5vw, 1.5rem)", { 
          lineHeight: "1.6", 
          fontWeight: "400" 
        }],
        "body": ["clamp(1rem, 0.95rem + 0.25vw, 1.125rem)", { 
          lineHeight: "1.7", 
          fontWeight: "400" 
        }],
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
        "slide-up": {
          from: { transform: "translateY(20px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "slide-down": {
          from: { transform: "translateY(-20px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { transform: "scale(0.95)", opacity: "0" },
          to: { transform: "scale(1)", opacity: "1" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-20px)" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.5", boxShadow: "0 0 20px rgba(16, 185, 129, 0.2)" },
          "50%": { opacity: "0.8", boxShadow: "0 0 40px rgba(16, 185, 129, 0.4)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "marquee": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "slide-up": "slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-down": "slide-down 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-in": "fade-in 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
        "scale-in": "scale-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "float": "float 6s ease-in-out infinite",
        "pulse-glow": "pulse-glow 4s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "marquee": "marquee 40s linear infinite",
        "spin-slow": "spin-slow 20s linear infinite",
        "gradient": "gradient-shift 8s ease infinite",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "gradient-mesh": `
          radial-gradient(ellipse at 20% 30%, rgba(16, 185, 129, 0.08) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 70%, rgba(6, 182, 212, 0.06) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 50%, rgba(139, 92, 246, 0.04) 0%, transparent 60%)
        `,
      },
      boxShadow: {
        "glow-emerald": "0 0 40px -10px rgba(16, 185, 129, 0.3)",
        "glow-cyan": "0 0 40px -10px rgba(6, 182, 212, 0.3)",
        "glow-violet": "0 0 40px -10px rgba(139, 92, 246, 0.3)",
        "glow-strong": "0 0 60px -10px rgba(16, 185, 129, 0.5)",
        "premium": "0 20px 40px -10px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
        "in-expo": "cubic-bezier(0.7, 0, 0.84, 0)",
        "spring": "cubic-bezier(0.34, 1.56, 0.64, 1)",
        "dramatic": "cubic-bezier(0.87, 0, 0.13, 1)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
