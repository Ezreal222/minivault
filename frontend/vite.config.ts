import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In production we deploy to https://ezreal222.github.io/minivault/, so
// asset URLs must be prefixed with /minivault/. In dev (vite serve), we
// stay rooted at / so http://localhost:5173/ keeps working.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? "/minivault/" : "/",
  server: { port: 5173 },
}));
