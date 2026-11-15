interface UserscriptRequestDetails {
  method?: string;
  anonymous?: boolean;
  timeout?: number;
  ontimeout?: (response?: UserscriptResponse) => void;
  url: string;
  headers?: Record<string, string>;
  data?: string;
  responseType?: "text" | "blob" | "arraybuffer" | "json" | "stream" | "document";
  onload?: (response: UserscriptResponse) => void;
  onerror?: (error: unknown) => void;
  onabort?: () => void;
  onprogress?: (response: UserscriptResponse) => void;
  onloadstart?: (response: UserscriptResponse) => void;
}

interface UserscriptResponse {
  status: number;
  responseText: string;
  responseHeaders?: string;
  response?: unknown;
}

declare const GM_info: { script?: { version?: string } } | undefined;
declare const GM_getValue:
  | ((key: string, fallback?: unknown) => unknown)
  | undefined;
declare const GM_setValue:
  | ((key: string, value: unknown) => void)
  | undefined;
declare const GM_deleteValue: ((key: string) => void) | undefined;
declare const GM_xmlhttpRequest:
  | ((details: UserscriptRequestDetails) => { abort?: () => void })
  | undefined;
declare const GM_setClipboard: ((text: string, contentType?: "text" | "html") => void) | undefined;
declare const GM_addStyle: ((css: string) => void) | undefined;
declare const GM_download:
  | ((details: {
      url: string;
      name?: string;
      saveAs?: boolean;
      conflictAction?: "overwrite" | "uniquify" | "prompt";
      onload?: () => void;
      onerror?: (error?: unknown) => void;
      ontimeout?: () => void;
    }) => void)
  | undefined;
declare const unsafeWindow: Window | undefined;

/** CDN rendering APIs are optional at runtime; the workbench checks/lazily loads them. */
interface MarkdownGlobal {
  parse(markdown: string): string;
  setOptions(config: Record<string, unknown>): void;
}
interface SvgSanitizer {
  sanitize(html: string, options?: Record<string, unknown>): string;
}
interface MermaidGlobal {
  initialize(options: Record<string, unknown>): void;
  render(id: string, source: string): Promise<{ svg: string; bindFunctions?: (element: Element) => void }>;
}
interface KatexGlobal {
  renderToString(math: string, options?: Record<string, unknown>): string;
}
interface SyntaxHighlighter {
  highlightElement(element: Element): void;
}
declare const marked: MarkdownGlobal;
declare const DOMPurify: SvgSanitizer;
declare const mermaid: MermaidGlobal;
declare const katex: KatexGlobal;
declare const hljs: SyntaxHighlighter;
