import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: false,
    minify: false,
    sourcemap: false,
    lib: {
      entry: "apps/userscript/src/main.ts",
      formats: ["iife"],
      name: "SubBatch",
      fileName: () => "subbatch.bundle.js",
    },
    rollupOptions: {
      output: {
        // Expose the single SubBatchMonorepo composition object on the IIFE global.
        exports: "named",
      },
    },
    outDir: "dist/userscript/.build",
  },
});
