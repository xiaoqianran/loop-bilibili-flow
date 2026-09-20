import type {
  ContentProvider,
  ProviderPageContext,
  ProviderRegistry,
  ResolvedContent,
} from "./types";

export function createProviderRegistry(
  providers: readonly ContentProvider[],
): ProviderRegistry {
  const list = [...providers];

  return {
    match(href: string): ContentProvider | null {
      return list.find((provider) => provider.matches(href)) ?? null;
    },

    resolveCurrent(context: ProviderPageContext): ResolvedContent | null {
      for (const provider of list) {
        if (!provider.matches(context.href)) continue;
        const resolved = provider.resolveCurrent(context);
        if (resolved) return resolved;
      }
      return null;
    },

    activationState(context: ProviderPageContext) {
      const provider = list.find((candidate) => candidate.matches(context.href));
      return provider?.activationState?.(context) ?? "ready";
    },
  };
}
