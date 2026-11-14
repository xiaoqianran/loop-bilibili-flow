/** Typed event owner for library selection, search and transcript navigation. */
export interface ResourceInteractionPorts {
  followEnabled(): boolean;
  selectGroup(key: string, selected: boolean): void;
  selectItem(index: number, selected: boolean): void;
  toggleFolder(key: string): void;
  openItem(index: number): void;
  searchLibrary(query: string): void;
  filterLibrary(filter: string): void;
  searchTranscript(query: string): void;
  switchTrack(index: number): void;
  setFollow(enabled: boolean): void;
  seekTranscript(seconds: number): void;
  recordUserScroll(): void;
}

const bindings = new WeakMap<HTMLElement, () => void>();

function closest<T extends Element>(event: Event, selector: string): T | null {
  const target = event.target as Element | null;
  return typeof target?.closest === "function" ? target.closest<T>(selector) : null;
}

function debounceInput(
  target: Element | null, delay: number, onValue: (value: string) => void,
): () => void {
  if (!target) return () => {};
  let timer: ReturnType<typeof setTimeout> | null = null;
  const handler = (event: Event) => {
    const input = event.target as HTMLInputElement | null;
    const value = String(input?.value || "");
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; onValue(value); }, delay);
  };
  target.addEventListener("input", handler);
  return () => {
    target.removeEventListener("input", handler);
    if (timer !== null) clearTimeout(timer);
  };
}

export function bind(root: HTMLElement, ports: ResourceInteractionPorts): () => void {
  bindings.get(root)?.();
  const disposers: Array<() => void> = [];
  const listen = (target: Element | null, name: string, fn: EventListener, passive = false) => {
    if (!target) return;
    target.addEventListener(name, fn, passive ? { passive: true } : undefined);
    disposers.push(() => target.removeEventListener(name, fn));
  };
  const list = root.querySelector<HTMLElement>('[data-role="list"]');
  listen(list, "change", event => {
    const group = closest<HTMLInputElement>(event, 'input[type="checkbox"][data-group-check]');
    if (group) {
      ports.selectGroup(group.getAttribute("data-group-check") || "", !!group.checked);
      return;
    }
    const item = closest<HTMLInputElement>(event, 'input[type="checkbox"][data-i]');
    if (item) ports.selectItem(Number(item.getAttribute("data-i")), !!item.checked);
  });
  listen(list, "click", event => {
    const folder = closest<HTMLElement>(event, "[data-folder-toggle]");
    if (folder) {
      event.preventDefault();
      event.stopPropagation();
      ports.toggleFolder(folder.getAttribute("data-folder-toggle") || "");
      return;
    }
    if (closest(event, 'input[type="checkbox"]') || closest(event, ".bsb-resource-folder")) return;
    const item = closest<HTMLElement>(event, "[data-transcript-i]");
    if (item) ports.openItem(Number(item.dataset.transcriptI));
  });
  disposers.push(debounceInput(root.querySelector('[data-role="library-search"]'), 70,
    value => ports.searchLibrary(value.trim())));
  listen(root.querySelector('[data-role="library-filters"]'), "click", event => {
    const button = closest<HTMLElement>(event, "[data-library-filter]");
    if (button) ports.filterLibrary(button.dataset.libraryFilter || "all");
  });
  disposers.push(debounceInput(root.querySelector('[data-role="transcript-search"]'), 80,
    value => ports.searchTranscript(value.trim())));
  listen(root.querySelector('[data-role="transcript-track"]'), "change", event => {
    ports.switchTrack(Number((event.target as HTMLSelectElement | null)?.value));
  });
  const follow = root.querySelector<HTMLInputElement>('[data-role="transcript-follow"]');
  if (follow) follow.checked = ports.followEnabled();
  listen(follow, "change", event => {
    ports.setFollow(!!(event.target as HTMLInputElement | null)?.checked);
  });
  const transcript = root.querySelector<HTMLElement>('[data-role="transcript-list"]');
  listen(transcript, "click", event => {
    const time = closest<HTMLElement>(event, "[data-transcript-time]");
    if (time) ports.seekTranscript(Number(time.dataset.transcriptTime));
  });
  listen(transcript, "wheel", () => ports.recordUserScroll(), true);
  listen(transcript, "touchmove", () => ports.recordUserScroll(), true);
  const dispose = () => {
    disposers.splice(0).forEach(fn => fn());
    if (bindings.get(root) === dispose) bindings.delete(root);
  };
  bindings.set(root, dispose);
  return dispose;
}
