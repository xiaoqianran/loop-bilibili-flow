/** Evidence tokens stay in AI input; readers display their text and navigation separately. */
export function transcriptTimestampPattern(): RegExp {
  return /\[([\w-]+)\s+P(\d+)\s+(\d{1,2}:\d{2}(?::\d{2})?)\]/gi;
}

export function transcriptTimestamps(text: string) {
  return Array.from(text.matchAll(transcriptTimestampPattern()), match => ({
    bvid: match[1]!, page: Number(match[2]) || 1, clock: match[3]!,
    seconds: match[3]!.split(":").map(Number).reduce((total, part) => total * 60 + part, 0),
  }));
}

function sourceHeading(line: string) {
  return line.match(/^===\s+([\w-]+)(?:\s+P(\d+))?(?:\s+(.*?))?\s+===$/);
}

export function transcriptReadingText(text: string): string {
  return text.replace(/\r\n?/g, "\n").split("\n").map(line => {
    const heading = sourceHeading(line.trim());
    if (heading) return heading[3]?.trim() || "";
    const hadPrefix = /^\s*\[[\w-]+\s+P\d+\s+\d{1,2}:\d{2}(?::\d{2})?\]/i.test(line);
    const clean = line.replace(transcriptTimestampPattern(), "").trimEnd();
    return hadPrefix ? clean.trimStart() : clean;
  }).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function renderTranscriptReading(
  text: string, timeline: boolean, escapeHtml: (text: string) => string,
): string {
  const rows = text.replace(/\r\n?/g, "\n").split("\n").map(line => {
    const heading = sourceHeading(line.trim());
    if (heading) {
      const identity = `${heading[1]} · P${heading[2] || 1}`;
      return `<header class="bsb-transcript-reading-source"><strong>${escapeHtml(heading[3]?.trim() || "字幕")}</strong><small>${escapeHtml(identity)}</small></header>`;
    }
    const clean = line.replace(transcriptTimestampPattern(), "").trim();
    if (!clean) return "";
    if (!timeline) return `<div class="bsb-transcript-reading-text">${escapeHtml(clean)}</div>`;
    const time = transcriptTimestamps(line)[0];
    const button = time
      ? `<button type="button" class="bsb-time-link" data-seconds="${time.seconds}" data-bvid="${escapeHtml(time.bvid)}" data-page="${time.page}" title="跳到视频对应时间">${escapeHtml(time.clock)}</button>`
      : "";
    return `<div class="bsb-transcript-timeline-row"><span class="bsb-transcript-timeline-time">${button}</span><div class="bsb-transcript-reading-text">${escapeHtml(clean)}</div></div>`;
  }).join("");
  return `<div class="bsb-transcript-reading${timeline ? " is-timeline" : ""}">${rows}</div>`;
}
