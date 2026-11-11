/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sidebar: {
          bg: "#0F172A",
          text: "#94A3B8",
          active: "#2563EB",
          hover: "#1E293B",
        },
        primary: "#2563EB",
        "primary-dark": "#1D4ED8",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
