import type { ContentRef } from "@subbatch/schemas";

export interface ProviderPageContext {
  href: string;
  pageRuntime: unknown;
}

export interface ResolvedContent<TNative = unknown> {
  ref: ContentRef;
  key: string;
  native: TNative;
}

export type ProviderActivationState = "ready" | "defer";

export interface ContentProvider<TNative = unknown> {
  id: string;
  matches(href: string): boolean;
  resolveCurrent(context: ProviderPageContext): ResolvedContent<TNative> | null;
  activationState?(context: ProviderPageContext): ProviderActivationState;
}

export interface ProviderRegistry {
  match(href: string): ContentProvider | null;
  resolveCurrent(context: ProviderPageContext): ResolvedContent | null;
  activationState(context: ProviderPageContext): ProviderActivationState;
}

export function contentRefKey(ref: ContentRef): string {
  const segment = String(ref.segmentId || "").trim();
  return [ref.source, ref.sourceId, ...(segment ? [segment] : [])].join(":");
}
