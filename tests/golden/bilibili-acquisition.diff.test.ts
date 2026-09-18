import { describe, expect, it } from "vitest";

import {
  isChargeBlocked,
  normalizeSubtitleUrl,
  pageMeta,
  pickTrack,
  preferredTrackIndex,
  runtimeSubtitleTracks,
  runtimeVideoView,
  subtitleAiStatUrl,
  subtitleDmUrl,
  subtitlePlayerUrl,
  videoViewUrl,
  wbi,
} from "@subbatch/bilibili";
import { md5 } from "@subbatch/core";

import { legacyFunction, legacySource } from "./legacy-harness";

type UnknownFunction = (...args: any[]) => any;

const legacyNormalizeUrl = legacyFunction<UnknownFunction>("formatSubtitleUrl");
const legacyPickTrack = legacyFunction<UnknownFunction>("pickTrack");
const legacyKeyFromUrl = legacyFunction<UnknownFunction>("keyFromUrl");
const mixinTableSource = legacySource.match(
  /const MIXIN_KEY_ENC_TAB = (\[[\s\S]*?\]);/,
)?.[1];
if (!mixinTableSource) throw new Error("legacy WBI mixin table not found");
const legacyMixinKey = legacyFunction<UnknownFunction>("mixinKey", {
  MIXIN_KEY_ENC_TAB: [...mixinTableSource.matchAll(/\d+/g)].map(([value]) => Number(value)),
});
const legacyEncWbi = legacyFunction<UnknownFunction>("encWbi", {
  md5,
  mixinKey: legacyMixinKey,
});

describe("Bilibili acquisition domain", () => {
  it("signs WBI queries exactly like the legacy product", () => {
    const keys = {
      img: legacyKeyFromUrl("https://i0.hdslb.com/bfs/wbi/abcdefghijklmnopqrstuvwxyz123456.png"),
      sub: legacyKeyFromUrl("https://i0.hdslb.com/bfs/wbi/654321zyxwvutsrqponmlkjihgfedcba.png"),
    };
    const params = {
      bvid: "BV1TEST",
      cid: 20,
      keyword: "a!b(c)*d",
    };
    const wts = 1_700_000_000;

    expect(wbi.keyFromUrl("https://example.com/path/key.png")).toBe(
      legacyKeyFromUrl("https://example.com/path/key.png"),
    );
    expect(wbi.sign(params, keys, md5, wts)).toBe(
      legacyEncWbi(params, keys.img, keys.sub, wts),
    );
  });

  it("normalizes subtitle URLs exactly like the legacy product", () => {
    for (const value of [
      "",
      "//i0.hdslb.com/subtitle.json",
      "http://i0.hdslb.com/subtitle.json",
      "https://i0.hdslb.com/subtitle.json",
      "i0.hdslb.com/subtitle.json",
    ]) {
      expect(normalizeSubtitleUrl(value)).toBe(legacyNormalizeUrl(value));
    }
  });

  it("selects preferred Chinese / AI subtitle tracks like legacy", () => {
    const tracks = [
      { lan: "en", subtitle_url: "//en" },
      { lan: "ai-zh", subtitle_url: "//ai" },
      { lan: "zh-TW", subtitle_url: "//zh" },
    ];
    expect(pickTrack(tracks)).toEqual(legacyPickTrack(tracks));
    expect(preferredTrackIndex(tracks)).toBe(1);
    expect(preferredTrackIndex([])).toBe(0);
  });

  it("extracts current page video view from Bilibili runtime state", () => {
    const runtime = {
      __INITIAL_STATE__: {
        videoData: {
          bvid: "BV1TEST",
          aid: 12,
          cid: 34,
          title: "Video",
          pages: [{ cid: 34, part: "One" }],
        },
      },
    };
    const legacy = legacyFunction<UnknownFunction>("runtimeVideoView", {
      pageWindow: runtime,
    });

    expect(runtimeVideoView(runtime, "bv1test")).toEqual(legacy("bv1test"));
    expect(runtimeVideoView(runtime, "BV-NOT-FOUND")).toBeNull();
  });

  it("extracts and normalizes runtime subtitle tracks with cid guard", () => {
    const runtime = {
      __INITIAL_STATE__: { videoData: { cid: 100 } },
      __playinfo__: {
        data: {
          cid: 100,
          subtitle: {
            subtitles: [{ lan: "zh-CN", subtitle_url: "//sub.example/a.json" }],
          },
        },
      },
    };
    const legacy = legacyFunction<UnknownFunction>("runtimeSubtitleTracks", {
      pageWindow: runtime,
      formatSubtitleUrl: legacyNormalizeUrl,
    });

    expect(runtimeSubtitleTracks(runtime, { cid: 100 })).toEqual(
      legacy({ cid: 100 }),
    );
    expect(runtimeSubtitleTracks(runtime, { cid: 200 })).toBeNull();
  });

  it("builds page metadata and Bilibili acquisition URLs", () => {
    const view = {
      bvid: "BV1TEST",
      aid: 123,
      cid: 10,
      title: "Title",
      owner: { name: "UP" },
      pages: [
        { cid: 10, part: "A" },
        { cid: 20, part: "B" },
      ],
    };

    expect(pageMeta(view, "BV1TEST", 2)).toEqual({
      bvid: "BV1TEST",
      aid: 123,
      cid: 20,
      title: "Title - P2【B】",
      author: "UP",
      pages: view.pages,
      page: 2,
    });
    expect(videoViewUrl("BV1TEST")).toBe(
      "https://api.bilibili.com/x/web-interface/view?bvid=BV1TEST",
    );
    expect(subtitlePlayerUrl({ bvid: "BV1TEST", cid: 20, aid: 123 })).toBe(
      "https://api.bilibili.com/x/player/v2?bvid=BV1TEST&cid=20&aid=123",
    );
    expect(subtitleDmUrl({ bvid: "BV1TEST", cid: 20 })).toBe(
      "https://api.bilibili.com/x/v2/dm/view?oid=20&type=1&bvid=BV1TEST",
    );
    expect(subtitleAiStatUrl({ aid: 123, cid: 20 })).toBe(
      "https://api.bilibili.com/x/player/v2/ai/subtitle/search/stat?aid=123&cid=20",
    );
    expect(wbi.navUrl()).toBe(
      "https://api.bilibili.com/x/web-interface/nav",
    );
    expect(wbi.videoDetailUrl("signed=1")).toBe(
      "https://api.bilibili.com/x/web-interface/wbi/view/detail?signed=1",
    );
    expect(wbi.playerUrl("signed=1")).toBe(
      "https://api.bilibili.com/x/player/wbi/v2?signed=1",
    );
    expect(
      isChargeBlocked({ is_upower_exclusive: true, is_upower_play: false }),
    ).toBe(true);
  });
});
