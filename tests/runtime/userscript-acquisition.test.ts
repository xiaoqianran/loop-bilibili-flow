import { describe, expect, it, vi } from "vitest";

import { acquisition } from "../../apps/userscript/src/app";
import type { NetworkAdapter } from "@subbatch/runtime";

function networkWith(
  handler: (url: string) => unknown | Promise<unknown>,
): NetworkAdapter {
  const json = vi.fn(async (url: string) => handler(url));
  return {
    request: vi.fn(),
    json: json as NetworkAdapter["json"],
  };
}

describe("Userscript acquisition orchestration", () => {
  it("fetches and validates video view through runtime.network", async () => {
    const network = networkWith(() => ({
      code: 0,
      data: {
        bvid: "BV1TEST",
        aid: 1,
        cid: 2,
        title: "Video",
      },
    }));

    await expect(
      acquisition.fetchVideoView(network, "BV1TEST"),
    ).resolves.toMatchObject({ bvid: "BV1TEST", cid: 2 });

    expect(network.json).toHaveBeenCalledWith(
      "https://api.bilibili.com/x/web-interface/view?bvid=BV1TEST",
      expect.objectContaining({
        credentials: "include",
        cache: "no-store",
        fallback: "network-or-http",
      }),
    );
  });

  it("falls through signed WBI to player v2 and normalizes tracks", async () => {
    const network = networkWith((url) => {
      if (url.endsWith("/x/web-interface/nav")) {
        return {
          code: 0,
          data: {
            wbi_img: {
              img_url: "https://i0.hdslb.com/bfs/wbi/abcdefghijklmnopqrstuvwxyz123456.png",
              sub_url: "https://i0.hdslb.com/bfs/wbi/654321zyxwvutsrqponmlkjihgfedcba.png",
            },
          },
        };
      }
      if (url.includes("/x/player/wbi/v2?")) {
        expect(url).toContain("w_rid=");
        return { code: -400, message: "wbi unavailable" };
      }
      if (url.includes("/x/player/v2?")) {
        return {
          code: 0,
          data: {
            subtitle: {
              subtitles: [
                { lan: "zh-CN", subtitle_url: "//sub.example/test.json" },
              ],
            },
          },
        };
      }
      throw new Error(`unexpected URL: ${url}`);
    });

    await expect(
      acquisition.fetchSubtitleTracks(network, {
        bvid: "BV1TEST",
        cid: 2,
        aid: 1,
      }),
    ).resolves.toEqual([
      {
        lan: "zh-CN",
        subtitle_url: "https://sub.example/test.json",
      },
    ]);

    expect(network.json).toHaveBeenCalledTimes(3);
  });

  it("fetches a subtitle body through runtime.network", async () => {
    const body = [{ from: 0, to: 1, content: "hello" }];
    const network = networkWith(() => ({ body }));

    await expect(
      acquisition.fetchSubtitleBody(
        network,
        "https://sub.example/test.json",
      ),
    ).resolves.toEqual(body);

    expect(network.json).toHaveBeenCalledWith(
      "https://sub.example/test.json",
      expect.objectContaining({
        credentials: "include",
        cache: "no-store",
        fallback: "network-or-http",
      }),
    );
  });

  it("uses signed WBI acquisition before the dm-view subtitle fallback", async () => {
    const network = networkWith((url) => {
      if (url.endsWith("/x/web-interface/nav")) {
        return {
          code: 0,
          data: {
            wbi_img: {
              img_url: "https://i0.hdslb.com/bfs/wbi/abcdefghijklmnopqrstuvwxyz123456.png",
              sub_url: "https://i0.hdslb.com/bfs/wbi/654321zyxwvutsrqponmlkjihgfedcba.png",
            },
          },
        };
      }
      if (url.includes("/x/player/wbi/v2?")) {
        expect(url).toContain("wts=");
        expect(url).toContain("w_rid=");
        return { code: -400, message: "player unavailable" };
      }
      if (url.includes("/x/player/v2?")) {
        return { code: -400, message: "player v2 unavailable" };
      }
      if (url.includes("/x/v2/dm/view?")) {
        return {
          code: 0,
          data: {
            subtitle: {
              subtitles: [
                { lan: "zh-CN", subtitle_url: "//sub.example/dm.json" },
              ],
            },
          },
        };
      }
      throw new Error(`unexpected URL: ${url}`);
    });

    await expect(
      acquisition.collectSubtitleTracks(network, {
        bvid: "BV1TEST",
        aid: 1,
        cid: 2,
      }),
    ).resolves.toEqual({
      subs: [
        {
          lan: "zh-CN",
          subtitle_url: "https://sub.example/dm.json",
        },
      ],
      source: "dm_view",
    });

    expect(network.json).toHaveBeenCalledTimes(4);
  });

  it("resolves missing AI subtitle URLs through the stat fallback", async () => {
    const network = networkWith((url) => {
      expect(url).toContain("/x/player/v2/ai/subtitle/search/stat?");
      return {
        code: 0,
        data: { subtitle_url: "//sub.example/ai.json" },
      };
    });

    await expect(
      acquisition.resolveSubtitleUrl(
        network,
        { lan: "ai-zh", subtitle_url: "" },
        { aid: 1, cid: 2 },
        "player_wbi",
      ),
    ).resolves.toEqual({
      url: "https://sub.example/ai.json",
      source: "ai_stat",
    });
  });

  it("treats a successful empty fallback response as empty rather than error", async () => {
    const network = networkWith((url) => {
      if (url.endsWith("/x/web-interface/nav")) {
        return { code: -400, message: "nav unavailable" };
      }
      if (url.includes("/x/player/v2?")) {
        return {
          code: 0,
          data: { subtitle: { subtitles: [] } },
        };
      }
      if (url.includes("/x/v2/dm/view?")) {
        return { code: -400, message: "dm unavailable" };
      }
      throw new Error(`unexpected URL: ${url}`);
    });

    await expect(
      acquisition.fetchSubtitleTracks(network, {
        bvid: "BV1TEST",
        cid: 2,
        aid: 1,
      }),
    ).resolves.toEqual([]);
  });

  it("preserves a real acquisition failure when every fallback fails", async () => {
    const network = networkWith((url) => {
      if (url.endsWith("/x/web-interface/nav")) {
        return { code: -400, message: "nav unavailable" };
      }
      if (url.includes("/x/player/v2?")) {
        return { code: -400, message: "player v2 unavailable" };
      }
      if (url.includes("/x/v2/dm/view?")) {
        return { code: -400, message: "dm unavailable" };
      }
      throw new Error(`unexpected URL: ${url}`);
    });

    await expect(
      acquisition.fetchSubtitleTracks(network, {
        bvid: "BV1TEST",
        cid: 2,
        aid: 1,
      }),
    ).rejects.toThrow("dm unavailable");
  });

  it("preserves abort errors instead of trying the fallback endpoint", async () => {
    const abort = new DOMException("Aborted", "AbortError");
    const network = networkWith(() => {
      throw abort;
    });

    await expect(
      acquisition.fetchSubtitleTracks(network, {
        bvid: "BV1TEST",
        cid: 2,
      }),
    ).rejects.toBe(abort);

    expect(network.json).toHaveBeenCalledTimes(1);
  });
});
