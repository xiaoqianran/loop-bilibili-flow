export function stripMermaidTimestampCitations(code: string): string {
  return String(code || "")
    .replace(
      /[ \t]*\[\s*(?:BV(?:号|[A-Za-z0-9]+)?\s+)?P(?:号|\d+)\s+(?:mm:ss|\d{1,2}:\d{2}(?::\d{2})?)\s*\]/gi,
      "",
    )
    .replace(
      /[ \t]*\[\s*BV(?:号|[A-Za-z0-9]+)?\s+(?:mm:ss|\d{1,2}:\d{2}(?::\d{2})?)\s*\]/gi,
      "",
    )
    .replace(/[ \t]+(?=\r?\n|$)/g, "")
    .trim();
}

export function sanitizeMermaidTimestampCitationsInMarkdown(
  markdown: string,
): string {
  return String(markdown || "").replace(
    /```mermaid\s*\r?\n([\s\S]*?)```/gi,
    (_, code: string) =>
      `\`\`\`mermaid\n${stripMermaidTimestampCitations(code)}\n\`\`\``,
  );
}

export function replaceMermaidBlockAt(
  markdown: string,
  targetIdx: number,
  nextCode: string,
): { value: string; replaced: boolean } {
  let current = -1;
  let replaced = false;
  const value = String(markdown || "").replace(
    /```mermaid\s*\r?\n([\s\S]*?)```/gi,
    (full) => {
      current += 1;
      if (current !== Number(targetIdx)) return full;
      replaced = true;
      return `\`\`\`mermaid\n${stripMermaidTimestampCitations(nextCode)}\n\`\`\``;
    },
  );
  return { value, replaced };
}

