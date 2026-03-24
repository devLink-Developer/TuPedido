export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12"
        },
        ink: "#18181b",
        shell: "#fffaf5",
        surface: "#fffdf8"
      },
      boxShadow: {
        float: "0 28px 70px -30px rgba(193, 65, 12, 0.35)",
        lift: "0 30px 80px -42px rgba(24, 24, 27, 0.35)"
      },
      borderRadius: {
        xl2: "1.5rem"
      },
      fontFamily: {
        sans: ['"Manrope"', "system-ui", "sans-serif"],
        display: ['"Space Grotesk"', '"Manrope"', "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
