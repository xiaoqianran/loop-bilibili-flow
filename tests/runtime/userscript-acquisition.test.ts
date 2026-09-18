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

  it("falls through player endpoints and normalizes tracks", async () => {
    const network = networkWith((url) => {
      if (url.includes("/wbi/")) {
        return { code: -400, message: "wbi unavailable" };
      }
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

    expect(network.json).toHaveBeenCalledTimes(2);
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
