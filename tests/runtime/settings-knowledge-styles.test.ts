import { describe, expect, it } from "vitest";
import { renderSettingsStyles } from "../../apps/userscript/src/ui/workspaces/settings-styles";
import { renderKnowledgeWorkspaceStyles } from "../../apps/userscript/src/ui/workspaces/knowledge-workspace-styles";

describe("Extracted Settings and Knowledge workspace CSS", () => {
  it("preserves settings selectors and scopes them to a panel", () => {
    const css = renderSettingsStyles("test-panel");
    expect(css).toContain("#test-panel");
    expect(css).toContain(".bsb-settings");
    expect(css).not.toContain("${PANEL_ID}");
  });
  it("keeps Knowledge Navigator/Reader split without forcing inactive view visible", () => {
    const css = renderKnowledgeWorkspaceStyles("test-panel");
    expect(css).toContain('#test-panel .bsb-view[data-view-panel="knowledge"]');
    expect(css).toContain(".bsb-knowledge-workspace");
    expect(css).toContain(".bsb-knowledge-nav");
    expect(css).not.toContain("${PANEL_ID}");
    expect(css).not.toMatch(/\.bsb-view\[data-view-panel="knowledge"\]\s*\{[^}]*display\s*:\s*flex/);
  });
});
