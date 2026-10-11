import { describe, expect, it, vi } from "vitest";

import { acquisition, transcript } from "../../apps/userscript/src/app";
import type { NetworkAdapter } from "@subbatch/runtime";

function networkWith(
  handler: (url: string) => unknown | Promise<unknown>,
): NetworkAdapter {
  const json = vi.fn(async (url: string) => handler(url));
  const request = vi.fn(async (url: string) => {
    const value = await handler(url);
    return {
      status: 200,
      ok: true,
      text: typeof value === "string" ? value : JSON.stringify(value),
      headers: {},
    };
  });
  return {
    request: request as NetworkAdapter["request"],
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

  it("acquires a provider-neutral transcript through the Bilibili transcript source", async () => {
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
        return {
          code: 0,
          data: {
            subtitle: {
              subtitles: [
                { lan: "zh-CN", subtitle_url: "//sub.example/current.json" },
              ],
            },
          },
        };
      }
      if (url === "https://sub.example/current.json") {
        return {
          body: [
            { sid: 7, from: 1.25, to: 2.5, content: "hello" },
            { sid: 8, from: 2.5, to: 4, content: "world" },
          ],
        };
      }
      throw new Error(`unexpected URL: ${url}`);
    });
    const pageRuntime = {
      player: {
        getManifest: () => ({ bvid: "BV1TEST", cid: 2, aid: 1 }),
      },
    };

    await expect(
      transcript.acquire(
        "https://www.bilibili.com/video/BV1TEST",
        pageRuntime,
        network,
      ),
    ).resolves.toMatchObject({
      ref: {
        source: "bilibili",
        sourceId: "BV1TEST",
        segmentId: "P1",
      },
      language: "zh-CN",
      origin: "player_wbi",
      segments: [
        { id: "7", start: 1.25, end: 2.5, text: "hello" },
        { id: "8", start: 2.5, end: 4, text: "world" },
      ],
    });
  });

  it("acquires a provider-neutral YouTube transcript from caption tracks", async () => {
    const playerResponse = {
      videoDetails: {
        videoId: "abcdefghijk",
        title: "Video",
        author: "Channel",
      },
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            {
              baseUrl:
                "https://www.youtube.com/api/timedtext?v=abcdefghijk&lang=en",
              languageCode: "en",
              name: { simpleText: "English" },
            },
          ],
        },
      },
    };
    const network = networkWith((url) => {
      if (url === "https://www.youtube.com/watch?v=abcdefghijk") {
        return (
          "<script>var ytInitialPlayerResponse = " +
          JSON.stringify(playerResponse) +
          ";</script>"
        );
      }
      if (url.includes("/api/timedtext")) {
        return JSON.stringify({
          events: [
            {
              tStartMs: 1000,
              dDurationMs: 1500,
              segs: [{ utf8: "hello" }],
            },
            {
              tStartMs: 2500,
              dDurationMs: 1500,
              segs: [{ utf8: "world" }],
            },
          ],
        });
      }
      throw new Error(`unexpected URL: ${url}`);
    });
    const pageRuntime = {
      ytInitialPlayerResponse: {
        videoDetails: { videoId: "ZYXWVUTSRQ", title: "stale" },
      },
      navigator: { languages: ["en-US"] },
    };

    await expect(
      transcript.acquire(
        "https://www.youtube.com/watch?v=abcdefghijk",
        pageRuntime,
        network,
      ),
    ).resolves.toMatchObject({
      ref: {
        source: "youtube",
        sourceId: "abcdefghijk",
        segmentId: "main",
      },
      language: "en",
      origin: "caption_track",
      segments: [
        { id: "1", start: 1, end: 2.5, text: "hello" },
        { id: "2", start: 2.5, end: 4, text: "world" },
      ],
    });

    expect(network.request).toHaveBeenCalledTimes(2);
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
