/** Strictly typed owner for panel settings, workspace selection and debounced form input. */
export interface SettingsInputPorts {
  selectWorkspace(view: string): void;
  maxPages(value: number): void;
  delayMs(value: number): void;
  autoCapture(value: boolean): void;
  autoAnalyze(value: boolean): void;
  playerSubtitle(value: boolean): void;
  mode(value: string): void;
  promptSelect(value: string): void;
  preprocessEnabled(value: boolean): void;
  preprocessPrompt(value: string): void;
  preprocessModel(value: string): void;
  promptSearch(value: string): void;
  aiSearch(value: string): void;
  knowledgeSearch(value: string): void;
}

export interface SettingsInputDefaults {
  maxPages: number;
  delayMs: number;
  autoCapture: boolean;
  autoAnalyze: boolean;
  playerSubtitle: boolean;
  preprocessEnabled: boolean;
}
const bindings = new WeakMap<HTMLElement, () => void>();

export function bind(root: HTMLElement, ports: SettingsInputPorts, defaults: SettingsInputDefaults): () => void {
  bindings.get(root)?.();
  const disposers: Array<() => void> = [];
  const listen = (element: Element | null, name: string, action: (event: Event) => void): void => {
    if (!element) return;
    element.addEventListener(name, action);
    disposers.push(() => element.removeEventListener(name, action));
  };
  const onValue = (selector: string, action: (value: string) => void): void => {
    listen(root.querySelector(selector), "change", event => {
      action(String((event.target as HTMLInputElement | null)?.value || ""));
    });
  };
  const onCheck = (selector: string, initial: boolean, action: (value: boolean) => void): void => {
    const input = root.querySelector<HTMLInputElement>(selector);
    if (input) input.checked = initial;
    listen(input, "change", event => {
      action(Boolean((event.target as HTMLInputElement | null)?.checked));
    });
  };
  const debounceInput = (selector: string, delayMs: number, action: (value: string) => void): void => {
    const element = root.querySelector<HTMLInputElement>(selector);
    if (!element) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = (event: Event) => {
      const value = String((event.target as HTMLInputElement | null)?.value || "");
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; action(value); }, delayMs);
    };
    listen(element, "input", handler);
    disposers.push(() => { if (timer !== null) clearTimeout(timer); });
  };

  root.querySelectorAll<HTMLElement>("[data-view]").forEach(button => {
    listen(button, "click", () => ports.selectWorkspace(button.getAttribute("data-view") || ""));
  });
  onValue('[data-role="max-pages"]', value =>
    ports.maxPages(Math.max(1, Math.min(100, Number(value) || defaults.maxPages))));
  onValue('[data-role="delay"]', value =>
    ports.delayMs(Math.max(0, Math.min(5000, Number(value) || defaults.delayMs))));
  onCheck('[data-role="auto-capture"]', defaults.autoCapture, ports.autoCapture);
  onCheck('[data-role="auto-analyze"]', defaults.autoAnalyze, ports.autoAnalyze);
  onCheck('[data-role="player-subtitle"]', defaults.playerSubtitle, ports.playerSubtitle);
  onValue('[data-role="mode"]', value => ports.mode(value || "auto"));
  onValue('[data-role="prompt-select"]', ports.promptSelect);
  onCheck('[data-role="preprocess-enabled"]', defaults.preprocessEnabled, ports.preprocessEnabled);
  onValue('[data-role="preprocess-prompt-select"]', ports.preprocessPrompt);
  onValue('[data-role="preprocess-model-select"]', ports.preprocessModel);
  debounceInput('[data-role="prompt-search"]', 60, ports.promptSearch);
  debounceInput('[data-role="ai-search"]', 60, ports.aiSearch);
  debounceInput('[data-role="knowledge-search"]', 70, ports.knowledgeSearch);

  const dispose = () => {
    disposers.splice(0).forEach(remove => remove());
    if (bindings.get(root) === dispose) bindings.delete(root);
  };
  bindings.set(root, dispose);
  return dispose;
}
