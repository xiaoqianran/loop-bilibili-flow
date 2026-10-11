import { describe, expect, it } from "vitest";
import { renderWorkspaceLayoutStyles } from "../../apps/userscript/src/ui/workspaces/layout-styles";

describe("Workspace layout CSS", () => {
  it("preserves shared workspace view behavior and AI canvas sizing", () => {
    const css = renderWorkspaceLayoutStyles("test-panel");
    expect(css).toContain("#test-panel .bsb-body");
    expect(css).toContain("#test-panel .bsb-view.active { display: flex; }");
    expect(css).toContain('.bsb-view[data-view-panel="ai"]');
    expect(css).toContain("min-height: 260px");
    expect(css).not.toContain("${PANEL_ID}");
  });
});
