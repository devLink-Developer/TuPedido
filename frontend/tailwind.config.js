export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#FFF7EF",
          100: "#FFF0E5",
          200: "#FFD7BB",
          300: "#FFB780",
          400: "#FF8A28",
          500: "#FF6A1A",
          600: "#F05A0A",
          700: "#C2410C",
          800: "#8F2F0A",
          900: "#5A1B06"
        },
        ink: "#151515",
        shell: "#FCFAF7",
        sand: "#FFF7EF",
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
        xl2: "4px",
        panel: "4px"
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        display: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
