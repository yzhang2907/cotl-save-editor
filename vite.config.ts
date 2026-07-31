import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    // The decoder's positional save-field map is large but compresses well.
    // It is lazy-loaded only after a user selects a save.
    chunkSizeWarningLimit: 550,
  },
  plugins: [react()],
});
