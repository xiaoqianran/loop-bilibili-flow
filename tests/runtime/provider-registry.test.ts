import { describe, expect, it } from "vitest";

import {
  contentRefKey,
  createProviderRegistry,
  type ContentProvider,
} from "../../apps/userscript/src/providers";

function provider(
  id: string,
  host: string,
  sourceId: string,
): ContentProvider {
  return {
    id,
    matches: (href) => new URL(href).hostname === host,
    resolveCurrent: ({ href }) => {
      const ref = { source: id, sourceId, url: href };
      return { ref, key: contentRefKey(ref), native: { sourceId } };
    },
  };
}

describe("provider registry", () => {
  it("selects the matching provider without platform conditionals in app code", () => {
    const registry = createProviderRegistry([
      provider("alpha", "alpha.example", "A1"),
      provider("beta", "beta.example", "B1"),
    ]);

    expect(registry.match("https://beta.example/watch")).toMatchObject({
      id: "beta",
    });
    expect(
      registry.resolveCurrent({
        href: "https://beta.example/watch",
        pageRuntime: {},
      }),
    ).toMatchObject({
      ref: { source: "beta", sourceId: "B1" },
      key: "beta:B1",
    });
  });

  it("uses provider activation policy without leaking platform rules into app code", () => {
    const deferred: ContentProvider = {
      ...provider("alpha", "alpha.example", "A1"),
      activationState: () => "defer",
    };
    const registry = createProviderRegistry([deferred]);

    expect(
      registry.activationState({
        href: "https://alpha.example/watch",
        pageRuntime: {},
      }),
    ).toBe("defer");
    expect(
      registry.activationState({
        href: "https://unknown.example/",
        pageRuntime: {},
      }),
    ).toBe("ready");
  });

  it("returns null when no provider matches", () => {
    const registry = createProviderRegistry([
      provider("alpha", "alpha.example", "A1"),
    ]);

    expect(
      registry.resolveCurrent({
        href: "https://unknown.example/",
        pageRuntime: {},
      }),
    ).toBeNull();
  });
});
