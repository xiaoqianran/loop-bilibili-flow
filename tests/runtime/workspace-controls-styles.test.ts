import { describe, expect, it } from "vitest";
import { renderWorkspaceControlsStyles } from "../../apps/userscript/src/ui/workspaces/controls-styles";

describe("Studio shared workspace controls CSS", () => {
  it("keeps capture inputs and action buttons correctly scoped", () => {
    const css = renderWorkspaceControlsStyles("test-panel");
    for (const selector of [".bsb-badge", ".bsb-meta", ".bsb-btn", ".bsb-toolbar", ".bsb-actions", ".bsb-opts"]) {
      expect(css).toContain(`#test-panel ${selector}`);
    }
    expect(css).toContain('input[type="checkbox"]');
    expect(css).not.toContain("${PANEL_ID}");
  });
});
