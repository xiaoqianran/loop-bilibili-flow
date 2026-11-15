import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(
  fileURLToPath(new URL(`../../${path}`, import.meta.url)),
  "utf8",
);

describe("Isolated pure userscript entry", () => {
  it("keeps the pure entry separate from the full workbench and rendering dependencies", () => {
    const vite = source("apps/userscript/vite.config.ts");
    const pure = source("apps/userscript/src/main-pure.ts");
    const composition = source("apps/userscript/src/composition.ts");
    const main = source("apps/userscript/src/main.ts");

    expect(vite).toContain('mode === "pure" ? "apps/userscript/src/main-pure.ts"');
    expect(pure).toContain('from "./composition"');
    expect(pure).not.toMatch(/workbench\/runtime|rendering-libs/);
    expect(composition).not.toMatch(/workbench\/runtime|rendering-libs/);
    expect(main).toContain('from "./composition"');
    expect(main).toContain('from "./workbench/runtime"');
    expect(main).not.toContain("import.meta.env.MODE");
    const workbench = source("apps/userscript/src/workbench/runtime.ts");
    expect(workbench).toContain('import type { SubBatchMonorepo } from "../composition"');
    expect(workbench).not.toContain('from "../main"');
  });

  it("rejects unbound require without rejecting guarded module.require probes", () => {
    const isRuntimeDependency = (output: string) =>
      /^\s*(?:import|export)\s/m.test(output) || /(?<![\w$.])require\s*\(/.test(output);

    expect(isRuntimeDependency('const x = module.require("util");')).toBe(false);
    expect(isRuntimeDependency('const x = require("util");')).toBe(true);
    expect(isRuntimeDependency('import lib from "lib";')).toBe(true);
    expect(isRuntimeDependency('export { lib } from "lib";')).toBe(true);
  });
});
