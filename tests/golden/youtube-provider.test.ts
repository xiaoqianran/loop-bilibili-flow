import { describe, expect, it } from "vitest";

import {
  captionJson3Url,
  captionTracks,
  extractVideoRef,
  parseJson3Transcript,
  pickCaptionTrack,
  playerResponseFromHtml,
  resolveCurrentVideo,
} from "@subbatch/youtube";

describe("YouTube platform core", () => {
  it("extracts stable video identity from watch, Shorts, live and short links", () => {
    expect(
      extractVideoRef("https://www.youtube.com/watch?v=abcdefghijk&t=20s"),
    ).toEqual({ videoId: "abcdefghijk", kind: "watch" });
    expect(
      extractVideoRef("https://www.youtube.com/shorts/abcdefghijk"),
    ).toEqual({ videoId: "abcdefghijk", kind: "shorts" });
    expect(
      extractVideoRef("https://www.youtube.com/live/abcdefghijk"),
    ).toEqual({ videoId: "abcdefghijk", kind: "live" });
    expect(extractVideoRef("https://youtu.be/abcdefghijk")).toEqual({
      videoId: "abcdefghijk",
      kind: "shortlink",
    });
    expect(extractVideoRef("https://www.youtube.com/")).toBeNull();
  });

  it("uses the URL identity when ytInitialPlayerResponse is stale after SPA navigation", () => {
    const resolved = resolveCurrentVideo(
      "https://www.youtube.com/watch?v=abcdefghijk",
      {
        ytInitialPlayerResponse: {
          videoDetails: {
            videoId: "ZYXWVUTSRQ",
            title: "stale title",
          },
        },
      },
    );

    expect(resolved).toEqual({
      videoId: "abcdefghijk",
      kind: "watch",
    });
  });

  it("keeps matching player metadata when it belongs to the current video", () => {
    expect(
      resolveCurrentVideo("https://www.youtube.com/watch?v=abcdefghijk", {
        ytInitialPlayerResponse: {
          videoDetails: {
            videoId: "abcdefghijk",
            title: "Current title",
            author: "Channel",
          },
        },
      }),
    ).toMatchObject({
      videoId: "abcdefghijk",
      title: "Current title",
      author: "Channel",
    });
  });

  it("parses player response, caption tracks and JSON3 transcript", () => {
    const player = {
      videoDetails: {
        videoId: "abcdefghijk",
        title: 'A title containing } braces',
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
            {
              baseUrl:
                "https://www.youtube.com/api/timedtext?v=abcdefghijk&lang=zh-CN",
              languageCode: "zh-CN",
              name: { runs: [{ text: "中文" }] },
              kind: "asr",
            },
          ],
        },
      },
    };
    const html =
      "<script>var ytInitialPlayerResponse = " +
      JSON.stringify(player) +
      ";</script>";

    const parsed = playerResponseFromHtml(html);
    expect(parsed).not.toBeNull();

    const tracks = captionTracks(parsed);
    expect(tracks).toHaveLength(2);
    expect(pickCaptionTrack(tracks)?.languageCode).toBe("en");
    expect(pickCaptionTrack(tracks, ["zh-CN"])?.languageCode).toBe("zh-CN");
    expect(captionJson3Url(tracks[0])).toContain("fmt=json3");

    expect(
      parseJson3Transcript({
        events: [
          {
            tStartMs: 1250,
            dDurationMs: 1750,
            segs: [{ utf8: "hello " }, { utf8: "world" }],
          },
          { tStartMs: 3000, dDurationMs: 1000, segs: [{ utf8: "next" }] },
          { tStartMs: 4000, dDurationMs: 1000 },
        ],
      }),
    ).toEqual([
      { id: "1", start: 1.25, end: 3, text: "hello world" },
      { id: "2", start: 3, end: 4, text: "next" },
    ]);
  });
});
