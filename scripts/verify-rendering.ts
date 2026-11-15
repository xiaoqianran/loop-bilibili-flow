import { build } from "vite";
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { once } from "node:events";
import { resolve } from "node:path";
import assert from "node:assert/strict";

// Build the real dependencies with the production options, then exercise them
// without CDN access or page globals, including a Trusted Types enforcing page.
async function verify() {
  const result = await build({
    configFile: "apps/userscript/vite.config.ts",
    logLevel: "error",
    build: { write: false, lib: { entry: "tests/fixtures/rendering-browser.ts", formats: ["iife"], name: "RenderSmoke" } },
  });
  const bundle = (Array.isArray(result) ? result[0] : result);
  assert(bundle && "output" in bundle);
  const script = bundle.output.find(item => item.type === "chunk")?.code;
  assert(script);
  const server = createServer((req, res) => {
    if (req.url === "/render.js") {
      res.writeHead(200, { "Content-Type": "text/javascript" });
      res.end(script);
      return;
    }
    const strict = req.url === "/strict";
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": `script-src 'self'; style-src 'self' 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none';${strict ? " require-trusted-types-for 'script';" : ""}`,
    });
    res.end('<!doctype html><html><head><meta charset="utf-8"></head><body><main id="content"></main><script src="/render.js"></script></body></html>');
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    for (const path of ["/normal", "/strict"]) {
      const page = await browser.newPage();
      const external: string[] = [];
      await page.route("**/*", route => {
        const url = route.request().url();
        if (url.startsWith(base) || url.startsWith("data:")) return route.continue();
        external.push(url);
        return route.abort();
      });
      await page.goto(base + path);
      await page.waitForFunction(() => !!document.body.dataset.result, undefined, { timeout: 30000 });
      const result = await page.evaluate(() => ({
        status: document.body.dataset.result, error: document.body.dataset.error,
        table: !!document.querySelector("table td"), math: !!document.querySelector(".katex .mfrac"),
        highlight: !!document.querySelector(".hljs-keyword"), graph: !!document.querySelector("#diagram svg"),
        unsafe: !!document.querySelector("#content script,#content [onerror]"),
        fonts: Array.from(document.fonts).filter(font => font.status === "error").length,
      }));
      assert.equal(result.status, "ok", JSON.stringify(result));
      assert(result.table && result.math && result.highlight && result.graph, JSON.stringify(result));
      assert(!result.unsafe && result.fonts === 0, JSON.stringify(result));
      assert.deepEqual(external, [], "Rendering must not request remote resources");
      console.log(`Rendering verified ${path}: Markdown, sanitizer, KaTeX/fonts, highlighting, Mermaid; zero external requests`);
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`Production options: ${resolve("apps/userscript/vite.config.ts")}`);
}

void verify().catch(error => { console.error(error); process.exit(1); });
