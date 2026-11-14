/** Domain boundary for the Bilibili-only full workbench. */
export function isWorkbenchHost(hostname: string): boolean {
  return /(^|\.)bilibili\.com$/i.test(hostname);
}
