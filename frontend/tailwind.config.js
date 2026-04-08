export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#FFF4EE",
          100: "#FFE4D7",
          200: "#FFC9B4",
          300: "#FFA47E",
          400: "#FF7442",
          500: "#FF3D00",
          600: "#DD2C00",
          700: "#B32600",
          800: "#8F1F00",
          900: "#5E1300"
        },
        ink: "#201612",
        shell: "#FFF8F0",
        sand: "#FFF1E6",
        surface: "#FFFFFF"
      },
      boxShadow: {
        sm: "0 18px 40px -32px rgba(24, 19, 18, 0.2), inset 0 1px 0 rgba(255,255,255,0.7)",
        md: "0 24px 52px -34px rgba(24, 19, 18, 0.24)",
        lg: "0 28px 64px -34px rgba(24, 19, 18, 0.28)",
        float: "0 22px 46px -22px rgba(255, 61, 0, 0.36)",
        lift: "0 30px 80px -42px rgba(24, 19, 18, 0.26)"
      },
      borderRadius: {
        xl2: "1.5rem",
        panel: "1.75rem"
      },
      fontFamily: {
        sans: ['"Manrope"', "system-ui", "sans-serif"],
        display: ['"Space Grotesk"', '"Manrope"', "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
