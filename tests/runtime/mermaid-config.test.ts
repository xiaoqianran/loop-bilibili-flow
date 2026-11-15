import { describe, expect, it } from "vitest";
import { createMermaidConfig, type MermaidPalette } from "../../apps/userscript/src/ui/workspaces/mermaid-config";

const palette: MermaidPalette = {
  mantle: "#181825", surface0: "#313244", surface1: "#45475a",
  surface2: "#585b70", base: "#1e1e2e", rosewater: "#f5e0dc",
  blue: "#89b4fa", green: "#a6e3a1", mauve: "#cba6f7",
  subtext1: "#bac2de", yellow: "#f9e2af", text: "#cdd6f4",
};

describe("Mermaid presentation configuration", () => {
  it("retains safe SVG labels and consistent layout after theme changes", () => {
    const initial = createMermaidConfig(palette, true);
    const refreshed = createMermaidConfig(palette, true);
    expect(refreshed).toEqual(initial);
    for (const config of [initial, refreshed]) {
      expect(config.securityLevel).toBe("strict");
      expect(config.htmlLabels).toBe(false);
      expect(config.flowchart.htmlLabels).toBe(false);
      expect(config.flowchart.useMaxWidth).toBe(false);
      expect(config.flowchart.nodeSpacing).toBe(48);
      expect(config.sequence.wrap).toBe(true);
      expect(config.themeVariables.fontSize).toBe("16px");
      expect(config.themeCSS).toContain(palette.mantle);
    }
  });
  it("updates flavor colors without altering diagram behavior", () => {
    const dark = createMermaidConfig(palette, true);
    const light = createMermaidConfig({ ...palette, mantle: "#e6e9ef" }, false);
    expect(light.themeVariables.darkMode).toBe(false);
    expect(light.themeVariables.background).toBe("#e6e9ef");
    expect(light.htmlLabels).toBe(dark.htmlLabels);
    expect(light.flowchart).toEqual(dark.flowchart);
    expect(light.sequence).toEqual(dark.sequence);
  });
});
