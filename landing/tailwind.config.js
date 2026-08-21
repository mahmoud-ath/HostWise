/** @type {import('tailwindcss').Config} */
/**
 * HostWise brand tokens:
 * - accent #7B39FC: used sparingly (positive states, small highlights)
 * - accent.dark #2B2344: dark HostWise purple
 * - soft #F4F3F3 / hoverSurface #EAEAEA: subtle interactive surfaces
 * Everything else is neutral ink #191919 on white #FFFFFF.
 */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      spacing: {
        26: "6.5rem",
      },
      colors: {
        accent: {
          DEFAULT: "#7B39FC",
          dark: "#2B2344",
        },
        soft: "#F4F3F3",
        hoverSurface: "#EAEAEA",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        serif: ["P22 Mackinac W01 Book", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
