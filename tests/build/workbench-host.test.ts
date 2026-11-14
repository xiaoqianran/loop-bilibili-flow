import { describe, expect, it } from "vitest";
import { isWorkbenchHost } from "../../apps/userscript/src/workbench/host";

describe("bundled workbench domain boundary", () => {
  it("enables full workbench only on Bilibili hosts", () => {
    expect(isWorkbenchHost("www.bilibili.com")).toBe(true);
    expect(isWorkbenchHost("space.bilibili.com")).toBe(true);
    expect(isWorkbenchHost("bilibili.com")).toBe(true);
    expect(isWorkbenchHost("www.youtube.com")).toBe(false);
    expect(isWorkbenchHost("example-bilibili.com")).toBe(false);
    expect(isWorkbenchHost("bilibili.com.example.org")).toBe(false);
  });
});
