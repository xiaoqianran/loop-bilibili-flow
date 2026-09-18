export interface WbiKeys {
  img: string;
  sub: string;
}

export type WbiParams = Record<string, unknown>;
export type WbiHash = (input: string) => string;

const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61,
  26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36,
  20, 34, 44, 52,
] as const;

const FORBIDDEN = new Set(["!", "'", "(", ")", "*"]);

export function navUrl(): string {
  return "https://api.bilibili.com/x/web-interface/nav";
}

export function videoDetailUrl(query: string): string {
  return `https://api.bilibili.com/x/web-interface/wbi/view/detail?${query}`;
}

export function playerUrl(query: string): string {
  return `https://api.bilibili.com/x/player/wbi/v2?${query}`;
}

export function keyFromUrl(url: unknown): string {
  let name = String(url || "").split("/").pop() || "";
  if (name.includes(".")) name = name.split(".").slice(0, -1).join(".");
  return name;
}

function mixinKey(keys: WbiKeys): string {
  let raw = String(keys.img) + String(keys.sub);
  const maxIndex = Math.max(...MIXIN_KEY_ENC_TAB);
  if (maxIndex >= raw.length) raw = raw.padEnd(maxIndex + 1, "0");

  let mixed = "";
  for (const index of MIXIN_KEY_ENC_TAB) mixed += raw[index] || "";
  return mixed.slice(0, 32);
}

export function sign(
  params: WbiParams,
  keys: WbiKeys,
  hash: WbiHash,
  wts = Math.floor(Date.now() / 1000),
): string {
  const data: Record<string, unknown> = { ...params, wts: Number(wts) };
  const parts: string[] = [];

  for (const key of Object.keys(data).sort()) {
    const value = String(data[key])
      .split("")
      .filter((char) => !FORBIDDEN.has(char))
      .join("");
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  }

  const query = parts.join("&");
  return `${query}&w_rid=${hash(query + mixinKey(keys))}`;
}
