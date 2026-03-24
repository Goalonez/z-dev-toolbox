import preset from "../../packages/config/tailwind-preset.cjs";

/** @type {import('tailwindcss').Config} */
export default {
  presets: [preset],
  content: [
    "./options.tsx",
    "./src/**/*.{ts,tsx}",
    "../../packages/app-shell/src/**/*.{ts,tsx}",
    "../../packages/tool-registry/src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}"
  ]
};
