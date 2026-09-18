import { describe, expect, it } from "vitest";

import {
  isChargeBlocked,
  normalizeSubtitleUrl,
  pageMeta,
  pickTrack,
  preferredTrackIndex,
  runtimeSubtitleTracks,
  runtimeVideoView,
  trackEndpoints,
} from "@subbatch/bilibili";

import { legacyFunction } from "./legacy-harness";

type UnknownFunction = (...args: any[]) => any;

const legacyNormalizeUrl = legacyFunction<UnknownFunction>("formatSubtitleUrl");
const legacyPickTrack = legacyFunction<UnknownFunction>("pickTrack");

describe("Bilibili acquisition domain", () => {
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

  it("builds page metadata and player subtitle endpoints", () => {
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
    expect(trackEndpoints({ bvid: "BV1TEST", cid: 20, aid: 123 })).toEqual([
      "https://api.bilibili.com/x/player/wbi/v2?bvid=BV1TEST&cid=20&aid=123",
      "https://api.bilibili.com/x/player/v2?bvid=BV1TEST&cid=20&aid=123",
    ]);
    expect(
      isChargeBlocked({ is_upower_exclusive: true, is_upower_play: false }),
    ).toBe(true);
  });
});
