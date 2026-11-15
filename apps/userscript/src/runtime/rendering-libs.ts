import { Marked } from "marked";
import purifier from "dompurify";
import katex from "katex";
import highlighter from "highlight.js/lib/common";
import mermaid from "mermaid";
import katexCss from "katex/dist/katex.min.css?inline";
import highlightCss from "highlight.js/styles/atom-one-dark.min.css?inline";
import { toTrustedHTML } from "./trusted-html";

// Keep these APIs in the userscript realm. Page globals and remote <script>
// injection are unreliable under userscript isolation, CSP and Trusted Types.
const parser = new Marked({ gfm: true, breaks: true, async: false });
export const marked = {
  parse: (markdown: string): string => parser.parse(markdown, { async: false }),
};
export const DOMPurify = purifier;
export { katex, mermaid };
export const hljs = {
  highlightElement(element: HTMLElement): void {
    if (element.dataset.highlighted) return;
    const language = element.className.match(/\blanguage-([\w#+-]+)/i)?.[1];
    const source = element.textContent || "";
    const result = language
      ? highlighter.highlight(source, { language, ignoreIllegals: true })
      : highlighter.highlightAuto(source);
    // highlight() escapes source text; only its generated spans are installed.
    element.innerHTML = toTrustedHTML(result.value);
    element.classList.add("hljs");
    element.dataset.highlighted = "yes";
  },
};

const styles = { katex: katexCss, highlight: highlightCss };

export function installRenderingStyles(kind: keyof typeof styles): void {
  const id = `bsb-render-style-${kind}`;
  if (document.getElementById(id)) return;
  const element = document.createElement("style");
  element.id = id;
  element.textContent = styles[kind];
  (document.head || document.documentElement).appendChild(element);
}
