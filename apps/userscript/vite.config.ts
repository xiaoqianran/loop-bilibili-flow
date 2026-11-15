import { defineConfig } from "vite";
import { renderingTrustedTypesPlugin } from "./build/rendering-trusted-types-plugin";

export default defineConfig(({ mode }) => ({
  plugins: [renderingTrustedTypesPlugin()],
  build: {
    emptyOutDir: false,
    minify: false,
    sourcemap: false,
    assetsInlineLimit: Infinity,
    lib: {
      entry: mode === "pure" ? "apps/userscript/src/main-pure.ts" : "apps/userscript/src/main.ts",
      formats: ["iife"],
      name: "SubBatch",
      fileName: () => "subbatch.bundle.js",
    },
    rollupOptions: {
      output: {
        // Expose the single SubBatchMonorepo composition object on the IIFE global.
        exports: "named",
        // Mermaid's diagram modules and KaTeX fonts must ship in the same file.
        inlineDynamicImports: true,
      },
    },
    outDir: "dist/userscript/.build",
  },
}));
