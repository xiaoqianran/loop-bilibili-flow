import { providerRegistry } from "../providers";
import type { ResolvedContent } from "../providers";

export function resolve(
  href: string,
  pageRuntime: unknown,
): ResolvedContent | null {
  return providerRegistry.resolveCurrent({ href, pageRuntime });
}

export const resolveCurrentContent = resolve;
