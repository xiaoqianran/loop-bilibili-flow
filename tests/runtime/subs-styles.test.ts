import { describe, expect, it } from "vitest";
import { renderSubsStyles } from "../../apps/userscript/src/ui/workspaces/subs-styles";

describe("Subtitle library styles", () => {
  it("retains library master-detail layout and scoped controls", () => {
    const css = renderSubsStyles("test-panel");
    for (const selector of [".bsb-library-jobbar", ".bsb-library-master", ".bsb-library-layout", ".bsb-library-filterbar", ".bsb-empty"]) {
      expect(css).toContain(`#test-panel ${selector}`);
    }
    expect(css).not.toContain("${PANEL_ID}");
  });
});