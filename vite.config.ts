import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages serves the app from /<repo>/, so asset URLs must stay
  // relative to the page instead of the domain root.
  base: "./",
  build: {
    // The decoder's positional save-field map is large but compresses well.
    // It is lazy-loaded only after a user selects a save.
    chunkSizeWarningLimit: 550,
  },
  plugins: [react()],
});
