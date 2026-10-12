import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "node:path";

const target = process.env.UI_TARGET;
if (!target) {
  throw new Error(
    "vite.config.ts requires UI_TARGET (e.g. UI_TARGET=puzzle vite build)",
  );
}
const ALLOWED = ["puzzle", "pgn", "openings"];
if (!ALLOWED.includes(target)) {
  throw new Error(
    `Unknown UI_TARGET="${target}". Allowed: ${ALLOWED.join(", ")}`,
  );
}

export default defineConfig({
  root: resolve(import.meta.dirname, `src/ui/${target}`),
  base: "./",
  plugins: [viteSingleFile()],
  build: {
    outDir: resolve(import.meta.dirname, "build/ui"),
    emptyOutDir: false,
    assetsInlineLimit: Infinity,
    cssCodeSplit: false,
    rollupOptions: {
      input: resolve(import.meta.dirname, `src/ui/${target}/index.html`),
      output: {
        entryFileNames: `${target}.js`,
      },
    },
  },
});
