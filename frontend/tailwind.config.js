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
        sm: "0 12px 28px -24px rgba(24, 19, 18, 0.14)",
        md: "0 18px 36px -28px rgba(24, 19, 18, 0.16)",
        lg: "0 22px 46px -32px rgba(24, 19, 18, 0.18)",
        float: "0 12px 28px -22px rgba(24, 19, 18, 0.16)",
        lift: "0 20px 44px -32px rgba(24, 19, 18, 0.18)"
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
