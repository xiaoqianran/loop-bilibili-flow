import { create } from "./userscript";
import { observe } from "./spa";
import * as shortcutApi from "./shortcuts";

export const RUNTIME_VERSION = "0.1.0";

export const userscript = {
  create,
} as const;

export const spa = {
  observe,
} as const;

export const shortcut = {
  chordFromEvent: shortcutApi.chordFromEvent,
  keyLabel: shortcutApi.keyLabel,
  display: shortcutApi.display,
  hasStrongModifier: shortcutApi.hasStrongModifier,
  isEditableTarget: shortcutApi.isEditableTarget,
  shouldIgnore: shortcutApi.shouldIgnore,
  register: shortcutApi.register,
} as const;

// Compatibility flat exports.
export * from "./types";
export * from "./userscript";
export * from "./spa";
export * from "./shortcuts";
