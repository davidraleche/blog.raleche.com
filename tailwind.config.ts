import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "Arial Narrow", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "Songti SC", "Noto Serif SC", "serif"],
        sans: ["var(--font-sans)", "system-ui", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        ink: "#0a0a0a",
        paper: "#ffffff",
        accent: "#e1251b",
        terminal: { bg: "#05070a", panel: "#0c1117", line: "#1c2530", up: "#16c784", down: "#ea3943", amber: "#f5a623", dim: "#6b7a8c" },
      },
    },
  },
  plugins: [typography],
} satisfies Config;
