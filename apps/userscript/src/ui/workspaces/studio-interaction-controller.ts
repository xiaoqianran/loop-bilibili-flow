export interface StudioInteractionPorts {
  getIndex(): number;
  setIndex(index: number): void;
  renderMenu(): void;
  hideMenu(): void;
  runCommand(command: string): void;
  send(text: string): Promise<unknown>;
  onError(error: unknown): void;
}
const bindings = new WeakMap<HTMLElement, () => void>();
export function bind(root: HTMLElement, ports: StudioInteractionPorts): () => void {
  bindings.get(root)?.();
  const input = root.querySelector<HTMLTextAreaElement>('[data-role="studio-input"]');
  if (!input) return () => {};
  const onInput = () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(120, Math.max(40, input.scrollHeight))}px`;
    ports.renderMenu();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.isComposing || event.keyCode === 229) return;
    const menu = root.querySelector<HTMLElement>('[data-role="studio-slash"]');
    const open = menu && !menu.hidden;
    const items = open ? Array.from(menu.querySelectorAll<HTMLElement>("[data-studio-slash]")) : [];
    if (open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      ports.setIndex((ports.getIndex() + (event.key === "ArrowDown" ? 1 : -1) + items.length) % Math.max(1, items.length));
      ports.renderMenu();
    } else if (open && (event.key === "Tab" || (event.key === "Enter" && !event.shiftKey))) {
      event.preventDefault();
      const active = items[ports.getIndex()] || items[0];
      if (active?.dataset.studioSlash) {
        input.value = "";
        ports.hideMenu();
        ports.runCommand(active.dataset.studioSlash);
      }
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      ports.hideMenu();
    } else if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const text = input.value;
      input.value = "";
      input.style.height = "40px";
      ports.hideMenu();
      void ports.send(text).catch(ports.onError);
    }
  };
  input.addEventListener("input", onInput);
  input.addEventListener("keydown", onKey);
  const dispose = () => {
    input.removeEventListener("input", onInput);
    input.removeEventListener("keydown", onKey);
    if (bindings.get(root) === dispose) bindings.delete(root);
  };
  bindings.set(root, dispose);
  return dispose;
}
