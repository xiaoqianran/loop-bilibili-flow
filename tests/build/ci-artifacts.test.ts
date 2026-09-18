import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  fileURLToPath(new URL("../../.github/workflows/ci.yml", import.meta.url)),
  "utf8",
);

describe("CI userscript artifacts", () => {
  it("uploads the current official and lab userscript outputs", () => {
    expect(workflow).toContain("dist/userscript/loop-bilibili-flow.user.js");
    expect(workflow).toContain("dist/lab/subbatch.pure.user.js");

    expect(workflow).not.toContain("dist/userscript/subbatch.user.js");
    expect(workflow).not.toContain("dist/userscript/subbatch.compat.user.js");
    expect(workflow).not.toContain("dist/userscript/subbatch.pure.user.js");
  });
});
