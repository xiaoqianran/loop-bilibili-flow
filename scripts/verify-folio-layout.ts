import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import ts from "typescript";
import { chromium } from "@playwright/test";
import * as ui from "../apps/userscript/src/ui";

async function verify() {
  const runtime = readFileSync("apps/userscript/src/workbench/runtime.ts", "utf8");
  const source = ts.createSourceFile("workbench.ts", runtime, ts.ScriptTarget.Latest, true);
  const functionText = (name: string) => {
    const find = (node: ts.Node): ts.FunctionDeclaration | undefined => {
      if (ts.isFunctionDeclaration(node) && node.name?.text === name) return node;
      return ts.forEachChild(node, find);
    };
    const found = find(source);
    assert(found, `Missing production function: ${name}`);
    return found.getText(source);
  };
  let css = "";
  const styleScope = {
    PANEL_ID: "folio-test", MIN_W: 300, MIN_H: 400, DOCK_EDGE_PX: 8,
    buildCtpFlavorCss: () => "#folio-test { --ctp-text:#cdd6f4; --ctp-base:#1e1e2e; --ctp-mantle:#181825; --ctp-surface0:#313244; --ctp-surface1:#45475a; --ctp-overlay0:#6c7086; --ctp-overlay1:#7f849c; --ctp-subtext0:#a6adc8; --ctp-lavender:#b4befe; }",
    GM_addStyle: (value: string) => { css = value; },
    SubBatch: { SubBatchMonorepo: { ui } },
  };
  const styleScript = ts.transpileModule(`(${functionText("injectStyles")})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  new Function(...Object.keys(styleScope), `return ${styleScript}`)(...Object.values(styleScope))();
  const helpers = ["extractHtmlFolioSource", "sanitizeFolioHtml", "pruneFolioClasses", "slugFolioHeading", "collectFolioHeadings", "decorateFolioArticle", "folioOutlineFromHeadings", "makeFolioTocLink", "buildFolioToc", "setFolioTocCurrent", "scrollFolioTocLinkIntoNav", "syncFolioTocViewport", "updateFolioProgress", "bindFolioToc", "mountHtmlFolio"];
  const declarations = helpers.map(functionText).join("\n");
  const core = readFileSync("packages/core/src/folio/index.ts", "utf8").replace(/^export /gm, "");
  const bridge = `const coreFn = name => coreApi[name]; const coreCall = (name, ...args) => coreApi[name](...args);`;
  // The core slug has the same name as the compatibility wrapper; namespace it.
  const coreScript = `const coreApi = (() => { ${core}; return { slugFolioHeading, buildFolioOutline, formatFolioChapterIndex, countFolioOutline, folioOutlineSummary }; })();`;
  const setup = `const FOLIO_CLASS_ALLOW = new Set(["bsb-folio","kicker","lede","callout","steps","quote","meta"]); const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); const toTrustedHTML = s => s; ${coreScript} ${bridge} ${declarations}`;
  const script = ts.transpileModule(setup, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const require = createRequire(resolve("apps/userscript/package.json"));
  const purifier = readFileSync(require.resolve("dompurify/dist/purify.min.js"), "utf8");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  mkdirSync("dist/qa", { recursive: true });
  try {
    for (const [viewport, width, toc] of [[1440, 1000, false], [1440, 1000, true], [1440, 520, true], [1440, 320, true], [760, 680, true], [1440, 520, false]] as const) {
      const page = await browser.newPage({ viewport: { width: viewport, height: 900 } });
      await page.setContent(`<style>${css}</style><div id="folio-test" class="open" data-panel-size="${width < 600 ? "small" : "large"}"><div class="bsb-sidebar" style="width:${width}px;height:800px;top:20px;left:20px"><header class="bsb-head">HTML 阅读页</header><nav class="bsb-nav"></nav><div class="bsb-body"><section class="bsb-view active" data-view-panel="ai"><div class="bsb-ai-canvas-wrap"><div class="bsb-ai-md" data-role="ai-md"><div class="bsb-ai-content"></div></div></div></section></div></div></div>`);
      await page.addScriptTag({ content: purifier });
      await page.addScriptTag({ content: script });
      const html = `<article class="bsb-folio" style="width:80px;float:left;display:grid;grid-template-columns:30px"><header><h1>正常宽度的阅读页</h1><p class="lede">正文应占据阅读区域，不能挤成左侧一条窄列。</p></header>${Array.from({ length: 6 }, (_, i) => `<section>${toc ? `<h2>章节 ${i + 1}</h2>` : ""}<p>这里是连续阅读的中文正文。${"文字应自然换行，保留足够的阅读空间。".repeat(12)}</p></section>`).join("")}</article>`;
      await page.evaluate(html => {
        const mount = (window as unknown as { mountHtmlFolio(host: Element, html: string, root: Element): void }).mountHtmlFolio;
        mount(document.querySelector(".bsb-ai-content")!, html, document.querySelector(".bsb-ai-md")!);
      }, html);
      const metrics = await page.evaluate(() => {
        const reader = document.querySelector<HTMLElement>(".bsb-ai-content")!;
        const frame = document.querySelector<HTMLElement>(".bsb-folio-frame")!;
        const article = document.querySelector<HTMLElement>(".bsb-folio")!;
        const body = document.querySelector<HTMLElement>(".bsb-ai-md")!;
        const box = article.getBoundingClientRect();
        const frameBox = frame.getBoundingClientRect();
        const sidebar = document.querySelector<HTMLElement>(".bsb-folio-toc");
        return { width: box.width, frameWidth: frameBox.width, readerWidth: reader.clientWidth, centered: Math.abs((box.left + box.right - frameBox.left - frameBox.right) / 2), overflow: body.scrollWidth - body.clientWidth, inlineStyle: article.getAttribute("style"), tocPosition: sidebar ? getComputedStyle(sidebar).position : "none" };
      });
      const wide = toc && metrics.readerWidth >= 760;
      assert.equal(metrics.inlineStyle, null, "Generated HTML must not override reader layout");
      assert(metrics.width >= Math.min(640, metrics.readerWidth - (wide ? 224 : 0) - 56) - 2, JSON.stringify(metrics));
      assert(metrics.centered < 2 && metrics.overflow <= 1, JSON.stringify(metrics));
      if (toc) {
        assert.equal(metrics.tocPosition, wide ? "sticky" : "absolute");
        if (!wide) {
          await page.locator(".bsb-folio-toc-fab").click();
          await page.locator(".bsb-folio-toc-link").first().click();
          assert.equal(await page.locator(".bsb-folio-shell.is-toc-open").count(), 0);
          await page.waitForFunction(() => getComputedStyle(document.querySelector(".bsb-folio-toc")!).visibility === "hidden");
        }
      }
      await page.screenshot({ path: `dist/qa/folio-${viewport}-${width}-${toc ? "toc" : "plain"}.png` });
      if (toc && width === 520) {
        await page.evaluate(() => {
          document.querySelector<HTMLElement>(".bsb-ai-md")!.scrollTop = 0;
          document.querySelector(".bsb-folio-shell")!.classList.add("is-toc-open");
          document.querySelector<HTMLElement>(".bsb-sidebar")!.style.width = "1000px";
        });
        await page.waitForFunction(() => getComputedStyle(document.querySelector(".bsb-folio-toc")!).position === "sticky");
        assert.equal(await page.locator(".bsb-folio-toc-scrim").isVisible(), false);
      }
      console.log(`Folio layout verified: viewport=${viewport}, panel=${width}, toc=${toc}, text=${Math.round(metrics.width)}px`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

void verify().catch(error => { console.error(error); process.exit(1); });
