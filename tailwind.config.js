/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#f8f9fa",
        card: "#ffffff",
        cardLight: "#f1f3f5",
        accent: "#0a0a0a",
        accentHover: "#212529",
        success: "#10b981",
        warning: "#f59e0b",
        danger: "#ef4444",
        muted: "#6c757d",
        border: "#ebebeb"
      }
    },
  },
  plugins: [],
}
