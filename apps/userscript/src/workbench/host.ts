/** Domain boundary for the Bilibili and YouTube full workbench. */
export function isWorkbenchHost(hostname: string): boolean {
  return /(^|\.)(?:bilibili|youtube)\.com$/i.test(hostname) || /(^|\.)youtu\.be$/i.test(hostname);
}
