import { describe, expect, it } from "vitest";
import { renderShellStyles } from "../../apps/userscript/src/ui/shell/styles";

describe("Studio shell base CSS", () => {
  it("preserves the shell layout and eight resize handles", () => {
    const css = renderShellStyles("test-panel", 420, 520, 32);
    expect(css).toContain("#test-panel .bsb-sidebar");
    expect(css).toContain("#test-panel .bsb-dock-tab");
    expect(css).toContain("#test-panel .bsb-head");
    expect(css).toContain("#test-panel .bsb-nav");
    expect(css).toContain("min-width: 420px");
    expect(css).toContain("min-height: 520px");
    expect(css).toContain("width: 32px");
    for (const direction of ["n", "s", "e", "w", "ne", "nw", "se", "sw"]) {
      expect(css).toContain(`.bsb-resize.${direction}`);
    }
    expect(css).not.toContain("${PANEL_ID}");
  });
});
