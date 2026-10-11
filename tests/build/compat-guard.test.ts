import { describe, expect, it } from "vitest";

import { guardCompatRuntimeForBilibili } from "../../scripts/userscript-build-utils";

describe("compat runtime host guard", () => {
  it("keeps the maintained Bilibili body off YouTube pages", () => {
    const source = guardCompatRuntimeForBilibili("state.count += 1;");
    const run = new Function("location", "state", source) as (
      location: { hostname: string },
      state: { count: number },
    ) => void;

    const youtube = { count: 0 };
    run({ hostname: "www.youtube.com" }, youtube);
    expect(youtube.count).toBe(0);

    const bilibili = { count: 0 };
    run({ hostname: "www.bilibili.com" }, bilibili);
    expect(bilibili.count).toBe(1);
  });
});
