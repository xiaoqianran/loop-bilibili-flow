import { describe, expect, it } from "vitest";
import { renderFolioStyles } from "../../apps/userscript/src/ui/workspaces/folio-styles";
import { renderWorkspaceOverrides } from "../../apps/userscript/src/ui/workspaces/workspace-overrides-styles";

describe("Extracted folio and workspace override CSS", () => {
  it("retains HTML folio reading layout", () => {
    const css = renderFolioStyles("test-panel");
    expect(css).toContain("#test-panel .bsb-folio-shell");
    expect(css).not.toContain("${PANEL_ID}");
  });
  it("retains scoped Knowledge toast and font overrides", () => {
    const css = renderWorkspaceOverrides("test-panel");
    expect(css).toContain('[data-panel-view="knowledge"]');
    expect(css).toContain("font-size: 14px !important");
    expect(css).not.toContain("${PANEL_ID}");
  });
});
