import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // Plugin order matters: Tailwind and the path resolver must be in place before
  // TanStack Start scans routes, and nitro builds from what Start emits.
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    // Point TanStack Start's server entry at src/server.ts, our SSR error wrapper.
    tanstackStart({ server: { entry: "server" } }),
    // No preset: nitro detects Vercel from the build environment. Setting one
    // here would override that and break the deploy.
    nitro(),
    viteReact(),
  ],
  css: { transformer: "lightningcss" },
  server: { host: "::", port: 8080 },
});
