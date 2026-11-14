import { describe, expect, it } from "vitest";
import * as app from "../../apps/userscript/src/app";
import {
  callApp, resolveAppMethod, type AppMethodPath,
} from "../../apps/userscript/src/runtime/app-bridge";

const validPaths: AppMethodPath[] = [
  "ordering.reorderIds", "knowledge.createRepository",
  "studio.beginTurn", "navigation.observe", "activation.start",
  "acquisition.fetchSubtitleTracks",
];

describe("typed Application capability bridge", () => {
  it("resolves methods from the actual module registry without flat compatibility aliases", () => {
    expect(validPaths).toHaveLength(6);
    for (const path of validPaths) expect(typeof resolveAppMethod(app, path)).toBe("function");
    expect(resolveAppMethod(app, "studio.unknown")).toBeNull();
    expect(resolveAppMethod(app, "nonexistent")).toBeNull();
    expect(resolveAppMethod(null, "ordering.reorderIds")).toBeNull();
    expect(resolveAppMethod({}, "ordering.reorderIds")).toBeNull();
  });

  it("does not traverse prototypes or non-callable configuration objects", () => {
    const registry = Object.create({ inherited: () => true }) as Record<string, unknown>;
    registry.own = { nested: () => "ok", config: "value" };
    expect(resolveAppMethod(registry, "inherited")).toBeNull();
    expect(resolveAppMethod(registry, "__proto__.constructor")).toBeNull();
    expect(resolveAppMethod(registry, "own.constructor")).toBeNull();
    expect(resolveAppMethod(registry, "own.nested")?.()).toBe("ok");
    expect(resolveAppMethod(registry, "own.config")).toBeNull();
    expect(resolveAppMethod(registry, "own..nested")).toBeNull();
  });

  it("preserves actual method parameters and return values through a typed call", () => {
    const ids = ["a", "b", "c"];
    const reordered: string[] = callApp(app, "ordering.reorderIds", ids, "a", "c");
    expect(reordered).toEqual(["b", "c", "a"]);
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("fails immediately and informatively when a capability is absent at runtime", () => {
    expect(() => callApp({}, "ordering.reorderIds", ["a"], "a", "a"))
      .toThrow("Application capability missing: ordering.reorderIds");
  });
});
