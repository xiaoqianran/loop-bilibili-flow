import { resolve } from "./current-video";
import { observe } from "./navigation";
import { start } from "./video-carrier";

export const video = {
  resolve,
} as const;

export const navigation = {
  observe,
} as const;

export const activation = {
  start,
} as const;

// Compatibility flat exports.
export * from "./current-video";
export * from "./navigation";
export * from "./video-carrier";
