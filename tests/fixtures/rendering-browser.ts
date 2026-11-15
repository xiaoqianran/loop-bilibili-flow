import { DOMPurify, marked, katex, hljs, mermaid, installRenderingStyles } from "../../apps/userscript/src/runtime/rendering-libs";
import { toTrustedHTML } from "../../apps/userscript/src/runtime/trusted-html";
import { createMermaidConfig } from "../../apps/userscript/src/ui/workspaces/mermaid-config";

async function run() {
  installRenderingStyles("katex");
  installRenderingStyles("highlight");
  const host = document.getElementById("content")!;
  const markdown = "# 离线渲染\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n```javascript\nconst value = 42;\n```\n\n<img src=x onerror='window.pwned=true'><script>window.pwned=true</script>";
  host.innerHTML = toTrustedHTML(DOMPurify.sanitize(marked.parse(markdown)));
  const code = host.querySelector<HTMLElement>("code")!;
  hljs.highlightElement(code);
  const math = document.createElement("div");
  math.innerHTML = toTrustedHTML(DOMPurify.sanitize(katex.renderToString("\\frac{a}{b}")));
  host.appendChild(math);
  mermaid.initialize(createMermaidConfig({
    mantle: "#181825", surface0: "#313244", surface1: "#45475a",
    surface2: "#585b70", base: "#1e1e2e", rosewater: "#f5e0dc",
    blue: "#89b4fa", green: "#a6e3a1", mauve: "#cba6f7",
    subtext1: "#bac2de", yellow: "#f9e2af", text: "#cdd6f4",
  }, true));
  const { svg } = await mermaid.render("offline-graph", 'flowchart TD\nA["字幕"] --> B["阅读"]');
  const graph = document.createElement("div");
  graph.id = "diagram";
  const safeSvg = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
  document.body.dataset.graphDiag = JSON.stringify({rawText: (svg.match(/<text\b/gi) || []).length, rawForeign: (svg.match(/<foreignObject\b/gi) || []).length, safeText: (safeSvg.match(/<text\b/gi) || []).length, safeForeign: (safeSvg.match(/<foreignObject\b/gi) || []).length, safeHasLabels: safeSvg.includes("字幕") && safeSvg.includes("阅读")});
  graph.innerHTML = toTrustedHTML(safeSvg);
  host.appendChild(graph);
  await document.fonts.ready;
  document.body.dataset.result = "ok";
}

run().catch(error => {
  document.body.dataset.result = "error";
  document.body.dataset.error = error instanceof Error ? error.stack : String(error);
  console.error(error);
});
