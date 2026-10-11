import { describe, expect, it } from "vitest";
import { renderAiStyles } from "../../apps/userscript/src/ui/workspaces/ai-styles";
import { renderKnowledgeDrilldownStyles } from "../../apps/userscript/src/ui/workspaces/knowledge-styles";

describe("Extracted AI and Knowledge CSS", () => {
  it("scopes the AI workbench selectors", () => {
    const css = renderAiStyles("test-panel");
    expect(css).toContain("#test-panel .bsb-ai-hero");
    expect(css).toContain("align-self: flex-end");
    expect(css).not.toContain("${PANEL_ID}");
  });
  it("preserves Knowledge drill-down layout and selector scoping", () => {
    const css = renderKnowledgeDrilldownStyles("test-panel");
    expect(css).toContain("#test-panel");
    expect(css).toContain("inset:9px 0 9px auto");
    expect(css).not.toContain("${PANEL_ID}");
  });
});
