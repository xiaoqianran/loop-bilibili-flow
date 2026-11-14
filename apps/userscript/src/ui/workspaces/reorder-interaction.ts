/** One typed delegated drag lifecycle for Prompt, LLM and post-task model ordering. */
export type ConfigKind = "prompt" | "llm";

export interface ReorderPorts {
  reorderConfig(kind: ConfigKind, fromId: string, toId: string): void;
  reorderFlow(taskId: string, fromId: string, toId: string): void;
}

type ConfigDrag = { type: "config"; kind: ConfigKind; id: string; list: HTMLElement };
type FlowDrag = { type: "flow"; id: string; taskId: string; card: HTMLElement };
type Drag = ConfigDrag | FlowDrag;

const CONFIG_ITEM = ".bsb-config-list-item[draggable='true']";
const FLOW_ITEM = ".bsb-model-rank[draggable='true']";
const CONFIG_LIST = '[data-role="prompt-list"], [data-role="ai-list"]';
const FLOW_CARD = "[data-flow-task-id]";
const ACTIVE = ".bsb-config-list-item.dragging, .bsb-config-list-item.drag-over, .bsb-model-rank.dragging, .bsb-model-rank.drag-over";
const bindings = new WeakMap<HTMLElement, () => void>();

function element(event: Event): Element | null {
  const target = event.target;
  return target && typeof (target as Element).closest === "function" ? target as Element : null;
}

function attr(el: HTMLElement, key: string): string {
  return el.dataset[key] || "";
}

export function bind(root: HTMLElement, ports: ReorderPorts): () => void {
  bindings.get(root)?.();
  let dragging: Drag | null = null;
  const clear = () => {
    root.querySelectorAll<HTMLElement>(ACTIVE).forEach(item =>
      item.classList.remove("dragging", "drag-over"));
  };
  const onStart = (event: DragEvent) => {
    const target = element(event);
    if (!target) return;
    // Starting another drag invalidates any leftover visual or source state.
    clear();
    dragging = null;
    const config = target.closest<HTMLElement>(CONFIG_ITEM);
    if (config && root.contains(config)) {
      const list = config.closest<HTMLElement>(CONFIG_LIST);
      if (!list || list.dataset.reorderLocked === "1") {
        event.preventDefault();
        return;
      }
      const id = attr(config, "promptListId") || attr(config, "aiListId");
      if (!id) { event.preventDefault(); return; }
      dragging = { type: "config", kind: list.dataset.role === "prompt-list" ? "prompt" : "llm", id, list };
      config.classList.add("dragging");
    } else {
      const model = target.closest<HTMLElement>(FLOW_ITEM);
      if (!model || !root.contains(model)) return;
      const card = model.closest<HTMLElement>(FLOW_CARD);
      const id = attr(model, "flowModelId");
      if (!card || !id) return;
      if (target.closest("[data-flow-task-model-remove]")) {
        event.preventDefault();
        return;
      }
      dragging = { type: "flow", id, taskId: attr(card, "flowTaskId"), card };
      model.classList.add("dragging");
    }
    try {
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", dragging.id);
      }
    } catch { /* Some userscript hosts block dataTransfer.setData. */ }
  };
  const targetFor = (target: Element, drag: Drag): HTMLElement | null => {
    if (drag.type === "config") {
      const item = target.closest<HTMLElement>(CONFIG_ITEM);
      return item?.closest(CONFIG_LIST) === drag.list ? item : null;
    }
    const item = target.closest<HTMLElement>(FLOW_ITEM);
    const card = item?.closest<HTMLElement>(FLOW_CARD);
    return card && attr(card, "flowTaskId") === drag.taskId ? item || null : null;
  };
  const onOver = (event: DragEvent) => {
    const target = element(event);
    if (!target || !dragging) return;
    const item = targetFor(target, dragging);
    if (!item) return;
    event.preventDefault();
    try { if (event.dataTransfer) event.dataTransfer.dropEffect = "move"; } catch { /* Some hosts restrict effect updates. */ }
    const scope = dragging.type === "config" ? dragging.list : dragging.card;
    const selector = dragging.type === "config"
      ? ".bsb-config-list-item.drag-over" : ".bsb-model-rank.drag-over";
    scope.querySelectorAll<HTMLElement>(selector).forEach(el => {
      if (el !== item) el.classList.remove("drag-over");
    });
    const id = dragging.type === "config"
      ? attr(item, "promptListId") || attr(item, "aiListId")
      : attr(item, "flowModelId");
    if (id !== dragging.id) item.classList.add("drag-over");
  };
  const onLeave = (event: DragEvent) => {
    const target = element(event);
    const item = target?.closest<HTMLElement>(".bsb-config-list-item, .bsb-model-rank");
    if (!item) return;
    const related = event.relatedTarget;
    if (related && item.contains(related as Node)) return;
    item.classList.remove("drag-over");
  };
  const onEnd = () => { clear(); dragging = null; };
  const onDrop = (event: DragEvent) => {
    const target = element(event);
    if (!target || !dragging) return;
    const item = targetFor(target, dragging);
    if (!item) return;
    event.preventDefault();
    const drag = dragging;
    const toId = drag.type === "config"
      ? attr(item, "promptListId") || attr(item, "aiListId")
      : attr(item, "flowModelId");
    onEnd();
    if (!toId || toId === drag.id) return;
    if (drag.type === "config") ports.reorderConfig(drag.kind, drag.id, toId);
    else ports.reorderFlow(drag.taskId, drag.id, toId);
  };
  root.addEventListener("dragstart", onStart);
  root.addEventListener("dragover", onOver);
  root.addEventListener("dragleave", onLeave);
  root.addEventListener("drop", onDrop);
  root.addEventListener("dragend", onEnd);
  const dispose = () => {
    root.removeEventListener("dragstart", onStart);
    root.removeEventListener("dragover", onOver);
    root.removeEventListener("dragleave", onLeave);
    root.removeEventListener("drop", onDrop);
    root.removeEventListener("dragend", onEnd);
    onEnd();
    if (bindings.get(root) === dispose) bindings.delete(root);
  };
  bindings.set(root, dispose);
  return dispose;
}
