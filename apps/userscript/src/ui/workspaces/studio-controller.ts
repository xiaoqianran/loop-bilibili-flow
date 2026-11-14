/** Studio stage rendering only. Data and request state belong to app controllers. */
export type WorkbenchStage = "preprocess" | "postprocess" | "chat";

export function stageOf(value: unknown): WorkbenchStage {
  return value === "postprocess" || value === "chat" ? value : "preprocess";
}

export function applyWorkbenchStageUi(
  root: ParentNode,
  stageValue: unknown,
  inputView: string,
): void {
  const stage = stageOf(stageValue);
  root.querySelectorAll<HTMLElement>("[data-ai-stage]").forEach((button) => {
    const active = button.dataset.aiStage === stage;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  const preNav = root.querySelector<HTMLElement>('[data-role="ai-preprocess-nav"]');
  const postNav = root.querySelector<HTMLElement>('[data-role="ai-postprocess-nav"]');
  const dock = root.querySelector<HTMLElement>('[data-role="studio-dock"]');
  const wrap = root.querySelector<HTMLElement>(".bsb-ai-canvas-wrap");
  if (preNav) preNav.hidden = stage !== "preprocess";
  if (postNav) postNav.hidden = stage !== "postprocess";
  if (dock) dock.hidden = stage !== "chat";
  wrap?.classList.toggle("is-studio", stage === "chat");
  root.querySelectorAll<HTMLElement>("[data-preprocess-action]").forEach((node) => {
    node.hidden = stage !== "preprocess";
  });
  root.querySelectorAll<HTMLElement>("[data-postprocess-action]").forEach((node) => {
    node.hidden = stage !== "postprocess";
  });
  root.querySelectorAll<HTMLElement>("[data-studio-action]").forEach((node) => {
    node.hidden = stage !== "chat";
  });
  root.querySelectorAll<HTMLElement>("[data-pipeline-action]").forEach((node) => {
    node.hidden = stage === "chat";
  });
  const label = root.querySelector<HTMLElement>('[data-role="ai-canvas-stage-label"]');
  if (label) label.textContent =
    stage === "preprocess" ? "预处理" : stage === "chat" ? "对话" : "后处理";
  root.querySelectorAll<HTMLElement>("[data-ai-preprocess-view]").forEach((button) => {
    const active = button.dataset.aiPreprocessView === inputView;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
}
