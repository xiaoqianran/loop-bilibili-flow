export const COMPAT_BODY_MARKER =
  "// ---- SubBatch temporary maintained compatibility runtime ----";

export function stripUserscriptMetadata(source: string): string {
  const closingMarker = "// ==/UserScript==";
  const markerIndex = source.indexOf(closingMarker);
  if (markerIndex < 0) throw new Error("Userscript metadata closing marker not found");
  let bodyStart = markerIndex + closingMarker.length;
  if (source.startsWith("\r\n", bodyStart)) bodyStart += 2;
  else if (source.startsWith("\n", bodyStart)) bodyStart += 1;
  return source.slice(bodyStart);
}
