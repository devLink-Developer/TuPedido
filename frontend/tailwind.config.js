export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#FFF3EE",
          100: "#FFE0D6",
          200: "#FFC2AD",
          300: "#FF9A75",
          400: "#FF6A33",
          500: "#FF3D00",
          600: "#DD2C00",
          700: "#B32600",
          800: "#8A1E00",
          900: "#611500"
        },
        ink: "#2B2B2B",
        shell: "#FFF8F0",
        surface: "#FFFFFF"
      },
      boxShadow: {
        float: "0 28px 70px -30px rgba(255, 61, 0, 0.3)",
        lift: "0 30px 80px -42px rgba(43, 43, 43, 0.28)"
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
