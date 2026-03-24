/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--color-background) / <alpha-value>)",
        foreground: "rgb(var(--color-foreground) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        surfaceStrong: "rgb(var(--color-surface-strong) / <alpha-value>)",
        surfaceMuted: "rgb(var(--color-surface-muted) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        accentSoft: "rgb(var(--color-accent-soft) / <alpha-value>)",
        success: "rgb(var(--color-success) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)"
      },
      boxShadow: {
        panel:
          "0 28px 64px -42px rgb(var(--color-shadow-ambient) / 0.52), 0 10px 24px -18px rgb(var(--color-shadow-warm) / 0.16)",
        "inner-soft": "inset 0 1px 0 rgb(var(--color-panel-glow) / 0.44)",
        floating:
          "0 24px 46px -30px rgb(var(--color-shadow-ambient) / 0.44), 0 8px 20px -16px rgb(var(--color-shadow-warm) / 0.2)"
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem"
      },
      fontFamily: {
        brand: [
          "Inter Tight",
          "Segoe UI Variable",
          "Inter",
          "PingFang SC",
          "sans-serif"
        ]
      },
      backgroundImage: {
        "shell-grid":
          "linear-gradient(to right, rgb(var(--color-grid) / var(--grid-line-alpha)) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--color-grid) / var(--grid-line-alpha)) 1px, transparent 1px)"
      }
    }
  }
};
