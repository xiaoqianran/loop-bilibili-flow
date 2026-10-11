import { describe, expect, it } from "vitest";
import { renderLateStudioStyles } from "../../apps/userscript/src/ui/workspaces/late-styles";

describe("Final Studio CSS cascade layer", () => {
  it("retains compact sizing and focus-mode overrides", () => {
    const css = renderLateStudioStyles("test-panel");
    expect(css).toContain("#test-panel.ai-focus .bsb-sidebar");
    expect(css).toContain("#test-panel");
    expect(css).not.toContain("${PANEL_ID}");
  });
});
