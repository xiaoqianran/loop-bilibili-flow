import { describe, expect, it } from "vitest";
import { renderAiWorkspace, renderSubsWorkspace, renderKnowledgeWorkspaceMarkup, renderSettingsWorkspace } from "../../apps/userscript/src/ui/workspaces/markup";

describe("Studio workspace markup contracts", () => {
  it("retains one independently addressable panel per workspace", () => {
    const views = [
      ["ai", renderAiWorkspace()],
      ["subs", renderSubsWorkspace(50, 300)],
      ["knowledge", renderKnowledgeWorkspaceMarkup()],
      ["settings", renderSettingsWorkspace()],
    ] as const;
    for (const [name, html] of views) {
      expect(html).toContain(`data-view-panel="${name}"`);
      expect(html).toContain("bsb-view");
      expect(html).not.toContain("${DEFAULT_");
    }
    expect(renderAiWorkspace()).toContain('data-ai-stage="chat"');
    expect(renderSubsWorkspace(50, 300)).toContain('data-role="library-search"');
    expect(renderKnowledgeWorkspaceMarkup()).toContain('data-role="knowledge-nav-split"');
    expect(renderSettingsWorkspace()).toContain('data-settings-tab="shortcuts"');
  });
  it("keeps subtitle capture defaults configurable", () => {
    const html = renderSubsWorkspace(73, 1250);
    expect(html).toContain('data-role="max-pages" min="1" max="100" value="73"');
    expect(html).toContain('data-role="delay" min="0" max="5000" step="50" value="1250"');
  });
});
