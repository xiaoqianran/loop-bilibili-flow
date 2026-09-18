import type { ShortcutBinding, ShortcutRegisterOptions } from "./types";

export interface ShortcutKeyboardEvent {
  code?: string;
  key?: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  repeat?: boolean;
  isComposing?: boolean;
  target?: EventTarget | null;
  getModifierState?: (key: string) => boolean;
}

export interface ShortcutEventTargetLike {
  addEventListener(
    type: string,
    listener: (event: ShortcutKeyboardEvent) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: (event: ShortcutKeyboardEvent) => void,
    options?: boolean | EventListenerOptions,
  ): void;
}

export interface RegisterShortcutRuntimeOptions extends ShortcutRegisterOptions {
  target?: ShortcutEventTargetLike;
  capture?: boolean;
  stopOnMatch?: boolean;
  onError?: (error: unknown) => void;
}

export function chordFromEvent(event: ShortcutKeyboardEvent): string {
  const code = String(event.code || "");
  if (!code || /^(Control|Shift|Alt|Meta)(Left|Right)?$/.test(code)) return "";
  const parts: string[] = [];
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  if (event.metaKey) parts.push("Meta");
  parts.push(code);
  return parts.join("+");
}

export function keyLabel(code: string): string {
  const value = String(code || "");
  if (/^Key[A-Z]$/.test(value)) return value.slice(3);
  if (/^Digit[0-9]$/.test(value)) return value.slice(5);
  if (/^Numpad[0-9]$/.test(value)) return `Num ${value.slice(6)}`;
  const labels: Record<string, string> = {
    Space: "Space",
    Enter: "Enter",
    Tab: "Tab",
    Escape: "Esc",
    Backspace: "Backspace",
    Delete: "Delete",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    Minus: "-",
    Equal: "=",
    BracketLeft: "[",
    BracketRight: "]",
    Semicolon: ";",
    Quote: "'",
    Comma: ",",
    Period: ".",
    Slash: "/",
    Backslash: "\\",
    Backquote: "`",
    Home: "Home",
    End: "End",
    PageUp: "PgUp",
    PageDown: "PgDn",
    Insert: "Insert",
  };
  if (labels[value]) return labels[value];
  if (/^F\d{1,2}$/.test(value)) return value;
  return value.replace(/^(Arrow|Numpad)/, "") || value;
}

export function display(chord: string): string {
  const parts = String(chord || "").split("+").filter(Boolean);
  if (!parts.length) return "未绑定";
  return parts
    .map((part) =>
      ["Ctrl", "Alt", "Shift", "Meta"].includes(part) ? part : keyLabel(part),
    )
    .join(" + ");
}

export function hasStrongModifier(chord: string): boolean {
  const parts = new Set(String(chord || "").split("+"));
  return parts.has("Ctrl") || parts.has("Alt") || parts.has("Meta");
}

export function isEditableTarget(target: EventTarget | null | undefined): boolean {
  if (!target || typeof (target as Element).closest !== "function") return false;
  return !!(target as Element).closest(
    'input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]',
  );
}

export function shouldIgnore(
  event: ShortcutKeyboardEvent,
  options: { enabled?: boolean } = {},
): boolean {
  if (options.enabled === false) return true;
  if (event.repeat || event.isComposing) return true;
  if (event.getModifierState?.("AltGraph")) return true;
  if (isEditableTarget(event.target ?? null)) return true;
  return false;
}

export function register(
  bindings: readonly ShortcutBinding[],
  options: RegisterShortcutRuntimeOptions = {},
): () => void {
  const target = options.target;
  if (!target) {
    throw new Error("shortcut.register requires a target EventTarget");
  }
  const capture = options.capture !== false;
  const protectInput = options.protectInput !== false;
  const stopOnMatch = options.stopOnMatch !== false;
  const enabled = options.enabled !== false;

  const listener = (event: ShortcutKeyboardEvent): void => {
    if (protectInput && shouldIgnore(event, { enabled })) return;
    if (!protectInput && options.enabled === false) return;

    const chord = chordFromEvent(event);
    if (!chord) return;
    const binding = bindings.find((candidate) => candidate.chord === chord);
    if (!binding) return;

    if (stopOnMatch) {
      const native = event as unknown as {
        preventDefault?: () => void;
        stopImmediatePropagation?: () => void;
      };
      native.preventDefault?.();
      native.stopImmediatePropagation?.();
    }
    try {
      void Promise.resolve(binding.handler()).catch((error: unknown) => {
        options.onError?.(error);
      });
    } catch (error) {
      options.onError?.(error);
    }
  };

  target.addEventListener("keydown", listener, capture);
  return () => target.removeEventListener("keydown", listener, capture);
}

// Compatibility aliases for callers not yet migrated to runtime.shortcut.*.
export const shortcutChordFromEvent = chordFromEvent;
export const shortcutKeyLabel = keyLabel;
export const shortcutDisplayChord = display;
export const shortcutHasStrongModifier = hasStrongModifier;
export const shortcutEditableTarget = isEditableTarget;
export const shouldIgnoreShortcutEvent = shouldIgnore;
export const registerShortcutRuntime = register;
