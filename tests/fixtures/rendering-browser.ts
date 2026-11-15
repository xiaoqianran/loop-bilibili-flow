import { DOMPurify, marked, katex, hljs, mermaid, installRenderingStyles } from "../../apps/userscript/src/runtime/rendering-libs";
import { toTrustedHTML } from "../../apps/userscript/src/runtime/trusted-html";

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
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", flowchart: { htmlLabels: false } });
  const { svg } = await mermaid.render("offline-graph", 'flowchart TD\nA["字幕"] --> B["阅读"]');
  const graph = document.createElement("div");
  graph.id = "diagram";
  graph.innerHTML = toTrustedHTML(DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } }));
  host.appendChild(graph);
  await document.fonts.ready;
  document.body.dataset.result = "ok";
}

run().catch(error => {
  document.body.dataset.result = "error";
  document.body.dataset.error = error instanceof Error ? error.stack : String(error);
  console.error(error);
});
