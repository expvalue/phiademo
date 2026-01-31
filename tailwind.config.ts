import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#f7f7fb",
        foreground: "#111827",
        card: "#ffffff",
        primary: "#4f46e5",
        muted: "#6b7280",
        accent: "#eef2ff"
      },
      boxShadow: {
        soft: "0 10px 25px rgba(15, 23, 42, 0.08)",
        subtle: "0 6px 20px rgba(15, 23, 42, 0.06)"
      }
    }
  },
  plugins: []
};

export default config;
