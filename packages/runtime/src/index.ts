import { create } from "./userscript";
import { observe } from "./spa";
import { register } from "./shortcuts";

export const RUNTIME_VERSION = "0.1.0";

export const userscript = {
  create,
} as const;

export const spa = {
  observe,
} as const;

export const shortcut = {
  register,
} as const;

// Compatibility flat exports.
export * from "./types";
export * from "./userscript";
export * from "./spa";
export * from "./shortcuts";
