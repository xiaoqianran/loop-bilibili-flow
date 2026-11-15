/**
 * Wrap SubBatch-owned HTML templates for sites enforcing Trusted Types (YouTube).
 * This does not sanitize HTML: callers still escape or sanitize untrusted content.
 * We intentionally do not install a global "default" policy, which would weaken
 * Trusted Types enforcement for the hosting website.
 */
interface HtmlPolicy {
  createHTML(html: string): unknown;
}
interface HtmlPolicyFactory {
  createPolicy(
    name: string,
    rules: { createHTML(html: string): string },
  ): HtmlPolicy;
}

let cachedFactory: HtmlPolicyFactory | null = null;
let cachedPolicy: HtmlPolicy | null = null;

export function toTrustedHTML(markup: string): string {
  const factory = (globalThis as { trustedTypes?: HtmlPolicyFactory }).trustedTypes;
  if (!factory) return markup;
  if (factory !== cachedFactory) {
    cachedPolicy = factory.createPolicy("bili-subbatch-workbench", {
      createHTML: (html) => html,
    });
    cachedFactory = factory;
  }
  // DOM's TypeScript definition still types innerHTML as string.
  return cachedPolicy!.createHTML(markup) as string;
}
