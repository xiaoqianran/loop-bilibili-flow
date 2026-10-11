import { describe, expect, it } from "vitest";
import { renderPanelHeader } from "../../apps/userscript/src/ui/shell/markup";

describe("Studio shell chrome markup", () => {
  it("preserves the controls required by both controllers", () => {
    const html = renderPanelHeader("6.10.1");
    expect(html).toContain("v6.10.1");
    for (const selector of ['bsb-dock-tab', 'bsb-sidebar', 'bsb-head', 'bsb-resize', 'bsb-close', 'bsb-nav']) {
      expect(html).toContain(selector);
    }
    expect((html.match(/data-act="panel-size"/g) || [])).toHaveLength(3);
    expect((html.match(/class="bsb-resize /g) || [])).toHaveLength(8);
  });
});
