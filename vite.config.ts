import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

export default defineConfig(({ command }) => ({
  plugins: [
    tanstackStart({
      server: { entry: "server" },
    }),
    react(),
    tailwindcss(),
    // Only run Nitro during build — generates Vercel-compatible serverless output
    ...(command === "build" ? [nitro({ preset: "vercel" })] : []),
  ],
  resolve: {
    tsconfigPaths: true,
  },
}));
