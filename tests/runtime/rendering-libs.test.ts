// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { DOMPurify, marked, katex, hljs, installRenderingStyles } from "../../apps/userscript/src/runtime/rendering-libs";

afterEach(() => document.querySelectorAll('[id^="bsb-render-style-"]').forEach(node => node.remove()));

describe("bundled rendering dependencies", () => {
  it("renders GFM tables and line breaks synchronously without page globals", () => {
    const html = marked.parse("# 标题\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n第一行\n第二行");
    expect(html).toContain("<h1>标题</h1>");
    expect(html).toContain("<table>");
    expect(html).toContain("第一行<br>第二行");
  });

  it("sanitizes generated HTML while keeping formatting and removing executable content", () => {
    const html = DOMPurify.sanitize(marked.parse('**保留** <img src=x onerror="alert(1)"><script>alert(2)</script>'));
    expect(html).toContain("<strong>保留</strong>");
    expect(html).not.toMatch(/onerror|<script/);
  });

  it("renders formulas and highlights code locally", () => {
    expect(katex.renderToString("\\frac{a}{b}", { throwOnError: false })).toContain('class="katex"');
    const code = document.createElement("code");
    code.className = "language-javascript";
    code.textContent = "const value = 42;";
    hljs.highlightElement(code);
    expect(code.querySelector(".hljs-keyword")?.textContent).toBe("const");
  });

  it("installs formula and code styles once without external stylesheet requests", () => {
    installRenderingStyles("katex");
    installRenderingStyles("katex");
    installRenderingStyles("highlight");
    expect(document.querySelectorAll('[id^="bsb-render-style-"]')).toHaveLength(2);
    expect(document.getElementById("bsb-render-style-katex")?.textContent).toContain(".katex");
    expect(document.getElementById("bsb-render-style-highlight")?.textContent).toContain(".hljs");
    expect(document.querySelector("script[src],link[rel=stylesheet]")).toBeNull();
  });
});
