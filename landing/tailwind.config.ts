import type { Config } from "tailwindcss";

/**
 * HostWise brand tokens.
 * - primary #7B39FC: CTAs, highlights, badges, interactive elements (only accent)
 * - brand.dark #2B2344: secondary buttons / dark surfaces
 * - brand.ink #171717: dark text on light surfaces
 * - brand.offwhite #F6F7F9: secondary text on dark surfaces
 * Radius scale (documented, consistent): 8px nav buttons, 10px CTAs + pill,
 * 12px cards/panels.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#7B39FC",
        brand: {
          dark: "#2B2344",
          ink: "#171717",
          offwhite: "#F6F7F9",
        },
      },
      fontFamily: {
        // Instrument Serif for large headlines (explicitly briefed).
        serif: ["var(--font-instrument)", "Georgia", "serif"],
        // Inter for body text (explicitly briefed).
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        // Manrope for navigation, UI elements, labels.
        manrope: ["var(--font-manrope)", "system-ui", "sans-serif"],
        // Cabin for buttons and small promotional elements.
        cabin: ["var(--font-cabin)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
