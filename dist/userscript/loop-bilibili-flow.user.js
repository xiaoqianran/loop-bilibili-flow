// ==UserScript==
// @name         Bili SubBatch (loop-bilibili)
// @namespace    https://github.com/loop-bilibili/bili-subbatch
// @version      6.10.4
// @updateURL    https://raw.githubusercontent.com/xiaoqianran/loop-bilibili-flow/main/dist/userscript/loop-bilibili-flow.user.js
// @downloadURL  https://raw.githubusercontent.com/xiaoqianran/loop-bilibili-flow/main/dist/userscript/loop-bilibili-flow.user.js
// @description  B站 / YouTube 知识阅读工作台：字幕预处理、多产物后处理、Anchor 局部追问树与持久 Knowledge Workspace
// @author       loop-bilibili
// @match        *://www.bilibili.com/video/*
// @match        *://www.bilibili.com/festival/*
// @match        *://www.bilibili.com/blackboard/*
// @match        *://www.bilibili.com/list/*
// @match        *://www.bilibili.com/bangumi/play/*
// @match        *://www.bilibili.com/medialist/*
// @match        *://www.bilibili.com/favlist*
// @match        *://space.bilibili.com/*
// @match        *://search.bilibili.com/*
// @match        *://www.youtube.com/*
// @match        *://m.youtube.com/*
// @match        *://youtube.com/*
// @match        *://youtu.be/*
// @connect      api.bilibili.com
// @connect      aisubtitle.hdslb.com
// @connect      *.hdslb.com
// @connect      bilibili.com
// @connect      youtube.com
// @connect      *.youtube.com
// @connect      youtu.be
// @connect      *
// @connect      cdn.jsdelivr.net
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @grant        GM_info
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_download
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

// SubBatch bundled application (6.10.4)
var SubBatch = (function(exports) {
  "use strict";
  function videoViewUrl(bvid) {
    return `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`;
  }
  function record$4(value) {
    return value && typeof value === "object" ? value : null;
  }
  function parseRecord(value) {
    if (typeof value === "string") {
      try {
        return record$4(JSON.parse(value));
      } catch {
        return null;
      }
    }
    return record$4(value);
  }
  function nested(root, ...keys) {
    let current = root;
    for (const key of keys) {
      const item = record$4(current);
      if (!item) return void 0;
      current = item[key];
    }
    return current;
  }
  function runtimeVideoView(runtime2, bvid) {
    const root = record$4(runtime2);
    const initial = record$4(root?.__INITIAL_STATE__);
    const key = String(bvid || "").toUpperCase();
    const candidates = [
      record$4(initial?.videoData),
      record$4(initial?.videoInfo),
      record$4(initial?.epInfo)
    ];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const candidateBvid = String(candidate.bvid || "").toUpperCase();
      const pages = candidate.pages;
      if (candidateBvid === key && (candidate.cid || Array.isArray(pages) && pages.length)) {
        return candidate;
      }
    }
    return null;
  }
  function isChargeBlocked(view2) {
    return Boolean(view2?.is_upower_exclusive && !view2?.is_upower_play);
  }
  function pageMeta(view2, requestedBvid, requestedPage = 1) {
    const pages = Array.isArray(view2.pages) ? view2.pages : [];
    const page = Math.max(
      1,
      Math.min(Number(requestedPage) || 1, Math.max(1, pages.length))
    );
    const part = pages[page - 1] ?? null;
    const cid = Number(part?.cid || view2.cid) || null;
    const aid = Number(view2.aid) || null;
    const title = part?.part && pages.length > 1 ? `${view2.title || requestedBvid} - P${page}【${part.part}】` : String(view2.title || requestedBvid);
    return {
      bvid: String(view2.bvid || requestedBvid),
      aid,
      cid,
      title,
      author: String(view2.owner?.name || ""),
      pages,
      page
    };
  }
  function normalizeSubtitleUrl(value) {
    let url = String(value || "").trim();
    if (!url) return "";
    if (url.startsWith("//")) return `https:${url}`;
    if (url.startsWith("http://")) return `https://${url.slice(7)}`;
    if (!url.startsWith("http")) {
      url = `https://${url.replace(/^\/+/, "")}`;
    }
    return url;
  }
  function normalizeTracks(value) {
    if (!Array.isArray(value)) return [];
    return value.map((track) => {
      const item = record$4(track) ?? {};
      return {
        ...item,
        subtitle_url: normalizeSubtitleUrl(item.subtitle_url)
      };
    });
  }
  function runtimeSubtitleTracks(runtime2, meta) {
    const root = record$4(runtime2);
    const initial = record$4(root?.__INITIAL_STATE__);
    const initialVideo = record$4(initial?.videoData);
    const roots = [
      root?.__playinfo__,
      root?.__PLAYINFO__,
      root?.__PLAYER_CONFIG__
    ];
    for (const candidate of roots) {
      const parsed = parseRecord(candidate);
      if (!parsed) continue;
      const runtimeCid = Number(
        nested(parsed, "data", "cid") || parsed.cid || initialVideo?.cid || 0
      );
      if (runtimeCid && meta.cid && runtimeCid !== Number(meta.cid)) continue;
      const tracks = [
        nested(parsed, "data", "subtitle", "subtitles"),
        nested(parsed, "subtitle", "subtitles"),
        nested(parsed, "data", "data", "subtitle", "subtitles")
      ];
      for (const value of tracks) {
        if (Array.isArray(value) && value.length) return normalizeTracks(value);
      }
    }
    return null;
  }
  function subtitlePlayerUrl(meta) {
    const params = new URLSearchParams({
      bvid: meta.bvid,
      cid: String(meta.cid)
    });
    if (meta.aid) params.set("aid", String(meta.aid));
    return `https://api.bilibili.com/x/player/v2?${params}`;
  }
  function subtitleDmUrl(meta) {
    const params = new URLSearchParams({
      oid: String(meta.cid),
      type: "1",
      bvid: meta.bvid
    });
    return `https://api.bilibili.com/x/v2/dm/view?${params}`;
  }
  function subtitleAiStatUrl(meta) {
    const params = new URLSearchParams({
      aid: String(meta.aid || ""),
      cid: String(meta.cid)
    });
    return `https://api.bilibili.com/x/player/v2/ai/subtitle/search/stat?${params}`;
  }
  function pickTrack(tracks) {
    if (!tracks?.length) return null;
    for (const track of tracks) {
      const lan = String(track.lan || "");
      if (lan === "zh-CN" || lan === "ai-zh" || lan.startsWith("zh") || lan.startsWith("ai")) {
        return track;
      }
    }
    return tracks[0] ?? null;
  }
  function preferredTrackIndex(tracks) {
    if (!tracks?.length) return 0;
    const chosen = pickTrack(tracks);
    const index = chosen ? tracks.indexOf(chosen) : -1;
    return index >= 0 ? index : 0;
  }
  function extractBvid$1(text) {
    if (!text) return "";
    const value = String(text).trim();
    if (!value) return "";
    if (/^BV(?!id$)[A-Za-z0-9]+$/i.test(value)) return `BV${value.slice(2)}`;
    const match = value.match(/BV(?!id\b)[A-Za-z0-9]+/i);
    return match ? `BV${match[0].slice(2)}` : "";
  }
  function routeVideoKey$1(bvid, page) {
    return `${String(bvid || "").toUpperCase()}:P${Math.max(1, Number(page) || 1)}`;
  }
  function asRecord$1(value) {
    return value && typeof value === "object" ? value : null;
  }
  function readPositiveNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : void 0;
  }
  function callMethod(target, name) {
    if (!target) return null;
    const fn = target[name];
    if (typeof fn !== "function") return null;
    try {
      return fn.call(target);
    } catch {
      return null;
    }
  }
  function pageFromCid(pages, cid) {
    const target = readPositiveNumber(cid);
    if (!target || !Array.isArray(pages) || !pages.length) return void 0;
    const index = pages.findIndex((part) => readPositiveNumber(part?.cid) === target);
    return index >= 0 ? index + 1 : void 0;
  }
  function firstBvid(...values) {
    for (const value of values) {
      const id = extractBvid$1(value == null ? "" : String(value));
      if (id) return id;
    }
    return "";
  }
  function extractPlayingVideoHint(runtime2) {
    const root = asRecord$1(runtime2);
    if (!root) return {};
    const player = asRecord$1(root.player);
    const manifest = asRecord$1(callMethod(player, "getManifest")) || asRecord$1(callMethod(player, "getPlayerInfo")) || asRecord$1(callMethod(player, "getVideoMessage"));
    const state2 = asRecord$1(root.__INITIAL_STATE__);
    const playinfo = asRecord$1(root.__playinfo__) || asRecord$1(root.__PLAYINFO__);
    const playData = asRecord$1(playinfo?.data) || playinfo;
    const videoData = asRecord$1(state2?.videoData) || asRecord$1(state2?.videoInfo);
    const epInfo = asRecord$1(state2?.epInfo);
    const pages = Array.isArray(manifest?.pages) ? manifest.pages : Array.isArray(videoData?.pages) ? videoData.pages : Array.isArray(epInfo?.pages) ? epInfo.pages : null;
    const hint = {};
    const playerCid = readPositiveNumber(manifest?.cid) || readPositiveNumber(callMethod(player, "getCid")) || readPositiveNumber(player?.cid);
    const playerBvid = firstBvid(manifest?.bvid, player?.bvid);
    const playerAid = readPositiveNumber(manifest?.aid) || readPositiveNumber(player?.aid);
    const playerPage = pageFromCid(pages, playerCid) || readPositiveNumber(manifest?.p) || readPositiveNumber(player?.p);
    if (playerBvid) hint.bvid = playerBvid;
    if (playerCid) hint.cid = playerCid;
    if (playerAid) hint.aid = playerAid;
    if (playerPage) hint.page = playerPage;
    if (playerBvid || playerCid) hint.source = "player";
    if (!hint.bvid) {
      const bvid = firstBvid(playData?.bvid);
      if (bvid) {
        hint.bvid = bvid;
        hint.source = hint.source || "playinfo";
      }
    }
    if (!hint.cid) {
      const cid = readPositiveNumber(playData?.cid);
      if (cid) hint.cid = cid;
    }
    if (!hint.bvid) {
      const bvid = firstBvid(videoData?.bvid, epInfo?.bvid, state2?.bvid);
      if (bvid) {
        hint.bvid = bvid;
        hint.source = hint.source || "initial-state";
      }
    }
    if (!hint.cid) {
      const cid = readPositiveNumber(videoData?.cid) || readPositiveNumber(epInfo?.cid) || readPositiveNumber(state2?.cid);
      if (cid) hint.cid = cid;
    }
    if (!hint.page) {
      const page = pageFromCid(pages, hint.cid) || readPositiveNumber(state2?.p) || readPositiveNumber(videoData?.p);
      if (page) hint.page = page;
    }
    if (!hint.aid) {
      const aid = readPositiveNumber(videoData?.aid) || readPositiveNumber(epInfo?.aid) || readPositiveNumber(playData?.aid);
      if (aid) hint.aid = aid;
    }
    return hint;
  }
  function resolvePlayingVideoRef(input) {
    const urlBvid = firstBvid(input.urlBvid, input.href);
    const playingBvid = firstBvid(input.playing?.bvid);
    const bvid = playingBvid || urlBvid;
    if (!bvid) return null;
    const urlPage = Math.max(1, Number(input.urlPage) || 1);
    const playingPage = Math.max(0, Number(input.playing?.page) || 0);
    const page = playingPage || urlPage;
    const source = playingBvid && playingBvid.toUpperCase() !== urlBvid.toUpperCase() ? input.playing?.source || "player" : playingBvid ? input.playing?.source || "player" : "url";
    const snapshot = {
      bvid,
      page,
      key: routeVideoKey$1(bvid, page),
      source
    };
    const cid = readPositiveNumber(input.playing?.cid);
    if (cid) snapshot.cid = cid;
    const aid = readPositiveNumber(input.playing?.aid);
    if (aid) snapshot.aid = aid;
    return snapshot;
  }
  function playingVideoChanged(prev, next) {
    const prevKey = prev?.key || (prev?.bvid ? routeVideoKey$1(prev.bvid, prev.page) : "");
    const nextKey = next?.key || (next?.bvid ? routeVideoKey$1(next.bvid, next.page) : "");
    if (prevKey !== nextKey) return true;
    const prevCid = readPositiveNumber(prev?.cid);
    const nextCid = readPositiveNumber(next?.cid);
    return !!(prevCid && nextCid && prevCid !== nextCid);
  }
  function isVideoCarrierShell(href) {
    try {
      const url = new URL(href);
      if (!/^(www\.)?bilibili\.com$/i.test(url.hostname)) return false;
      return /^\/(?:festival|blackboard)(?:\/|$)/i.test(url.pathname);
    } catch {
      return false;
    }
  }
  function extractBvid(text) {
    if (!text) return "";
    const value = String(text).trim();
    if (!value) return "";
    if (/^BV(?!id$)[A-Za-z0-9]+$/i.test(value)) return `BV${value.slice(2)}`;
    const match = value.match(/BV(?!id\b)[A-Za-z0-9]+/i);
    return match ? `BV${match[0].slice(2)}` : "";
  }
  function hasVideoCarrierIdentity(href, observedBvid) {
    return !!(extractBvid(href) || extractBvid(observedBvid));
  }
  function routeVideoKey(bvid, page) {
    return `${String(bvid || "").toUpperCase()}:P${Math.max(1, Number(page) || 1)}`;
  }
  function pickHintIds(hints = {}) {
    const out = {};
    if (hints.mid) out.mid = hints.mid;
    if (hints.season_id) out.season_id = hints.season_id;
    if (hints.media_id) out.media_id = hints.media_id;
    if (hints.bvid) out.bvid = hints.bvid;
    if (hints.keyword) out.keyword = hints.keyword;
    return out;
  }
  function extractUrlHints(href) {
    const hints = {
      bvid: "",
      mid: "",
      season_id: "",
      media_id: "",
      keyword: "",
      fromVideoPath: false
    };
    let url;
    try {
      url = new URL(href);
    } catch {
      return hints;
    }
    hints.bvid = extractBvid(url.searchParams.get("bvid") || "") || extractBvid(url.pathname) || "";
    hints.keyword = (url.searchParams.get("keyword") || "").trim();
    const sid = url.searchParams.get("sid") || url.searchParams.get("season_id") || url.searchParams.get("business_id") || "";
    if (sid && /^\d+$/.test(String(sid))) hints.season_id = String(sid);
    const fid = url.searchParams.get("fid") || "";
    if (fid && /^\d+$/.test(fid)) hints.media_id = fid;
    if (/\/video\//i.test(url.pathname)) hints.fromVideoPath = true;
    let match = url.href.match(/space\.bilibili\.com\/(\d+)/i);
    if (match?.[1]) hints.mid = match[1];
    match = url.pathname.match(/^\/list\/(\d+)/i);
    if (match?.[1]) hints.mid = match[1];
    match = url.pathname.match(/^\/(\d+)(?:\/|$)/);
    if (match?.[1] && /space\.bilibili\.com/i.test(url.hostname)) {
      hints.mid = match[1];
    }
    return hints;
  }
  function detectContext(href, hints = {}) {
    let url;
    try {
      url = new URL(href);
    } catch {
      return { type: "unknown", source: "auto" };
    }
    const host2 = url.hostname.toLowerCase();
    const path = url.pathname;
    const merged = {
      ...extractUrlHints(href),
      ...Object.fromEntries(
        Object.entries(hints).filter(([, value]) => value != null && value !== "")
      )
    };
    if (host2 === "search.bilibili.com") {
      if (/^\/(all|video)\/?$/i.test(path)) {
        const keyword = (url.searchParams.get("keyword") || "").trim() || merged.keyword;
        if (keyword) {
          const allowed2 = /* @__PURE__ */ new Set([
            "totalrank",
            "click",
            "pubdate",
            "dm",
            "stow",
            "scores"
          ]);
          const order = (url.searchParams.get("order") || "totalrank").trim().toLowerCase();
          return {
            type: "search",
            source: "auto",
            keyword,
            order: allowed2.has(order) ? order : "totalrank",
            page: Math.max(
              1,
              Number.parseInt(url.searchParams.get("page") || "1", 10) || 1
            )
          };
        }
      }
      return { type: "unknown", source: "auto" };
    }
    if (host2 === "space.bilibili.com") {
      let match = path.match(/^\/(\d+)\/lists\/(\d+)\/?$/i);
      if (match?.[1] && match[2]) {
        return {
          type: "collection",
          source: "auto",
          mid: match[1],
          season_id: match[2]
        };
      }
      match = path.match(/^\/(\d+)\/channel\/collectiondetail\/?$/i);
      if (match?.[1]) {
        const seasonId = url.searchParams.get("sid") || url.searchParams.get("season_id") || merged.season_id;
        if (seasonId && /^\d+$/.test(String(seasonId))) {
          return {
            type: "collection",
            source: "auto",
            mid: match[1],
            season_id: String(seasonId)
          };
        }
      }
      match = path.match(/^\/(\d+)\/channel\/seriesdetail\/?$/i);
      if (match?.[1]) {
        const seasonId = url.searchParams.get("sid") || url.searchParams.get("season_id") || merged.season_id;
        if (seasonId && /^\d+$/.test(String(seasonId))) {
          return {
            type: "collection",
            source: "auto",
            mid: match[1],
            season_id: String(seasonId)
          };
        }
      }
      const mediaId = (url.searchParams.get("fid") || merged.media_id || "").trim();
      if (mediaId && /^\d+$/.test(mediaId) && /\/favlist\/?$/i.test(path)) {
        return { type: "favorite", source: "auto", media_id: mediaId };
      }
      match = path.match(/^\/(\d+)/);
      if (match?.[1]) {
        const segments = path.split("/").filter(Boolean);
        const mid = match[1];
        if (segments.length === 1 || segments.length === 2 && /^(video|upload|dynamic|favlist)?$/i.test(segments[1] || "") || segments.length === 3 && segments[1] === "upload" && segments[2] === "video") {
          if (segments[1] && /^favlist$/i.test(segments[1]) && !mediaId) {
            return { type: "user", source: "auto", mid, note: "favlist_no_fid" };
          }
          return { type: "user", source: "auto", mid };
        }
        return {
          type: "user",
          source: "auto",
          mid,
          note: "space_tab",
          ...merged.bvid ? { bvid: merged.bvid } : {}
        };
      }
      return { type: "unknown", source: "auto", ...pickHintIds(merged) };
    }
    if (/^(www\.)?bilibili\.com$/i.test(host2)) {
      let match = path.match(/^\/medialist\/(?:detail|play)\/ml(\d+)\/?$/i);
      if (match?.[1]) {
        return { type: "favorite", source: "auto", media_id: match[1] };
      }
      match = path.match(/^\/list\/ml(\d+)\/?/i);
      if (match?.[1]) {
        return { type: "favorite", source: "auto", media_id: match[1] };
      }
      match = path.match(/^\/list\/(\d+)\/?/i);
      if (match?.[1]) {
        const mid = match[1];
        const seasonId = url.searchParams.get("sid") || url.searchParams.get("season_id") || merged.season_id;
        const bvid2 = extractBvid(url.searchParams.get("bvid") || "") || extractBvid(url.pathname) || merged.bvid || "";
        const page = Math.max(
          1,
          Number.parseInt(url.searchParams.get("p") || "1", 10) || 1
        );
        if (seasonId && /^\d+$/.test(String(seasonId))) {
          return {
            type: "collection",
            source: "auto",
            mid,
            season_id: String(seasonId),
            ...bvid2 ? { bvid: bvid2 } : {},
            page
          };
        }
        if (bvid2) {
          return {
            type: "video",
            source: "auto",
            bvid: bvid2,
            mid,
            page,
            note: "list_without_sid"
          };
        }
        return { type: "user", source: "auto", mid, note: "list_mid_only" };
      }
      match = path.match(/^\/(?:fav|list)\/(?:ml)?(\d+)\/?$/i);
      if (match?.[1] && !path.startsWith("/list/")) {
        return { type: "favorite", source: "auto", media_id: match[1] };
      }
      if (/^\/favlist\/?$/i.test(path)) {
        const fid = (url.searchParams.get("fid") || merged.media_id || "").trim();
        if (fid && /^\d+$/.test(fid)) {
          return { type: "favorite", source: "auto", media_id: fid };
        }
      }
      const bvid = extractBvid(path) || extractBvid(href) || merged.bvid || "";
      if (bvid && (/\/video\//i.test(path) || merged.fromVideoPath)) {
        const page = Math.max(
          1,
          Number.parseInt(url.searchParams.get("p") || "1", 10) || 1
        );
        const ctx = {
          type: "video",
          source: "auto",
          bvid,
          page
        };
        if (merged.mid && merged.season_id) {
          ctx.mid = merged.mid;
          ctx.season_id = merged.season_id;
          ctx.note = "video_has_ugc_season";
        }
        return ctx;
      }
      if (/\/list\//i.test(path)) {
        const bvid2 = extractBvid(url.searchParams.get("bvid") || "") || extractBvid(url.pathname) || merged.bvid || "";
        if (bvid2) {
          return {
            type: "video",
            source: "auto",
            bvid: bvid2,
            page: Math.max(
              1,
              Number.parseInt(url.searchParams.get("p") || "1", 10) || 1
            ),
            ...merged.mid ? { mid: merged.mid } : {},
            ...merged.season_id ? { season_id: merged.season_id } : {},
            note: "list_fallback_video"
          };
        }
      }
    }
    if (merged.bvid) {
      return {
        type: "video",
        source: "auto",
        bvid: merged.bvid,
        page: 1,
        ...merged.mid ? { mid: merged.mid } : {},
        ...merged.season_id ? { season_id: merged.season_id } : {},
        note: "dom_bvid"
      };
    }
    return { type: "unknown", source: "auto", ...pickHintIds(merged) };
  }
  const MIXIN_KEY_ENC_TAB = [
    46,
    47,
    18,
    2,
    53,
    8,
    23,
    32,
    15,
    50,
    10,
    31,
    58,
    3,
    45,
    35,
    27,
    43,
    5,
    49,
    33,
    9,
    42,
    19,
    29,
    28,
    14,
    39,
    12,
    38,
    41,
    13,
    37,
    48,
    7,
    16,
    24,
    55,
    40,
    61,
    26,
    17,
    0,
    1,
    60,
    51,
    30,
    4,
    22,
    25,
    54,
    21,
    56,
    59,
    6,
    63,
    57,
    62,
    11,
    36,
    20,
    34,
    44,
    52
  ];
  const FORBIDDEN = /* @__PURE__ */ new Set(["!", "'", "(", ")", "*"]);
  function navUrl() {
    return "https://api.bilibili.com/x/web-interface/nav";
  }
  function videoDetailUrl(query) {
    return `https://api.bilibili.com/x/web-interface/wbi/view/detail?${query}`;
  }
  function playerUrl(query) {
    return `https://api.bilibili.com/x/player/wbi/v2?${query}`;
  }
  function keyFromUrl(url) {
    let name = String(url || "").split("/").pop() || "";
    if (name.includes(".")) name = name.split(".").slice(0, -1).join(".");
    return name;
  }
  function mixinKey(keys) {
    let raw = String(keys.img) + String(keys.sub);
    const maxIndex = Math.max(...MIXIN_KEY_ENC_TAB);
    if (maxIndex >= raw.length) raw = raw.padEnd(maxIndex + 1, "0");
    let mixed = "";
    for (const index of MIXIN_KEY_ENC_TAB) mixed += raw[index] || "";
    return mixed.slice(0, 32);
  }
  function sign(params, keys, hash, wts = Math.floor(Date.now() / 1e3)) {
    const data = { ...params, wts: Number(wts) };
    const parts = [];
    for (const key of Object.keys(data).sort()) {
      const value = String(data[key]).split("").filter((char) => !FORBIDDEN.has(char)).join("");
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
    const query = parts.join("&");
    return `${query}&w_rid=${hash(query + mixinKey(keys))}`;
  }
  const BILIBILI_SOURCE = "bilibili";
  const route = {
    isCarrierShell: isVideoCarrierShell,
    bvidFrom: extractBvid,
    hasCarrierIdentity: hasVideoCarrierIdentity,
    videoKey: routeVideoKey,
    pickIds: pickHintIds,
    urlHints: extractUrlHints,
    detect: detectContext,
    pageFromCid,
    playingHint: extractPlayingVideoHint,
    resolveVideo: resolvePlayingVideoRef,
    videoChanged: playingVideoChanged
  };
  const video$1 = {
    url: videoViewUrl,
    runtimeView: runtimeVideoView,
    isChargeBlocked,
    pageMeta
  };
  const subtitle = {
    normalizeUrl: normalizeSubtitleUrl,
    normalizeTracks,
    runtimeTracks: runtimeSubtitleTracks,
    playerUrl: subtitlePlayerUrl,
    dmUrl: subtitleDmUrl,
    aiStatUrl: subtitleAiStatUrl,
    pickTrack,
    preferredIndex: preferredTrackIndex
  };
  const wbi = {
    navUrl,
    videoDetailUrl,
    playerUrl,
    keyFromUrl,
    sign
  };
  const bilibili = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    BILIBILI_SOURCE,
    detectContext,
    extractBvid,
    extractPlayingVideoHint,
    extractUrlHints,
    hasVideoCarrierIdentity,
    isChargeBlocked,
    isVideoCarrierShell,
    keyFromUrl,
    navUrl,
    normalizeSubtitleUrl,
    normalizeTracks,
    pageFromCid,
    pageMeta,
    pickHintIds,
    pickTrack,
    playerUrl,
    playingVideoChanged,
    preferredTrackIndex,
    resolvePlayingVideoRef,
    route,
    routeVideoKey,
    runtimeSubtitleTracks,
    runtimeVideoView,
    sign,
    subtitle,
    subtitleAiStatUrl,
    subtitleDmUrl,
    subtitlePlayerUrl,
    video: video$1,
    videoDetailUrl,
    videoViewUrl,
    wbi
  }, Symbol.toStringTag, { value: "Module" }));
  const DEFAULT_AI_INPUT_MAX_CHARS = 16e4;
  function extractAssistantText(piece) {
    if (!piece || typeof piece !== "object") {
      return { content: "", reasoning: "" };
    }
    const value = piece;
    const content2 = typeof value.content === "string" && value.content || typeof value.text === "string" && value.text || "";
    const reasoning = typeof value.reasoning_content === "string" && value.reasoning_content || typeof value.reasoning === "string" && value.reasoning || "";
    return { content: content2, reasoning };
  }
  function extractFromChoice(choice) {
    if (!choice || typeof choice !== "object") {
      return { content: "", reasoning: "" };
    }
    const value = choice;
    const fromDelta = extractAssistantText(value.delta);
    const fromMessage = extractAssistantText(value.message);
    return {
      content: fromDelta.content || fromMessage.content || "",
      reasoning: fromDelta.reasoning || fromMessage.reasoning || ""
    };
  }
  function formatAiDisplay(content2, reasoning) {
    const body = String(content2 || "");
    if (body.trim()) return body;
    return reasoning && String(reasoning).trim() ? "正在分析字幕并组织笔记…" : "";
  }
  function truncateForAi(text, maxChars = DEFAULT_AI_INPUT_MAX_CHARS) {
    const source = String(text || "");
    const limit = maxChars == null ? DEFAULT_AI_INPUT_MAX_CHARS : Math.max(4e3, Number(maxChars));
    if (source.length <= limit) {
      return { text: source, truncated: false, originalLen: source.length };
    }
    const markerBudget = 420;
    const usable = Math.max(3e3, limit - markerBudget);
    const headLen = Math.floor(usable * 0.44);
    const tailLen = Math.floor(usable * 0.24);
    const middleBudget = usable - headLen - tailLen;
    const windows = 3;
    const windowLen = Math.floor(middleBudget / windows);
    const middleStart = headLen;
    const middleEnd = source.length - tailLen;
    const span = Math.max(1, middleEnd - middleStart - windowLen);
    const parts = [source.slice(0, headLen).replace(/[^\n]*$/, "")];
    for (let index = 0; index < windows; index += 1) {
      const at = middleStart + Math.floor(span * (index + 1) / (windows + 1));
      let piece = source.slice(at, at + windowLen);
      piece = piece.replace(/^[^\n]*\n?/, "").replace(/[^\n]*$/, "");
      parts.push(`
…[中段采样 ${index + 1}/${windows}]…
${piece}`);
    }
    parts.push(
      `
…[省略 ${source.length - usable} 字；保留结尾]…
${source.slice(-tailLen).replace(/^[^\n]*\n?/, "")}`
    );
    return {
      text: parts.join(""),
      truncated: true,
      originalLen: source.length
    };
  }
  function parseSseDataLine(line) {
    const text = String(line || "").trim();
    if (!text || text.startsWith(":") || !text.startsWith("data:")) {
      return { kind: "skip" };
    }
    const data = text.slice(5).trim();
    if (!data) return { kind: "skip" };
    if (data === "[DONE]") return { kind: "done" };
    try {
      const payload = JSON.parse(data);
      if (payload.error) {
        const error = payload.error && typeof payload.error === "object" ? payload.error : null;
        return {
          kind: "error",
          message: typeof error?.message === "string" && error.message || JSON.stringify(payload.error)
        };
      }
      const choices = Array.isArray(payload.choices) ? payload.choices : [];
      const choice = choices[0];
      const piece = extractFromChoice(choice);
      const finishReason = choice && typeof choice === "object" ? String(choice.finish_reason || "") : "";
      return {
        kind: "delta",
        ...piece,
        finishReason,
        usage: payload.usage || null
      };
    } catch {
      return { kind: "skip" };
    }
  }
  const SHIFT = [
    7,
    12,
    17,
    22,
    7,
    12,
    17,
    22,
    7,
    12,
    17,
    22,
    7,
    12,
    17,
    22,
    5,
    9,
    14,
    20,
    5,
    9,
    14,
    20,
    5,
    9,
    14,
    20,
    5,
    9,
    14,
    20,
    4,
    11,
    16,
    23,
    4,
    11,
    16,
    23,
    4,
    11,
    16,
    23,
    4,
    11,
    16,
    23,
    6,
    10,
    15,
    21,
    6,
    10,
    15,
    21,
    6,
    10,
    15,
    21,
    6,
    10,
    15,
    21
  ];
  const TABLE = Array.from(
    { length: 64 },
    (_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 4294967296) >>> 0
  );
  function rotateLeft(value, count) {
    return (value << count | value >>> 32 - count) >>> 0;
  }
  function hex32(value) {
    return [0, 8, 16, 24].map((shift) => (value >>> shift & 255).toString(16).padStart(2, "0")).join("");
  }
  function md5(input) {
    const bytes = new TextEncoder().encode(input);
    const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
    const padded = new Uint8Array(paddedLength);
    padded.set(bytes);
    padded[bytes.length] = 128;
    const view2 = new DataView(padded.buffer);
    const bitLength = BigInt(bytes.length) * 8n;
    view2.setUint32(paddedLength - 8, Number(bitLength & 0xffffffffn), true);
    view2.setUint32(paddedLength - 4, Number(bitLength >> 32n), true);
    let a0 = 1732584193;
    let b0 = 4023233417;
    let c0 = 2562383102;
    let d0 = 271733878;
    for (let offset = 0; offset < paddedLength; offset += 64) {
      const words = Array.from(
        { length: 16 },
        (_, index) => view2.getUint32(offset + index * 4, true)
      );
      let a = a0;
      let b = b0;
      let c = c0;
      let d = d0;
      for (let index = 0; index < 64; index += 1) {
        let f;
        let wordIndex;
        if (index < 16) {
          f = b & c | ~b & d;
          wordIndex = index;
        } else if (index < 32) {
          f = d & b | ~d & c;
          wordIndex = (5 * index + 1) % 16;
        } else if (index < 48) {
          f = b ^ c ^ d;
          wordIndex = (3 * index + 5) % 16;
        } else {
          f = c ^ (b | ~d);
          wordIndex = 7 * index % 16;
        }
        const sum = a + f + (TABLE[index] ?? 0) + (words[wordIndex] ?? 0) >>> 0;
        const nextB = b + rotateLeft(sum, SHIFT[index] ?? 0) >>> 0;
        a = d;
        d = c;
        c = b;
        b = nextB;
      }
      a0 = a0 + a >>> 0;
      b0 = b0 + b >>> 0;
      c0 = c0 + c >>> 0;
      d0 = d0 + d >>> 0;
    }
    return hex32(a0) + hex32(b0) + hex32(c0) + hex32(d0);
  }
  const AI_SESSION_CACHE_PREFIX = "ai-session:";
  const AI_SESSION_CACHE_TTL_MS = 30 * 24 * 60 * 6e4;
  function aiSessionCacheTtlMs() {
    return AI_SESSION_CACHE_TTL_MS;
  }
  function aiSessionCacheKey(routeKey) {
    const key = String(routeKey || "").trim();
    return key ? `${AI_SESSION_CACHE_PREFIX}${key}` : "";
  }
  function shouldRestoreAutomaticAiSession(options = {}) {
    return !!options.automatic && !options.forcePreprocessOnce;
  }
  function isUsableAiSessionCache(payload) {
    const runs = Array.isArray(payload?.runs) ? payload.runs : [];
    return runs.some((run) => String(run?.raw || "").trim());
  }
  function serializeAiRunForCache(run) {
    if (!run) return null;
    const config = run.config && typeof run.config === "object" ? { ...run.config } : null;
    if (config && "apiKey" in config) config.apiKey = "";
    const snapshot = run.taskSnapshot;
    const sourceIds = Array.isArray(run.sourceIds) ? [...run.sourceIds] : null;
    return {
      id: String(run.id || ""),
      profileId: String(run.profileId || ""),
      taskId: String(run.taskId || ""),
      taskSnapshot: snapshot && typeof snapshot === "object" ? { ...snapshot, modelIds: [...snapshot.modelIds || []] } : null,
      promptId: String(run.promptId || ""),
      promptName: String(run.promptName || ""),
      promptProfile: run.promptProfile && typeof run.promptProfile === "object" ? { ...run.promptProfile } : null,
      config,
      raw: String(run.raw || ""),
      status: String(run.status || ""),
      statusText: String(run.statusText || ""),
      error: String(run.error || ""),
      ...sourceIds ? { sourceIds } : {},
      sourceBvids: Array.isArray(run.sourceBvids) ? [...run.sourceBvids] : [],
      startedAt: Number(run.startedAt) || 0,
      finishedAt: Number(run.finishedAt) || 0,
      scrollTop: Number(run.scrollTop) || 0
    };
  }
  function serializePreprocessRunForCache(run) {
    if (!run) return null;
    return {
      raw: String(run.raw || ""),
      preview: String(run.preview || ""),
      text: String(run.text || run.raw || ""),
      status: String(run.status || ""),
      statusText: String(run.statusText || ""),
      modelName: String(run.modelName || ""),
      promptName: String(run.promptName || ""),
      cacheHits: Number(run.cacheHits) || 0,
      total: Number(run.total) || 0,
      totalChunks: Number(run.totalChunks) || 0,
      completedChunks: Number(run.completedChunks) || 0,
      settings: run.settings && typeof run.settings === "object" ? { ...run.settings } : null
    };
  }
  function sanitizeSessionInputForCache(input) {
    if (!input || typeof input !== "object") return null;
    const next = { ...input };
    const preprocessConfig = next.preprocessConfig;
    if (preprocessConfig && typeof preprocessConfig === "object") {
      next.preprocessConfig = {
        ...preprocessConfig,
        apiKey: ""
      };
    }
    return next;
  }
  function buildAiSessionCachePayload(input) {
    return {
      version: 1,
      routeKey: String(input.routeKey || ""),
      sessionInput: sanitizeSessionInputForCache(input.sessionInput),
      preprocessRun: serializePreprocessRunForCache(input.preprocessRun),
      runs: (input.runs || []).map((run) => serializeAiRunForCache(run)).filter((run) => !!run),
      activeRunId: String(input.activeRunId || ""),
      activeTaskId: String(input.activeTaskId || "")
    };
  }
  function resolveRestoredActiveRunId(runs, savedActive, activeTaskId = "") {
    const list = (runs || []).filter(Boolean);
    if (savedActive) {
      const match = list.find(
        (run) => run.profileId === savedActive.profileId && run.taskId === savedActive.taskId
      );
      if (match?.id) return String(match.id);
    }
    if (activeTaskId) {
      const match = list.find((run) => run.taskId === activeTaskId);
      if (match?.id) return String(match.id);
    }
    return String(list[0]?.id || "");
  }
  function draftHydratedAiRun(saved) {
    if (!saved) return null;
    const raw = String(saved.raw || "");
    const unfinished = saved.status === "running" || saved.status === "queued";
    return {
      profileId: String(saved.profileId || ""),
      config: saved.config && typeof saved.config === "object" ? { ...saved.config } : null,
      taskSnapshot: saved.taskSnapshot || null,
      promptProfile: saved.promptProfile ?? null,
      raw,
      status: unfinished ? raw.trim() ? "done" : "stopped" : String(saved.status || "done"),
      statusText: unfinished ? raw.trim() ? "缓存" : "缓存中无完整结果" : String(saved.statusText || "缓存"),
      error: String(saved.error || ""),
      sourceIds: Array.isArray(saved.sourceIds) ? [...saved.sourceIds] : Array.isArray(saved.sourceBvids) ? [...saved.sourceBvids] : [],
      sourceBvids: Array.isArray(saved.sourceBvids) ? [...saved.sourceBvids] : [],
      startedAt: Number(saved.startedAt) || 0,
      finishedAt: Number(saved.finishedAt) || 0,
      scrollTop: Number(saved.scrollTop) || 0,
      busy: false,
      mermaidRepairing: false
    };
  }
  function aiSessionInputHash(vars) {
    return md5(String(vars?.processedSubtitle || vars?.subtitle || ""));
  }
  function aiRunIdentityKey(run, inputHash = "") {
    const prompt2 = run?.promptProfile || {};
    const promptSig = md5(`${prompt2.systemPrompt || ""}
---
${prompt2.userPromptTemplate || ""}`);
    const config = run?.config || {};
    const modelSig = md5(
      `${config.baseUrl || ""}|${config.model || ""}|${config.temperature}|${config.maxTokens}`
    );
    return [
      String(run?.taskId || ""),
      String(run?.profileId || ""),
      String(run?.promptId || prompt2.id || ""),
      promptSig,
      modelSig,
      String(inputHash || "")
    ].join(":");
  }
  function plannedAiRunFromCache(cached) {
    const prompt2 = cached.promptProfile && typeof cached.promptProfile === "object" ? cached.promptProfile : null;
    const config = cached.config && typeof cached.config === "object" ? {
      baseUrl: String(cached.config.baseUrl || ""),
      model: String(cached.config.model || ""),
      temperature: Number(cached.config.temperature),
      maxTokens: Number(cached.config.maxTokens)
    } : null;
    const next = {
      promptProfile: prompt2,
      config
    };
    if (cached.taskId !== void 0) next.taskId = cached.taskId;
    if (cached.profileId !== void 0) next.profileId = cached.profileId;
    if (cached.promptId !== void 0) next.promptId = cached.promptId;
    return next;
  }
  function partitionPlannedAiRuns(planned, cachedRuns, inputHash = "") {
    const byKey = /* @__PURE__ */ new Map();
    for (const cached of cachedRuns || []) {
      if (!cached || !String(cached.raw || "").trim()) continue;
      byKey.set(aiRunIdentityKey(plannedAiRunFromCache(cached), inputHash), cached);
    }
    const reuse = [];
    const generate = [];
    const used = /* @__PURE__ */ new Set();
    for (const plan of planned || []) {
      const key = aiRunIdentityKey(plan, inputHash);
      const cached = byKey.get(key);
      if (cached && !used.has(key)) {
        used.add(key);
        reuse.push({ plan, cached });
      } else {
        generate.push(plan);
      }
    }
    return { reuse, generate };
  }
  function shouldSkipPrepareForCachedSession(plannedCount, generateCount, reuseCount, options = {}) {
    return !!options.automatic && !options.force && plannedCount > 0 && generateCount === 0 && reuseCount === plannedCount;
  }
  function draftHydratedPreprocessRun(saved) {
    if (!saved) return null;
    return {
      raw: String(saved.raw || ""),
      preview: String(saved.preview || ""),
      text: String(saved.text || saved.raw || ""),
      status: String(saved.status || "done"),
      statusText: String(saved.statusText || "缓存"),
      modelName: String(saved.modelName || ""),
      promptName: String(saved.promptName || ""),
      cacheHits: Number(saved.cacheHits) || 0,
      total: Number(saved.total) || 0,
      totalChunks: Number(saved.totalChunks) || 0,
      completedChunks: Number(saved.completedChunks) || 0,
      settings: saved.settings && typeof saved.settings === "object" ? { ...saved.settings } : null,
      busy: false
    };
  }
  const SHORTCUT_COMMANDS = [
    {
      id: "toggle-panel",
      label: "召唤 / 隐藏面板",
      defaultChord: "Ctrl+KeyB"
    },
    {
      id: "open-processed",
      label: "AI 处理字幕",
      defaultChord: "Ctrl+Alt+Digit1"
    },
    {
      id: "open-postprocess",
      label: "后处理结果",
      defaultChord: "Ctrl+Alt+Digit2"
    },
    {
      id: "toggle-dock",
      label: "悬浮 / 靠边",
      defaultChord: "Ctrl+Alt+KeyD"
    }
  ];
  const MULTI_PART_TITLE_RE$2 = /^(.*)\s-\sP(\d+)【([\s\S]*)】\s*$/;
  function cleanAuthor(author) {
    const up = String(author || "").trim();
    if (!up || up === "未知UP") return "";
    return up;
  }
  function cleanParent(parent) {
    return cleanAuthor(parent);
  }
  function buildUpFolderLabel(author, name) {
    const up = cleanAuthor(author);
    const n = String(name || "").trim() || "未命名";
    if (!up) return n;
    return `${up} ${n}`;
  }
  function buildCollectionShortUrl(mid, seasonId) {
    const m = String(mid || "").trim();
    const s = String(seasonId || "").trim();
    if (!m || !s) return "";
    return `space.bilibili.com/${m}/lists/${s}`;
  }
  function inferLibraryGroupType(item) {
    const explicit = String(item?.groupType || "").trim();
    if (explicit === "selection" || explicit === "collection" || explicit === "single") {
      return explicit;
    }
    if (item?.collectionSid || item?.collectionName || item?.collectionShortUrl) {
      return "collection";
    }
    const page = Math.max(1, Number(item?.page) || 1);
    const title = String(item?.title || "");
    if (page > 1 || item?.part || MULTI_PART_TITLE_RE$2.test(title)) return "selection";
    return "single";
  }
  function resolveSpaceGroupKey(item) {
    const mid = String(item?.spaceMid || "").trim();
    if (mid) return `space:${mid}`;
    const parent = cleanParent(item?.parentFolder);
    if (parent) return `space:${parent}`;
    return "";
  }
  function resolveLibraryGroupKey(item) {
    if (item?.groupKey) return String(item.groupKey);
    const kind = inferLibraryGroupType(item);
    if (kind === "collection") {
      const mid = item?.collectionMid;
      const sid = item?.collectionSid;
      if (mid && sid) return `collection:${mid}/${sid}`;
      if (item?.collectionShortUrl) return `collection:${item.collectionShortUrl}`;
    }
    if (kind === "selection") {
      const bvid2 = String(item?.bvid || "").trim();
      if (bvid2) return `selection:${bvid2}`;
    }
    const bvid = String(item?.bvid || "unknown").trim();
    const page = Math.max(1, Number(item?.page) || 1);
    return `single:${bvid}:P${page}`;
  }
  const SPACE_LOOSE_VIDEOS_FOLDER = "视频";
  function resolveSpaceLooseVideosKey(item) {
    const mid = String(item?.spaceMid || "").trim();
    if (mid) return `space-videos:${mid}`;
    const parent = cleanParent(item?.parentFolder);
    if (parent) return `space-videos:${parent}`;
    return "space-videos:unknown";
  }
  function isSpaceLooseVideosKey(groupKey) {
    return String(groupKey || "").startsWith("space-videos:");
  }
  function resolveLibraryFolderLabel(item) {
    const existing = String(item?.groupFolder || "").trim();
    const parent = cleanParent(item?.parentFolder);
    if (existing && !/^未知UP\b/.test(existing)) {
      if (parent && existing.startsWith(`${parent} `)) {
        const leaf = existing.slice(parent.length + 1).trim();
        if (leaf) return leaf;
      }
      return existing;
    }
    const kind = inferLibraryGroupType(item);
    const author = item?.author;
    if (kind === "collection") {
      const name = String(item?.collectionName || "未命名合集").trim() || "未命名合集";
      return parent ? name : buildUpFolderLabel(author, name);
    }
    if (kind === "selection") {
      const title = String(item?.videoTitle || "").trim() || String(item?.title || "").replace(/\s-\sP\d+【[\s\S]*】\s*$/, "").trim() || item?.bvid || "未命名视频";
      return parent ? title : buildUpFolderLabel(author, title);
    }
    if (parent) {
      if (existing && !/^未知UP\b/.test(existing) && existing !== parent) {
        if (existing.startsWith(`${parent} `)) {
          const leaf = existing.slice(parent.length + 1).trim();
          if (leaf) return leaf;
        } else {
          return existing;
        }
      }
      return SPACE_LOOSE_VIDEOS_FOLDER;
    }
    return buildUpFolderLabel(author, item?.title || item?.bvid || "未命名视频");
  }
  function resolveFolderSegments(item) {
    const parent = cleanParent(item?.parentFolder);
    const kind = inferLibraryGroupType(item);
    if (parent) {
      if (kind === "collection") {
        const name = String(item?.collectionName || "").trim() || String(item?.groupFolder || "").trim() || "未命名合集";
        const leaf2 = name.startsWith(`${parent} `) ? name.slice(parent.length + 1).trim() || name : name;
        return [parent, leaf2 || "未命名合集"];
      }
      if (kind === "selection") {
        const title = String(item?.videoTitle || "").trim() || String(item?.groupFolder || "").trim() || String(item?.title || "").replace(/\s-\sP\d+【[\s\S]*】\s*$/, "").trim() || item?.bvid || "未命名视频";
        const leaf2 = title.startsWith(`${parent} `) ? title.slice(parent.length + 1).trim() || title : title;
        return [parent, leaf2 || "未命名视频"];
      }
      const loose = String(item?.groupFolder || "").trim() || SPACE_LOOSE_VIDEOS_FOLDER;
      const leaf = loose.startsWith(`${parent} `) ? loose.slice(parent.length + 1).trim() || SPACE_LOOSE_VIDEOS_FOLDER : loose;
      return [parent, leaf || SPACE_LOOSE_VIDEOS_FOLDER];
    }
    const label = resolveLibraryFolderLabel(item);
    return label ? [label] : [];
  }
  function bvidMultiPageKeys(entries) {
    const counts = /* @__PURE__ */ new Map();
    for (const entry of entries) {
      const bvid = String(entry.item?.bvid || "").trim();
      if (!bvid) continue;
      counts.set(bvid, (counts.get(bvid) || 0) + 1);
    }
    const multi = /* @__PURE__ */ new Set();
    for (const [bvid, n] of counts) {
      if (n > 1) multi.add(bvid);
    }
    return multi;
  }
  function collectionIdentityKey(item) {
    if (!item) return "";
    if (item.groupKey && String(item.groupKey).startsWith("collection:")) {
      return String(item.groupKey);
    }
    const mid = item.collectionMid;
    const sid = item.collectionSid;
    if (mid && sid) return `collection:${mid}/${sid}`;
    if (item.collectionShortUrl) return `collection:${item.collectionShortUrl}`;
    const name = String(item.collectionName || "").trim();
    if (name) {
      const author = String(item.author || "").trim();
      return `collection:name:${author}|${name}`;
    }
    return "";
  }
  function collectionFolderKeys(entries) {
    const keys = /* @__PURE__ */ new Set();
    for (const entry of entries) {
      const item = entry.item;
      const kind = inferLibraryGroupType(item);
      const id = collectionIdentityKey(item);
      if (id && (kind === "collection" || item?.collectionSid || item?.collectionName || item?.collectionShortUrl)) {
        keys.add(id);
      }
    }
    const counts = /* @__PURE__ */ new Map();
    for (const entry of entries) {
      const id = collectionIdentityKey(entry.item);
      if (!id) continue;
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    for (const [id, n] of counts) {
      if (n > 1) keys.add(id);
    }
    return keys;
  }
  function effectiveGroupType(item, multiBvids, collectionKeys) {
    const kind = inferLibraryGroupType(item);
    if (kind === "collection") return "collection";
    if (kind === "selection") return "selection";
    const colId = collectionIdentityKey(item);
    if (colId && collectionKeys.has(colId)) return "collection";
    const bvid = String(item?.bvid || "").trim();
    if (bvid && multiBvids.has(bvid)) return "selection";
    return "single";
  }
  function effectiveGroupKey(item, multiBvids, collectionKeys) {
    if (item?.groupKey) return String(item.groupKey);
    const kind = effectiveGroupType(item, multiBvids, collectionKeys);
    if (kind === "collection") {
      const id = collectionIdentityKey(item);
      if (id) return id;
    }
    if (kind === "selection") {
      const bvid = String(item?.bvid || "").trim();
      if (bvid) return `selection:${bvid}`;
    }
    return resolveLibraryGroupKey(item);
  }
  function folderCheckState(selectedCount, total) {
    if (selectedCount === 0) return "none";
    if (selectedCount === total) return "all";
    return "partial";
  }
  function isFolderedEntry(item, multiBvids, collectionKeys) {
    const kind = effectiveGroupType(item, multiBvids, collectionKeys);
    if (kind !== "single") return true;
    if (isSpaceLooseVideosKey(item?.groupKey)) return true;
    if (cleanParent(item?.parentFolder) && String(item?.groupFolder || "").trim() === SPACE_LOOSE_VIDEOS_FOLDER) {
      return true;
    }
    return false;
  }
  function leafFolderKey(item, multiBvids, collectionKeys) {
    if (isSpaceLooseVideosKey(item?.groupKey)) return String(item.groupKey);
    if (cleanParent(item?.parentFolder) && String(item?.groupFolder || "").trim() === SPACE_LOOSE_VIDEOS_FOLDER && effectiveGroupType(item, multiBvids, collectionKeys) === "single") {
      return resolveSpaceLooseVideosKey(item);
    }
    return effectiveGroupKey(item, multiBvids, collectionKeys);
  }
  function buildLeafRenderNodes(entries, collapsedMap, depth) {
    const multiBvids = bvidMultiPageKeys(entries);
    const collectionKeys = collectionFolderKeys(entries);
    const folderBuckets = /* @__PURE__ */ new Map();
    for (const entry of entries) {
      if (!isFolderedEntry(entry.item, multiBvids, collectionKeys)) continue;
      const key = leafFolderKey(entry.item, multiBvids, collectionKeys);
      if (!folderBuckets.has(key)) folderBuckets.set(key, []);
      folderBuckets.get(key).push(entry);
    }
    const nodes = [];
    const emittedFolders = /* @__PURE__ */ new Set();
    for (const entry of entries) {
      if (!isFolderedEntry(entry.item, multiBvids, collectionKeys)) {
        nodes.push({ type: "item", entry, depth });
        continue;
      }
      const key = leafFolderKey(entry.item, multiBvids, collectionKeys);
      if (emittedFolders.has(key)) continue;
      emittedFolders.add(key);
      const children = folderBuckets.get(key) || [entry];
      const selectedCount = children.filter((c) => c.item.selected).length;
      const total = children.length;
      const labeled = children.map((c) => c.item).find((it) => it.groupFolder && !/^未知UP\b/.test(String(it.groupFolder))) || children.map((c) => c.item).find((it) => String(it.author || "").trim() && it.author !== "未知UP") || children[0]?.item;
      const kind = effectiveGroupType(labeled, multiBvids, collectionKeys);
      nodes.push({
        type: "folder",
        groupKey: key,
        groupType: kind,
        folderLabel: resolveLibraryFolderLabel(labeled),
        collapsed: !!collapsedMap[key],
        selectedCount,
        total,
        checkState: folderCheckState(selectedCount, total),
        children,
        depth
      });
    }
    return nodes;
  }
  function buildLibraryRenderNodes(entries, collapsedMap = {}) {
    const collapsed = collapsedMap || {};
    const spaceBuckets = /* @__PURE__ */ new Map();
    const flatEntries = [];
    for (const entry of entries) {
      const spaceKey = resolveSpaceGroupKey(entry.item);
      const parent = cleanParent(entry.item?.parentFolder);
      if (spaceKey && parent) {
        if (!spaceBuckets.has(spaceKey)) {
          spaceBuckets.set(spaceKey, { label: parent, entries: [] });
        }
        const bucket = spaceBuckets.get(spaceKey);
        if (parent && parent !== "未知UP") bucket.label = parent;
        bucket.entries.push(entry);
      } else {
        flatEntries.push(entry);
      }
    }
    const spaceNodeByKey = /* @__PURE__ */ new Map();
    for (const [spaceKey, bucket] of spaceBuckets) {
      const nested2 = buildLeafRenderNodes(bucket.entries, collapsed, 1);
      const selectedCount = bucket.entries.filter((c) => c.item.selected).length;
      const total = bucket.entries.length;
      spaceNodeByKey.set(spaceKey, {
        type: "folder",
        groupKey: spaceKey,
        groupType: "space",
        folderLabel: bucket.label,
        collapsed: !!collapsed[spaceKey],
        selectedCount,
        total,
        checkState: folderCheckState(selectedCount, total),
        children: bucket.entries,
        nodes: nested2,
        depth: 0
      });
    }
    const flatNodes = buildLeafRenderNodes(flatEntries, collapsed, 0);
    const nodes = [];
    const emittedSpace = /* @__PURE__ */ new Set();
    const emittedFlatKeys = /* @__PURE__ */ new Set();
    const flatNodeKey = (node) => {
      if (node.type === "item") return `item:${node.entry.index}`;
      return `folder:${node.groupKey}`;
    };
    const flatOwnerByIndex = /* @__PURE__ */ new Map();
    for (const node of flatNodes) {
      if (node.type === "item") {
        flatOwnerByIndex.set(node.entry.index, node);
      } else {
        for (const child of node.children) {
          flatOwnerByIndex.set(child.index, node);
        }
      }
    }
    for (const entry of entries) {
      const spaceKey = resolveSpaceGroupKey(entry.item);
      if (spaceKey && cleanParent(entry.item?.parentFolder)) {
        if (emittedSpace.has(spaceKey)) continue;
        emittedSpace.add(spaceKey);
        const spaceNode = spaceNodeByKey.get(spaceKey);
        if (spaceNode) nodes.push(spaceNode);
        continue;
      }
      const owner = flatOwnerByIndex.get(entry.index);
      if (!owner) continue;
      const k = flatNodeKey(owner);
      if (emittedFlatKeys.has(k)) continue;
      emittedFlatKeys.add(k);
      nodes.push(owner);
    }
    return nodes;
  }
  function setGroupSelection(items, groupKey, selected) {
    const key = String(groupKey || "").trim();
    if (!key) return;
    if (key.startsWith("space:") && !key.startsWith("space-videos:")) {
      for (const item of items) {
        if (resolveSpaceGroupKey(item) === key) item.selected = selected;
      }
      return;
    }
    if (isSpaceLooseVideosKey(key)) {
      for (const item of items) {
        if (String(item.groupKey || "") === key || resolveSpaceLooseVideosKey(item) === key) {
          const kind = inferLibraryGroupType(item);
          if (kind === "collection" || kind === "selection") continue;
          if (item.collectionSid || item.collectionName) continue;
          item.selected = selected;
        }
      }
      return;
    }
    for (const item of items) {
      if (resolveLibraryGroupKey(item) === key) item.selected = selected;
      if (key.startsWith("selection:")) {
        const bvid = key.slice("selection:".length);
        if (bvid && String(item.bvid || "").trim() === bvid) {
          item.selected = selected;
        }
      }
    }
  }
  const SUBTITLE_EXPORT_ROOT = "loop-bilibili-subbatch";
  const SUBTITLE_EXPORT_INDEX_NAME = "index.md";
  const MULTI_PART_TITLE_RE$1 = /^(.*)\s-\sP(\d+)【([\s\S]*)】\s*$/;
  function buildVideoShortUrl(bvid) {
    const id = String(bvid || "").trim();
    if (!id) return "";
    const normalized = /^bv/i.test(id) ? `BV${id.slice(2)}` : id;
    return `www.bilibili.com/video/${normalized}`;
  }
  function videoIndexKey(bvid) {
    const id = String(bvid || "").trim();
    if (!id) return "";
    return /^bv/i.test(id) ? `BV${id.slice(2)}` : id;
  }
  function safePathSegment(name, maxLen = 120) {
    const cleaned = String(name || "untitled").replace(/\|/g, "｜").replace(/\./g, "·").replace(/[\\/:*?"<>]+/g, "_").replace(/[？?！!]+/g, "＿").replace(/\s+/g, " ").trim().replace(/^\.+/, "").replace(/[.\s]+$/g, "").slice(0, Math.max(1, maxLen)).replace(/[.\s]+$/g, "");
    return cleaned || "untitled";
  }
  function joinFileName(stem, ext) {
    const cleanExt = String(ext || "txt").replace(/^\./, "").trim().toLowerCase() || "txt";
    let base = safePathSegment(stem, 160);
    base = base.replace(new RegExp(`[·._-]+${cleanExt}$`, "i"), "");
    if (!base) base = "untitled";
    return `${base}.${cleanExt}`;
  }
  function resolveSeriesTitle(item) {
    if (item?.videoTitle) return String(item.videoTitle).trim();
    const title = String(item?.title || "").trim();
    const multi = title.match(MULTI_PART_TITLE_RE$1);
    if (multi?.[1]?.trim()) return multi[1].trim();
    const cut = title.search(/\s-\sP\d+【/);
    if (cut > 0) return title.slice(0, cut).trim();
    if (title) return title;
    return String(item?.bvid || "untitled").trim() || "untitled";
  }
  function resolvePartLabel(item) {
    const explicit = String(item?.part || "").trim();
    if (explicit) return explicit;
    const page = Math.max(1, Number(item?.page) || 1);
    const fromPages = item?.pages?.[page - 1];
    const pagePart = String(fromPages?.part || "").trim();
    if (pagePart) return pagePart;
    const title = String(item?.title || "").trim();
    const multi = title.match(MULTI_PART_TITLE_RE$1);
    if (multi?.[3] != null) return String(multi[3]).trim();
    return "";
  }
  function resolveSubtitleFileStem(item) {
    const kind = inferLibraryGroupType(item);
    if (kind === "collection") {
      const title = String(item?.title || "").trim();
      if (title) return title;
      return String(item?.bvid || "video").trim() || "video";
    }
    const parent = String(item?.parentFolder || "").trim();
    if (kind === "single" && parent && parent !== "未知UP") {
      const title = String(item?.title || "").trim();
      if (title) return title;
      return String(item?.bvid || "video").trim() || "video";
    }
    const page = Math.max(1, Number(item?.page) || 1);
    const part = resolvePartLabel(item);
    return part ? `P${page}${part}` : `P${page}`;
  }
  function resolveExportFolderName(item) {
    const raw = resolveFolderSegments(item);
    if (raw.length > 1) return raw.join(" / ");
    if (raw.length === 1) return raw[0] || "";
    const folder = String(item?.groupFolder || "").trim();
    if (folder && !/^未知UP\b/.test(folder)) return folder;
    return resolveLibraryFolderLabel(item);
  }
  function resolveExportFolderSegments(item) {
    const raw = resolveFolderSegments(item);
    return raw.map((s) => safePathSegment(s)).filter(Boolean);
  }
  function buildSubtitleExportRelativePath(item, ext) {
    const segments = resolveExportFolderSegments(item);
    const fileName = joinFileName(resolveSubtitleFileStem(item), ext);
    if (!segments.length) return `${SUBTITLE_EXPORT_ROOT}/${fileName}`;
    return `${SUBTITLE_EXPORT_ROOT}/${segments.join("/")}/${fileName}`;
  }
  function buildSubtitleExportIndexPath() {
    return `${SUBTITLE_EXPORT_ROOT}/${SUBTITLE_EXPORT_INDEX_NAME}`;
  }
  function collectionIndexKey(shortUrl) {
    return `collection:${String(shortUrl || "").trim()}`;
  }
  function parseExportIndexMd(content2) {
    const map = {};
    for (const rawLine of String(content2 || "").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const col = line.match(
        /^(.+?)\s+(space\.bilibili\.com\/\d+\/lists\/\d+)\s+(.+)$/i
      );
      if (col) {
        const author = String(col[1] || "").trim();
        const shortUrl = String(col[2] || "").trim();
        const name = String(col[3] || "").trim();
        map[collectionIndexKey(shortUrl)] = {
          kind: "collection",
          author,
          shortUrl,
          name
        };
        continue;
      }
      const vid = line.match(
        /^(?:(.+?)\s+)?((?:www\.)?bilibili\.com\/video\/(BV[\w]+))\s+(.+)$/i
      );
      if (vid) {
        const author = String(vid[1] || "").trim();
        const bare = String(vid[2] || "").replace(/^https?:\/\//i, "");
        const short = bare.startsWith("www.") ? bare : bare.toLowerCase().startsWith("bilibili.com") ? `www.${bare}` : bare;
        const bvid = videoIndexKey(vid[3]);
        const name = String(vid[4] || "").trim();
        map[bvid] = {
          kind: "video",
          author,
          shortUrl: short || buildVideoShortUrl(bvid),
          bvid,
          name
        };
        continue;
      }
      const m = line.match(/^(BV[\w]+)\s+(.+)$/i);
      if (!m) continue;
      const normalized = videoIndexKey(m[1] || "");
      const legacyName = String(m[2] || "").trim();
      map[normalized] = {
        kind: "video",
        author: "",
        shortUrl: buildVideoShortUrl(normalized),
        bvid: normalized,
        name: legacyName
      };
    }
    return map;
  }
  function upsertVideoExportIndex(map, author, bvid, videoTitle) {
    const next = { ...map || {} };
    const id = videoIndexKey(bvid);
    if (!id) return next;
    const up = String(author || "").trim();
    const name = String(videoTitle || "").trim() || id;
    const shortUrl = buildVideoShortUrl(id);
    next[id] = {
      kind: "video",
      author: up,
      shortUrl,
      bvid: id,
      name
    };
    return next;
  }
  function upsertExportIndexMap(map, bvid, seriesTitle, author) {
    return upsertVideoExportIndex(map, author, bvid, seriesTitle);
  }
  function upsertCollectionExportIndex(map, author, shortUrl, collectionName) {
    const next = { ...map || {} };
    const url = String(shortUrl || "").trim();
    if (!url) return next;
    const up = String(author || "").trim();
    const name = String(collectionName || "").trim() || "未命名合集";
    next[collectionIndexKey(url)] = {
      kind: "collection",
      author: up,
      shortUrl: url,
      name
    };
    return next;
  }
  function renderExportIndexMd(map) {
    const videoLines = [];
    const colLines = [];
    for (const [key, value] of Object.entries(map || {})) {
      if (!value) continue;
      if (typeof value === "string") {
        const bvid = videoIndexKey(key);
        const shortUrl = buildVideoShortUrl(bvid);
        if (bvid && value) videoLines.push(`${shortUrl} ${value}`);
        continue;
      }
      if (value.kind === "video" && value.bvid && value.name) {
        const shortUrl = value.shortUrl || buildVideoShortUrl(value.bvid);
        const up = String(value.author || "").trim();
        videoLines.push(up ? `${up} ${shortUrl} ${value.name}` : `${shortUrl} ${value.name}`);
        continue;
      }
      if (value.kind === "collection" && value.shortUrl && value.name) {
        const up = String(value.author || "").trim();
        colLines.push(up ? `${up} ${value.shortUrl} ${value.name}` : `${value.shortUrl} ${value.name}`);
      }
    }
    videoLines.sort((a, b) => a.localeCompare(b, "en"));
    colLines.sort((a, b) => a.localeCompare(b, "zh"));
    const lines = [...videoLines, ...colLines];
    if (!lines.length) return "";
    return `${lines.join("\n")}
`;
  }
  function normalizeExportItem(item, peers = []) {
    const base = { ...item || {} };
    const list = peers || [];
    const key = String(base.groupKey || "");
    const sameGroup = key ? list.filter((p) => String(p?.groupKey || "") === key) : list.filter((p) => String(p?.bvid || "") === String(base.bvid || "") && base.bvid);
    const peerAuthor = sameGroup.map((p) => String(p?.author || "").trim()).find((a) => a && a !== "未知UP");
    const author = String(base.author || "").trim() && base.author !== "未知UP" ? String(base.author).trim() : peerAuthor || String(base.author || "").trim();
    if (author) base.author = author;
    if (!String(base.parentFolder || "").trim() || base.parentFolder === "未知UP") {
      const peerParent = sameGroup.map((p) => String(p?.parentFolder || "").trim()).find((p) => p && p !== "未知UP");
      if (peerParent) base.parentFolder = peerParent;
    }
    if (base.spaceMid == null || base.spaceMid === "") {
      const peerMid = sameGroup.map((p) => p?.spaceMid).find((m) => m != null && m !== "");
      if (peerMid != null && peerMid !== "") base.spaceMid = peerMid;
    }
    const peerFolder = sameGroup.map((p) => String(p?.groupFolder || "").trim()).find((f) => f && !/^未知UP\b/.test(f));
    if (peerFolder) base.groupFolder = peerFolder;
    else if (!base.groupFolder || /^未知UP\b/.test(String(base.groupFolder))) {
      base.groupFolder = resolveLibraryFolderLabel(base);
    }
    return base;
  }
  function resolveIndexVideoTitle(item) {
    const videoTitle = String(item?.videoTitle || "").trim();
    if (videoTitle) return videoTitle;
    return resolveSeriesTitle(item);
  }
  function upsertIndexForExportItem(map, item) {
    const normalized = normalizeExportItem(item, item ? [item] : []);
    const kind = inferLibraryGroupType(normalized);
    if (kind === "collection") {
      const shortUrl = normalized.collectionShortUrl || buildCollectionShortUrl(normalized.collectionMid, normalized.collectionSid);
      return upsertCollectionExportIndex(
        map,
        normalized.author,
        shortUrl,
        normalized.collectionName || resolveSeriesTitle(normalized)
      );
    }
    return upsertVideoExportIndex(
      map,
      normalized.author,
      normalized.bvid,
      resolveIndexVideoTitle(normalized)
    );
  }
  function describeSubtitleExport(item, ext = "txt") {
    const normalized = normalizeExportItem(item, item ? [item] : []);
    const seriesTitle = resolveExportFolderName(normalized);
    const fileStem = resolveSubtitleFileStem(normalized);
    const folderSegments = resolveExportFolderSegments(normalized);
    return {
      bvid: String(normalized.bvid || "").trim(),
      seriesTitle,
      fileStem,
      folderSegment: folderSegments.join("/") || safePathSegment(seriesTitle),
      folderSegments,
      fileSegment: safePathSegment(fileStem, 160),
      relativePath: buildSubtitleExportRelativePath(normalized, ext),
      indexPath: buildSubtitleExportIndexPath(),
      groupType: inferLibraryGroupType(normalized)
    };
  }
  function slugFolioHeading(text, index) {
    const base = String(text || "").toLowerCase().replace(/[^\u4e00-\u9fff\w]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
    return `folio-${base || "s"}-${Math.max(0, Number(index) || 0) + 1}`;
  }
  function normalizeFolioHeadingLevel(value) {
    return Number(value) >= 3 ? 3 : 2;
  }
  function buildFolioOutline(headings) {
    const roots = [];
    let currentChapter = null;
    for (const heading of headings || []) {
      if (!heading) continue;
      const text = String(heading.text || "").replace(/\s+/g, " ").trim() || "未命名";
      const id = String(heading.id || "").trim();
      if (!id) continue;
      const node = {
        id,
        level: normalizeFolioHeadingLevel(heading.level),
        text,
        children: []
      };
      if (node.level === 2 || !currentChapter) {
        node.level = 2;
        roots.push(node);
        currentChapter = node;
        continue;
      }
      currentChapter.children.push(node);
    }
    return roots;
  }
  function flattenFolioOutline(nodes) {
    const out = [];
    for (const node of nodes || []) {
      out.push(node);
      if (node.children?.length) out.push(...flattenFolioOutline(node.children));
    }
    return out;
  }
  function countFolioOutline(nodes) {
    const flat = flattenFolioOutline(nodes);
    return {
      chapters: (nodes || []).length,
      sections: flat.length
    };
  }
  function formatFolioChapterIndex(index) {
    return String(Math.max(1, Number(index) || 1)).padStart(2, "0");
  }
  function folioOutlineSummary(stats) {
    const chapters = Math.max(0, Number(stats?.chapters) || 0);
    const sections = Math.max(0, Number(stats?.sections) || 0);
    if (!chapters) return "暂无章节";
    if (sections <= chapters) return `${chapters} 章`;
    return `${chapters} 章 · ${sections} 节`;
  }
  function parseKnowledgeOutput(raw) {
    const source = String(raw || "");
    const match = source.match(/<suggestions>([\s\S]*?)(?:<\/suggestions>|$)/i);
    const answer = source.replace(/\n?<suggestions>[\s\S]*$/i, "").trim();
    const suggestions = match ? (match[1] ?? "").split(/\r?\n/).map((item) => item.replace(/^\s*[-*\d.)]+\s*/, "").trim()).filter(Boolean).slice(0, 4) : [];
    return { answer, suggestions };
  }
  function knowledgeBranchContext(parentNode, ancestors = []) {
    if (!parentNode) return "（这是该锚点下的新分支）";
    return [...ancestors, parentNode].slice(-6).map((node, index) => {
      const answer = String(node.answer || "").trim().replace(/\s+/g, " ").slice(0, 1800);
      return `${index + 1}. 问题：${node.question}
   回答摘要：${answer || "（尚无回答）"}`;
    }).join("\n");
  }
  const MULTI_PART_TITLE_RE = /^(.*)\s-\sP(\d+)【([\s\S]*)】\s*$/;
  function cleanUpName(author) {
    const up = String(author || "").trim();
    if (!up || up === "未知UP") return "";
    return up;
  }
  function inheritParentFolder(items, explicit) {
    const fromMeta = cleanUpName(explicit);
    if (fromMeta) return fromMeta;
    for (const it of items) {
      const p = cleanUpName(it?.parentFolder);
      if (p) return p;
    }
    return "";
  }
  function resolveSeriesTitleLocal(item) {
    if (item?.videoTitle) return String(item.videoTitle).trim();
    const title = String(item?.title || "").trim();
    const multi = title.match(MULTI_PART_TITLE_RE);
    if (multi?.[1]?.trim()) return multi[1].trim();
    const cut = title.search(/\s-\sP\d+【/);
    if (cut > 0) return title.slice(0, cut).trim();
    if (title) return title;
    return String(item?.bvid || "untitled").trim() || "untitled";
  }
  function attachUserSpaceGroupMeta(items, meta = {}) {
    const list = items || [];
    const author = cleanUpName(meta.author) || cleanUpName(list.find((it) => cleanUpName(it?.author))?.author) || "";
    const mid = String(meta.mid || "").trim();
    if (!author && !mid) return list.map((it) => ({ ...it }));
    const parentFolder = author || String(list[0]?.parentFolder || "").trim();
    return list.map((it) => {
      const itemAuthor = cleanUpName(it.author) || author;
      return {
        ...it,
        author: itemAuthor || it.author,
        parentFolder: parentFolder || it.parentFolder,
        spaceMid: mid || it.spaceMid
      };
    });
  }
  function attachSpaceLooseVideosMeta(items) {
    const list = items || [];
    return list.map((it) => {
      const parent = cleanUpName(it.parentFolder);
      if (!parent) return { ...it };
      const kind = inferLibraryGroupType(it);
      if (kind === "collection" || kind === "selection") return { ...it };
      if (it.collectionSid || it.collectionName || it.collectionShortUrl) return { ...it };
      return {
        ...it,
        groupType: "single",
        groupKey: resolveSpaceLooseVideosKey(it),
        groupFolder: SPACE_LOOSE_VIDEOS_FOLDER
      };
    });
  }
  function attachSelectionGroupMeta(items, meta = {}) {
    const list = items || [];
    const author = String(meta.author || list[0]?.author || "").trim();
    const videoTitle = String(meta.title || "").trim() || resolveSeriesTitleLocal(list[0]) || "";
    const bvid = String(list[0]?.bvid || "").trim();
    const groupKey = bvid ? `selection:${bvid}` : "selection:unknown";
    const parentFolder = inheritParentFolder(list, meta.parentFolder);
    const groupFolder = parentFolder ? videoTitle || "未命名视频" : buildUpFolderLabel(author, videoTitle);
    return list.map((it) => ({
      ...it,
      author: String(it.author || "").trim() || author,
      videoTitle,
      groupType: "selection",
      groupKey,
      groupFolder,
      parentFolder: parentFolder || it.parentFolder,
      spaceMid: it.spaceMid
    }));
  }
  function attachCollectionGroupMeta(items, meta = {}, ctx = {}) {
    const list = items || [];
    const mid = String(meta.mid || ctx.mid || "").trim();
    const sid = String(meta.season_id || ctx.season_id || "").trim();
    const shortUrl = buildCollectionShortUrl(mid, sid);
    const collectionName = String(meta.name || meta.title || ctx.collectionTitleHint || "未命名合集").trim();
    const author = String(meta.author || "").trim() || String(ctx.authorHint || "").trim() || String(list[0]?.author || "").trim() || "";
    const groupKey = mid && sid ? `collection:${mid}/${sid}` : `collection:${shortUrl || collectionName}`;
    const parentFolder = inheritParentFolder(list, meta.parentFolder || ctx.parentFolder);
    const groupFolder = parentFolder ? collectionName || "未命名合集" : buildUpFolderLabel(author, collectionName);
    return list.map((it) => ({
      ...it,
      author: String(it.author || "").trim() || author,
      groupType: "collection",
      groupKey,
      groupFolder,
      collectionName,
      collectionMid: mid,
      collectionSid: sid,
      collectionShortUrl: shortUrl,
      parentFolder: parentFolder || it.parentFolder,
      spaceMid: it.spaceMid
    }));
  }
  function applyUgcSeasonToItem(item, view2) {
    if (!item) return item;
    if (!view2?.ugc_season?.id) return item;
    const season = view2.ugc_season;
    const mid = season.mid || view2.owner?.mid;
    const sid = season.id;
    if (!mid || !sid) return item;
    const author = String(item.author || view2.owner?.name || "").trim();
    const collectionName = String(season.title || item.collectionName || "未命名合集").trim();
    const shortUrl = buildCollectionShortUrl(mid, sid);
    const groupKey = `collection:${mid}/${sid}`;
    const parentFolder = cleanUpName(item.parentFolder);
    const groupFolder = parentFolder ? collectionName : buildUpFolderLabel(author, collectionName);
    return {
      ...item,
      author: author || item.author,
      groupType: "collection",
      groupKey,
      groupFolder,
      collectionName,
      collectionMid: String(mid),
      collectionSid: String(sid),
      collectionShortUrl: shortUrl,
      parentFolder: parentFolder || item.parentFolder
    };
  }
  function applyUgcSeasonToItems(items, view2) {
    return (items || []).map((it) => applyUgcSeasonToItem(it, view2));
  }
  function normalizeBvidKey(bvid) {
    const id = String(bvid || "").trim();
    if (!id) return "";
    const body = /^bv/i.test(id) ? id.slice(2) : id;
    return `BV${body.toUpperCase()}`;
  }
  function applySpaceCollectionMembership(items, collections) {
    const list = items || [];
    const cols = collections || [];
    if (!list.length || !cols.length) return list.map((it) => ({ ...it }));
    const byBvid = /* @__PURE__ */ new Map();
    for (const col of cols) {
      const sid = String(col?.season_id || "").trim();
      if (!sid) continue;
      for (const raw of col.bvids || []) {
        const key = normalizeBvidKey(raw);
        if (!key || byBvid.has(key)) continue;
        byBvid.set(key, col);
      }
    }
    if (!byBvid.size) return list.map((it) => ({ ...it }));
    return list.map((it) => {
      const key = normalizeBvidKey(it.bvid);
      const col = key ? byBvid.get(key) : void 0;
      if (!col) return { ...it };
      const stamped = attachCollectionGroupMeta([it], {
        mid: col.mid ?? "",
        season_id: col.season_id ?? "",
        name: col.name || col.title || "未命名合集",
        ...col.author || it.author ? { author: col.author || it.author } : {},
        ...it.parentFolder ? { parentFolder: it.parentFolder } : {}
      });
      return stamped[0] || { ...it };
    });
  }
  function countSpaceCollectionMatches(items, collections) {
    const list = items || [];
    const cols = (collections || []).filter((c) => String(c?.season_id || "").trim());
    if (!list.length || !cols.length) return { matched: 0, collectionCount: cols.length };
    const memberKeys = /* @__PURE__ */ new Set();
    for (const col of cols) {
      for (const raw of col.bvids || []) {
        const key = normalizeBvidKey(raw);
        if (key) memberKeys.add(key);
      }
    }
    let matched = 0;
    for (const it of list) {
      const key = normalizeBvidKey(it.bvid);
      if (key && memberKeys.has(key)) matched += 1;
    }
    return { matched, collectionCount: cols.length };
  }
  function buildGroupMetaPatches(normalized) {
    const key = String(normalized?.groupKey || "").trim();
    if (!key) return null;
    const author = String(normalized?.author || "").trim();
    const groupFolder = String(normalized?.groupFolder || "").trim();
    if (!author && !groupFolder) return null;
    const patch = { groupKey: key };
    if (author && author !== "未知UP") patch.author = author;
    if (groupFolder && !/^未知UP\b/.test(groupFolder)) patch.groupFolder = groupFolder;
    if (!patch.author && !patch.groupFolder) return null;
    return patch;
  }
  function applyGroupMetaPatchToItems(items, patch) {
    const list = items || [];
    if (!patch?.groupKey) return list.slice();
    return list.map((row2) => {
      if (String(row2.groupKey || "") !== patch.groupKey) return row2;
      const next = { ...row2 };
      if (patch.author && (!row2.author || row2.author === "未知UP")) next.author = patch.author;
      if (patch.groupFolder && (!row2.groupFolder || /^未知UP\b/.test(String(row2.groupFolder)))) {
        next.groupFolder = patch.groupFolder;
      }
      return next;
    });
  }
  function mergeGroupFields(target, source) {
    if (!source) return target;
    const next = { ...target };
    if (source.groupType) next.groupType = source.groupType;
    if (source.groupKey) next.groupKey = source.groupKey;
    if (source.groupFolder) next.groupFolder = source.groupFolder;
    if (source.parentFolder) next.parentFolder = source.parentFolder;
    if (source.spaceMid != null && source.spaceMid !== "") next.spaceMid = source.spaceMid;
    if (source.collectionName) next.collectionName = source.collectionName;
    if (source.collectionMid != null) next.collectionMid = source.collectionMid;
    if (source.collectionSid != null) next.collectionSid = source.collectionSid;
    if (source.collectionShortUrl) next.collectionShortUrl = source.collectionShortUrl;
    if (source.videoTitle) next.videoTitle = source.videoTitle;
    if (source.author && (!target.author || target.author === "未知UP")) {
      next.author = source.author;
    }
    return next;
  }
  function refreshGroupFolder(item) {
    const folder = String(item.groupFolder || "").trim();
    if (folder && !/^未知UP\b/.test(folder)) return item;
    return { ...item, groupFolder: resolveLibraryFolderLabel(item) };
  }
  function suggestCaptureMode(item) {
    if (!item) return "auto";
    if (item.groupType === "collection" || item.collectionSid || item.collectionShortUrl || item.collectionName) {
      return "collection";
    }
    const pageCount = Array.isArray(item.pages) ? item.pages.length : 0;
    if (item.groupType === "selection" || pageCount > 1) {
      return "selection";
    }
    return "auto";
  }
  function stripMermaidTimestampCitations(code) {
    return String(code || "").replace(
      /[ \t]*\[\s*(?:BV(?:号|[A-Za-z0-9]+)?\s+)?P(?:号|\d+)\s+(?:mm:ss|\d{1,2}:\d{2}(?::\d{2})?)\s*\]/gi,
      ""
    ).replace(
      /[ \t]*\[\s*BV(?:号|[A-Za-z0-9]+)?\s+(?:mm:ss|\d{1,2}:\d{2}(?::\d{2})?)\s*\]/gi,
      ""
    ).replace(/[ \t]+(?=\r?\n|$)/g, "").trim();
  }
  function sanitizeMermaidTimestampCitationsInMarkdown(markdown) {
    return String(markdown || "").replace(
      /```mermaid\s*\r?\n([\s\S]*?)```/gi,
      (_, code) => `\`\`\`mermaid
${stripMermaidTimestampCitations(code)}
\`\`\``
    );
  }
  function mermaidField(value) {
    return String(value ?? "").trim();
  }
  function isReadyMermaidModel(model) {
    return !!(mermaidField(model?.apiKey) && mermaidField(model?.baseUrl) && mermaidField(model?.model));
  }
  function mergeMermaidRepairModel(base, fill) {
    const next = {};
    const id = mermaidField(base?.id) || mermaidField(fill?.id);
    const name = mermaidField(base?.name) || mermaidField(fill?.name);
    const baseUrl = mermaidField(base?.baseUrl) || mermaidField(fill?.baseUrl);
    const model = mermaidField(base?.model) || mermaidField(fill?.model);
    const apiKey = mermaidField(base?.apiKey) || mermaidField(fill?.apiKey);
    if (id) next.id = id;
    if (name) next.name = name;
    if (baseUrl) next.baseUrl = baseUrl;
    if (model) next.model = model;
    if (apiKey) next.apiKey = apiKey;
    const temperature = base?.temperature ?? fill?.temperature;
    if (temperature !== void 0 && Number.isFinite(Number(temperature))) {
      next.temperature = Number(temperature);
    }
    const maxTokens = base?.maxTokens ?? fill?.maxTokens;
    if (maxTokens !== void 0 && Number.isFinite(Number(maxTokens))) {
      next.maxTokens = Number(maxTokens);
    }
    const stream = base?.stream ?? fill?.stream;
    if (stream !== void 0) next.stream = !!stream;
    return next;
  }
  function missingMermaidFields(model) {
    const missing = [];
    if (!mermaidField(model?.apiKey)) missing.push("apiKey");
    if (!mermaidField(model?.baseUrl)) missing.push("baseUrl");
    if (!mermaidField(model?.model)) missing.push("model");
    return missing;
  }
  function resolveMermaidRepairConfig(input = {}) {
    const profiles = (input.profiles || []).filter(
      (item) => !!item && typeof item === "object"
    );
    const enabledReady = profiles.filter((item) => item.enabled !== false && isReadyMermaidModel(item));
    const anyReady = profiles.filter((item) => isReadyMermaidModel(item));
    const readyProfiles = enabledReady.length ? enabledReady : anyReady;
    const run = input.runConfig && typeof input.runConfig === "object" ? input.runConfig : null;
    const profileId = mermaidField(input.profileId) || mermaidField(run?.id);
    const preferredId = mermaidField(input.preferredProfileId);
    const matched = preferredId && profiles.find((item) => item.id === preferredId) || profileId && profiles.find((item) => item.id === profileId) || null;
    let merged = mergeMermaidRepairModel(run, matched);
    let source = "none";
    if (isReadyMermaidModel(merged)) {
      source = mermaidField(run?.apiKey) ? "run" : matched ? "profile" : "run";
    } else if (readyProfiles[0]) {
      const preferred = preferredId ? readyProfiles.find((item) => item.id === preferredId) : void 0;
      merged = mergeMermaidRepairModel(preferred || readyProfiles[0], null);
      source = "fallback";
    }
    const missing = missingMermaidFields(merged);
    if (missing.length) {
      return { config: Object.keys(merged).length ? merged : null, source: "none", missing, readyProfiles };
    }
    return { config: merged, source, missing: [], readyProfiles };
  }
  function mermaidRepairSetupHint(missing) {
    const list = Array.isArray(missing) ? missing : [];
    if (list.includes("apiKey") && (list.includes("baseUrl") || list.includes("model"))) {
      return "还没有可用的 LLM。在这张图里填写 Base URL / API Key / Model，或打开 设置 → LLM。";
    }
    if (list.includes("apiKey")) return "这个模型还没有 API Key。在这张图里填写，或打开 设置 → LLM。";
    if (list.includes("baseUrl")) return "这个模型还没有 Base URL。在这张图里填写，或打开 设置 → LLM。";
    if (list.includes("model")) return "这个模型还没有 Model 名。在这张图里填写，或打开 设置 → LLM。";
    return "还没有可用的 LLM。打开 设置 → LLM 配好后再重绘。";
  }
  function replaceMermaidBlockAt(markdown, targetIdx, nextCode) {
    let current = -1;
    let replaced = false;
    const value = String(markdown || "").replace(
      /```mermaid\s*\r?\n([\s\S]*?)```/gi,
      (full) => {
        current += 1;
        if (current !== Number(targetIdx)) return full;
        replaced = true;
        return `\`\`\`mermaid
${stripMermaidTimestampCitations(nextCode)}
\`\`\``;
      }
    );
    return { value, replaced };
  }
  function parseSeconds(value) {
    if (value == null) return 0;
    if (typeof value === "number") return value;
    const parsed = Number(String(value).trim().replace(/s$/i, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function toCues(body) {
    return (body ?? []).map((cue, position) => {
      const from = Number(cue.from) || 0;
      const to = Number(cue.to) || 0;
      const sid = cue.sid == null ? Number.NaN : Number(cue.sid);
      return {
        index: Number.isFinite(sid) ? sid : position + 1,
        from: `${from.toFixed(2)}s`,
        to: `${to.toFixed(2)}s`,
        from_sec: from,
        to_sec: to,
        content: String(cue.content || "")
      };
    });
  }
  function formatSrtTimestamp(seconds) {
    const totalMs = Math.round(Math.max(0, seconds) * 1e3);
    const hours = Math.floor(totalMs / 36e5);
    const minuteRemainder = totalMs % 36e5;
    const minutes = Math.floor(minuteRemainder / 6e4);
    const secondRemainder = minuteRemainder % 6e4;
    const secs = Math.floor(secondRemainder / 1e3);
    const milliseconds = secondRemainder % 1e3;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(milliseconds).padStart(3, "0")}`;
  }
  function cuesToSrt(cues) {
    const lines = [];
    let sequence = 0;
    for (const cue of cues) {
      const text = String(cue.content || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
      if (!text) continue;
      sequence += 1;
      lines.push(String(sequence));
      lines.push(
        `${formatSrtTimestamp(parseSeconds(cue.from_sec ?? cue.from))} --> ${formatSrtTimestamp(parseSeconds(cue.to_sec ?? cue.to))}`
      );
      lines.push(text, "");
    }
    return lines.join("\n");
  }
  function cuesToTxt(cues) {
    return cues.map((cue) => String(cue.content || "").trim()).filter(Boolean).join("\n");
  }
  function formatClock(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor(total % 3600 / 60);
    const secs = total % 60;
    return hours > 0 ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}` : `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  function cuesToEvidenceText(cues, context = {}) {
    const sourceId = String(context.sourceId || "source").trim() || "source";
    const segmentId = String(context.segmentId || "").trim();
    const identity = [sourceId, segmentId].filter(Boolean).join(" ");
    const rows2 = [];
    let previous = "";
    for (const cue of cues) {
      const content2 = String(cue.content || "").replace(/\s+/g, " ").trim();
      if (!content2 || content2 === previous) continue;
      previous = content2;
      rows2.push(
        `[${identity} ${formatClock(cue.from_sec ?? parseSeconds(cue.from))}] ${content2}`
      );
    }
    return rows2.join("\n");
  }
  function cuesToAiText(cues, bvid, page) {
    return cuesToEvidenceText(cues, {
      sourceId: bvid || "BV",
      segmentId: `P${Math.max(1, Number(page) || 1)}`
    });
  }
  function preprocessEvidence(item) {
    const sourceId = String(
      item.sourceId || item.bvid || item.source || "source"
    ).trim() || "source";
    const explicitSegment = String(item.segmentId || "").trim();
    const legacySegment = item.bvid || item.page ? `P${Math.max(1, Number(item.page) || 1)}` : "";
    const segmentId = explicitSegment || legacySegment;
    return segmentId ? { sourceId, segmentId } : { sourceId };
  }
  function preprocessSourceKey(item) {
    const legacyBvid = String(item.bvid || "").trim();
    if (!item.sourceId && legacyBvid) {
      return `${legacyBvid}:P${Math.max(1, Number(item.page) || 1)}`;
    }
    const source = String(item.source || "content").trim() || "content";
    const sourceId = String(item.sourceId || legacyBvid || "unknown").trim() || "unknown";
    const segmentId = String(item.segmentId || "").trim();
    return [source, sourceId, ...segmentId ? [segmentId] : []].join(":");
  }
  function cueTextLength(cue, evidence) {
    return `${cuesToEvidenceText([cue], evidence)}
`.length;
  }
  function splitCuesForPreprocess(item, settings2) {
    const cues = (item.data ?? []).filter(
      (cue) => String(cue.content || "").trim()
    );
    if (!cues.length) return [];
    const evidence = preprocessEvidence(item);
    const targetSeconds = Math.max(120, settings2.targetMinutes * 60);
    const overlapSeconds = Math.max(0, settings2.overlapSeconds);
    const hardChars = Math.max(8e3, settings2.maxChars);
    const specs = [];
    let coreStartIndex = 0;
    while (coreStartIndex < cues.length) {
      const firstCue = cues[coreStartIndex];
      if (!firstCue) break;
      const coreStartSeconds = Number(
        firstCue.from_sec ?? parseSeconds(firstCue.from)
      );
      let endIndex = coreStartIndex;
      let chars = 0;
      while (endIndex < cues.length) {
        const cue = cues[endIndex];
        if (!cue) break;
        const nextChars = chars + cueTextLength(cue, evidence);
        const cueEnd = Number(cue.to_sec ?? parseSeconds(cue.to));
        const duration = Math.max(0, cueEnd - coreStartSeconds);
        if (endIndex > coreStartIndex && (nextChars > hardChars || duration >= targetSeconds)) {
          break;
        }
        chars = nextChars;
        endIndex += 1;
      }
      if (endIndex <= coreStartIndex) endIndex = coreStartIndex + 1;
      let overlapStartIndex = coreStartIndex;
      if (specs.length && overlapSeconds > 0) {
        const wanted = coreStartSeconds - overlapSeconds;
        while (overlapStartIndex > 0) {
          const previous = cues[overlapStartIndex - 1];
          if (!previous) break;
          const previousSeconds = Number(
            previous.from_sec ?? parseSeconds(previous.from)
          );
          if (previousSeconds < wanted) break;
          overlapStartIndex -= 1;
        }
      }
      let chunkText = cuesToEvidenceText(
        cues.slice(overlapStartIndex, endIndex),
        evidence
      );
      while (chunkText.length > hardChars && overlapStartIndex < coreStartIndex) {
        overlapStartIndex += 1;
        chunkText = cuesToEvidenceText(
          cues.slice(overlapStartIndex, endIndex),
          evidence
        );
      }
      if (chunkText.length > hardChars) chunkText = chunkText.slice(0, hardChars);
      const overlapCue = cues[overlapStartIndex];
      const lastCue = cues[Math.max(coreStartIndex, endIndex - 1)];
      if (!overlapCue || !lastCue) break;
      specs.push({
        text: chunkText,
        coreStartSec: coreStartSeconds,
        chunkStartSec: Number(
          overlapCue.from_sec ?? parseSeconds(overlapCue.from)
        ),
        endSec: Number(lastCue.to_sec ?? parseSeconds(lastCue.to)),
        coreStartIdx: coreStartIndex,
        overlapStartIdx: overlapStartIndex,
        endIdx: endIndex
      });
      coreStartIndex = endIndex;
    }
    return specs;
  }
  function parseEvidenceTimestampSeconds(text) {
    const match = String(text || "").match(
      /\[[^\]\n]*?\b(?:(\d{1,2}):)?(\d{2}):(\d{2})\]/
    );
    if (!match) return null;
    const hours = Number(match[1] || 0);
    const minutes = Number(match[2] || 0);
    const seconds = Number(match[3] || 0);
    return [hours, minutes, seconds].every(Number.isFinite) ? hours * 3600 + minutes * 60 + seconds : null;
  }
  function trimProcessedOverlap(text, coreStartSec) {
    const source = String(text || "").trim();
    if (!source || !(coreStartSec > 0)) return source;
    const blocks = source.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
    const kept = [];
    let pending = [];
    let sawKeptTimestamp = false;
    let sawAnyTimestamp = false;
    for (const block of blocks) {
      const seconds = parseEvidenceTimestampSeconds(block);
      if (seconds == null) {
        if (sawKeptTimestamp) kept.push(block);
        else pending.push(block);
        continue;
      }
      sawAnyTimestamp = true;
      if (seconds + 0.75 < coreStartSec) {
        pending = [];
        continue;
      }
      if (!sawKeptTimestamp && pending.length) kept.push(...pending);
      pending = [];
      kept.push(block);
      sawKeptTimestamp = true;
    }
    if (!sawAnyTimestamp || !sawKeptTimestamp) return source;
    return kept.join("\n\n").trim();
  }
  function dedupeExactBlocks(text) {
    const seen = /* @__PURE__ */ new Set();
    const output = [];
    for (const block of String(text || "").split(/\n{2,}/).map((value) => value.trim()).filter(Boolean)) {
      const key = block.replace(/\s+/g, " ").trim().toLocaleLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      output.push(block);
    }
    return output.join("\n\n").trim();
  }
  function stitchPreprocessChunks(chunkSpecs, outputs) {
    const parts = [];
    for (let index = 0; index < chunkSpecs.length; index += 1) {
      const spec = chunkSpecs[index];
      if (!spec) continue;
      const cleaned = index === 0 ? String(outputs[index] || "").trim() : trimProcessedOverlap(String(outputs[index] || ""), spec.coreStartSec);
      if (cleaned) parts.push(cleaned);
    }
    return dedupeExactBlocks(parts.join("\n\n"));
  }
  function preprocessCacheKey(item, raw, prompt2, config, settings2) {
    const source = preprocessSourceKey(item);
    const promptSignature = md5(
      `${prompt2.systemPrompt}
---
${prompt2.userPromptTemplate}`
    );
    const modelSignature = md5(
      `${config.baseUrl}|${config.model}|${config.temperature}|${config.maxTokens}`
    );
    const chunkSignature = md5(
      `${settings2.targetMinutes}|${settings2.overlapSeconds}|${settings2.maxChars}`
    );
    return `ai-preprocess:${source}:${md5(raw)}:${promptSignature}:${modelSignature}:${chunkSignature}`;
  }
  const DEFAULT_AI_PROFILE_DEFAULTS = {
    baseUrl: "",
    apiKey: "",
    model: "openai/gpt-oss-120b",
    temperature: 0.4,
    maxTokens: 65536,
    stream: true
  };
  function makePromptProfileId() {
    return `prompt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
  function createPromptProfile(seed, index = 0, createId = makePromptProfileId) {
    const source = seed && typeof seed === "object" ? seed : {};
    const stage = source.stage === "preprocess" ? "preprocess" : source.stage === "knowledge" ? "knowledge" : "postprocess";
    return {
      id: String(source.id || createId()),
      stage,
      name: String(source.name || `提示词 ${index + 1}`).slice(0, 100),
      hint: String(
        source.hint || (stage === "preprocess" ? "字幕预处理" : stage === "knowledge" ? "局部知识追问" : "后处理提示词")
      ).slice(0, 160),
      systemPrompt: String(source.systemPrompt || ""),
      userPromptTemplate: String(source.userPromptTemplate || "")
    };
  }
  function normalizePromptProfiles(input, createId = makePromptProfileId) {
    return (Array.isArray(input) ? input : []).filter((value) => value && typeof value === "object").map((value, index) => createPromptProfile(value, index, createId));
  }
  function resolvePromptActiveIds(prompts, postId, preId, knowledgeId) {
    const posts = prompts.filter((profile2) => profile2.stage === "postprocess");
    const preprocess2 = prompts.filter((profile2) => profile2.stage === "preprocess");
    const knowledge2 = prompts.filter((profile2) => profile2.stage === "knowledge");
    return {
      activeId: posts.some((profile2) => profile2.id === postId) ? postId : posts[0]?.id || "",
      activePreprocessId: preprocess2.some((profile2) => profile2.id === preId) ? preId : preprocess2[0]?.id || "",
      activeKnowledgeId: knowledge2.some((profile2) => profile2.id === knowledgeId) ? knowledgeId : knowledge2[0]?.id || ""
    };
  }
  function makeAiProfileId() {
    return `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
  function createAiProfile(seed, index = 0, defaults = DEFAULT_AI_PROFILE_DEFAULTS, createId = makeAiProfileId) {
    const source = seed && typeof seed === "object" ? seed : {};
    const temperature = Number(source.temperature);
    return {
      id: String(source.id || createId()),
      name: String(
        source.name || source.label || source.model || `模型 ${index + 1}`
      ).slice(0, 80),
      enabled: source.enabled !== false,
      baseUrl: String(source.baseUrl || defaults.baseUrl).trim().replace(/\/+$/, ""),
      apiKey: String(
        source.apiKey != null ? source.apiKey : defaults.apiKey
      ).trim(),
      model: String(source.model || defaults.model).trim(),
      temperature: Number.isFinite(temperature) ? temperature : defaults.temperature,
      maxTokens: Math.max(
        256,
        Math.min(
          128e3,
          Math.floor(Number(source.maxTokens) || defaults.maxTokens)
        )
      ),
      stream: !(source.stream === false || source.stream === "false" || source.stream === 0)
    };
  }
  function normalizeAiProfiles(input, defaults = DEFAULT_AI_PROFILE_DEFAULTS, createId = makeAiProfileId) {
    const list = Array.isArray(input) ? input : [];
    const normalized = list.filter((value) => value && typeof value === "object").map((value, index) => createAiProfile(value, index, defaults, createId));
    return normalized.length ? normalized : [createAiProfile(defaults, 0, defaults, createId)];
  }
  const PROMPT_KEYS = [
    "title",
    "source",
    "sourceId",
    "segmentId",
    "bvid",
    "author",
    "subtitle",
    "rawSubtitle",
    "processedSubtitle",
    "chunkIndex",
    "chunkCount",
    "chunkStart",
    "coreStart",
    "chunkEnd",
    "anchorText",
    "sourceContext",
    "ancestorPath",
    "question"
  ];
  const PROMPT_KEY_PATTERN = /\{\{\s*(title|source|sourceId|segmentId|bvid|author|subtitle|rawSubtitle|processedSubtitle|chunkIndex|chunkCount|chunkStart|coreStart|chunkEnd|anchorText|sourceContext|ancestorPath|question)\s*\}\}/g;
  function renderPromptTemplate(template, variables) {
    const values = Object.fromEntries(
      // Legacy uses `value || ""`; retain false/zero compatibility while the
      // new chunk boundary variables extend the supported key set.
      PROMPT_KEYS.map((key) => [key, String(variables?.[key] || "")])
    );
    return String(template || "").replace(
      PROMPT_KEY_PATTERN,
      (_, key) => values[key] ?? ""
    );
  }
  const CORE_VERSION = "0.6.0";
  const ai$1 = {
    extractText: extractAssistantText,
    extractChoice: extractFromChoice,
    display: formatAiDisplay,
    truncateInput: truncateForAi,
    parseSseLine: parseSseDataLine
  };
  const aiSession = {
    ttlMs: aiSessionCacheTtlMs,
    cacheKey: aiSessionCacheKey,
    shouldAutoRestore: shouldRestoreAutomaticAiSession,
    hasCache: isUsableAiSessionCache,
    serializeRun: serializeAiRunForCache,
    serializePreprocess: serializePreprocessRunForCache,
    sanitizeInput: sanitizeSessionInputForCache,
    buildCache: buildAiSessionCachePayload,
    resolveActiveRun: resolveRestoredActiveRunId,
    hydrateRun: draftHydratedAiRun,
    inputHash: aiSessionInputHash,
    runKey: aiRunIdentityKey,
    partitionRuns: partitionPlannedAiRuns,
    shouldSkipPrepare: shouldSkipPrepareForCachedSession,
    hydratePreprocess: draftHydratedPreprocessRun
  };
  const command = {
    shortcuts: SHORTCUT_COMMANDS
  };
  const subtitleExport = {
    root: SUBTITLE_EXPORT_ROOT,
    indexName: SUBTITLE_EXPORT_INDEX_NAME,
    videoUrl: buildVideoShortUrl,
    videoKey: videoIndexKey,
    safeSegment: safePathSegment,
    fileName: joinFileName,
    seriesTitle: resolveSeriesTitle,
    partLabel: resolvePartLabel,
    fileStem: resolveSubtitleFileStem,
    folderName: resolveExportFolderName,
    folderSegments: resolveExportFolderSegments,
    buildPath: buildSubtitleExportRelativePath,
    indexPath: buildSubtitleExportIndexPath,
    collectionKey: collectionIndexKey,
    parseIndex: parseExportIndexMd,
    upsertVideo: upsertVideoExportIndex,
    upsertIndex: upsertExportIndexMap,
    upsertCollection: upsertCollectionExportIndex,
    renderIndex: renderExportIndexMd,
    normalizeItem: normalizeExportItem,
    indexVideoTitle: resolveIndexVideoTitle,
    upsertItem: upsertIndexForExportItem,
    describe: describeSubtitleExport
  };
  const folio = {
    slugHeading: slugFolioHeading,
    normalizeLevel: normalizeFolioHeadingLevel,
    buildOutline: buildFolioOutline,
    flattenOutline: flattenFolioOutline,
    countOutline: countFolioOutline,
    chapterIndex: formatFolioChapterIndex,
    summary: folioOutlineSummary
  };
  const knowledge$1 = {
    parse: parseKnowledgeOutput,
    branchContext: knowledgeBranchContext
  };
  const library = {
    group: {
      upFolderLabel: buildUpFolderLabel,
      collectionUrl: buildCollectionShortUrl,
      inferType: inferLibraryGroupType,
      spaceKey: resolveSpaceGroupKey,
      groupKey: resolveLibraryGroupKey,
      looseKey: resolveSpaceLooseVideosKey,
      isLooseKey: isSpaceLooseVideosKey,
      folderLabel: resolveLibraryFolderLabel,
      folderSegments: resolveFolderSegments,
      renderNodes: buildLibraryRenderNodes,
      setSelection: setGroupSelection
    },
    meta: {
      attachUserSpace: attachUserSpaceGroupMeta,
      attachLooseVideos: attachSpaceLooseVideosMeta,
      attachSelection: attachSelectionGroupMeta,
      attachCollection: attachCollectionGroupMeta,
      applyUgcSeason: applyUgcSeasonToItem,
      applyUgcSeasons: applyUgcSeasonToItems,
      applyCollectionMembership: applySpaceCollectionMembership,
      countCollectionMatches: countSpaceCollectionMatches,
      buildPatches: buildGroupMetaPatches,
      applyPatch: applyGroupMetaPatchToItems,
      mergeFields: mergeGroupFields,
      refreshFolder: refreshGroupFolder,
      suggestCaptureMode
    }
  };
  const mermaid$1 = {
    stripCitations: stripMermaidTimestampCitations,
    sanitizeMarkdown: sanitizeMermaidTimestampCitationsInMarkdown,
    resolveRepair: resolveMermaidRepairConfig,
    repairHint: mermaidRepairSetupHint,
    replaceBlock: replaceMermaidBlockAt
  };
  const preprocess$1 = {
    splitCues: splitCuesForPreprocess,
    parseTimestamp: parseEvidenceTimestampSeconds,
    trimOverlap: trimProcessedOverlap,
    dedupeBlocks: dedupeExactBlocks,
    stitchChunks: stitchPreprocessChunks,
    cacheKey: preprocessCacheKey
  };
  const profile = {
    prompt: {
      makeId: makePromptProfileId,
      create: createPromptProfile,
      normalize: normalizePromptProfiles,
      resolveActive: resolvePromptActiveIds
    },
    ai: {
      defaults: DEFAULT_AI_PROFILE_DEFAULTS,
      makeId: makeAiProfileId,
      create: createAiProfile,
      normalize: normalizeAiProfiles
    }
  };
  const prompt = {
    render: renderPromptTemplate
  };
  const transcript$1 = {
    parseSeconds,
    toCues,
    srtTimestamp: formatSrtTimestamp,
    toSrt: cuesToSrt,
    toTxt: cuesToTxt,
    clock: formatClock,
    toEvidenceText: cuesToEvidenceText,
    toAiText: cuesToAiText
  };
  const core = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    AI_SESSION_CACHE_PREFIX,
    AI_SESSION_CACHE_TTL_MS,
    CORE_VERSION,
    DEFAULT_AI_INPUT_MAX_CHARS,
    DEFAULT_AI_PROFILE_DEFAULTS,
    PROMPT_KEYS,
    SHORTCUT_COMMANDS,
    SPACE_LOOSE_VIDEOS_FOLDER,
    SUBTITLE_EXPORT_INDEX_NAME,
    SUBTITLE_EXPORT_ROOT,
    ai: ai$1,
    aiRunIdentityKey,
    aiSession,
    aiSessionCacheKey,
    aiSessionCacheTtlMs,
    aiSessionInputHash,
    applyGroupMetaPatchToItems,
    applySpaceCollectionMembership,
    applyUgcSeasonToItem,
    applyUgcSeasonToItems,
    attachCollectionGroupMeta,
    attachSelectionGroupMeta,
    attachSpaceLooseVideosMeta,
    attachUserSpaceGroupMeta,
    buildAiSessionCachePayload,
    buildCollectionShortUrl,
    buildFolioOutline,
    buildGroupMetaPatches,
    buildLibraryRenderNodes,
    buildSubtitleExportIndexPath,
    buildSubtitleExportRelativePath,
    buildUpFolderLabel,
    buildVideoShortUrl,
    collectionIndexKey,
    command,
    countFolioOutline,
    countSpaceCollectionMatches,
    createAiProfile,
    createPromptProfile,
    cuesToAiText,
    cuesToEvidenceText,
    cuesToSrt,
    cuesToTxt,
    dedupeExactBlocks,
    describeSubtitleExport,
    draftHydratedAiRun,
    draftHydratedPreprocessRun,
    extractAssistantText,
    extractFromChoice,
    flattenFolioOutline,
    folio,
    folioOutlineSummary,
    formatAiDisplay,
    formatClock,
    formatFolioChapterIndex,
    formatSrtTimestamp,
    inferLibraryGroupType,
    isSpaceLooseVideosKey,
    isUsableAiSessionCache,
    joinFileName,
    knowledge: knowledge$1,
    knowledgeBranchContext,
    library,
    makeAiProfileId,
    makePromptProfileId,
    md5,
    mergeGroupFields,
    mermaid: mermaid$1,
    mermaidRepairSetupHint,
    normalizeAiProfiles,
    normalizeExportItem,
    normalizeFolioHeadingLevel,
    normalizePromptProfiles,
    parseEvidenceTimestampSeconds,
    parseExportIndexMd,
    parseKnowledgeOutput,
    parseSeconds,
    parseSseDataLine,
    partitionPlannedAiRuns,
    preprocess: preprocess$1,
    preprocessCacheKey,
    profile,
    prompt,
    refreshGroupFolder,
    renderExportIndexMd,
    renderPromptTemplate,
    replaceMermaidBlockAt,
    resolveExportFolderName,
    resolveExportFolderSegments,
    resolveFolderSegments,
    resolveIndexVideoTitle,
    resolveLibraryFolderLabel,
    resolveLibraryGroupKey,
    resolveMermaidRepairConfig,
    resolvePartLabel,
    resolvePromptActiveIds,
    resolveRestoredActiveRunId,
    resolveSeriesTitle,
    resolveSpaceGroupKey,
    resolveSpaceLooseVideosKey,
    resolveSubtitleFileStem,
    safePathSegment,
    sanitizeMermaidTimestampCitationsInMarkdown,
    sanitizeSessionInputForCache,
    serializeAiRunForCache,
    serializePreprocessRunForCache,
    setGroupSelection,
    shouldRestoreAutomaticAiSession,
    shouldSkipPrepareForCachedSession,
    slugFolioHeading,
    splitCuesForPreprocess,
    stitchPreprocessChunks,
    stripMermaidTimestampCitations,
    subtitleExport,
    suggestCaptureMode,
    toCues,
    transcript: transcript$1,
    trimProcessedOverlap,
    truncateForAi,
    upsertCollectionExportIndex,
    upsertExportIndexMap,
    upsertIndexForExportItem,
    upsertVideoExportIndex,
    videoIndexKey
  }, Symbol.toStringTag, { value: "Module" }));
  function create(host2) {
    return {
      storage: {
        async get(key, fallback) {
          const value = await host2.storageGet(key, fallback);
          return value === void 0 ? fallback : value;
        },
        async set(key, value) {
          await host2.storageSet(key, value);
        },
        async remove(key) {
          await host2.storageRemove(key);
        }
      },
      network: {
        request(url, request2) {
          return host2.request(url, request2);
        },
        async json(url, request2) {
          const response = await host2.request(url, request2);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${url}`);
          }
          return JSON.parse(response.text);
        }
      },
      clipboard: {
        async writeText(text) {
          await host2.writeClipboard(text);
        }
      },
      style: {
        add(css) {
          host2.addStyle(css);
        }
      },
      shortcuts: {
        register(bindings2, options) {
          return host2.registerShortcuts(bindings2, options);
        }
      },
      page: {
        href: () => host2.pageHref(),
        window: () => host2.pageWindow,
        onNavigate: (listener) => host2.onNavigate(listener)
      }
    };
  }
  const historyPatches = /* @__PURE__ */ new WeakMap();
  function subscribeHistoryPatch(history, callback) {
    let patch = historyPatches.get(history);
    if (!patch) {
      const originalPush = history.pushState;
      const originalReplace = history.replaceState;
      const callbacks = /* @__PURE__ */ new Set();
      const notify = () => {
        for (const subscriber of [...callbacks]) subscriber();
      };
      const wrappedPush = function wrappedPush2(...args) {
        const result = originalPush.apply(this, args);
        notify();
        return result;
      };
      const wrappedReplace = function wrappedReplace2(...args) {
        const result = originalReplace.apply(this, args);
        notify();
        return result;
      };
      patch = {
        originalPush,
        originalReplace,
        wrappedPush,
        wrappedReplace,
        callbacks
      };
      history.pushState = wrappedPush;
      history.replaceState = wrappedReplace;
      historyPatches.set(history, patch);
    }
    patch.callbacks.add(callback);
    return () => {
      const current = historyPatches.get(history);
      if (!current) return;
      current.callbacks.delete(callback);
      if (current.callbacks.size) return;
      if (history.pushState === current.wrappedPush) {
        history.pushState = current.originalPush;
      }
      if (history.replaceState === current.wrappedReplace) {
        history.replaceState = current.originalReplace;
      }
      historyPatches.delete(history);
    };
  }
  function observe$1(options, listener) {
    const historyWindow = options.historyWindow;
    const eventWindow = options.eventWindow ?? historyWindow;
    const documentRef = options.documentRef ?? null;
    const getHref = options.getHref ?? (() => String(eventWindow.location?.href || historyWindow.location?.href || ""));
    const pollIntervalMs = options.pollIntervalMs === void 0 ? 2e3 : options.pollIntervalMs;
    const setIntervalFn = options.setIntervalFn ?? setInterval;
    const clearIntervalFn = options.clearIntervalFn ?? clearInterval;
    const setTimeoutFn = options.setTimeoutFn ?? setTimeout;
    let lastHref = getHref();
    let disposed = false;
    const check = () => {
      if (disposed) return;
      const href = getHref();
      if (href === lastHref) return;
      lastHref = href;
      listener();
    };
    const scheduleCheck = () => {
      setTimeoutFn(() => check(), 0);
    };
    const unsubscribeHistory = subscribeHistoryPatch(
      historyWindow.history,
      scheduleCheck
    );
    const onPopState = () => check();
    const onHashChange = () => check();
    const onPageShow = () => check();
    const onVisibility = () => {
      if (!documentRef || documentRef.visibilityState === "visible") check();
    };
    eventWindow.addEventListener("popstate", onPopState);
    eventWindow.addEventListener("hashchange", onHashChange);
    eventWindow.addEventListener("pageshow", onPageShow);
    documentRef?.addEventListener("visibilitychange", onVisibility);
    let pollTimer = null;
    if (pollIntervalMs > 0) {
      pollTimer = setIntervalFn(() => {
        if (!documentRef || documentRef.visibilityState === "visible") check();
      }, pollIntervalMs);
    }
    return {
      check,
      dispose: () => {
        if (disposed) return;
        disposed = true;
        unsubscribeHistory();
        eventWindow.removeEventListener("popstate", onPopState);
        eventWindow.removeEventListener("hashchange", onHashChange);
        eventWindow.removeEventListener("pageshow", onPageShow);
        documentRef?.removeEventListener("visibilitychange", onVisibility);
        if (pollTimer != null) clearIntervalFn(pollTimer);
      }
    };
  }
  function chordFromEvent(event) {
    const code = String(event.code || "");
    if (!code || /^(Control|Shift|Alt|Meta)(Left|Right)?$/.test(code)) return "";
    const parts = [];
    if (event.ctrlKey) parts.push("Ctrl");
    if (event.altKey) parts.push("Alt");
    if (event.shiftKey) parts.push("Shift");
    if (event.metaKey) parts.push("Meta");
    parts.push(code);
    return parts.join("+");
  }
  function keyLabel(code) {
    const value = String(code || "");
    if (/^Key[A-Z]$/.test(value)) return value.slice(3);
    if (/^Digit[0-9]$/.test(value)) return value.slice(5);
    if (/^Numpad[0-9]$/.test(value)) return `Num ${value.slice(6)}`;
    const labels = {
      Space: "Space",
      Enter: "Enter",
      Tab: "Tab",
      Escape: "Esc",
      Backspace: "Backspace",
      Delete: "Delete",
      ArrowUp: "↑",
      ArrowDown: "↓",
      ArrowLeft: "←",
      ArrowRight: "→",
      Minus: "-",
      Equal: "=",
      BracketLeft: "[",
      BracketRight: "]",
      Semicolon: ";",
      Quote: "'",
      Comma: ",",
      Period: ".",
      Slash: "/",
      Backslash: "\\",
      Backquote: "`",
      Home: "Home",
      End: "End",
      PageUp: "PgUp",
      PageDown: "PgDn",
      Insert: "Insert"
    };
    if (labels[value]) return labels[value];
    if (/^F\d{1,2}$/.test(value)) return value;
    return value.replace(/^(Arrow|Numpad)/, "") || value;
  }
  function display(chord) {
    const parts = String(chord || "").split("+").filter(Boolean);
    if (!parts.length) return "未绑定";
    return parts.map(
      (part) => ["Ctrl", "Alt", "Shift", "Meta"].includes(part) ? part : keyLabel(part)
    ).join(" + ");
  }
  function hasStrongModifier(chord) {
    const parts = new Set(String(chord || "").split("+"));
    return parts.has("Ctrl") || parts.has("Alt") || parts.has("Meta");
  }
  function isEditableTarget(target) {
    if (!target || typeof target.closest !== "function") return false;
    return !!target.closest(
      'input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]'
    );
  }
  function shouldIgnore(event, options = {}) {
    if (options.enabled === false) return true;
    if (event.repeat || event.isComposing) return true;
    if (event.getModifierState?.("AltGraph")) return true;
    if (isEditableTarget(event.target ?? null)) return true;
    return false;
  }
  function register(bindings2, options = {}) {
    const target = options.target;
    if (!target) {
      throw new Error("shortcut.register requires a target EventTarget");
    }
    const capture = options.capture !== false;
    const protectInput = options.protectInput !== false;
    const stopOnMatch = options.stopOnMatch !== false;
    const enabled = options.enabled !== false;
    const listener = (event) => {
      if (protectInput && shouldIgnore(event, { enabled })) return;
      if (!protectInput && options.enabled === false) return;
      const chord = chordFromEvent(event);
      if (!chord) return;
      const binding = bindings2.find((candidate) => candidate.chord === chord);
      if (!binding) return;
      if (stopOnMatch) {
        const native = event;
        native.preventDefault?.();
        native.stopImmediatePropagation?.();
      }
      try {
        void Promise.resolve(binding.handler()).catch((error) => {
          options.onError?.(error);
        });
      } catch (error) {
        options.onError?.(error);
      }
    };
    target.addEventListener("keydown", listener, capture);
    return () => target.removeEventListener("keydown", listener, capture);
  }
  function createKnowledgeDb(factory, settings2) {
    let pending = null;
    function open() {
      if (pending) return pending;
      pending = new Promise((resolve2, reject) => {
        if (!factory) {
          reject(new Error("IndexedDB unavailable"));
          return;
        }
        const req = factory.open(settings2.name, settings2.version);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(settings2.anchorStore)) {
            const store = db.createObjectStore(settings2.anchorStore, { keyPath: "id" });
            store.createIndex("sourceKey", "sourceKey", { unique: false });
            store.createIndex("updatedAt", "updatedAt", { unique: false });
          }
          if (!db.objectStoreNames.contains(settings2.nodeStore)) {
            const store = db.createObjectStore(settings2.nodeStore, { keyPath: "id" });
            store.createIndex("anchorId", "anchorId", { unique: false });
            store.createIndex("parentId", "parentId", { unique: false });
            store.createIndex("updatedAt", "updatedAt", { unique: false });
          }
        };
        req.onblocked = () => reject(new Error("Knowledge 数据库升级被其他标签页阻塞"));
        req.onerror = () => reject(req.error || new Error("Knowledge DB open failed"));
        req.onsuccess = () => {
          const db = req.result;
          db.onversionchange = () => {
            db.close();
            pending = null;
          };
          resolve2(db);
        };
      }).catch((error) => {
        pending = null;
        throw error;
      });
      return pending;
    }
    async function request2(storeName, mode, handler) {
      const db = await open();
      return new Promise((resolve2, reject) => {
        let tx;
        try {
          tx = db.transaction(storeName, mode);
        } catch (error) {
          reject(error);
          return;
        }
        let value;
        let settled = false;
        const rejectOnce = (error) => {
          if (settled) return;
          settled = true;
          reject(error || tx.error || new Error("Knowledge transaction failed"));
        };
        tx.oncomplete = () => {
          if (settled) return;
          settled = true;
          resolve2(value);
        };
        tx.onerror = () => rejectOnce(tx.error);
        tx.onabort = () => rejectOnce(tx.error || new Error("Knowledge transaction aborted"));
        try {
          const result = handler(tx.objectStore(storeName));
          if (result && typeof result === "object" && "onsuccess" in result) {
            const req = result;
            req.onsuccess = () => {
              value = req.result;
            };
            req.onerror = () => rejectOnce(req.error);
          } else {
            value = result;
          }
        } catch (error) {
          try {
            tx.abort();
          } catch {
          }
          rejectOnce(error);
        }
      });
    }
    async function deleteAnchor(anchorId) {
      const db = await open();
      await new Promise((resolve2, reject) => {
        let tx;
        try {
          tx = db.transaction([settings2.anchorStore, settings2.nodeStore], "readwrite");
        } catch (error) {
          reject(error);
          return;
        }
        let settled = false;
        const rejectOnce = (error) => {
          if (settled) return;
          settled = true;
          reject(error || tx.error || new Error("Knowledge delete failed"));
        };
        tx.oncomplete = () => {
          if (settled) return;
          settled = true;
          resolve2();
        };
        tx.onerror = () => rejectOnce(tx.error);
        tx.onabort = () => rejectOnce(tx.error || new Error("Knowledge delete aborted"));
        try {
          const nodes = tx.objectStore(settings2.nodeStore).index("anchorId");
          const cursorRequest = nodes.openCursor(IDBKeyRange.only(anchorId));
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (!cursor) return;
            cursor.delete();
            cursor.continue();
          };
          cursorRequest.onerror = () => rejectOnce(cursorRequest.error);
          tx.objectStore(settings2.anchorStore).delete(anchorId);
        } catch (error) {
          try {
            tx.abort();
          } catch {
          }
          rejectOnce(error);
        }
      });
    }
    return { open, request: request2, deleteAnchor };
  }
  const userscript = {
    create
  };
  const spa = {
    observe: observe$1
  };
  const knowledgeDb = {
    create: createKnowledgeDb
  };
  const shortcut = {
    chordFromEvent,
    keyLabel,
    display,
    hasStrongModifier,
    isEditableTarget,
    shouldIgnore,
    register
  };
  const YOUTUBE_SOURCE = "youtube";
  const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
  function validVideoId(value) {
    const id = String(value || "").trim();
    return VIDEO_ID_PATTERN.test(id) ? id : "";
  }
  function isYoutubeHost(hostname) {
    const host2 = String(hostname || "").toLowerCase();
    return host2 === "youtube.com" || host2.endsWith(".youtube.com") || host2 === "youtu.be" || host2.endsWith(".youtu.be");
  }
  function matchesYoutubeUrl(href) {
    try {
      return isYoutubeHost(new URL(href).hostname);
    } catch {
      return false;
    }
  }
  function extractVideoRef(href) {
    let url;
    try {
      url = new URL(href);
    } catch {
      return null;
    }
    if (!isYoutubeHost(url.hostname)) return null;
    const host2 = url.hostname.toLowerCase();
    if (host2 === "youtu.be" || host2.endsWith(".youtu.be")) {
      const id = validVideoId(url.pathname.split("/").filter(Boolean)[0]);
      return id ? { videoId: id, kind: "shortlink" } : null;
    }
    if (url.pathname === "/watch") {
      const id = validVideoId(url.searchParams.get("v"));
      return id ? { videoId: id, kind: "watch" } : null;
    }
    for (const [prefix, kind] of [
      ["/shorts/", "shorts"],
      ["/live/", "live"],
      ["/embed/", "embed"]
    ]) {
      if (!url.pathname.startsWith(prefix)) continue;
      const id = validVideoId(url.pathname.slice(prefix.length).split("/")[0]);
      return id ? { videoId: id, kind } : null;
    }
    return null;
  }
  function videoWatchUrl(videoId) {
    const id = validVideoId(videoId);
    return id ? `https://www.youtube.com/watch?v=${id}` : "";
  }
  function record$3(value) {
    return value && typeof value === "object" ? value : null;
  }
  function textOf$1(value) {
    const root = record$3(value);
    if (!root) return String(value || "").trim();
    const simple = String(root.simpleText || "").trim();
    if (simple) return simple;
    const runs = Array.isArray(root.runs) ? root.runs : [];
    return runs.map((run) => String(record$3(run)?.text || "")).join("").trim();
  }
  function videoDetails(response) {
    const root = record$3(response);
    const nested2 = record$3(root?.playerResponse);
    const details = record$3(root?.videoDetails) ?? record$3(nested2?.videoDetails);
    const videoId = String(details?.videoId || "").trim();
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
    const title = String(details?.title || "").trim();
    const author = String(details?.author || "").trim();
    return {
      videoId,
      ...title ? { title } : {},
      ...author ? { author } : {}
    };
  }
  function runtimePlayerResponse(runtime2, expectedVideoId) {
    const root = record$3(runtime2);
    if (!root) return null;
    const direct = root.ytInitialPlayerResponse;
    const ytplayer = record$3(root.ytplayer);
    const config = record$3(ytplayer?.config);
    const args = record$3(config?.args);
    const candidates = [direct];
    const serialized = args?.player_response;
    if (typeof serialized === "string" && serialized.trim()) {
      try {
        candidates.push(JSON.parse(serialized));
      } catch {
      }
    }
    for (const candidate of candidates) {
      const details = videoDetails(candidate);
      if (!details) continue;
      if (expectedVideoId && details.videoId !== expectedVideoId) continue;
      return candidate;
    }
    return null;
  }
  function resolveCurrentVideo(href, runtime2) {
    const route2 = extractVideoRef(href);
    if (!route2) return null;
    const response = runtimePlayerResponse(runtime2, route2.videoId);
    const details = response ? videoDetails(response) : null;
    return {
      videoId: route2.videoId,
      kind: route2.kind,
      ...details?.title ? { title: details.title } : {},
      ...details?.author ? { author: details.author } : {},
      ...response ? { playerResponse: response } : {}
    };
  }
  function balancedJson(source, start2) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start2; index < source.length; index += 1) {
      const char = source[index];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }
      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) return source.slice(start2, index + 1);
      }
    }
    return "";
  }
  function playerResponseFromHtml(html) {
    const source = String(html || "");
    const markers = [
      "ytInitialPlayerResponse =",
      "ytInitialPlayerResponse=",
      'window["ytInitialPlayerResponse"] =',
      'window["ytInitialPlayerResponse"]='
    ];
    for (const marker of markers) {
      let offset = source.indexOf(marker);
      while (offset >= 0) {
        const objectStart = source.indexOf("{", offset + marker.length);
        if (objectStart < 0) break;
        const json = balancedJson(source, objectStart);
        if (json) {
          try {
            const parsed = JSON.parse(json);
            if (videoDetails(parsed)) return parsed;
          } catch {
          }
        }
        offset = source.indexOf(marker, offset + marker.length);
      }
    }
    return null;
  }
  function captionTracks(response) {
    const root = record$3(response);
    const nested2 = record$3(root?.playerResponse);
    const captions = record$3(root?.captions) ?? record$3(nested2?.captions);
    const renderer = record$3(captions?.playerCaptionsTracklistRenderer);
    const tracks = Array.isArray(renderer?.captionTracks) ? renderer.captionTracks : [];
    return tracks.flatMap((value) => {
      const track = record$3(value);
      const baseUrl = String(track?.baseUrl || "").trim();
      const languageCode = String(track?.languageCode || "").trim();
      if (!baseUrl || !languageCode) return [];
      const name = textOf$1(track?.name) || languageCode;
      const kind = String(track?.kind || "").trim();
      const vssId = String(track?.vssId || "").trim();
      return [{
        baseUrl,
        languageCode,
        name,
        ...kind ? { kind } : {},
        ...vssId ? { vssId } : {},
        ...typeof track?.isTranslatable === "boolean" ? { isTranslatable: track.isTranslatable } : {}
      }];
    });
  }
  function languageScore(languageCode, preferred) {
    const code = languageCode.toLowerCase();
    for (let index = 0; index < preferred.length; index += 1) {
      const wanted = String(preferred[index] || "").toLowerCase();
      if (!wanted) continue;
      if (code === wanted) return 1e3 - index * 10;
      const codeBase = code.split("-")[0];
      const wantedBase = wanted.split("-")[0];
      if (codeBase && wantedBase && codeBase === wantedBase) {
        return 500 - index * 10;
      }
    }
    return 0;
  }
  function pickCaptionTrack(tracks, preferredLanguages2 = []) {
    if (!tracks?.length) return null;
    return [...tracks].sort((a, b) => {
      const language = languageScore(b.languageCode, preferredLanguages2) - languageScore(a.languageCode, preferredLanguages2);
      if (language) return language;
      const manualA = a.kind === "asr" ? 0 : 1;
      const manualB = b.kind === "asr" ? 0 : 1;
      return manualB - manualA;
    })[0] ?? null;
  }
  function captionJson3Url(track) {
    const raw = String(track?.baseUrl || "").trim();
    if (!raw) return "";
    try {
      const url = new URL(raw);
      url.searchParams.set("fmt", "json3");
      return url.toString();
    } catch {
      return raw + (raw.includes("?") ? "&" : "?") + "fmt=json3";
    }
  }
  function parseJson3Transcript(payload) {
    const root = record$3(payload);
    const events = Array.isArray(root?.events) ? root.events : [];
    const segments = [];
    for (let index = 0; index < events.length; index += 1) {
      const event = record$3(events[index]);
      if (!event) continue;
      const pieces = Array.isArray(event.segs) ? event.segs : [];
      const text = pieces.map((piece) => String(record$3(piece)?.utf8 || "")).join("").replace(/\s+/g, " ").trim();
      if (!text) continue;
      const startMs = Number(event.tStartMs);
      if (!Number.isFinite(startMs)) continue;
      const durationMs = Number(event.dDurationMs);
      const start2 = startMs / 1e3;
      const end = Number.isFinite(durationMs) && durationMs >= 0 ? (startMs + durationMs) / 1e3 : void 0;
      segments.push({
        id: String(index + 1),
        start: start2,
        ...end !== void 0 ? { end } : {},
        text
      });
    }
    return segments;
  }
  const youtube = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    YOUTUBE_SOURCE,
    captionJson3Url,
    captionTracks,
    extractVideoRef,
    isYoutubeHost,
    matchesYoutubeUrl,
    parseJson3Transcript,
    pickCaptionTrack,
    playerResponseFromHtml,
    resolveCurrentVideo,
    runtimePlayerResponse,
    videoDetails,
    videoWatchUrl
  }, Symbol.toStringTag, { value: "Module" }));
  function record$2(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
  }
  const str = (value) => String(value ?? "");
  const num = (value) => {
    const converted = Number(value);
    return Number.isFinite(converted) ? converted : 0;
  };
  function optionalNumber(value) {
    if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return void 0;
    const converted = Number(value);
    return Number.isFinite(converted) ? converted : void 0;
  }
  function row(value) {
    const o = record$2(value);
    const owner = record$2(o.owner);
    const upper = record$2(o.upper);
    return {
      bvid: str(o.bvid),
      bv_id: str(o.bv_id),
      aid: num(o.aid),
      id: num(o.id),
      title: str(o.title),
      author: str(o.author),
      up_name: str(o.up_name),
      arcurl: str(o.arcurl),
      type: num(o.type),
      owner: { name: str(owner.name) },
      upper: { name: str(upper.name) }
    };
  }
  const rows = (input) => Array.isArray(input) ? input.map(row) : [];
  function parseListResponse(value) {
    const payload = record$2(value);
    const code = optionalNumber(payload.code);
    if (code === void 0 || !Number.isInteger(code)) {
      throw new Error("Bilibili 列表响应缺少有效 code");
    }
    const data = record$2(payload.data), list = record$2(data.list);
    const page = record$2(data.page), info = record$2(data.info), meta = record$2(data.meta);
    const metaUpper = record$2(meta.upper);
    const pagination = {};
    for (const key of ["pn", "ps", "count", "total"]) {
      const value2 = optionalNumber(page[key]);
      if (value2 !== void 0 && value2 >= 0) pagination[key] = value2;
    }
    return {
      code,
      message: str(payload.message),
      data: {
        list: { vlist: rows(list.vlist) },
        page: pagination,
        medias: rows(data.medias),
        archives: rows(data.archives),
        result: rows(data.result),
        has_more: data.has_more === true,
        numPages: num(data.numPages),
        numResults: num(data.numResults),
        info: { title: str(info.title) },
        meta: {
          name: str(meta.name),
          title: str(meta.title),
          author: str(meta.author),
          name_upper: str(meta.name_upper),
          upper: { name: str(metaUpper.name) }
        }
      }
    };
  }
  function validateContext(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("缺少扫描上下文，请打开 Bilibili 页面后重试");
    }
    const ctx = value;
    switch (ctx.type) {
      case "video":
      case "selection":
        if (!ctx.bvid) throw new Error("缺少 BV 号。请打开视频页，或切到「单个视频/视频选集」后重试");
        break;
      case "user":
        if (!ctx.mid) throw new Error("缺少 mid。请打开个人主页，或模式选「个人主页」");
        break;
      case "collection":
        if (!ctx.mid || !ctx.season_id) {
          throw new Error("合集需要 mid + season_id。请打开合集页（space/lists 或 /list/{mid}?sid=），或从合集内视频页切到「合集」后重试");
        }
        break;
      case "favorite":
        if (!ctx.media_id) throw new Error("收藏夹需要 fid/media_id。请打开带 fid 的收藏夹页");
        break;
      case "search":
        if (!ctx.keyword) throw new Error("搜索需要 keyword。请打开搜索结果页");
        break;
      case "unknown":
        throw new Error("未能识别页面。可手动选择模式：单个视频 / 视频选集 / 个人主页 / 收藏夹 / 合集 / 搜索页");
    }
  }
  function pageSizeFor(mode) {
    return mode === "favorite" ? 20 : mode === "search" ? 42 : 30;
  }
  function reorderIds(ids, fromId, toId) {
    const list = Array.isArray(ids) ? ids.map(String) : [];
    const from = list.indexOf(String(fromId || ""));
    const to = list.indexOf(String(toId || ""));
    if (from < 0 || to < 0 || from === to) return list;
    const next = list.slice();
    const [item] = next.splice(from, 1);
    if (item === void 0) return list;
    next.splice(to, 0, item);
    return next;
  }
  function applyConfigIdOrder(items, orderedIds) {
    const list = Array.isArray(items) ? [...items] : [];
    const byId = new Map(list.map((item) => [String(item.id), item]));
    const seen = /* @__PURE__ */ new Set();
    const next = [];
    for (const id of orderedIds || []) {
      const hit = byId.get(String(id));
      if (!hit || seen.has(hit.id)) continue;
      seen.add(hit.id);
      next.push(hit);
    }
    for (const item of list) if (!seen.has(item.id)) next.push(item);
    return next;
  }
  function applyPromptStageOrder(prompts, stage, orderedIds) {
    const list = Array.isArray(prompts) ? [...prompts] : [];
    const byId = new Map(list.map((item) => [String(item.id), item]));
    const ordered = [];
    const seen = /* @__PURE__ */ new Set();
    for (const id of orderedIds || []) {
      const hit = byId.get(String(id));
      if (!hit || hit.stage !== stage || seen.has(hit.id)) continue;
      seen.add(hit.id);
      ordered.push(hit);
    }
    for (const item of list) {
      if (item.stage === stage && !seen.has(item.id)) ordered.push(item);
    }
    let index = 0;
    return list.map((item) => item.stage === stage ? ordered[index++] || item : item);
  }
  function assertScanActive(cancelled) {
    if (!cancelled()) return;
    const error = new Error("扫描已取消");
    error.name = "AbortError";
    throw error;
  }
  async function collectPages(config, ports) {
    const all = [];
    const seen = /* @__PURE__ */ new Set();
    let page = 1;
    let hasMore = true;
    const meta = {};
    while (hasMore && page <= config.maxPages) {
      assertScanActive(ports.cancelled);
      await ports.waitIfPaused();
      assertScanActive(ports.cancelled);
      ports.progress?.("拉取列表 " + page + "/" + config.maxPages + "…（已 " + all.length + "）");
      const result = await ports.fetchPage(page, config.pageSize);
      assertScanActive(ports.cancelled);
      Object.assign(meta, result.meta || {});
      for (const item of result.items) {
        const key = item.bvid + "#" + (item.page || 1);
        if (!item.bvid || seen.has(key)) continue;
        seen.add(key);
        all.push(item);
      }
      hasMore = result.hasMore;
      if (!hasMore) break;
      page++;
      if (hasMore && page <= config.maxPages) {
        await ports.sleep(config.delayMs || 300);
        assertScanActive(ports.cancelled);
      }
    }
    return { items: all, meta, pagesFetched: Math.min(page, config.maxPages), truncated: hasMore };
  }
  const REFRESH_KEYS = [
    "title",
    "author",
    "videoTitle",
    "groupType",
    "groupKey",
    "groupFolder",
    "parentFolder",
    "spaceMid",
    "collectionName",
    "collectionMid",
    "collectionSid",
    "collectionShortUrl"
  ];
  function mergeScanItems(existing, incoming, sourceLabel, keyOf) {
    const byKey = new Map(existing.map((item) => [keyOf(item), item]));
    let added = 0;
    let existed = 0;
    for (const raw of incoming) {
      const key = keyOf(raw);
      const previous = byKey.get(key);
      if (previous) {
        existed++;
        const target = previous;
        for (const field of REFRESH_KEYS) {
          target[field] = raw[field] || previous[field];
        }
        target.aid = raw.aid ?? previous.aid;
        target.part = raw.part ?? previous.part;
        const sources = Array.isArray(previous.sources) ? previous.sources : [];
        target.sources = Array.from(new Set([...sources, sourceLabel].filter(Boolean)));
        continue;
      }
      const next = {
        ...raw,
        selected: true,
        subStatus: "wait",
        cue_count: 0,
        data: null,
        error: "",
        sources: sourceLabel ? [sourceLabel] : []
      };
      existing.push(next);
      byKey.set(key, next);
      added++;
    }
    return { added, existed };
  }
  async function expandCollectionParts(archives, config, ports) {
    const list = Array.isArray(archives) ? archives : [];
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    const normalizeBvid = (raw) => ports.extractBvid(raw) || String(raw || "").trim();
    const pushItem = (item) => {
      const bvid = normalizeBvid(item.bvid);
      if (!bvid) return;
      const page = Math.max(1, Number(item.page) || 1);
      const key = bvid + "#" + page;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ ...item, bvid, page });
    };
    const delayMs = config.delayMs === void 0 ? 160 : config.delayMs;
    for (let i = 0; i < list.length; i++) {
      assertScanActive(ports.cancelled);
      await ports.waitIfPaused();
      assertScanActive(ports.cancelled);
      const item = list[i];
      const bvid = normalizeBvid(item.bvid);
      if (!bvid) continue;
      ports.progress(i + 1, list.length, bvid);
      let pages = Array.isArray(item.pages) && item.pages.length ? item.pages : null;
      let title = String(item.title || "").trim();
      let author = String(item.author || "").trim();
      let aid = item.aid;
      if (!pages || pages.length <= 1) {
        try {
          const view2 = await ports.fetchView(bvid);
          pages = Array.isArray(view2.pages) ? view2.pages : [];
          title = String(view2.title || title || bvid).trim();
          author = String(view2.owner?.name || author).trim();
          aid = view2.aid || aid;
        } catch (error) {
          if (error?.name === "AbortError") throw error;
          ports.onFailure(bvid, error);
          pushItem({ ...item, bvid, title, author, aid, page: Math.max(1, Number(item.page) || 1) });
          continue;
        }
      }
      if (!pages.length || pages.length <= 1) {
        pushItem({ ...item, bvid, aid, title: title || item.title || bvid, author, page: 1, pages: pages || [] });
      } else {
        for (let p = 0; p < pages.length; p++) {
          const part = pages[p] || {};
          const pageNo = Math.max(1, Number(part.page) || p + 1);
          const partName = String(part.part || "").trim();
          pushItem({
            ...item,
            bvid,
            aid,
            title: (title || bvid) + " - P" + pageNo + (partName ? "【" + partName + "】" : ""),
            author,
            page: pageNo,
            part: partName,
            pages
          });
        }
      }
      if (delayMs && i < list.length - 1) {
        await ports.sleep(delayMs);
        assertScanActive(ports.cancelled);
      }
    }
    return out;
  }
  function seasonMemberPlan(entry, fallbackMid) {
    const meta = entry?.meta || {};
    const sid = meta.season_id;
    if (sid == null || sid === "") return null;
    const bvids = (entry?.archives || []).map((archive) => archive?.bvid).filter((bvid) => !!bvid);
    const total = Number(meta.total) || bvids.length;
    return {
      mid: String(meta.mid || fallbackMid),
      season_id: String(sid),
      name: String(meta.name || meta.title || "未命名合集").trim() || "未命名合集",
      bvids,
      missingMembers: total > bvids.length,
      total
    };
  }
  function chooseSeasonMembers(recent, loaded) {
    return loaded.length > recent.length ? loaded : recent;
  }
  function parseUserSeasonPage(input) {
    const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
    const response = object(input);
    if (typeof response.code !== "number" && (typeof response.code !== "string" || !response.code.trim())) {
      throw new Error("Bilibili 合集列表响应缺少有效 code");
    }
    const code = Number(response.code);
    if (!Number.isInteger(code)) throw new Error("Bilibili 合集列表响应缺少有效 code");
    const data = object(response.data);
    const lists = object(data.items_lists);
    const page = object(lists.page);
    const seasons = Array.isArray(lists.seasons_list) ? lists.seasons_list.map((entry) => {
      const raw = object(entry);
      const meta = object(raw.meta);
      const seasonMeta = {
        ...typeof meta.season_id === "string" || typeof meta.season_id === "number" ? { season_id: meta.season_id } : {},
        ...typeof meta.mid === "string" || typeof meta.mid === "number" ? { mid: meta.mid } : {},
        ...typeof meta.name === "string" ? { name: meta.name } : {},
        ...typeof meta.title === "string" ? { title: meta.title } : {},
        ...Number.isFinite(Number(meta.total)) && meta.total != null ? { total: Number(meta.total) } : {}
      };
      return {
        meta: seasonMeta,
        ...Array.isArray(raw.archives) ? {
          archives: raw.archives.map((item) => {
            const archive = object(item);
            return typeof archive.bvid === "string" ? { bvid: archive.bvid } : {};
          })
        } : {}
      };
    }) : [];
    return {
      code,
      ...typeof response.message === "string" ? { message: response.message } : {},
      ...response.data !== void 0 ? { data: { items_lists: {
        seasons_list: seasons,
        ...Array.isArray(lists.series_list) ? { series_list: lists.series_list } : {},
        ...page.total === null || typeof page.total === "number" || typeof page.total === "string" ? { page: { total: page.total } } : {}
      } } } : {}
    };
  }
  async function collectUserSeasons(midValue, config, ports) {
    const mid = String(midValue || "").trim();
    if (!mid) return [];
    const maxPages = config.maxPages ?? 30;
    const pageSize = config.pageSize ?? 20;
    const delayMs = config.delayMs ?? 280;
    const maxSeasonArchivePages = config.maxSeasonArchivePages ?? 40;
    const seasons = [];
    let page = 1;
    let hasMore = true;
    while (hasMore && page <= maxPages) {
      assertScanActive(ports.cancelled);
      ports.progress?.("拉取合集列表 " + page + "/" + maxPages + "…（已 " + seasons.length + " 个）");
      const result = await ports.fetchPage(mid, page, pageSize);
      assertScanActive(ports.cancelled);
      if (result.code !== 0) {
        throw new Error(result.message || "seasons_series_list code=" + result.code);
      }
      const lists = result.data?.items_lists || {};
      const entries = lists.seasons_list || [];
      const pageInfo = lists.page || {};
      for (const entry of entries) {
        const plan = seasonMemberPlan(entry, mid);
        if (!plan) continue;
        let bvids = plan.bvids;
        if (plan.missingMembers) {
          ports.progress?.("补全合集「" + plan.name + "」成员 " + bvids.length + "/" + plan.total + "…");
          try {
            const loaded = await ports.loadMembers(
              mid,
              plan.season_id,
              maxSeasonArchivePages,
              delayMs,
              (message) => ports.progress?.("合集 " + (entry?.meta?.name || plan.season_id) + " · " + message)
            );
            bvids = chooseSeasonMembers(bvids, loaded);
          } catch (error) {
            if (error?.name === "AbortError") throw error;
            ports.warn(plan.season_id, error);
          }
        }
        seasons.push({
          mid: plan.mid,
          season_id: plan.season_id,
          name: plan.name,
          bvids,
          shortUrl: ports.shortUrl(String(entry?.meta?.mid || mid), plan.season_id)
        });
      }
      const totalHint = pageInfo.total != null ? Number(pageInfo.total) : null;
      if (totalHint != null && Number.isFinite(totalHint) && totalHint > 0) {
        hasMore = page * pageSize < totalHint;
      } else {
        hasMore = entries.length >= pageSize || (lists.series_list || []).length >= pageSize;
      }
      if (!hasMore) break;
      page++;
      if (page <= maxPages) {
        await ports.sleep(delayMs || 280);
        assertScanActive(ports.cancelled);
      }
    }
    return seasons;
  }
  function currentKind(s) {
    return s.batchBusy ? "fetch" : s.scanBusy ? "scan" : "";
  }
  function isPaused(s) {
    return s.batchBusy ? !!s.batchPaused : s.scanBusy ? !!s.scanPaused : false;
  }
  function setBusy(s, kind, busy) {
    if (kind === "scan") {
      s.scanBusy = !!busy;
      if (!busy) s.scanPaused = false;
    } else {
      s.batchBusy = !!busy;
      if (!busy) s.batchPaused = false;
    }
  }
  function setProgress(s, patch = {}) {
    const job = s.libraryJob || (s.libraryJob = { kind: "", index: 0, total: 0, label: "" });
    if (patch.kind != null) job.kind = patch.kind;
    if (patch.index != null) job.index = Math.max(0, Number(patch.index) || 0);
    if (patch.total != null) job.total = Math.max(0, Number(patch.total) || 0);
    if (patch.label != null) job.label = String(patch.label || "");
  }
  function clearProgress(s) {
    s.libraryJob = { kind: "", index: 0, total: 0, label: "" };
  }
  function togglePause(s) {
    if (s.batchBusy) {
      s.batchPaused = !s.batchPaused;
      return { changed: true, text: s.batchPaused ? "已暂停字幕抓取 · 点「继续」恢复" : "继续抓取字幕…", css: s.batchPaused ? "ok" : "" };
    }
    if (s.scanBusy) {
      s.scanPaused = !s.scanPaused;
      return { changed: true, text: s.scanPaused ? "已暂停扫描 · 点「继续」恢复" : "继续扫描…", css: s.scanPaused ? "ok" : "" };
    }
    return { changed: false, text: "当前没有可暂停的扫描或抓取任务", css: "ok" };
  }
  function stop(s) {
    s.cancel = true;
    s.cancelScan = true;
    s.cancelBatch = true;
    s.scanPaused = false;
    s.batchPaused = false;
  }
  async function waitWhilePaused(s, sleep) {
    while (isPaused(s) && !s.cancel && !s.cancelScan && !s.cancelBatch) await sleep(140);
  }
  function view(s) {
    const kind = currentKind(s);
    const busy = !!kind;
    const paused = isPaused(s);
    const job = s.libraryJob || { index: 0, total: 0, label: "" };
    const index = Number(job.index) || 0;
    const total = Number(job.total) || 0;
    const label = kind === "fetch" ? "抓取字幕" : kind === "scan" ? "扫描视频" : "任务";
    const parts = [];
    if (total > 0) parts.push(String(Math.min(index, total)) + " / " + total);
    if (job.label) parts.push(job.label);
    return {
      kind,
      busy,
      paused,
      title: paused ? label + "已暂停" : label,
      meta: parts.join(" · ") || (busy ? "进行中" : "空闲"),
      percent: total > 0 ? Math.max(0, Math.min(100, index / total * 100)) : busy ? 8 : 0,
      pauseLabel: paused ? "继续" : "暂停",
      pauseTitle: paused ? "从暂停处继续" : "暂停当前任务，已完成的条目会保留"
    };
  }
  function createCoordinator() {
    let sequence = 0;
    let active = null;
    return {
      begin(id) {
        this.stop();
        const token = ++sequence;
        const controller = new AbortController();
        const task = { id, status: "queued", error: "" };
        active = { token, controller, task };
        const current = () => active?.token === token && !controller.signal.aborted;
        return {
          task,
          signal: controller.signal,
          current,
          assertCurrent() {
            if (!current()) throw new Error("任务已停止或替换");
          },
          async stage(operation) {
            if (!current()) throw new Error("任务已停止或替换");
            task.status = "running";
            try {
              const result = await operation();
              if (!current()) throw new Error("任务已停止或替换");
              return result;
            } catch (error) {
              task.status = current() ? "error" : "stopped";
              task.error = task.status === "error" ? String(error instanceof Error ? error.message : error) : "";
              throw error;
            }
          },
          finish(status2 = "done") {
            if (current()) task.status = status2;
          }
        };
      },
      stop() {
        if (active && ["queued", "running"].includes(active.task.status)) {
          active.task.status = "stopped";
          active.controller.abort();
        }
      }
    };
  }
  function planTasks(tasks, prompts, profiles) {
    const profileMap = new Map(profiles.map((profile2) => [profile2.id, profile2]));
    const plans = tasks.filter((task) => task.enabled !== false).flatMap((task) => {
      const prompt2 = prompts.find((prompt22) => prompt22.id === task.promptId && prompt22.stage === "postprocess");
      if (!prompt2 || !(prompt2.systemPrompt.trim() || prompt2.userPromptTemplate.trim())) return [];
      const models = (task.modelIds || []).flatMap((id) => {
        const model = profileMap.get(id);
        return model?.enabled ? [model] : [];
      });
      return models.length ? [{ task, prompt: prompt2, models }] : [];
    });
    const runs = plans.flatMap((plan) => plan.models.map((profile2) => ({
      task: plan.task,
      prompt: plan.prompt,
      profile: profile2,
      taskId: plan.task.id,
      profileId: profile2.id,
      promptId: plan.prompt.id,
      promptProfile: plan.prompt,
      config: profile2
    })));
    const invalid = [...new Map(plans.flatMap((plan) => plan.models).map((model) => [model.id, model])).values()].filter((model) => !model.apiKey || !model.baseUrl || !model.model);
    return { plans, runs, invalid };
  }
  const partitionRuns = partitionPlannedAiRuns;
  async function executeTasks(jobs) {
    const results = await Promise.allSettled(jobs.map((job) => Promise.resolve().then(job)));
    const failed = results.some((result) => result.status === "rejected" || result.value.status === "error");
    const stopped = results.some((result) => result.status === "fulfilled" && result.value.status === "stopped");
    return { results, status: failed ? "error" : stopped ? "stopped" : "done" };
  }
  function cloneSessionInput(input, sessionId) {
    if (!input?.vars?.subtitle) return null;
    return {
      sessionId: Number(sessionId ?? input.sessionId),
      routeKey: String(input.routeKey || ""),
      vars: { ...input.vars },
      promptProfile: input.promptProfile ? { ...input.promptProfile } : null,
      taskSnapshots: Array.isArray(input.taskSnapshots) ? input.taskSnapshots.map((entry) => ({
        task: entry.task ? { ...entry.task, modelIds: [...entry.task.modelIds || []] } : null,
        prompt: entry.prompt ? { ...entry.prompt } : null
      })) : [],
      preprocessPrompt: input.preprocessPrompt ? { ...input.preprocessPrompt } : null,
      preprocessConfig: input.preprocessConfig ? { ...input.preprocessConfig } : null,
      preprocessEnabled: !!input.preprocessEnabled,
      commonMeta: {
        ...input.commonMeta || {},
        sourceBvids: [...input.commonMeta?.sourceBvids || []]
      }
    };
  }
  function summarizeRuns(runs) {
    if (!runs.length) return null;
    return {
      done: runs.filter((run) => run.status === "done").length,
      failed: runs.filter((run) => run.status === "error").length,
      stopped: runs.filter((run) => run.status === "stopped").length
    };
  }
  async function ensureSubtitles(targets, delayMs, ports) {
    for (let i = 0; i < targets.length; i++) {
      if (ports.cancelled()) throw new Error("用户停止");
      const item = targets[i];
      if (item.subStatus === "ok" && item.data?.length) continue;
      ports.onFetching(item, i, targets.length);
      const result = await ports.fetchSubtitle(item.bvid, item.page || 1);
      if (ports.cancelled()) throw new Error("用户停止");
      item.subStatus = result.status;
      item.cue_count = result.cue_count || 0;
      item.data = result.data || null;
      item.error = result.error || "";
      if (!item.title && result.title) item.title = result.title;
      if (!item.author && result.author) item.author = result.author;
      ports.onUpdated(item);
      if (i < targets.length - 1) await ports.sleep(delayMs);
    }
    return targets.filter((item) => item.subStatus === "ok" && !!item.data?.length);
  }
  function prepareBatchInput(ready, rawBuilt, stageInput, preprocessEnabled, truncate, preprocessPromptName, preprocessModelName) {
    const first = ready[0];
    const sourceBvids = ready.map((item) => item.bvid).filter(Boolean);
    const cut = truncate(stageInput);
    const vars = {
      title: ready.map((item) => item.title).filter(Boolean).join(" / ") || first?.title || "",
      bvid: ready.map((item) => item.bvid).join(", "),
      author: first?.author || "",
      subtitle: cut.text,
      rawSubtitle: rawBuilt,
      processedSubtitle: preprocessEnabled ? stageInput : ""
    };
    const commonMeta = {
      sourceBvids,
      truncated: cut.truncated,
      readyCount: ready.length,
      preprocessEnabled,
      preprocessPromptName,
      preprocessModelName
    };
    return { vars, commonMeta, sourceBvids, cut };
  }
  function hydratePlannedRuns(runs, split, sourceBvids, draft) {
    const findRun = (item) => runs.find((run) => run.taskId === item.taskId && run.profileId === item.profileId);
    let reused = 0;
    for (const item of split.reuse) {
      const run = findRun(item.plan);
      if (!run) continue;
      const restored = draft(item.cached);
      if (!restored) continue;
      Object.assign(run, restored, { sourceBvids: [...sourceBvids] });
      reused++;
    }
    const generateIds = split.generate.map((plan) => findRun(plan)?.id).filter(
      (id) => Boolean(id)
    );
    return { reused, generateIds };
  }
  function settings(value) {
    return {
      concurrency: Math.min(8, Math.max(1, Number(value.preprocessConcurrency) || 6)),
      targetMinutes: Math.min(30, Math.max(2, Number(value.preprocessTargetMinutes) || 8)),
      overlapSeconds: Math.min(120, Math.max(0, Number(value.preprocessOverlapSeconds) || 0)),
      maxChars: Math.min(6e4, Math.max(8e3, Number(value.preprocessMaxChars) || 24e3)),
      retries: Math.min(4, Math.max(0, Number(value.preprocessRetries) || 0))
    };
  }
  function parseTimestamp(token) {
    const match = String(token || "").match(/^\[(BV[\w]+)\s+P(\d+)\s+(\d{1,2}:\d{2}(?::\d{2})?)\]$/i);
    if (!match) return null;
    const clock = match[3];
    const parts = clock.split(":").map(Number);
    const seconds = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
    return { token: match[0], bvid: match[1], page: Number(match[2]) || 1, clock, seconds };
  }
  function readingBlocks(text) {
    const source = String(text || "").replace(/\r\n?/g, "\n").trim();
    if (!source) return [];
    const blocks = [];
    let paragraph = [];
    let topic = "";
    const flush = () => {
      const value = paragraph.join("\n").trim();
      paragraph = [];
      if (value) blocks.push({ type: "paragraph", text: value, topic });
    };
    for (const rawLine of source.split("\n")) {
      const line = rawLine.trimEnd();
      const trimmed = line.trim();
      if (!trimmed) {
        flush();
        continue;
      }
      const sourceMatch = trimmed.match(/^===\s*(.*?)\s*===$/);
      if (sourceMatch) {
        flush();
        blocks.push({ type: "source", text: sourceMatch[1].trim() });
        topic = "";
        continue;
      }
      const heading = trimmed.match(/^#{1,4}\s+(.+)$/);
      if (heading) {
        flush();
        topic = heading[1].replace(/[*_`]+/g, "").trim();
        blocks.push({ type: "heading", text: topic });
        continue;
      }
      paragraph.push(line);
    }
    flush();
    return blocks;
  }
  function buildPayload(items) {
    return items.map((it) => {
      const head = "=== " + it.bvid + ((it.page || 1) > 1 ? " P" + it.page : "") + " " + (it.title || "") + " ===";
      return head + "\n" + String(it.preprocessedText || "").trim();
    }).join("\n\n");
  }
  async function prepareJobs(items, ports) {
    const prepared = [];
    const jobs = [];
    let hits = 0;
    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      const item = items[itemIndex];
      const raw = ports.getRaw(item);
      const cacheKey = ports.cacheKey(item, raw);
      const cached = ports.forceRefresh ? null : await ports.readCache(cacheKey);
      if (cached?.value?.text) {
        item.preprocessedText = String(cached.value.text);
        item.preprocessCacheKey = cacheKey;
        hits++;
        prepared.push({ item, raw, cacheKey, cached: true, chunks: [], outputs: [] });
        continue;
      }
      const chunks = ports.split(item);
      const record2 = {
        item,
        raw,
        cacheKey,
        cached: false,
        chunks,
        outputs: new Array(chunks.length)
      };
      prepared.push(record2);
      chunks.forEach((chunk, chunkIndex) => jobs.push({
        record: record2,
        item,
        raw,
        chunk,
        chunkIndex,
        chunkCount: chunks.length,
        itemIndex,
        itemCount: items.length
      }));
    }
    return { prepared, jobs, hits };
  }
  async function runChunkWithRetry(job, retries, workerId, ports) {
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (ports.isCancelled()) throw new Error("用户停止");
      const runtime2 = ports.createRuntime("PRE W" + workerId + " " + job.item.bvid + " " + (job.chunkIndex + 1) + "/" + job.chunkCount);
      ports.register(runtime2);
      const vars = {
        title: job.item.title || "",
        bvid: (job.item.bvid || "") + ((job.item.page || 1) > 1 ? " P" + job.item.page : ""),
        author: job.item.author || "",
        subtitle: job.chunk.text,
        rawSubtitle: job.raw,
        chunkIndex: job.chunkIndex + 1,
        chunkCount: job.chunkCount,
        chunkStart: ports.formatClock(job.chunk.chunkStartSec),
        coreStart: ports.formatClock(job.chunk.coreStartSec),
        chunkEnd: ports.formatClock(job.chunk.endSec)
      };
      const suffix = attempt ? " · 重试 " + attempt + "/" + retries : "";
      const label = job.itemIndex + 1 + "/" + job.itemCount + " " + job.item.bvid + ((job.item.page || 1) > 1 ? " P" + job.item.page : "") + " · 块 " + (job.chunkIndex + 1) + "/" + job.chunkCount + " · W" + workerId + suffix;
      try {
        return await ports.execute(runtime2, vars, label);
      } catch (error) {
        lastError = error;
        if (ports.isCancelled() || runtime2.abort) throw error;
        if (attempt >= retries) break;
        ports.onRetry(label);
        await ports.sleep(Math.min(2500, 600 * (attempt + 1)));
      } finally {
        ports.unregister(runtime2);
        ports.abort(runtime2);
      }
    }
    throw lastError || new Error("预处理分块失败");
  }
  async function runPipeline(items, promptName, modelName, settings2, ports) {
    const runtime2 = ports.createRuntime();
    const run = {
      runtime: runtime2,
      childRuntimes: /* @__PURE__ */ new Set(),
      raw: "",
      preview: "",
      status: "running",
      statusText: "准备智能切块",
      busy: true,
      modelName,
      promptName,
      cacheHits: 0,
      total: items.length,
      totalChunks: 0,
      completedChunks: 0,
      settings: { ...settings2 }
    };
    ports.onStart(run);
    try {
      const { prepared, jobs, hits } = await prepareJobs(items, {
        getRaw: ports.getRaw,
        cacheKey: ports.cacheKey,
        readCache: ports.readCache,
        split: ports.split,
        forceRefresh: ports.forceRefresh
      });
      run.cacheHits = hits;
      run.totalChunks = jobs.length;
      run.statusText = jobs.length ? "智能切块完成 · " + jobs.length + " 块 · 并发 " + settings2.concurrency : "全部命中缓存 · " + hits + "/" + items.length;
      ports.onUpdate(run);
      if (jobs.length) {
        await ports.runPool(jobs, settings2.concurrency, async (job, workerId) => {
          const text = await ports.runChunk(job, workerId, run);
          job.record.outputs[job.chunkIndex] = text;
          run.completedChunks += 1;
          run.preview = "";
          run.statusText = "分块 " + run.completedChunks + "/" + run.totalChunks + " · 并发 " + settings2.concurrency;
          ports.onUpdate(run);
        }, () => ports.isCancelled(run));
      }
      for (const record2 of prepared) {
        if (record2.cached) continue;
        const text = ports.stitch(record2.chunks, record2.outputs);
        record2.item.preprocessedText = text;
        record2.item.preprocessCacheKey = record2.cacheKey;
        void ports.writeCache(record2.cacheKey, {
          text,
          bvid: record2.item.bvid,
          page: record2.item.page || 1,
          model: ports.cacheModel,
          chunkSettings: settings2,
          chunkCount: record2.chunks.length
        }).catch(() => {
        });
      }
      run.raw = buildPayload(items);
      run.text = run.raw;
      run.cacheHits = hits;
      run.status = "done";
      run.statusText = "完成 · " + items.length + " 个视频 · " + jobs.length + " 个新分块 · 缓存 " + hits + " · 并发 " + settings2.concurrency;
      run.busy = false;
      ports.onUpdate(run);
      ports.onComplete(run);
      return run.raw;
    } catch (error) {
      const stopped = ports.isCancelled(run);
      runtime2.abort = true;
      for (const child of run.childRuntimes) ports.abortChild(child);
      run.status = stopped ? "stopped" : "error";
      run.statusText = stopped ? "已停止" : "失败 · " + String(
        error instanceof Error ? error.message : error
      ).slice(0, 80);
      run.busy = false;
      ports.onUpdate(run);
      throw error;
    }
  }
  function selectAnchor(anchorId, nodes) {
    const latest = nodes.filter((node) => node.anchorId === anchorId).reduce((best, node) => !best || Number(node.updatedAt || 0) > Number(best.updatedAt || 0) ? node : best, void 0);
    return { anchorId, nodeId: latest?.id || "" };
  }
  function createController() {
    return createCoordinator();
  }
  function completeAnswer(node, parsed, text, stopped, now = Date.now()) {
    return Object.assign(node, {
      answer: parsed.answer || text.trim(),
      preview: "",
      suggestions: parsed.suggestions,
      status: stopped ? "stopped" : "done",
      updatedAt: now,
      error: ""
    });
  }
  function failAnswer(node, partial, error, stopped, now = Date.now()) {
    return Object.assign(node, {
      answer: partial,
      preview: "",
      status: stopped ? "stopped" : "error",
      error: stopped ? "" : String(error instanceof Error ? error.message : error || "请求失败"),
      updatedAt: now
    });
  }
  function removeAnchor(anchors, nodes, anchorId) {
    return { anchors: anchors.filter((anchor) => anchor.id !== anchorId), nodes: nodes.filter((node) => node.anchorId !== anchorId) };
  }
  async function runAnswer(execution) {
    const { node } = execution;
    try {
      const text = await execution.generate();
      if (!execution.exists()) return;
      completeAnswer(node, execution.parse(text), text, execution.stopped());
      await execution.persist(node);
      await execution.onSuccess(node);
    } catch (error) {
      if (!execution.exists()) return;
      failAnswer(node, execution.visible(execution.partial()), error, execution.stopped());
      await execution.persist(node).catch(() => {
      });
      execution.onFailure(node);
    } finally {
      await execution.cleanup();
    }
  }
  function ancestorNodes(node, nodes) {
    const out = [];
    let current = node;
    const seen = /* @__PURE__ */ new Set();
    while (current?.parentId && !seen.has(current.parentId) && out.length < 12) {
      const parentId = current.parentId;
      seen.add(parentId);
      const parent = nodes.find((item) => item.id === parentId);
      if (!parent) break;
      out.unshift(parent);
      current = parent;
    }
    return out;
  }
  function branchContext(parentNode, nodes) {
    if (!parentNode) return "（这是该锚点下的新分支）";
    const chain = [...ancestorNodes(parentNode, nodes), parentNode].slice(-6);
    return chain.map((node, index) => {
      const answer = String(node.answer || "").trim().replace(/\s+/g, " ").slice(0, 1800);
      return index + 1 + ". 问题：" + node.question + "\n   回答摘要：" + (answer || "（尚无回答）");
    }).join("\n");
  }
  function reconcileNodes(stored, current, busy, visibleAnswer, now = Date.now()) {
    const recovered = [];
    const live = busy ? new Map((current || []).filter((node) => node?.status === "running").map((node) => [node.id, node])) : /* @__PURE__ */ new Map();
    const nodes = (stored || []).map((node) => {
      const active = live.get(node?.id);
      if (active) return active;
      if (!busy && node?.status === "running") {
        const fixed = {
          ...node,
          answer: visibleAnswer(node.answer || node.preview || ""),
          preview: "",
          status: "stopped",
          error: "",
          updatedAt: now
        };
        recovered.push(fixed);
        return fixed;
      }
      return node;
    }).sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
    return { nodes, recovered };
  }
  function sortAnchors(anchors) {
    return [...anchors || []].sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  }
  function cacheAnchor(anchors, anchor) {
    const index = anchors.findIndex((item) => item.id === anchor.id);
    if (index >= 0) anchors[index] = anchor;
    else anchors.unshift(anchor);
    anchors.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    return anchor;
  }
  function cacheNode(nodes, node) {
    const index = nodes.findIndex((item) => item.id === node.id);
    if (index >= 0) nodes[index] = node;
    else nodes.push(node);
    return node;
  }
  async function saveAnchor(anchors, anchor, commit) {
    await commit(anchor);
    return cacheAnchor(anchors, anchor);
  }
  async function saveNode(nodes, node, commit) {
    await commit(node);
    return cacheNode(nodes, node);
  }
  async function deleteAnchorCommitted(anchors, nodes, anchorId, commit) {
    await commit(anchorId);
    return removeAnchor(anchors, nodes, anchorId);
  }
  function updateStreamPreview(node, full, lastPersistAt, now, intervalMs = 1800) {
    const latest = String(full || "");
    node.preview = latest;
    node.updatedAt = now;
    const shouldPersist = now - lastPersistAt > intervalMs;
    return { latest, persistAt: shouldPersist ? now : lastPersistAt, shouldPersist };
  }
  const WBI_TTL_MS = 6e5;
  const wbiCache = /* @__PURE__ */ new WeakMap();
  const JSON_REQUEST = {
    credentials: "include",
    cache: "no-store",
    fallback: "network-or-http",
    headers: { Accept: "application/json, text/plain, */*" }
  };
  function request$1(signal) {
    return { ...JSON_REQUEST, ...signal ? { signal } : {} };
  }
  function isAbortError(error) {
    return error?.name === "AbortError";
  }
  async function fetchWbiKeys(network, signal) {
    const now = Date.now();
    const cached = wbiCache.get(network);
    if (cached && now - cached.at < WBI_TTL_MS) return cached.keys;
    const payload = await network.json(
      wbi.navUrl(),
      request$1(signal)
    );
    const imgUrl = payload?.data?.wbi_img?.img_url || "";
    const subUrl = payload?.data?.wbi_img?.sub_url || "";
    if (payload?.code !== 0 || !imgUrl || !subUrl) {
      throw new Error(payload?.message || "无法取得 WBI keys");
    }
    const keys = {
      img: wbi.keyFromUrl(imgUrl),
      sub: wbi.keyFromUrl(subUrl)
    };
    wbiCache.set(network, { keys, at: now });
    return keys;
  }
  async function signWbi(network, params, signal, wts) {
    const keys = await fetchWbiKeys(network, signal);
    return wbi.sign(params, keys, md5, wts);
  }
  async function fetchVideoView(network, bvid, signal) {
    const payload = await network.json(
      video$1.url(bvid),
      request$1(signal)
    );
    if (payload?.code !== 0 || !payload.data) {
      throw new Error(payload?.message || "视频信息接口返回失败");
    }
    return payload.data;
  }
  async function fetchVideoDetail(network, bvid, signal) {
    const query = await signWbi(network, { bvid, need_elec: 0 }, signal);
    return network.json(
      wbi.videoDetailUrl(query),
      request$1(signal)
    );
  }
  async function fetchSubtitleBody(network, url, signal) {
    const payload = await network.json(url, request$1(signal));
    if (!Array.isArray(payload?.body)) return [];
    return payload.body.filter((value) => value !== null && typeof value === "object" && !Array.isArray(value));
  }
  async function fetchPlayerWbiTracks(network, meta, signal) {
    const params = meta.aid ? { aid: meta.aid, cid: meta.cid } : { bvid: meta.bvid, cid: meta.cid };
    const query = await signWbi(network, params, signal);
    const payload = await network.json(
      wbi.playerUrl(query),
      request$1(signal)
    );
    if (payload?.code !== 0) {
      throw new Error(payload?.message || "WBI 字幕轨道接口返回失败");
    }
    return subtitle.normalizeTracks(payload.data?.subtitle?.subtitles);
  }
  async function fetchPlayerV2Tracks(network, meta, signal) {
    const payload = await network.json(
      subtitle.playerUrl(meta),
      request$1(signal)
    );
    if (payload?.code !== 0) {
      throw new Error(payload?.message || "字幕轨道接口返回失败");
    }
    return subtitle.normalizeTracks(payload.data?.subtitle?.subtitles);
  }
  async function fetchDmSubtitleTracks(network, meta, signal) {
    const payload = await network.json(
      subtitle.dmUrl(meta),
      request$1(signal)
    );
    if (payload?.code !== 0) {
      throw new Error(payload?.message || "弹幕字幕接口返回失败");
    }
    return subtitle.normalizeTracks(payload.data?.subtitle?.subtitles);
  }
  async function fetchAiSubtitleUrl(network, meta, signal) {
    if (!meta.aid) return "";
    const payload = await network.json(
      subtitle.aiStatUrl(meta),
      request$1(signal)
    );
    if (payload?.code !== 0) return "";
    return subtitle.normalizeUrl(payload.data?.subtitle_url);
  }
  async function collectSubtitleTracks(network, meta, signal) {
    let lastError = null;
    let hadSuccessfulResponse = false;
    try {
      const subs = await fetchPlayerWbiTracks(network, meta, signal);
      hadSuccessfulResponse = true;
      if (subs.length) return { subs, source: "player_wbi" };
    } catch (error) {
      if (isAbortError(error)) throw error;
      lastError = error;
    }
    try {
      const subs = await fetchPlayerV2Tracks(network, meta, signal);
      hadSuccessfulResponse = true;
      if (subs.length) return { subs, source: "player_v2" };
    } catch (error) {
      if (isAbortError(error)) throw error;
      lastError = error;
    }
    try {
      const subs = await fetchDmSubtitleTracks(network, meta, signal);
      hadSuccessfulResponse = true;
      if (subs.length) return { subs, source: "dm_view" };
    } catch (error) {
      if (isAbortError(error)) throw error;
      lastError = error;
    }
    return {
      subs: [],
      source: "",
      ...!hadSuccessfulResponse && lastError ? { error: lastError } : {}
    };
  }
  async function resolveSubtitleUrl(network, track, meta, source = "", signal) {
    const lan = String(track.lan || "");
    const direct = subtitle.normalizeUrl(track.subtitle_url);
    if (direct) return { url: direct, source };
    if (!lan.startsWith("ai-") || !meta.aid) return { url: "", source };
    try {
      const url = await fetchAiSubtitleUrl(network, meta, signal);
      return url ? { url, source: "ai_stat" } : { url: "", source };
    } catch (error) {
      if (isAbortError(error)) throw error;
      return { url: "", source };
    }
  }
  async function fetchSubtitleTracks(network, meta, signal) {
    const result = await collectSubtitleTracks(network, meta, signal);
    if (!result.subs.length && result.error) throw result.error;
    return result.subs;
  }
  function completionUrl(baseUrl) {
    const base = String(baseUrl || "").trim().replace(/\/+$/, "");
    if (!base) throw new Error("AI Base URL 不能为空");
    const url = new URL(base + "/chat/completions");
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("AI Base URL 仅支持 HTTP(S)");
    }
    return url.href;
  }
  function transportFor(url, pageHref) {
    try {
      return new URL(url).origin === new URL(pageHref).origin ? "page" : "privileged";
    } catch {
      return "privileged";
    }
  }
  function toError(value) {
    return value instanceof Error ? value : new Error(String(value));
  }
  function streamAccumulator(onDelta) {
    let content2 = "";
    let reasoning = "";
    let finishReason = "";
    let sawDone = false;
    let foundEvents = false;
    let buffer = "";
    const current = () => ({ content: content2, reasoning, finishReason, sawDone });
    const consumeLine = (line) => {
      const cleaned = line.trim();
      if (cleaned.startsWith("data:")) foundEvents = true;
      const parsed = ai$1.parseSseLine(cleaned);
      if (parsed.kind === "error") throw new Error(parsed.message);
      if (parsed.kind === "done") sawDone = true;
      if (parsed.kind !== "delta") return;
      content2 += parsed.content;
      reasoning += parsed.reasoning;
      if (parsed.finishReason) finishReason = parsed.finishReason;
      if (parsed.content || parsed.reasoning) {
        onDelta?.("", ai$1.display(content2, reasoning), current());
      }
    };
    return {
      push(chunk) {
        buffer += chunk;
        let newline = buffer.indexOf("\n");
        while (newline !== -1) {
          consumeLine(buffer.slice(0, newline));
          buffer = buffer.slice(newline + 1);
          newline = buffer.indexOf("\n");
        }
      },
      finish() {
        if (buffer.trim()) consumeLine(buffer);
        buffer = "";
        return current();
      },
      current,
      hasEvents: () => foundEvents
    };
  }
  function parseJsonResponse(text) {
    const data = JSON.parse(text);
    if (data.error) {
      const error = data.error;
      throw new Error(error?.message || JSON.stringify(data.error));
    }
    const choice = Array.isArray(data.choices) ? data.choices[0] : null;
    const { content: content2, reasoning } = ai$1.extractChoice(choice);
    const finishReason = choice && typeof choice === "object" ? String(choice.finish_reason || "") : "";
    return { content: content2, reasoning, finishReason, sawDone: false };
  }
  function request(options) {
    const runtime2 = options.runtime;
    try {
      runtime2.abortController?.abort();
    } catch {
    }
    try {
      runtime2.xhr?.abort?.();
    } catch {
    }
    runtime2.abortController = null;
    runtime2.xhr = null;
    let url;
    try {
      url = completionUrl(options.baseUrl);
    } catch (error) {
      options.onError?.(toError(error));
      return runtime2;
    }
    const controller = new AbortController();
    runtime2.abortController = controller;
    const useStream = options.stream !== false;
    const maxTokens = Math.max(256, Math.min(128e3, Math.floor(Number(options.maxTokens) || 8192)));
    const transport = transportFor(url, options.pageHref);
    options.onStatus?.("准备请求 · max_tokens=" + maxTokens);
    options.onStatus?.(transport === "privileged" ? "跨域 GM 单次请求…" : "页内 fetch 请求…");
    const accumulator = streamAccumulator(options.onDelta);
    const payload = {
      model: String(options.model || "").trim(),
      messages: options.messages,
      temperature: options.temperature,
      max_tokens: maxTokens,
      stream: useStream
    };
    void (async () => {
      let result = null;
      try {
        if (runtime2.abort) throw new Error("用户停止");
        const response = await options.network.request(url, {
          method: "POST",
          transport,
          fallback: "never",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + options.apiKey,
            Accept: useStream ? "text/event-stream, application/json" : "application/json"
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
          stream: useStream,
          ...useStream ? { onChunk: (text) => accumulator.push(text) } : {}
        });
        if (!response.ok) throw new Error("HTTP " + response.status + ": " + response.text.slice(0, 300));
        if (useStream && accumulator.hasEvents()) {
          result = accumulator.finish();
        } else {
          result = parseJsonResponse(response.text);
          options.onDelta?.("", ai$1.display(result.content, result.reasoning), result);
        }
        if (!result.content && !result.reasoning) throw new Error("AI 响应无正文");
        if (result.finishReason === "length") {
          throw new Error("输出达到 max_tokens=" + maxTokens + "，结果已截断");
        }
        if (useStream && accumulator.hasEvents() && !result.sawDone && !result.finishReason) {
          throw new Error("流式连接在 [DONE]/finish_reason 之前中断");
        }
        options.onDone?.(ai$1.display(result.content, result.reasoning), result);
      } catch (error) {
        const partial = result || accumulator.current();
        if (runtime2.abort || controller.signal.aborted) {
          if (partial.content || partial.reasoning) {
            options.onStatus?.("已停止，保留已接收内容");
            options.onDone?.(ai$1.display(partial.content, partial.reasoning), partial);
          } else {
            options.onError?.(new Error("用户停止"));
          }
        } else {
          options.onError?.(toError(error));
        }
      } finally {
        if (runtime2.abortController === controller) runtime2.abortController = null;
      }
    })();
    return runtime2;
  }
  async function runPool(jobs, workerCount, handler, isCancelled = () => false) {
    let cursor = 0;
    let failed = false;
    async function worker(workerId) {
      while (!failed) {
        if (isCancelled()) throw new Error("用户停止");
        const index = cursor++;
        if (index >= jobs.length) return;
        try {
          await handler(jobs[index], workerId);
        } catch (error) {
          failed = true;
          throw error;
        }
      }
    }
    const count = Math.min(Math.max(1, Math.floor(workerCount) || 1), Math.max(1, jobs.length));
    const results = await Promise.allSettled(Array.from({ length: count }, (_, i) => worker(i + 1)));
    const failure = results.find((result) => result.status === "rejected");
    if (failure) throw failure.reason;
  }
  function parseStore(raw) {
    try {
      const value = typeof raw === "string" ? JSON.parse(raw) : raw;
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }
  function persist(current, routeKey, state2, now) {
    const key = String(routeKey || "").trim();
    if (!key) return current;
    const next = { ...current };
    next[key] = {
      messages: (state2.studioMessages || []).slice(-40),
      memory: String(state2.studioMemory || ""),
      memoryUntilId: String(state2.studioMemoryUntilId || ""),
      memoryTurns: Number(state2.studioMemoryTurns) || 0,
      contextPref: state2.studioContextPref || "auto",
      updatedAt: now
    };
    const keys = Object.keys(next).sort((a, b) => Number(next[b]?.updatedAt || 0) - Number(next[a]?.updatedAt || 0));
    for (const extra of keys.slice(24)) delete next[extra];
    return next;
  }
  function restore(store, routeKey) {
    const entry = String(routeKey || "").trim() ? store[routeKey] : null;
    const pref = entry?.contextPref;
    return {
      studioMessages: Array.isArray(entry?.messages) ? entry.messages : [],
      studioMemory: String(entry?.memory || ""),
      studioMemoryUntilId: String(entry?.memoryUntilId || ""),
      studioMemoryTurns: Number(entry?.memoryTurns) || 0,
      studioLastContextMeta: null,
      studioContextPref: pref === "raw" || pref === "processed" ? pref : "auto"
    };
  }
  function buildChatMessages(system, messages, currentUserId, question, keepRecent) {
    const history = messages.filter((message) => (message.role === "user" || message.role === "assistant") && message.id !== currentUserId && Boolean(message.content) && message.status !== "running").slice(-Math.max(0, keepRecent)).map((message) => ({ role: String(message.role), content: String(message.content) }));
    return [{ role: "system", content: system }, ...history, { role: "user", content: question }];
  }
  function transcriptContext(raw, processed, pref) {
    if (pref === "raw") return { text: raw, source: "原始字幕" };
    return { text: processed || raw, source: processed ? "规范化稿" : "原始字幕" };
  }
  function queryTokens(...parts) {
    const raw = parts.filter(Boolean).join(" ").toLowerCase();
    return raw.split(/[^\u4e00-\u9fffA-Za-z0-9_]+/).map((token) => token.trim()).filter((token) => token.length >= 2);
  }
  function splitTranscriptChunks(text) {
    const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
    const chunks = [];
    let buffer = [];
    const flush = () => {
      const value = buffer.join("\n").trim();
      if (value) chunks.push(value);
      buffer = [];
    };
    for (const line of lines) {
      const trimmed = line.trim();
      const boundary = !trimmed || /^#{1,4}\s/.test(trimmed) || /^\[BV/i.test(trimmed) || /^===\s/.test(trimmed);
      if (boundary && buffer.length) flush();
      if (trimmed) buffer.push(line);
      if (buffer.join("\n").length >= 720) flush();
    }
    flush();
    return chunks;
  }
  function scoreChunk(chunk, tokens) {
    const lower = String(chunk || "").toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (!lower.includes(token)) continue;
      score += token.length >= 4 ? 2 : 1;
    }
    if (/^#{1,4}\s/.test(chunk.trim())) score += 0.4;
    return score;
  }
  function compressTranscript(text, query, budget = 12e3) {
    const value = String(text || "");
    if (!value) return { text: "", compressed: false, original: 0, kept: 0, chunks: 0, total: 0 };
    if (value.length <= budget) {
      return { text: value, compressed: false, original: value.length, kept: value.length, chunks: 1, total: 1 };
    }
    const chunks = splitTranscriptChunks(value);
    const tokens = queryTokens(query);
    const selected = /* @__PURE__ */ new Set();
    const head = Math.min(2, chunks.length);
    for (let i = 0; i < head; i++) selected.add(i);
    const ranked = chunks.map((chunk, index) => ({ chunk, index, score: scoreChunk(chunk, tokens) })).filter((row2) => !selected.has(row2.index)).sort((a, b) => b.score - a.score || a.index - b.index);
    let used = [...selected].reduce((sum, index) => sum + chunks[index].length, 0);
    for (const row2 of ranked) {
      if (row2.score <= 0 && used > budget * 0.55) continue;
      if (used + row2.chunk.length > budget) continue;
      selected.add(row2.index);
      used += row2.chunk.length;
      if (used >= budget * 0.94) break;
    }
    const ordered = [...selected].sort((a, b) => a - b);
    const parts = [];
    let prev = -2;
    for (const index of ordered) {
      if (index !== prev + 1) parts.push("…");
      parts.push(chunks[index]);
      prev = index;
    }
    return {
      text: parts.join("\n\n"),
      compressed: true,
      original: value.length,
      kept: used,
      chunks: selected.size,
      total: chunks.length
    };
  }
  function clipSnippet(text, max) {
    const value = String(text || "").replace(/\s+/g, " ").trim();
    if (value.length <= max) return value;
    return value.slice(0, Math.max(0, max - 1)) + "…";
  }
  function compactMemoryText(text, budget = 2400) {
    const lines = String(text || "").split("\n").map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return "";
    const kept = [];
    let used = 0;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (used + line.length + 1 > budget && kept.length) break;
      kept.unshift(line);
      used += line.length + 1;
    }
    return kept.join("\n");
  }
  function refreshMemory(state2, keepRecent = 8, budget = 2400) {
    const all = (state2.studioMessages || []).filter((message) => (message.role === "user" || message.role === "assistant") && message.content && message.status !== "running");
    if (all.length <= keepRecent) return false;
    const foldable = all.slice(0, -keepRecent);
    const lastId = String(state2.studioMemoryUntilId || "");
    const already = lastId ? foldable.findIndex((message) => message.id === lastId) : -1;
    const fresh = already >= 0 ? foldable.slice(already + 1) : foldable;
    if (!fresh.length) return !!state2.studioMemory;
    const bullets = fresh.map((message) => message.role === "user" ? "- 问：" + clipSnippet(String(message.content), 72) : "- 答：" + clipSnippet(String(message.content), 140));
    state2.studioMemory = compactMemoryText([state2.studioMemory, ...bullets].filter(Boolean).join("\n"), budget);
    state2.studioMemoryUntilId = foldable[foldable.length - 1]?.id || lastId;
    state2.studioMemoryTurns = foldable.length;
    return true;
  }
  function lastAssistantText(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.role === "assistant" && message.content) return String(message.content);
    }
    return "";
  }
  function beginTurn(state2, text, now = Date.now()) {
    const user = { id: "u-" + now, role: "user", content: text, status: "done" };
    const assistant = { id: "a-" + now, role: "assistant", content: "", status: "running" };
    state2.studioMessages = [...state2.studioMessages || [], user, assistant];
    return { user, assistant };
  }
  function updateTurn(assistant, full) {
    const text = String(full || "");
    assistant.content = text;
    return text;
  }
  function finishTurn(assistant, latest, stopped) {
    assistant.content = latest.trim();
    assistant.status = stopped ? "stopped" : "done";
  }
  function failTurn(assistant, latest, error, stopped) {
    const message = error instanceof Error ? error.message : String(error || "");
    assistant.content = latest.trim() || (stopped ? "已停止" : message);
    assistant.status = stopped ? "stopped" : "error";
  }
  function clearTurnHistory(state2) {
    state2.studioMessages = [];
    state2.studioMemory = "";
    state2.studioMemoryUntilId = "";
    state2.studioMemoryTurns = 0;
    state2.studioLastContextMeta = null;
  }
  const V6_KNOWLEDGE_DB = {
    name: "bili-subbatch-knowledge-v1",
    version: 1,
    anchorStore: "anchors",
    nodeStore: "nodes"
  };
  function createRepository(factory) {
    return knowledgeDb.create(factory, {
      name: V6_KNOWLEDGE_DB.name,
      version: V6_KNOWLEDGE_DB.version,
      anchorStore: V6_KNOWLEDGE_DB.anchorStore,
      nodeStore: V6_KNOWLEDGE_DB.nodeStore
    });
  }
  function contentRefKey(ref) {
    const segment = String(ref.segmentId || "").trim();
    return [ref.source, ref.sourceId, ...segment ? [segment] : []].join(":");
  }
  function pageFromHref(href) {
    try {
      return Math.max(1, Number(new URL(href).searchParams.get("p")) || 1);
    } catch {
      return 1;
    }
  }
  function matchesBilibili(href) {
    try {
      const host2 = new URL(href).hostname.toLowerCase();
      return host2 === "bilibili.com" || host2.endsWith(".bilibili.com");
    } catch {
      return false;
    }
  }
  function resolveCurrent$1(context) {
    const ctx = route.detect(context.href);
    const playing = route.playingHint(context.pageRuntime);
    const ref = route.resolveVideo({
      href: context.href,
      urlBvid: ctx.bvid || route.bvidFrom(context.href),
      urlPage: ctx.page || pageFromHref(context.href),
      playing
    });
    if (!ref) return null;
    const native = { ...ref, ctx };
    const contentRef = {
      source: BILIBILI_SOURCE,
      sourceId: ref.bvid,
      segmentId: "P" + Math.max(1, Number(ref.page) || 1),
      url: context.href
    };
    return {
      ref: contentRef,
      key: contentRefKey(contentRef),
      native
    };
  }
  const bilibiliProvider = {
    id: BILIBILI_SOURCE,
    matches: matchesBilibili,
    resolveCurrent: resolveCurrent$1,
    activationState(context) {
      if (!route.isCarrierShell(context.href)) return "ready";
      return resolveCurrent$1(context) ? "ready" : "defer";
    }
  };
  function normalizeSegments(body) {
    const segments = [];
    for (let index = 0; index < body.length; index += 1) {
      const cue = body[index];
      if (!cue || typeof cue !== "object") continue;
      const text = String(cue.content || "").trim();
      if (!text) continue;
      const start2 = Number(cue.from) || 0;
      const end = Number(cue.to);
      segments.push({
        id: String(cue.sid ?? index + 1),
        start: start2,
        ...Number.isFinite(end) ? { end } : {},
        text
      });
    }
    return segments;
  }
  const bilibiliTranscriptSource = {
    id: BILIBILI_SOURCE,
    async acquire(resolved, context) {
      const native = resolved.native;
      const bvid = String(native.bvid || resolved.ref.sourceId).trim();
      if (!bvid) return null;
      let cid = Number(native.cid) || 0;
      let aid = Number(native.aid) || 0;
      if (!cid) {
        const view2 = await fetchVideoView(context.network, bvid, context.signal);
        if (video$1.isChargeBlocked(view2)) return null;
        const meta2 = video$1.pageMeta(view2, bvid, native.page || 1);
        cid = Number(meta2.cid) || 0;
        aid = Number(meta2.aid) || aid;
      }
      if (!cid) return null;
      const meta = {
        bvid,
        cid,
        ...aid ? { aid } : {}
      };
      const collected = await collectSubtitleTracks(
        context.network,
        meta,
        context.signal
      );
      const track = subtitle.pickTrack(collected.subs);
      if (!track) return null;
      const resolution = await resolveSubtitleUrl(
        context.network,
        track,
        { aid, cid },
        collected.source,
        context.signal
      );
      if (!resolution.url) return null;
      const body = await fetchSubtitleBody(
        context.network,
        resolution.url,
        context.signal
      );
      const segments = normalizeSegments(body);
      if (!segments.length) return null;
      const language = String(track.lan || "").trim();
      return {
        ref: resolved.ref,
        segments,
        ...language ? { language } : {},
        ...resolution.source ? { origin: resolution.source } : {},
        metadata: {
          track: { ...track }
        }
      };
    }
  };
  function createProviderRegistry(providers) {
    const list = [...providers];
    return {
      match(href) {
        return list.find((provider) => provider.matches(href)) ?? null;
      },
      resolveCurrent(context) {
        for (const provider of list) {
          if (!provider.matches(context.href)) continue;
          const resolved = provider.resolveCurrent(context);
          if (resolved) return resolved;
        }
        return null;
      },
      activationState(context) {
        const provider = list.find((candidate) => candidate.matches(context.href));
        return provider?.activationState?.(context) ?? "ready";
      },
      navigationEvents() {
        return [...new Set(list.flatMap((provider) => provider.navigationEvents ?? []))];
      }
    };
  }
  function classifyAcquisitionError(error) {
    const message = error instanceof Error ? error.message : String(error);
    const status2 = Number(error?.status);
    const aborted = error?.name === "AbortError";
    const rateLimited = status2 === 429 || /(?:HTTP\s*(?:429|412)|rate.limit|too many requests)/i.test(message);
    const unauthorized = status2 === 401 || status2 === 403 || /HTTP\s*(?:401|403)/i.test(message);
    const network = /(?:network|failed to fetch|load failed|timeout|http\s*5\d\d)/i.test(message);
    const code = aborted ? "aborted" : rateLimited ? "rate_limited" : unauthorized ? "unauthorized" : network ? "network" : "unknown";
    return {
      status: "error",
      code,
      message,
      retryable: rateLimited || network,
      cause: error
    };
  }
  function createTranscriptSourceRegistry(sources) {
    const byId = new Map(sources.map((source) => [source.id, source]));
    return {
      get(source) {
        return byId.get(source) ?? null;
      },
      async acquireDetailed(resolved, context) {
        const source = byId.get(resolved.ref.source);
        if (!source) return { status: "unavailable", code: "unsupported", retryable: false };
        try {
          const transcript2 = await source.acquire(resolved, context);
          return transcript2 ? { status: "ok", transcript: transcript2 } : { status: "unavailable", code: "no_transcript", retryable: false };
        } catch (error) {
          return classifyAcquisitionError(error);
        }
      },
      async acquire(resolved, context) {
        const result = await this.acquireDetailed(resolved, context);
        if (result.status === "error") throw result.cause;
        return result.status === "ok" ? result.transcript : null;
      }
    };
  }
  function resolveCurrent(context) {
    const current = resolveCurrentVideo(context.href, context.pageRuntime);
    if (!current) return null;
    const ref = {
      source: YOUTUBE_SOURCE,
      sourceId: current.videoId,
      segmentId: "main",
      url: context.href
    };
    return {
      ref,
      key: contentRefKey(ref),
      native: current
    };
  }
  const youtubeProvider = {
    id: YOUTUBE_SOURCE,
    matches: matchesYoutubeUrl,
    resolveCurrent,
    navigationEvents: ["yt-navigate-finish"]
  };
  const SEGMENT_SELECTOR = "ytd-transcript-segment-renderer, transcript-segment-view-model";
  function asRecord(value) {
    return value && typeof value === "object" ? value : null;
  }
  function runtimeDocument(runtime2) {
    const root = asRecord(runtime2);
    const value = root?.document;
    return value && typeof value === "object" ? value : null;
  }
  function preferredLanguages(runtime2) {
    const root = asRecord(runtime2);
    const navigator2 = asRecord(root?.navigator);
    const languages = Array.isArray(navigator2?.languages) ? navigator2.languages.map((value) => String(value || "").trim()).filter(Boolean) : [];
    const language = String(navigator2?.language || "").trim();
    if (language && !languages.includes(language)) languages.push(language);
    return languages;
  }
  async function requestText(context, url) {
    const response = await context.network.request(url, {
      credentials: "include",
      cache: "no-store",
      fallback: "network-or-http",
      ...context.signal ? { signal: context.signal } : {}
    });
    if (!response.ok) {
      throw new Error(`YouTube request failed (${response.status})`);
    }
    return response.text;
  }
  async function acquireFromCaptionTrack(resolved, context) {
    const native = resolved.native;
    const videoId = String(native.videoId || resolved.ref.sourceId).trim();
    if (!videoId) return null;
    let response = native.playerResponse ?? runtimePlayerResponse(context.pageRuntime, videoId);
    let tracks = captionTracks(response);
    if (!tracks.length) {
      const watchUrl = videoWatchUrl(videoId);
      if (!watchUrl) return null;
      const html = await requestText(context, watchUrl);
      response = playerResponseFromHtml(html);
      tracks = captionTracks(response);
    }
    const track = pickCaptionTrack(
      tracks,
      preferredLanguages(context.pageRuntime)
    );
    const captionUrl = captionJson3Url(track);
    if (!track || !captionUrl) return null;
    const captionText = await requestText(context, captionUrl);
    let payload;
    try {
      payload = JSON.parse(captionText);
    } catch {
      return null;
    }
    const segments = parseJson3Transcript(payload);
    if (!segments.length) return null;
    return {
      ref: resolved.ref,
      segments,
      language: track.languageCode,
      origin: "caption_track",
      metadata: {
        track: {
          languageCode: track.languageCode,
          name: track.name,
          ...track.kind ? { kind: track.kind } : {},
          ...track.vssId ? { vssId: track.vssId } : {}
        }
      }
    };
  }
  function secondsFromLabel(label) {
    const parts = String(label || "").trim().split(":").map((part) => Number(part));
    if (!parts.length || parts.length > 3 || parts.some((part) => !Number.isFinite(part) || part < 0)) {
      return null;
    }
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return parts[0];
  }
  function textOf(element2) {
    return String(element2?.textContent || "").replace(/\s+/g, " ").trim();
  }
  function parseDomTranscript(document2) {
    const first = document2.querySelector(SEGMENT_SELECTOR);
    const scope = first?.closest("ytd-engagement-panel-section-list-renderer") ?? document2;
    const nodes = [...scope.querySelectorAll(SEGMENT_SELECTOR)];
    const draft = nodes.flatMap((element2, index) => {
      const classic = element2.matches("ytd-transcript-segment-renderer");
      const timestamp = textOf(
        element2.querySelector(
          classic ? ".segment-timestamp" : '[class*="Timestamp"]'
        )
      );
      const text = textOf(
        element2.querySelector(
          classic ? ".segment-text" : '.ytAttributedStringHost, [class*="AttributedString"]'
        )
      );
      const start2 = secondsFromLabel(timestamp);
      if (start2 === null || !text) return [];
      return [{ id: String(index + 1), start: start2, text }];
    });
    return draft.map((segment, index) => {
      const next = draft[index + 1];
      return {
        ...segment,
        ...next && next.start >= segment.start ? { end: next.start } : {}
      };
    });
  }
  function findTranscriptButton(document2) {
    return document2.querySelector(
      "ytd-video-description-transcript-section-renderer button, ytd-video-description-transcript-section-renderer tp-yt-paper-button"
    ) ?? document2.querySelector('button[aria-label*="transcript" i]');
  }
  function hasDomTranscript(document2) {
    return document2.querySelector(SEGMENT_SELECTOR) != null;
  }
  async function waitFor(predicate, timeoutMs, stepMs = 150) {
    const start2 = Date.now();
    while (Date.now() - start2 < timeoutMs) {
      if (predicate()) return true;
      await new Promise((resolve2) => globalThis.setTimeout(resolve2, stepMs));
    }
    return predicate();
  }
  async function ensureTranscriptPanel(document2) {
    if (hasDomTranscript(document2)) return true;
    const expand = document2.querySelector(
      "ytd-text-inline-expander #expand, ytd-watch-metadata #expand"
    );
    if (expand && !findTranscriptButton(document2)) {
      expand.click();
      await waitFor(() => findTranscriptButton(document2) != null, 1500);
    }
    const button = findTranscriptButton(document2);
    if (button) {
      button.click();
      await waitFor(() => hasDomTranscript(document2), 5e3);
    }
    return hasDomTranscript(document2);
  }
  async function acquireFromDom(resolved, context) {
    const document2 = runtimeDocument(context.pageRuntime);
    if (!document2) return null;
    const current = extractVideoRef(document2.location?.href || "");
    if (current?.videoId !== resolved.ref.sourceId) return null;
    if (!await ensureTranscriptPanel(document2)) return null;
    const segments = parseDomTranscript(document2);
    if (!segments.length) return null;
    return {
      ref: resolved.ref,
      segments,
      origin: "transcript_panel",
      metadata: {}
    };
  }
  const youtubeTranscriptSource = {
    id: YOUTUBE_SOURCE,
    async acquire(resolved, context) {
      const current = resolved;
      let networkError;
      try {
        const network = await acquireFromCaptionTrack(current, context);
        if (network) return network;
      } catch (error) {
        if (context.signal?.aborted) throw error;
        networkError = error;
      }
      const dom = await acquireFromDom(current, context);
      if (dom) return dom;
      if (networkError) throw networkError;
      return null;
    }
  };
  const providerRegistry = createProviderRegistry([
    bilibiliProvider,
    youtubeProvider
  ]);
  const transcriptSourceRegistry = createTranscriptSourceRegistry([
    bilibiliTranscriptSource,
    youtubeTranscriptSource
  ]);
  function resolve$1(href, pageRuntime) {
    return providerRegistry.resolveCurrent({ href, pageRuntime });
  }
  const resolveCurrentContent = resolve$1;
  async function acquire(href, pageRuntime, network, signal) {
    const resolved = providerRegistry.resolveCurrent({ href, pageRuntime });
    if (!resolved) return null;
    return transcriptSourceRegistry.acquire(resolved, {
      network,
      pageRuntime,
      ...signal ? { signal } : {}
    });
  }
  async function acquireDetailed(href, pageRuntime, network, signal) {
    const resolved = providerRegistry.resolveCurrent({ href, pageRuntime });
    if (!resolved) return { status: "unavailable", code: "unsupported", retryable: false };
    return transcriptSourceRegistry.acquireDetailed(resolved, {
      network,
      pageRuntime,
      ...signal ? { signal } : {}
    });
  }
  const acquireCurrentTranscript = acquire;
  function resolve(href, pageRuntime) {
    const resolved = resolve$1(href, pageRuntime);
    if (!resolved || resolved.ref.source !== bilibiliProvider.id) return null;
    return resolved.native;
  }
  const resolveCurrentVideoRef = resolve;
  function observe(options) {
    const getHref = () => String(options.pageWindow.location?.href || options.eventWindow.location?.href || "");
    const contentIdentity = () => {
      const resolved = providerRegistry.resolveCurrent({
        href: getHref(),
        pageRuntime: options.pageWindow
      });
      if (!resolved) return "";
      const native = resolved.native;
      return `${resolved.key}:${Number(native?.cid) || 0}`;
    };
    let lastHref = getHref();
    let lastIdentity = contentIdentity();
    let disposed = false;
    const notify = (force = false) => {
      if (disposed) return;
      const href = getHref();
      const identity = contentIdentity();
      if (!force && href === lastHref && identity === lastIdentity) return;
      lastHref = href;
      lastIdentity = identity;
      options.onNavigate();
    };
    const spaHandle = spa.observe(
      {
        historyWindow: options.pageWindow,
        eventWindow: options.eventWindow,
        documentRef: options.document,
        getHref,
        pollIntervalMs: 0,
        setTimeoutFn: options.eventWindow.setTimeout.bind(options.eventWindow)
      },
      () => notify()
    );
    const onHistoryEvent = () => {
      spaHandle.check();
      notify();
    };
    const onPageShow = () => options.onPageShow?.();
    const onVisibilityChange = () => {
      if (options.document.visibilityState === "visible") options.onVisible?.();
    };
    const onMediaLoad = (event) => {
      const tag = event.target?.tagName;
      if (tag === "VIDEO" || tag === "AUDIO") notify(true);
    };
    const onProviderNavigate = () => {
      spaHandle.check();
      notify(true);
    };
    options.pageWindow.addEventListener("popstate", onHistoryEvent);
    options.pageWindow.addEventListener("hashchange", onHistoryEvent);
    const providerNavigationEvents = providerRegistry.navigationEvents();
    for (const eventName of providerNavigationEvents) {
      options.pageWindow.addEventListener(eventName, onProviderNavigate);
    }
    options.eventWindow.addEventListener("pageshow", onPageShow);
    options.document.addEventListener("visibilitychange", onVisibilityChange);
    options.document.addEventListener("loadstart", onMediaLoad, true);
    const timer = options.eventWindow.setInterval(() => {
      spaHandle.check();
      notify();
    }, options.pollMs ?? 800);
    return () => {
      if (disposed) return;
      disposed = true;
      options.eventWindow.clearInterval(timer);
      options.pageWindow.removeEventListener("popstate", onHistoryEvent);
      options.pageWindow.removeEventListener("hashchange", onHistoryEvent);
      for (const eventName of providerNavigationEvents) {
        options.pageWindow.removeEventListener(eventName, onProviderNavigate);
      }
      options.eventWindow.removeEventListener("pageshow", onPageShow);
      options.document.removeEventListener("visibilitychange", onVisibilityChange);
      options.document.removeEventListener("loadstart", onMediaLoad, true);
      spaHandle.dispose();
    };
  }
  function start(options) {
    const activationState = () => providerRegistry.activationState({
      href: options.href(),
      pageRuntime: options.pageWindow
    });
    if (activationState() === "ready") {
      options.boot();
      return () => {
      };
    }
    let booted = false;
    let timer = 0;
    const cleanup = () => {
      if (timer) options.eventWindow.clearInterval(timer);
      timer = 0;
      options.pageWindow.removeEventListener("popstate", onCandidate);
      options.pageWindow.removeEventListener("hashchange", onCandidate);
      options.eventWindow.removeEventListener("pageshow", onCandidate);
      options.document.removeEventListener("loadstart", onMediaCandidate, true);
    };
    const bootOnce = () => {
      if (booted) return;
      booted = true;
      cleanup();
      options.boot();
    };
    const tryActivate = () => {
      if (booted) {
        cleanup();
        return;
      }
      if (activationState() === "ready") bootOnce();
    };
    const onCandidate = () => {
      options.eventWindow.setTimeout(tryActivate, 0);
    };
    const onMediaCandidate = (event) => {
      const target = event.target;
      if (target?.tagName === "VIDEO" || target?.tagName === "AUDIO") {
        onCandidate();
      }
    };
    options.pageWindow.addEventListener("popstate", onCandidate);
    options.pageWindow.addEventListener("hashchange", onCandidate);
    options.eventWindow.addEventListener("pageshow", onCandidate);
    options.document.addEventListener("loadstart", onMediaCandidate, true);
    timer = options.eventWindow.setInterval(() => {
      if (options.document.visibilityState === "visible") tryActivate();
    }, options.pollMs ?? 1500);
    tryActivate();
    return cleanup;
  }
  const ordering = {
    reorderIds,
    applyConfigIdOrder,
    applyPromptStageOrder
  };
  const scan = {
    parseListResponse,
    validateContext,
    pageSizeFor
  };
  const libraryScan = {
    collectPages,
    expandCollectionParts,
    seasonMemberPlan,
    collectUserSeasons,
    chooseSeasonMembers,
    mergeItems: mergeScanItems,
    assertActive: assertScanActive
  };
  const libraryJob = {
    currentKind,
    isPaused,
    setBusy,
    setProgress,
    clearProgress,
    togglePause,
    stop,
    waitWhilePaused,
    view
  };
  const content = {
    resolve: resolve$1
  };
  const video = {
    resolve
  };
  const transcript = {
    acquire,
    acquireDetailed
  };
  const ai = {
    createCoordinator,
    planTasks,
    partitionRuns,
    executeTasks,
    cloneSessionInput,
    summarizeRuns,
    ensureSubtitles,
    prepareBatchInput,
    hydratePlannedRuns,
    request,
    runPool
  };
  const preprocess = {
    settings,
    parseTimestamp,
    readingBlocks,
    buildPayload,
    prepareJobs,
    runChunkWithRetry,
    runPipeline
  };
  const studio = {
    parseStore,
    persist,
    restore,
    buildChatMessages,
    transcriptContext,
    compressTranscript,
    compactMemoryText,
    refreshMemory,
    lastAssistantText,
    beginTurn,
    updateTurn,
    finishTurn,
    failTurn,
    clearTurnHistory
  };
  const knowledge = {
    createController,
    selectAnchor,
    ancestorNodes,
    branchContext,
    reconcileNodes,
    updateStreamPreview,
    sortAnchors,
    cacheAnchor,
    cacheNode,
    saveAnchor,
    saveNode,
    deleteAnchorCommitted,
    runAnswer,
    completeAnswer,
    failAnswer,
    removeAnchor,
    createRepository
  };
  const acquisition = {
    signWbi,
    fetchVideoView,
    fetchVideoDetail,
    fetchSubtitleTracks,
    collectSubtitleTracks,
    resolveSubtitleUrl,
    fetchSubtitleBody
  };
  const navigation = {
    observe
  };
  const activation = {
    start
  };
  const app = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    acquireCurrentTranscript,
    acquisition,
    activation,
    ai,
    collectSubtitleTracks,
    content,
    fetchSubtitleBody,
    fetchSubtitleTracks,
    fetchVideoDetail,
    fetchVideoView,
    knowledge,
    libraryJob,
    libraryScan,
    navigation,
    observe,
    ordering,
    preprocess,
    resolve,
    resolveCurrentContent,
    resolveCurrentVideoRef,
    resolveSubtitleUrl,
    scan,
    signWbi,
    start,
    studio,
    transcript,
    video
  }, Symbol.toStringTag, { value: "Module" }));
  const PANEL_SIZE_PRESETS = {
    small: { viewportRatio: 0.32, min: 440, max: 560 },
    medium: { viewportRatio: 0.48, min: 620, max: 820 },
    large: { viewportRatio: 0.68, min: 860, max: 1180 }
  };
  const DEFAULT_PANEL_SIZE = "large";
  const MIN_PANEL_WIDTH = 420;
  const MIN_PANEL_HEIGHT = 520;
  function isPanelSizePreset(value) {
    return typeof value === "string" && Object.hasOwn(PANEL_SIZE_PRESETS, value);
  }
  function panelPresetWidth(name, viewportWidth) {
    const preset = isPanelSizePreset(name) ? PANEL_SIZE_PRESETS[name] : PANEL_SIZE_PRESETS[DEFAULT_PANEL_SIZE];
    const desired = Math.round((Number(viewportWidth) || 0) * preset.viewportRatio);
    const available = Math.max(MIN_PANEL_WIDTH, (Number(viewportWidth) || 0) - 16);
    return Math.min(available, Math.max(preset.min, Math.min(preset.max, desired)));
  }
  function highPanelHeight(viewportHeight) {
    const available = Math.max(MIN_PANEL_HEIGHT, (Number(viewportHeight) || 0) - 16);
    return Math.min(available, Math.max(MIN_PANEL_HEIGHT, Math.round((Number(viewportHeight) || 0) * 0.9)));
  }
  function panelSizeClassFromWidth(width, viewportWidth) {
    const value = Number(width) || panelPresetWidth(DEFAULT_PANEL_SIZE, viewportWidth);
    const names = Object.keys(PANEL_SIZE_PRESETS);
    return names.reduce((best, name) => Math.abs(value - panelPresetWidth(name, viewportWidth)) < Math.abs(value - panelPresetWidth(best, viewportWidth)) ? name : best, DEFAULT_PANEL_SIZE);
  }
  function clampPanelRect(ui2, vw, vh) {
    const next = { ...ui2 };
    if (isPanelSizePreset(next.sizePreset)) {
      next.w = panelPresetWidth(next.sizePreset, vw);
    } else {
      next.sizePreset = "custom";
      next.w = Math.min(Math.max(MIN_PANEL_WIDTH, next.w), Math.max(MIN_PANEL_WIDTH, vw - 8));
    }
    if (next.heightMode !== "custom") {
      next.heightMode = "high";
      next.h = highPanelHeight(vh);
    } else {
      next.h = Math.min(Math.max(MIN_PANEL_HEIGHT, next.h), Math.max(MIN_PANEL_HEIGHT, vh - 8));
    }
    next.x = Math.min(Math.max(0, next.x), Math.max(0, vw - next.w));
    next.y = Math.min(Math.max(0, next.y), Math.max(0, vh - next.h));
    return next;
  }
  const geometry = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    DEFAULT_PANEL_SIZE,
    MIN_PANEL_HEIGHT,
    MIN_PANEL_WIDTH,
    PANEL_SIZE_PRESETS,
    clampPanelRect,
    highPanelHeight,
    isPanelSizePreset,
    panelPresetWidth,
    panelSizeClassFromWidth
  }, Symbol.toStringTag, { value: "Module" }));
  function setPanelOpen(state2, open) {
    return {
      ...state2,
      open,
      dock: open ? state2.dock : null,
      dockExpanded: open ? Boolean(state2.dock) : false,
      aiFocus: open ? state2.aiFocus : false
    };
  }
  function setPanelDock(state2, side, viewportWidth) {
    return {
      ...state2,
      open: true,
      aiFocus: side ? false : state2.aiFocus,
      dock: side,
      dockExpanded: false,
      x: side === "right" ? Math.max(0, viewportWidth - state2.w - 12) : side === "left" ? 12 : state2.x
    };
  }
  function expandPanelDock(state2, force) {
    if (!state2.dock) return { ...state2 };
    return {
      ...state2,
      open: true,
      dockExpanded: typeof force === "boolean" ? force : !state2.dockExpanded
    };
  }
  function preferredDockSide(state2, viewportWidth) {
    return state2.x + state2.w / 2 < viewportWidth / 2 ? "left" : "right";
  }
  const state = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    expandPanelDock,
    preferredDockSide,
    setPanelDock,
    setPanelOpen
  }, Symbol.toStringTag, { value: "Module" }));
  function movePanel(ui2, drag, clientX, clientY) {
    return { ...ui2, x: clientX - drag.ox, y: clientY - drag.oy };
  }
  function resizePanel(ui2, drag, clientX, clientY) {
    const dx = clientX - drag.sx;
    const dy = clientY - drag.sy;
    const d = drag.dir;
    let { x, y, w, h } = { x: drag.ox, y: drag.oy, w: drag.ow, h: drag.oh };
    if (d.includes("e")) w = drag.ow + dx;
    if (d.includes("s")) h = drag.oh + dy;
    if (d.includes("w")) {
      w = drag.ow - dx;
      x = drag.ox + dx;
    }
    if (d.includes("n")) {
      h = drag.oh - dy;
      y = drag.oy + dy;
    }
    if (w < MIN_PANEL_WIDTH) {
      if (d.includes("w")) x = drag.ox + drag.ow - MIN_PANEL_WIDTH;
      w = MIN_PANEL_WIDTH;
    }
    if (h < MIN_PANEL_HEIGHT) {
      if (d.includes("n")) y = drag.oy + drag.oh - MIN_PANEL_HEIGHT;
      h = MIN_PANEL_HEIGHT;
    }
    return {
      ...ui2,
      x,
      y,
      w,
      h,
      sizePreset: d.includes("e") || d.includes("w") ? "custom" : ui2.sizePreset,
      heightMode: d.includes("n") || d.includes("s") ? "custom" : ui2.heightMode
    };
  }
  function snapPanelSide(ui2, viewportWidth, threshold = 36) {
    if (ui2.x <= threshold) return "left";
    if (ui2.x + ui2.w >= viewportWidth - threshold) return "right";
    return null;
  }
  function shouldAutoHideDock(dock, expanded, pointerHover) {
    return Boolean(dock && expanded && !pointerHover);
  }
  const interaction = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    movePanel,
    resizePanel,
    shouldAutoHideDock,
    snapPanelSide
  }, Symbol.toStringTag, { value: "Module" }));
  function bindPanelPointerController(options) {
    const { root } = options;
    const sidebar = root.querySelector(".bsb-sidebar");
    const head = root.querySelector(".bsb-head");
    if (!sidebar || !head) throw new Error("Studio shell pointer elements are missing");
    let drag = null;
    head.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest("button, select, input, a, label")) return;
      const ui2 = options.getState();
      if (ui2.dock) {
        options.update({ dock: null, dockExpanded: false });
        options.setOpen(true);
      }
      drag = { pid: event.pointerId, ox: event.clientX - ui2.x, oy: event.clientY - ui2.y };
      head.setPointerCapture(event.pointerId);
      sidebar.classList.add("dragging");
      event.preventDefault();
    });
    head.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.pid) return;
      const viewport = options.viewport();
      const next = clampPanelRect(movePanel(options.getState(), drag, event.clientX, event.clientY), viewport.width, viewport.height);
      options.update(next);
      options.render();
    });
    const endDrag = (event) => {
      if (!drag || event.pointerId !== drag.pid) return;
      drag = null;
      sidebar.classList.remove("dragging");
      const side = snapPanelSide(options.getState(), options.viewport().width, options.snapThreshold);
      if (side) options.setDock(side);
      else options.persist();
    };
    head.addEventListener("pointerup", endDrag);
    head.addEventListener("pointercancel", endDrag);
    root.querySelectorAll(".bsb-resize").forEach((handle) => {
      let resize = null;
      handle.addEventListener("pointerdown", (event) => {
        const ui2 = options.getState();
        if (event.button !== 0 || ui2.dock) return;
        resize = {
          pid: event.pointerId,
          dir: handle.getAttribute("data-dir") || "",
          sx: event.clientX,
          sy: event.clientY,
          ox: ui2.x,
          oy: ui2.y,
          ow: ui2.w,
          oh: ui2.h
        };
        handle.setPointerCapture(event.pointerId);
        sidebar.classList.add("resizing");
        event.preventDefault();
        event.stopPropagation();
      });
      handle.addEventListener("pointermove", (event) => {
        if (!resize || event.pointerId !== resize.pid) return;
        const viewport = options.viewport();
        const next = clampPanelRect(resizePanel(options.getState(), resize, event.clientX, event.clientY), viewport.width, viewport.height);
        options.update(next);
        options.render();
      });
      const endResize = (event) => {
        if (!resize || event.pointerId !== resize.pid) return;
        resize = null;
        sidebar.classList.remove("resizing");
        options.persist();
      };
      handle.addEventListener("pointerup", endResize);
      handle.addEventListener("pointercancel", endResize);
    });
  }
  const pointerController = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    bindPanelPointerController
  }, Symbol.toStringTag, { value: "Module" }));
  function bindPanelChromeControls(options) {
    const { root } = options;
    const sidebar = root.querySelector(".bsb-sidebar");
    const fab = root.querySelector(".bsb-fab");
    const dockTab = root.querySelector(".bsb-dock-tab");
    const close = root.querySelector(".bsb-close");
    const dock = root.querySelector('[data-act="dock"]');
    const collapse = root.querySelector('[data-act="collapse"]');
    if (!sidebar || !fab || !dockTab || !close || !dock || !collapse) {
      throw new Error("Studio shell controls are missing");
    }
    let hideTimer = null;
    const clearHide = () => {
      if (hideTimer !== null) clearTimeout(hideTimer);
      hideTimer = null;
    };
    const autoHide = () => {
      const state2 = options.state();
      if (!state2.dock || !state2.dockExpanded) return;
      clearHide();
      hideTimer = setTimeout(() => {
        hideTimer = null;
        const hover = Boolean(root.querySelector(".bsb-sidebar:hover, .bsb-dock-tab:hover"));
        const now = options.state();
        if (hover) {
          autoHide();
        } else if (shouldAutoHideDock(now.dock, now.dockExpanded, false)) {
          options.expandDock(false);
        }
      }, options.autoHideDelay ?? 700);
    };
    fab.addEventListener("click", () => {
      const state2 = options.state();
      if (state2.dock) options.expandDock(true);
      else options.setOpen(!state2.open);
    });
    close.addEventListener("click", (event) => {
      event.stopPropagation();
      options.setOpen(false);
    });
    root.querySelectorAll('[data-act="panel-size"]').forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        if (button.dataset.size) options.selectSize(button.dataset.size);
      });
    });
    dock.addEventListener("click", (event) => {
      event.stopPropagation();
      options.setDock(options.state().dock ? null : options.preferredDockSide());
    });
    collapse.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!options.state().dock) options.setDock(options.preferredDockSide());
      else options.expandDock(false);
    });
    dockTab.addEventListener("click", () => options.expandDock(true));
    dockTab.addEventListener("mouseenter", () => {
      clearHide();
      if (options.state().dock && !options.state().dockExpanded) options.expandDock(true);
    });
    sidebar.addEventListener("mouseenter", clearHide);
    sidebar.addEventListener("mouseleave", autoHide);
    dockTab.addEventListener("mouseleave", autoHide);
  }
  const chromeController = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    bindPanelChromeControls
  }, Symbol.toStringTag, { value: "Module" }));
  function renderPanelHeader(version) {
    return `
      <button type="button" class="bsb-dock-tab" title="展开 SubBatch 工作台">AI · CC</button>
      <aside class="bsb-sidebar" role="complementary" aria-label="Bili SubBatch Workspace" aria-hidden="true">
        <div class="bsb-resize n" data-dir="n"></div>
        <div class="bsb-resize s" data-dir="s"></div>
        <div class="bsb-resize e" data-dir="e"></div>
        <div class="bsb-resize w" data-dir="w"></div>
        <div class="bsb-resize ne" data-dir="ne"></div>
        <div class="bsb-resize nw" data-dir="nw"></div>
        <div class="bsb-resize se" data-dir="se"></div>
        <div class="bsb-resize sw" data-dir="sw"></div>
        <div class="bsb-head">
          <div class="bsb-head-title">
            <span class="bsb-logo" aria-hidden="true">S</span>
            <span class="bsb-brand-stack"><strong>SubBatch</strong><span class="bsb-head-context" data-role="workspace-title">AI 工作台</span></span>
            <span class="bsb-ver">v${version}</span>
          </div>
          <div class="bsb-head-actions">
            <div class="bsb-size-switch" role="group" aria-label="面板宽度">
              <button type="button" data-act="panel-size" data-size="small" aria-pressed="false" title="紧凑宽度">S</button>
              <button type="button" data-act="panel-size" data-size="medium" aria-pressed="false" title="标准宽度">M</button>
              <button type="button" data-act="panel-size" data-size="large" aria-pressed="false" title="宽屏阅读">L</button>
            </div>
            <button type="button" class="bsb-icon-btn" data-act="dock" title="贴边收起" aria-label="贴边收起">◧</button>
            <button type="button" class="bsb-icon-btn" data-act="collapse" title="最小化" aria-label="最小化">−</button>
            <button type="button" class="bsb-icon-btn bsb-close" title="关闭" aria-label="关闭">×</button>
          </div>
        </div>
        <nav class="bsb-nav" aria-label="Workspace">
          <div class="bsb-nav-primary">
            <button type="button" data-view="ai" class="active" title="AI 工作台"><span class="bsb-nav-icon" aria-hidden="true">✦</span><span class="bsb-nav-label">AI</span></button>
            <button type="button" data-view="subs" title="字幕库"><span class="bsb-nav-icon" aria-hidden="true">≡</span><span class="bsb-nav-label">字幕</span></button>
            <button type="button" data-view="knowledge" title="Knowledge"><span class="bsb-nav-icon" aria-hidden="true">◇</span><span class="bsb-nav-label">知识</span></button>
          </div>
          <div class="bsb-nav-secondary">
            <button type="button" data-view="settings" title="设置"><span class="bsb-nav-icon" aria-hidden="true">⚙</span><span class="bsb-nav-label">设置</span></button>
          </div>
        </nav>
`;
  }
  const markup$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    renderPanelHeader
  }, Symbol.toStringTag, { value: "Module" }));
  function renderShellStyles(panelId, minW, minH, dockEdgePx) {
    return `      #${panelId} {
        position: fixed;
        top: 0;
        left: 0;
        width: 0;
        height: 0;
        z-index: 2147483646;
        --bsb-note-font: 14px;
        --bsb-knowledge-font: 14px;
        --bsb-ui-font: 14px;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI",
          "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
        font-size: 14px;
        font-synthesis: none;
        isolation: isolate;
        contain: style;
        color: var(--ctp-text);
        color-scheme: dark;
        line-height: 1.45;
        pointer-events: none;
      }
      #${panelId}[data-ctp-flavor="latte"] { color-scheme: light; }
      #${panelId} * { box-sizing: border-box; }

      #${panelId} .bsb-fab,
      #${panelId} .bsb-sidebar,
      #${panelId} .bsb-dock-tab {
        pointer-events: auto;
      }

      #${panelId} .bsb-fab {
        position: fixed;
        right: 14px;
        bottom: 88px;
        width: 46px;
        height: 46px;
        border-radius: 14px;
        border: 1px solid color-mix(in srgb, var(--ctp-lavender) 45%, transparent);
        cursor: pointer;
        background: color-mix(in srgb, var(--ctp-mantle) 55%, transparent);
        color: var(--ctp-lavender);
        font-weight: 700;
        font-size: 12px;
        letter-spacing: 0.04em;
        box-shadow: 0 8px 28px color-mix(in srgb, var(--ctp-crust) 55%, transparent);
        backdrop-filter: blur(14px) saturate(1.2);
        -webkit-backdrop-filter: blur(14px) saturate(1.2);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform .15s ease, border-color .15s ease, color .15s ease,
          background .15s ease, opacity .15s ease;
      }
      #${panelId} .bsb-fab:hover {
        transform: translateY(-1px);
        color: var(--ctp-base);
        background: color-mix(in srgb, var(--ctp-lavender) 88%, transparent);
        border-color: var(--ctp-lavender);
      }
      #${panelId}.open .bsb-fab,
      #${panelId}.docked .bsb-fab {
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
      }

      /* 悬浮玻璃工作台 */
      #${panelId} .bsb-sidebar {
        position: fixed;
        display: none;
        flex-direction: column;
        overflow: hidden;
        border-radius: 18px;
        border: 1px solid color-mix(in srgb, var(--ctp-overlay0) 32%, transparent);
        background: color-mix(in srgb, var(--ctp-base) 72%, transparent);
        backdrop-filter: blur(22px) saturate(1.4);
        -webkit-backdrop-filter: blur(22px) saturate(1.4);
        box-shadow:
          0 24px 64px color-mix(in srgb, var(--ctp-crust) 55%, transparent),
          0 0 0 1px color-mix(in srgb, var(--ctp-lavender) 8%, transparent),
          inset 0 1px 0 color-mix(in srgb, var(--ctp-overlay2) 22%, transparent);
        min-width: ${minW}px;
        min-height: ${minH}px;
        contain: layout paint style;
      }
      #${panelId}.open:not(.docked) .bsb-sidebar {
        display: flex;
      }
      /* 贴边收起时：主面板隐藏，只留 dock-tab；展开时显示 */
      #${panelId}.docked.dock-expanded .bsb-sidebar {
        display: flex;
      }

      /* 贴边标签 */
      #${panelId} .bsb-dock-tab {
        display: none;
        position: fixed;
        top: 50%;
        transform: translateY(-50%);
        width: ${dockEdgePx}px;
        padding: 14px 0;
        writing-mode: vertical-rl;
        text-orientation: mixed;
        letter-spacing: 0.18em;
        font-size: 12px;
        font-weight: 650;
        color: var(--ctp-lavender);
        cursor: pointer;
        user-select: none;
        border: 1px solid color-mix(in srgb, var(--ctp-lavender) 40%, transparent);
        background: color-mix(in srgb, var(--ctp-mantle) 62%, transparent);
        backdrop-filter: blur(14px) saturate(1.2);
        -webkit-backdrop-filter: blur(14px) saturate(1.2);
        box-shadow: 0 8px 28px color-mix(in srgb, var(--ctp-crust) 40%, transparent);
        z-index: 1;
      }
      #${panelId}.docked .bsb-dock-tab { display: flex; align-items: center; justify-content: center; }
      #${panelId}.docked[data-dock="right"] .bsb-dock-tab {
        right: 0;
        border-radius: 12px 0 0 12px;
        border-right: none;
      }
      #${panelId}.docked[data-dock="left"] .bsb-dock-tab {
        left: 0;
        border-radius: 0 12px 12px 0;
        border-left: none;
      }
      #${panelId} .bsb-dock-tab:hover {
        color: var(--ctp-base);
        background: color-mix(in srgb, var(--ctp-lavender) 85%, transparent);
      }

      #${panelId} .bsb-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px 10px;
        flex-shrink: 0;
        gap: 10px;
        border-bottom: 1px solid color-mix(in srgb, var(--ctp-surface0) 80%, transparent);
        background:
          linear-gradient(180deg,
            color-mix(in srgb, var(--ctp-mantle) 70%, transparent) 0%,
            color-mix(in srgb, var(--ctp-base) 35%, transparent) 100%);
        cursor: grab;
        user-select: none;
        touch-action: none;
      }
      #${panelId} .bsb-head:active { cursor: grabbing; }
      #${panelId} .bsb-head .bsb-head-title {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
      }
      #${panelId} .bsb-logo {
        width: 28px; height: 28px; border-radius: 9px;
        display: inline-flex; align-items: center; justify-content: center;
        font-size: 11px; font-weight: 800; letter-spacing: -0.02em;
        color: var(--ctp-crust);
        background: linear-gradient(135deg, var(--ctp-lavender), var(--ctp-mauve));
        box-shadow: 0 4px 14px color-mix(in srgb, var(--ctp-mauve) 35%, transparent);
      }
      #${panelId} .bsb-head strong {
        font-size: 14px;
        font-weight: 700;
        color: var(--ctp-text);
        letter-spacing: 0.01em;
      }
      #${panelId} .bsb-head .bsb-ver {
        font-size: 10px;
        color: var(--ctp-overlay1);
        font-weight: 500;
        padding: 2px 7px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--ctp-surface0) 55%, transparent);
      }
      #${panelId} .bsb-flavor {
        display: none;
      }
      #${panelId} .bsb-size-switch {
        display: inline-flex;
        align-items: center;
        padding: 2px;
        gap: 1px;
        border-radius: 9px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 58%, transparent);
        background: color-mix(in srgb, var(--ctp-crust) 36%, transparent);
      }
      #${panelId} .bsb-size-switch button {
        width: 25px;
        height: 23px;
        padding: 0;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: var(--ctp-overlay1);
        cursor: pointer;
        font-size: 10.5px;
        font-weight: 700;
      }
      #${panelId} .bsb-size-switch button:hover {
        color: var(--ctp-text);
        background: color-mix(in srgb, var(--ctp-surface1) 55%, transparent);
      }
      #${panelId} .bsb-size-switch button.active {
        color: var(--ctp-crust);
        background: linear-gradient(135deg, var(--ctp-lavender), var(--ctp-mauve));
        box-shadow: 0 3px 10px color-mix(in srgb, var(--ctp-mauve) 24%, transparent);
      }
      #${panelId}[data-panel-size="small"] .bsb-head {
        padding-inline: 10px;
        gap: 6px;
      }
      #${panelId}[data-panel-size="small"] .bsb-head .bsb-ver,
      #${panelId}[data-panel-size="small"] .bsb-ai-compact-stats {
        display: none;
      }
      #${panelId}[data-panel-size="small"] .bsb-ai-commandbar {
        gap: 5px;
      }
      #${panelId}[data-panel-size="small"] .bsb-ai-command-actions {
        gap: 3px;
      }
      #${panelId}[data-panel-size="small"] .bsb-ai-command-actions .bsb-btn {
        padding-inline: 7px;
      }
      #${panelId}[data-panel-size="small"] .bsb-ai-md {
        padding-inline: 15px;
      }
      #${panelId}[data-panel-size="small"] .bsb-ai-content {
        max-width: 100%;
      }
      #${panelId}[data-panel-size="medium"] .bsb-ai-content {
        max-width: 56em;
      }
      #${panelId}[data-panel-size="large"] .bsb-ai-content {
        max-width: 72em;
      }
      /* 主导航 */
      #${panelId} .bsb-nav {
        display: flex;
        gap: 4px;
        padding: 8px 12px;
        flex-shrink: 0;
        border-bottom: 1px solid color-mix(in srgb, var(--ctp-surface0) 70%, transparent);
        background: color-mix(in srgb, var(--ctp-mantle) 35%, transparent);
      }
      #${panelId} .bsb-nav button {
        flex: 1;
        height: 36px;
        border: none;
        border-radius: 11px;
        cursor: pointer;
        font-size: 12.5px;
        font-weight: 650;
        color: var(--ctp-subtext0);
        background: transparent;
        transition: background .15s, color .15s, box-shadow .15s;
        letter-spacing: 0.01em;
      }
      #${panelId} .bsb-nav button:hover {
        color: var(--ctp-text);
        background: color-mix(in srgb, var(--ctp-surface0) 45%, transparent);
      }
      #${panelId} .bsb-nav button.active {
        color: var(--ctp-crust);
        background: linear-gradient(135deg,
          color-mix(in srgb, var(--ctp-lavender) 92%, transparent),
          color-mix(in srgb, var(--ctp-mauve) 88%, transparent));
        box-shadow: 0 6px 18px color-mix(in srgb, var(--ctp-mauve) 28%, transparent);
      }
      #${panelId} .bsb-head-actions {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
      }
      #${panelId} .bsb-icon-btn {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        background: color-mix(in srgb, var(--ctp-surface0) 55%, transparent);
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 60%, transparent);
        color: var(--ctp-subtext0);
        cursor: pointer;
        font-size: 14px;
        line-height: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: color .12s, background .12s, border-color .12s;
      }
      #${panelId} .bsb-icon-btn:hover {
        color: var(--ctp-lavender);
        border-color: color-mix(in srgb, var(--ctp-lavender) 40%, transparent);
        background: color-mix(in srgb, var(--ctp-lavender) 12%, transparent);
      }
      #${panelId} .bsb-icon-btn.bsb-close:hover {
        color: var(--ctp-red);
        border-color: color-mix(in srgb, var(--ctp-red) 40%, transparent);
        background: color-mix(in srgb, var(--ctp-red) 12%, transparent);
      }

      /* 拉伸手柄 */
      #${panelId} .bsb-resize {
        position: absolute;
        z-index: 3;
        background: transparent;
      }
      #${panelId} .bsb-resize.n { top: 0; left: 10px; right: 10px; height: 6px; cursor: ns-resize; }
      #${panelId} .bsb-resize.s { bottom: 0; left: 10px; right: 10px; height: 6px; cursor: ns-resize; }
      #${panelId} .bsb-resize.e { right: 0; top: 10px; bottom: 10px; width: 6px; cursor: ew-resize; }
      #${panelId} .bsb-resize.w { left: 0; top: 10px; bottom: 10px; width: 6px; cursor: ew-resize; }
      #${panelId} .bsb-resize.ne { top: 0; right: 0; width: 12px; height: 12px; cursor: nesw-resize; }
      #${panelId} .bsb-resize.nw { top: 0; left: 0; width: 12px; height: 12px; cursor: nwse-resize; }
      #${panelId} .bsb-resize.se { bottom: 0; right: 0; width: 14px; height: 14px; cursor: nwse-resize; }
      #${panelId} .bsb-resize.sw { bottom: 0; left: 0; width: 12px; height: 12px; cursor: nesw-resize; }
      #${panelId} .bsb-resize.se::after {
        content: "";
        position: absolute;
        right: 3px;
        bottom: 3px;
        width: 8px;
        height: 8px;
        border-right: 2px solid color-mix(in srgb, var(--ctp-overlay1) 70%, transparent);
        border-bottom: 2px solid color-mix(in srgb, var(--ctp-overlay1) 70%, transparent);
        border-radius: 0 0 2px 0;
      }
      #${panelId}.docked .bsb-resize { display: none; }
      #${panelId} .bsb-sidebar.dragging,
      #${panelId} .bsb-sidebar.resizing {
        transition: none !important;
        user-select: none;
      }

      /* 内容区：三工作区切换 */
`;
  }
  const styles = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    renderShellStyles
  }, Symbol.toStringTag, { value: "Module" }));
  function renderWorkspaceLayoutStyles(panelId) {
    return `
      #${panelId} .bsb-body {
        padding: 0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        min-height: 0;
        flex: 1;
      }
      #${panelId} .bsb-view {
        display: none;
        flex-direction: column;
        gap: 10px;
        padding: 12px 14px 10px;
        min-height: 0;
        flex: 1 1 0;
        overflow: hidden;
      }
      #${panelId} .bsb-view.active { display: flex; }
      /* AI 页：画布吃掉剩余高度（给绝对定位阅读器当基准） */
      #${panelId} .bsb-view[data-view-panel="ai"] {
        gap: 8px;
      }
      #${panelId} .bsb-view[data-view-panel="ai"] .bsb-ai-canvas-wrap {
        flex: 1 1 0;
        min-height: 260px;
      }

  `;
  }
  const layoutStyles = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    renderWorkspaceLayoutStyles
  }, Symbol.toStringTag, { value: "Module" }));
  function renderAiWorkspace() {
    return `<section class="bsb-view active" data-view-panel="ai">
            <div class="bsb-ai-commandbar bsb-workbench-commandbar">
              <div class="bsb-ai-command-main">
                <div class="bsb-ai-stage-tabs" data-role="ai-stage-tabs" aria-label="AI 处理阶段">
                  <button type="button" data-ai-stage="preprocess" class="active"><span class="bsb-stage-index">1</span><span><strong>预处理</strong><small>字幕整理</small></span></button>
                  <span class="bsb-stage-connector">→</span>
                  <button type="button" data-ai-stage="chat"><span class="bsb-stage-index">2</span><span><strong>对话</strong><small>对着字幕聊</small></span></button>
                  <span class="bsb-stage-connector">→</span>
                  <button type="button" data-ai-stage="postprocess"><span class="bsb-stage-index">3</span><span><strong>后处理</strong><small>Mermaid / HTML 页</small></span></button>
                </div>
                <div class="bsb-ai-compact-stats bsb-chips" data-role="ai-chips" title="当前选择状态">
                  <span class="bsb-chip">选 <em data-role="chip-sel">0</em></span>
                  <span class="bsb-chip">字幕 <em data-role="chip-ok">0</em></span>
                  <span class="bsb-chip" data-role="chip-model">0 runs</span>
                </div>
              </div>
              <div class="bsb-ai-command-actions">
                <button type="button" class="bsb-btn ghost" data-act="ai-flow-drawer" title="配置预处理和后处理流程">流程</button>
                <button type="button" class="bsb-btn danger" data-act="ai-stop" style="display:none">停止</button>
                <button type="button" class="bsb-btn accent" data-act="ai-send" data-pipeline-action title="按照当前处理方案运行">运行</button>
              </div>
            </div>
            <div class="bsb-preprocess-nav" data-role="ai-preprocess-nav" aria-label="预处理字幕导航">
              <div class="bsb-preprocess-tabs">
                <button type="button" data-ai-preprocess-view="raw" class="active"><span class="dot raw"></span><span>原始字幕</span></button>
                <button type="button" data-ai-preprocess-view="processed"><span class="dot processed"></span><span>AI 处理字幕</span></button>
              </div>
              <span class="bsb-preprocess-status" data-role="ai-preprocess-status">等待字幕</span>
            </div>
            <div class="bsb-output-nav" data-role="ai-postprocess-nav" aria-label="后处理产物导航" hidden>
              <div class="bsb-output-tabs" data-role="ai-result-tabs">
                <span class="bsb-ai-result-empty">在“处理方案”中添加一个或多个后处理产物</span>
              </div>
              <div class="bsb-model-tabs" data-role="ai-model-tabs"></div>
            </div>
            <div class="bsb-ai-drawer-backdrop" data-role="ai-drawer-backdrop" hidden></div>
            <aside class="bsb-ai-drawer" data-role="ai-flow-drawer" aria-hidden="true"></aside>
            <aside class="bsb-ai-drawer bsb-ai-input-drawer" data-role="ai-input-drawer" aria-hidden="true"></aside>
            <aside class="bsb-knowledge-rail" data-role="knowledge-rail" aria-hidden="true"></aside>
            <div class="bsb-ai-canvas-wrap">
              <div class="bsb-ai-canvas-bar">
                <span class="bsb-bar-left">
                  <span class="bsb-live-dot" aria-hidden="true"></span>
                  <span data-role="ai-canvas-stage-label">预处理</span>
                  <span data-role="ai-canvas-meta">原始字幕</span>
                </span>
                <span class="bsb-bar-actions">
                  <button type="button" class="bsb-mini bsb-focus-stop" data-act="ai-stop" title="停止本批次所有仍在生成的模型" style="display:none">停止</button>
                  <button type="button" class="bsb-mini" data-preprocess-action data-act="ai-copy-input" title="复制当前字幕">复制字幕</button>
                  <button type="button" class="bsb-mini" data-preprocess-action data-act="ai-reprocess" title="强制重新运行字幕预处理">重做预处理</button>
                  <button type="button" class="bsb-mini on" data-postprocess-action data-act="ai-stick" title="跟随最新 / 暂停跟随（上滑也会自动暂停）" hidden>粘底</button>
                  <button type="button" class="bsb-mini" data-postprocess-action data-act="ai-regenerate-current" title="只重新生成当前产物的当前模型版本" hidden>重试</button>
                  <button type="button" class="bsb-mini" data-postprocess-action data-act="ai-copy" title="复制当前输出" hidden>复制</button>
                  <button type="button" class="bsb-mini" data-postprocess-action data-act="ai-export" title="导出当前产物（HTML 页或 Markdown）" hidden>导出</button>
                  <button type="button" class="bsb-mini" data-studio-action data-act="studio-clear" title="清空当前对话" hidden>清空</button>
                  <button type="button" class="bsb-mini" data-studio-action data-act="studio-copy" title="复制上一条回答" hidden>复制</button>
                  <button type="button" class="bsb-mini" data-studio-action data-act="studio-export" title="导出对话" hidden>导出</button>
                  <button type="button" class="bsb-mini" data-act="ai-font-dec" title="减小正文字号">A−</button>
                  <button type="button" class="bsb-mini" data-act="ai-font-inc" title="增大正文字号">A+</button>
                  <button type="button" class="bsb-mini" data-act="ai-top" title="回到顶部">顶部</button>
                  <button type="button" class="bsb-mini bsb-focus-toggle" data-act="ai-focus" aria-pressed="false" title="铺满窗口，只保留模型标签与正文"><span class="focus-enter">专注</span><span class="focus-exit">退出专注</span></button>
                </span>
              </div>
              <div class="bsb-ai-stream" data-role="ai-stream">
                <pre class="bsb-ai-raw" data-role="ai-raw" hidden></pre>
                <div class="bsb-ai-md" data-role="ai-md">
                  <div class="bsb-ai-content" data-role="ai-content" aria-label="AI 笔记输出">
                    <div class="bsb-empty">
                      <div class="bsb-empty-ico">✦</div>
                      <strong>还没有分析结果</strong>
                      <span>在「字幕库」采集并勾选视频，再点「开始分析」。生成中上滑即可自由阅读（不会被拽回底部）；跟随时点「↓ 最新」。</span>
                    </div>
                  </div>
                  <div class="bsb-ai-anchor" data-role="ai-anchor"></div>
                </div>
                <button type="button" class="bsb-jump-latest" data-act="ai-jump" title="跳到最新输出">↓ 最新</button>
              </div>
              <div class="bsb-studio-dock" data-role="studio-dock" hidden>
                <div class="bsb-studio-slash" data-role="studio-slash" hidden></div>
                <div class="bsb-studio-composer">
                  <textarea data-role="studio-input" rows="1" placeholder="对着这一期提问… 输入 / 使用命令"></textarea>
                  <button type="button" class="bsb-btn accent" data-act="studio-send" title="发送">发送</button>
                </div>
              </div>
            </div>
          </section>`;
  }
  function renderSubsWorkspace(maxPages, delayMs) {
    return `<section class="bsb-view" data-view-panel="subs">
            <div class="bsb-library-jobbar" data-role="library-jobbar" hidden>
              <div class="bsb-job-progress">
                <span class="bsb-job-dot" data-role="job-dot" aria-hidden="true"></span>
                <div class="bsb-job-copy">
                  <strong data-role="job-title">准备任务</strong>
                  <span data-role="job-meta">空闲</span>
                </div>
                <div class="bsb-job-meter" aria-hidden="true"><i data-role="job-meter"></i></div>
              </div>
              <div class="bsb-job-actions">
                <button type="button" data-act="job-pause" title="暂停当前扫描或字幕抓取，稍后再继续">暂停</button>
                <button type="button" data-act="job-stop" title="停止任务，已完成的条目会保留">停止</button>
              </div>
            </div>
            <div class="bsb-library-topbar">
              <button type="button" class="bsb-btn primary" data-act="capture-toggle">＋ 采集视频</button>
              <label class="bsb-library-search" title="搜索标题、BV、UP 或来源">
                <span>⌕</span>
                <input type="search" data-role="library-search" placeholder="搜索视频 / BV / UP…" autocomplete="off">
              </label>
              <div class="bsb-library-filterbar" data-role="library-filters" aria-label="字幕状态筛选">
                <button type="button" data-library-filter="all" class="active">全部 <span data-library-count="all">0</span></button>
                <button type="button" data-library-filter="ok">有字幕 <span data-library-count="ok">0</span></button>
                <button type="button" data-library-filter="wait">待抓取 <span data-library-count="wait">0</span></button>
                <button type="button" data-library-filter="error">失败 <span data-library-count="error">0</span></button>
                <button type="button" data-library-filter="empty">无字幕 <span data-library-count="empty">0</span></button>
              </div>
            </div>

            <div class="bsb-capture-drawer" data-role="capture-drawer" hidden>
              <div class="bsb-capture-head">
                <div><strong>采集视频</strong><br><span>扫描结果会按 BV + P 增量合并到资源库，不会覆盖已有字幕。</span></div>
                <button type="button" class="bsb-btn ghost" data-act="capture-toggle">关闭</button>
              </div>
              <div>
                <span class="bsb-badge" data-role="type">—</span>
                <div class="bsb-meta" data-role="ctx">—</div>
              </div>
              <div class="bsb-mode-row">
                <label>来源
                  <select data-role="mode" title="自动识别或强制类型">
                    <option value="auto" selected>自动识别</option>
                    <option value="video">单个视频</option>
                    <option value="selection">视频选集</option>
                    <option value="user">个人主页</option>
                    <option value="favorite">收藏夹</option>
                    <option value="collection">合集</option>
                    <option value="search">搜索页</option>
                  </select>
                </label>
                <span class="bsb-auto-hint" data-role="auto-hint">识别：—</span>
              </div>
              <div class="bsb-opts">
                <label class="bsb-auto-capture"><input type="checkbox" data-role="auto-capture" checked> 打开视频自动抓字幕</label>
                <label><input type="checkbox" data-role="auto-analyze" checked> 抓到字幕后自动分析</label>
                <label><input type="checkbox" data-role="player-subtitle" checked> 自动开启播放器字幕</label>
                <label>最多页 <input type="number" data-role="max-pages" min="1" max="100" value="${maxPages}"></label>
                <label>间隔ms <input type="number" data-role="delay" min="0" max="5000" step="50" value="${delayMs}"></label>
              </div>
              <div class="bsb-capture-actions">
                <button type="button" class="bsb-btn danger" data-act="cancel" style="display:none">停止</button>
                <button type="button" class="bsb-btn primary" data-act="scan">扫描并加入资源库</button>
              </div>
            </div>

            <div class="bsb-library-layout">
              <aside class="bsb-library-master">
                <div class="bsb-library-master-head">
                  <strong>视频资源</strong>
                  <span data-role="library-visible-count">0 / 0</span>
                  <div class="bsb-library-folder-tools">
                    <button type="button" data-act="folder-expand-all" title="展开全部文件夹">全部展开</button>
                    <button type="button" data-act="folder-collapse-all" title="收起全部文件夹">全部收起</button>
                  </div>
                </div>
                <div class="bsb-list" data-role="list">
                  <div class="bsb-empty">
                    <div class="bsb-empty-ico">≡</div>
                    <strong>字幕库为空</strong>
                    <span>点击「＋ 采集视频」，或直接打开一个视频自动加入。</span>
                  </div>
                </div>
                <div class="bsb-library-master-foot">
                  <div class="bsb-library-select-tools">
                    <button type="button" data-act="sel-all">全选</button>
                    <button type="button" data-act="sel-none">不选</button>
                    <button type="button" data-act="clear" title="清空资源库列表">清空</button>
                    <button type="button" data-act="copy-bvid" title="复制已勾选 BV">复制 BV</button>
                  </div>
                  <div class="bsb-library-primary-tools">
                    <button type="button" class="primary" data-act="fetch-selected" title="抓取勾选项字幕，可随时暂停">抓取字幕</button>
                    <button type="button" data-act="ai-send" title="把已有字幕送进 AI 工作台">送去 AI</button>
                  </div>
                </div>
              </aside>

              <main class="bsb-library-detail">
                <section class="bsb-transcript-shell" aria-label="当前视频工作区">
                  <div class="bsb-transcript-head">
                    <div class="bsb-transcript-title">
                      <strong data-role="transcript-title">当前视频字幕</strong>
                      <span data-role="transcript-meta">从左侧选择一个视频</span>
                    </div>
                    <div class="bsb-transcript-head-actions">
                      <button type="button" class="bsb-transcript-ai-link" data-act="open-ai-workspace" title="打开 AI 学习图谱工作区">AI ↗</button>
                    </div>
                  </div>
                  <div class="bsb-transcript-tools">
                    <label class="bsb-transcript-search" title="检索当前视频字幕">
                      <span>⌕</span>
                      <input type="search" data-role="transcript-search" placeholder="检索当前字幕…" autocomplete="off">
                      <span class="bsb-transcript-count" data-role="transcript-count"></span>
                    </label>
                    <div class="bsb-transcript-toolbar-end">
                      <select class="bsb-transcript-track" data-role="transcript-track" aria-label="字幕语言" disabled>
                        <option>自动</option>
                      </select>
                      <label class="bsb-transcript-follow"><input type="checkbox" data-role="transcript-follow" checked> 跟随</label>
                      <button type="button" class="bsb-transcript-refresh" data-act="transcript-refresh" title="忽略缓存重新读取">刷新</button>
                      <span class="bsb-toolbar-sep" aria-hidden="true"></span>
                      <div class="bsb-export-group" role="group" aria-label="导出字幕">
                        <button type="button" data-act="copy" title="复制当前字幕全文">复制</button>
                        <button type="button" data-act="dl-txt" title="下载 TXT">TXT</button>
                        <button type="button" class="primary" data-act="dl-srt" title="下载 SRT">SRT</button>
                      </div>
                    </div>
                  </div>
                  <div class="bsb-transcript-list" data-role="transcript-list">
                    <div class="bsb-transcript-empty">从左侧选择已有字幕的视频即可阅读全文。<br>点击时间可以跳转到播放器对应位置。</div>
                  </div>
                </section>
              </main>
            </div>
          </section>`;
  }
  function renderKnowledgeWorkspaceMarkup() {
    return `<section class="bsb-view" data-view-panel="knowledge">
            <div class="bsb-knowledge-workspace" data-role="knowledge-workspace">
              <aside class="bsb-knowledge-nav" data-role="knowledge-nav">
                <div class="bsb-knowledge-nav-head">
                  <div class="bsb-knowledge-nav-title">锚点 <span data-role="knowledge-count">0</span></div>
                  <label class="bsb-knowledge-search"><span>⌕</span><input type="search" data-role="knowledge-search" placeholder="搜索锚点 / 视频 / 追问…" autocomplete="off"></label>
                </div>
                <div class="bsb-knowledge-nav-scroll" data-role="knowledge-list"></div>
              </aside>
              <button type="button" class="bsb-knowledge-splitter" data-role="knowledge-nav-split" title="拖拽调整导航宽度" aria-label="调整导航宽度"></button>
              <main class="bsb-knowledge-reader" data-role="knowledge-detail"><div class="bsb-empty"><div class="bsb-empty-ico">◇</div><strong>选择知识锚点</strong><span>从左侧选择锚点，或在 AI 处理字幕里划选文字创建。</span></div></main>
            </div>
          </section>`;
  }
  function renderSettingsWorkspace() {
    return `<section class="bsb-view" data-view-panel="settings">
            <div class="bsb-settings">
              <div class="bsb-settings-tabs" role="tablist" aria-label="设置分类">
                <button type="button" class="active" data-settings-tab="prompt" role="tab">Prompt</button>
                <button type="button" data-settings-tab="llm" role="tab">LLM</button>
                <button type="button" data-settings-tab="appearance" role="tab">外观</button>
                <button type="button" data-settings-tab="shortcuts" role="tab">快捷键</button>
              </div>

              <section class="bsb-settings-pane active" data-settings-pane="prompt">
                <div class="bsb-prompt-stage-tabs" role="tablist" aria-label="Prompt 阶段">
                  <button type="button" class="active" data-prompt-stage-tab="preprocess" role="tab">预处理</button>
                  <button type="button" data-prompt-stage-tab="postprocess" role="tab">后处理</button>
                  <button type="button" data-prompt-stage-tab="knowledge" role="tab">Knowledge</button>
                </div>
                <div class="bsb-prompt-stage-context" data-role="prompt-stage-context">
                  <span>预处理 · 原始字幕 → 规范化简体中文字幕稿</span>
                  <span>PRE</span>
                </div>
                <div class="bsb-config-master-detail">
                  <aside class="bsb-config-sidebar">
                    <div class="bsb-config-sidebar-head">
                      <label class="bsb-config-search"><span>⌕</span><input type="search" data-role="prompt-search" placeholder="搜索预处理 Prompt…" autocomplete="off"></label>
                      <button type="button" class="bsb-btn ghost bsb-config-create" data-act="prompt-add-pre" data-prompt-create-stage="preprocess">＋ 新建预处理</button>
                      <button type="button" class="bsb-btn ghost bsb-config-create" data-act="prompt-add" data-prompt-create-stage="postprocess" hidden>＋ 新建后处理</button>
                      <button type="button" class="bsb-btn ghost bsb-config-create" data-act="prompt-add-knowledge" data-prompt-create-stage="knowledge" hidden>＋ 新建 Knowledge</button>
                    </div>
                    <div class="bsb-config-list" data-role="prompt-list"></div>
                    <div class="bsb-config-sidebar-foot">
                      <button type="button" class="bsb-btn ghost" data-act="prompt-reset">恢复内置 Prompt</button>
                    </div>
                  </aside>
                  <main class="bsb-config-editor-shell bsb-ai-config" data-role="prompt-editor"></main>
                </div>
              </section>

              <section class="bsb-settings-pane" data-settings-pane="llm">
                <div class="bsb-config-master-detail">
                  <aside class="bsb-config-sidebar">
                    <div class="bsb-config-sidebar-head">
                      <label class="bsb-config-search"><span>⌕</span><input type="search" data-role="ai-search" placeholder="搜索模型配置…" autocomplete="off"></label>
                      <button type="button" class="bsb-btn ghost bsb-config-create" data-act="ai-profile-add">＋ 新建 LLM</button>
                    </div>
                    <div class="bsb-config-list" data-role="ai-list"></div>
                    <div class="bsb-config-sidebar-foot">
                      <button type="button" class="bsb-btn ghost" data-act="ai-reset">恢复默认模型</button>
                    </div>
                  </aside>
                  <main class="bsb-config-editor-shell bsb-ai-config" data-role="ai-editor"></main>
                </div>
              </section>

              <section class="bsb-settings-pane" data-settings-pane="appearance">
                <div class="bsb-appearance-settings" data-role="appearance-settings"></div>
              </section>

              <section class="bsb-settings-pane" data-settings-pane="shortcuts">
                <div class="bsb-shortcut-settings" data-role="shortcut-settings"></div>
              </section>
            </div>
          </section>`;
  }
  const markup = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    renderAiWorkspace,
    renderKnowledgeWorkspaceMarkup,
    renderSettingsWorkspace,
    renderSubsWorkspace
  }, Symbol.toStringTag, { value: "Module" }));
  function renderWorkspaceControlsStyles(panelId) {
    return `
      #${panelId} .bsb-badge {
        display: inline-flex; align-items: center; gap: 4px;
        background: color-mix(in srgb, var(--ctp-sapphire) 16%, transparent);
        color: var(--ctp-sapphire);
        border: 1px solid color-mix(in srgb, var(--ctp-sapphire) 28%, transparent);
        border-radius: 999px;
        padding: 3px 10px;
        font-weight: 650;
        font-size: 11px;
      }
      #${panelId} .bsb-badge.manual {
        background: color-mix(in srgb, var(--ctp-mauve) 16%, transparent);
        color: var(--ctp-mauve);
        border-color: color-mix(in srgb, var(--ctp-mauve) 28%, transparent);
      }
      #${panelId} .bsb-meta {
        margin-top: 3px;
        color: var(--ctp-subtext0);
        word-break: break-all;
        font-size: 11px;
        line-height: 1.4;
      }
      #${panelId} .bsb-mode-row {
        display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
      }
      #${panelId} .bsb-mode-row label {
        display: inline-flex; align-items: center; gap: 6px; color: var(--ctp-subtext1);
      }
      #${panelId} .bsb-mode-row select,
      #${panelId} .bsb-field select {
        height: 32px; min-width: 132px; border-radius: 10px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 55%, transparent);
        background: color-mix(in srgb, var(--ctp-mantle) 65%, transparent);
        color: var(--ctp-text); padding: 0 10px; font-size: 12px; outline: none; cursor: pointer;
      }
      #${panelId} .bsb-mode-row select:focus {
        border-color: color-mix(in srgb, var(--ctp-mauve) 55%, transparent);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--ctp-mauve) 18%, transparent);
      }
      #${panelId} .bsb-auto-hint {
        font-size: 11px; color: var(--ctp-overlay1); flex: 1; min-width: 100px;
      }
      #${panelId} .bsb-auto-hint strong { color: var(--ctp-teal); font-weight: 650; }

      /* 通用按钮 */
      #${panelId} .bsb-btn {
        height: 34px; border-radius: 10px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 55%, transparent);
        background: color-mix(in srgb, var(--ctp-surface0) 50%, transparent);
        cursor: pointer; font-size: 12.5px; padding: 0 12px; color: var(--ctp-text);
        font-weight: 550; transition: background .12s, border-color .12s, color .12s, transform .12s;
      }
      #${panelId} .bsb-btn:hover:not(:disabled) {
        border-color: color-mix(in srgb, var(--ctp-lavender) 45%, transparent);
        color: var(--ctp-lavender);
        background: color-mix(in srgb, var(--ctp-surface1) 40%, transparent);
      }
      #${panelId} .bsb-btn:active:not(:disabled) { transform: scale(0.98); }
      #${panelId} .bsb-btn:disabled { opacity: .42; cursor: not-allowed; }
      #${panelId} .bsb-btn.primary {
        background: linear-gradient(135deg,
          color-mix(in srgb, var(--ctp-blue) 90%, transparent),
          color-mix(in srgb, var(--ctp-lavender) 85%, transparent));
        border-color: transparent; color: var(--ctp-crust); font-weight: 700;
        box-shadow: 0 6px 16px color-mix(in srgb, var(--ctp-blue) 25%, transparent);
      }
      #${panelId} .bsb-btn.primary:hover:not(:disabled) {
        filter: brightness(1.06); color: var(--ctp-crust);
      }
      #${panelId} .bsb-btn.accent {
        background: linear-gradient(135deg, var(--ctp-mauve), var(--ctp-pink));
        border-color: transparent; color: var(--ctp-crust); font-weight: 750;
        box-shadow: 0 8px 22px color-mix(in srgb, var(--ctp-mauve) 32%, transparent);
      }
      #${panelId} .bsb-btn.accent:hover:not(:disabled) {
        filter: brightness(1.05); color: var(--ctp-crust);
      }
      #${panelId} .bsb-btn.danger {
        color: var(--ctp-red);
        border-color: color-mix(in srgb, var(--ctp-red) 38%, transparent);
        background: color-mix(in srgb, var(--ctp-red) 12%, transparent);
      }
      #${panelId} .bsb-btn.ghost {
        background: transparent;
        border-color: color-mix(in srgb, var(--ctp-surface1) 50%, transparent);
      }
      #${panelId} .bsb-toolbar,
      #${panelId} .bsb-actions {
        display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
      }
      #${panelId} .bsb-actions {
        display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; flex-shrink: 0;
      }
      #${panelId} .bsb-toolbar button,
      #${panelId} .bsb-actions button {
        height: 34px; border-radius: 10px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 55%, transparent);
        background: color-mix(in srgb, var(--ctp-surface0) 50%, transparent);
        cursor: pointer; font-size: 12px; padding: 0 10px; color: var(--ctp-text);
      }
      #${panelId} .bsb-toolbar button.primary,
      #${panelId} .bsb-actions button.primary {
        background: color-mix(in srgb, var(--ctp-blue) 80%, transparent);
        border-color: transparent; color: var(--ctp-crust); font-weight: 650;
      }
      #${panelId} .bsb-toolbar button.danger {
        color: var(--ctp-red);
        border-color: color-mix(in srgb, var(--ctp-red) 40%, transparent);
        background: color-mix(in srgb, var(--ctp-red) 10%, transparent);
      }
      #${panelId} .bsb-toolbar button:disabled,
      #${panelId} .bsb-actions button:disabled { opacity: .45; cursor: not-allowed; }

      #${panelId} .bsb-opts {
        display: flex; flex-wrap: wrap; gap: 10px; align-items: center; color: var(--ctp-subtext1);
      }
      #${panelId} .bsb-opts label { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; }
      #${panelId} .bsb-opts input[type="number"] {
        width: 58px; height: 28px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 60%, transparent);
        border-radius: 8px; padding: 0 6px; font-size: 12px; color: var(--ctp-text);
        background: color-mix(in srgb, var(--ctp-mantle) 55%, transparent); outline: none;
      }
      #${panelId} .bsb-opts input[type="checkbox"] { accent-color: var(--ctp-mauve); }

`;
  }
  const controlsStyles = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    renderWorkspaceControlsStyles
  }, Symbol.toStringTag, { value: "Module" }));
  function renderSubsStyles(panelId) {
    return `
      /* ── 字幕资源库：采集入口 + 左侧资源 Master + 右侧 Detail ── */
      #${panelId} .bsb-view[data-view-panel="subs"] {
        position: relative; gap: 8px; overflow: hidden;
      }
      #${panelId} .bsb-library-jobbar {
        display: none; flex-shrink: 0; align-items: center; gap: 10px;
        min-height: 42px; padding: 7px 10px;
        border: 1px solid color-mix(in srgb, var(--ctp-blue) 28%, var(--ctp-surface1));
        border-radius: 12px;
        background: color-mix(in srgb, var(--ctp-mantle) 82%, var(--ctp-base));
      }
      #${panelId} .bsb-library-jobbar.is-on { display: flex; }
      #${panelId} .bsb-library-jobbar.is-paused {
        border-color: color-mix(in srgb, var(--ctp-yellow) 40%, var(--ctp-surface1));
      }
      #${panelId} .bsb-job-progress {
        flex: 1 1 auto; min-width: 0; display: grid; gap: 5px;
        grid-template-columns: 10px minmax(0,1fr);
        align-items: center;
      }
      #${panelId} .bsb-job-dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: var(--ctp-blue);
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--ctp-blue) 18%, transparent);
        animation: bsb-job-pulse 1.2s ease-in-out infinite;
      }
      #${panelId} .bsb-library-jobbar.is-paused .bsb-job-dot {
        background: var(--ctp-yellow); animation: none;
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--ctp-yellow) 16%, transparent);
      }
      @keyframes bsb-job-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: .55; transform: scale(.86); }
      }
      #${panelId} .bsb-job-copy { min-width: 0; display: grid; gap: 2px; }
      #${panelId} .bsb-job-copy strong {
        font-size: 11.5px; color: var(--ctp-text); font-weight: 700;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      #${panelId} .bsb-job-copy span {
        font-size: 10px; color: var(--ctp-overlay1); font-variant-numeric: tabular-nums;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      #${panelId} .bsb-job-meter {
        grid-column: 1 / -1; height: 3px; border-radius: 999px;
        background: color-mix(in srgb, var(--ctp-surface1) 70%, transparent); overflow: hidden;
      }
      #${panelId} .bsb-job-meter i {
        display: block; height: 100%; width: 0; border-radius: inherit;
        background: linear-gradient(90deg, var(--ctp-blue), var(--ctp-lavender));
        transition: width .2s ease;
      }
      #${panelId} .bsb-library-jobbar.is-paused .bsb-job-meter i {
        background: var(--ctp-yellow);
      }
      #${panelId} .bsb-job-actions { display: flex; gap: 6px; flex-shrink: 0; }
      #${panelId} .bsb-job-actions button {
        height: 28px; padding: 0 10px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 650;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 60%, transparent);
        background: color-mix(in srgb, var(--ctp-surface0) 50%, transparent); color: var(--ctp-text);
      }
      #${panelId} .bsb-job-actions [data-act="job-pause"] {
        border-color: color-mix(in srgb, var(--ctp-yellow) 38%, transparent);
        background: color-mix(in srgb, var(--ctp-yellow) 12%, transparent); color: var(--ctp-yellow);
      }
      #${panelId} .bsb-job-actions [data-act="job-stop"] {
        border-color: color-mix(in srgb, var(--ctp-red) 38%, transparent);
        background: color-mix(in srgb, var(--ctp-red) 10%, transparent); color: var(--ctp-red);
      }
      #${panelId} .bsb-library-topbar {
        display: flex; align-items: center; gap: 7px; min-height: 34px; flex-shrink: 0;
      }
      #${panelId} .bsb-library-search {
        flex: 1 1 180px; min-width: 120px; height: 32px; display: grid;
        grid-template-columns: auto minmax(0,1fr); align-items: center; gap: 6px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 55%, transparent);
        border-radius: 10px; padding: 0 9px;
        background: color-mix(in srgb, var(--ctp-mantle) 62%, transparent);
      }
      #${panelId} .bsb-library-search input {
        width: 100%; min-width: 0; border: 0; outline: 0; background: transparent;
        color: var(--ctp-text); font-size: 11.5px;
      }
      #${panelId} .bsb-library-filterbar {
        display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; flex-shrink: 1;
      }
      #${panelId} .bsb-library-filterbar::-webkit-scrollbar { display: none; }
      #${panelId} .bsb-library-filterbar button {
        height: 29px; border-radius: 9px; padding: 0 8px; white-space: nowrap; cursor: pointer;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 65%, transparent);
        background: transparent; color: var(--ctp-subtext0); font-size: 10.5px;
      }
      #${panelId} .bsb-library-filterbar button.active {
        color: var(--ctp-sapphire); border-color: color-mix(in srgb, var(--ctp-sapphire) 42%, transparent);
        background: color-mix(in srgb, var(--ctp-sapphire) 12%, transparent);
      }
      #${panelId} .bsb-library-layout {
        display: grid; grid-template-columns: minmax(190px, 31%) minmax(0, 1fr);
        gap: 9px; flex: 1 1 0; min-height: 0; overflow: hidden;
      }
      #${panelId} .bsb-library-master {
        display: flex; flex-direction: column; min-width: 0; min-height: 0;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 52%, transparent);
        border-radius: 14px; overflow: hidden;
        background: color-mix(in srgb, var(--ctp-mantle) 55%, transparent);
      }
      #${panelId} .bsb-library-master-head {
        padding: 8px 9px; display: flex; align-items: center; justify-content: space-between; gap: 6px;
        border-bottom: 1px solid color-mix(in srgb, var(--ctp-surface0) 72%, transparent);
        color: var(--ctp-subtext1); font-size: 10.5px;
      }
      #${panelId} .bsb-library-master-head strong { color: var(--ctp-text); font-size: 11.5px; }
      #${panelId} .bsb-library-master-head {
        flex-wrap: wrap;
      }
      #${panelId} .bsb-library-folder-tools { display: flex; gap: 4px; margin-left: auto; }
      #${panelId} .bsb-library-folder-tools button {
        height: 22px; border-radius: 6px; padding: 0 6px; cursor: pointer; font-size: 10px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 62%, transparent);
        background: transparent; color: var(--ctp-subtext1);
      }
      #${panelId} .bsb-list {
        flex: 1 1 0; min-height: 0; overflow-y: auto; padding: 5px;
      }
      #${panelId} .bsb-resource-item,
      #${panelId} .bsb-resource-folder {
        position: relative; display: grid; gap: 6px;
        padding: 8px 7px; border: 1px solid transparent; border-radius: 10px; cursor: pointer;
        transition: background .12s, border-color .12s; align-items: start;
      }
      #${panelId} .bsb-resource-item { grid-template-columns: 20px minmax(0,1fr); }
      #${panelId} .bsb-resource-folder { grid-template-columns: 16px 20px minmax(0,1fr); background: color-mix(in srgb, var(--ctp-surface0) 55%, transparent); margin-top: 3px; }
      #${panelId} .bsb-resource-item.child,
      #${panelId} .bsb-resource-folder.child {
        margin-left: 14px; border-radius: 0 10px 10px 0;
        border-left: 2px solid color-mix(in srgb, var(--ctp-overlay0) 35%, transparent);
      }
      #${panelId} .bsb-resource-item.child-2,
      #${panelId} .bsb-resource-folder.child-2 {
        margin-left: 28px;
      }
      #${panelId} .bsb-resource-item:hover,
      #${panelId} .bsb-resource-folder:hover {
        background: color-mix(in srgb, var(--ctp-surface0) 45%, transparent);
      }
      #${panelId} .bsb-resource-item.active {
        border-color: color-mix(in srgb, var(--ctp-sapphire) 42%, transparent);
        background: color-mix(in srgb, var(--ctp-sapphire) 10%, transparent);
      }
      #${panelId} .bsb-resource-item input[type="checkbox"],
      #${panelId} .bsb-resource-folder input[type="checkbox"] { margin-top: 2px; accent-color: var(--ctp-mauve); }
      #${panelId} .bsb-folder-toggle {
        border: 0; background: transparent; color: var(--ctp-overlay1); cursor: pointer;
        width: 16px; height: 16px; padding: 0; margin-top: 2px; font-size: 10px; line-height: 1;
      }
      #${panelId} .bsb-folder-toggle:hover { color: var(--ctp-text); }
      #${panelId} .bsb-resource-main { min-width: 0; display: grid; gap: 3px; }
      #${panelId} .bsb-resource-title {
        color: var(--ctp-text); font-weight: 590; font-size: 11.5px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      #${panelId} .bsb-resource-folder .bsb-resource-title { font-weight: 650; }
      #${panelId} .bsb-resource-meta {
        display: flex; gap: 6px; align-items: center; min-width: 0;
        color: var(--ctp-overlay1); font-size: 9.8px;
      }
      #${panelId} .bsb-resource-meta span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      #${panelId} .bsb-resource-status { font-weight: 650; flex-shrink: 0; }
      #${panelId} .bsb-resource-status.st-ok { color: var(--ctp-green); }
      #${panelId} .bsb-resource-status.st-empty { color: var(--ctp-peach); }
      #${panelId} .bsb-resource-status.st-err { color: var(--ctp-red); }
      #${panelId} .bsb-resource-status.st-wait { color: var(--ctp-overlay1); }
      #${panelId} .bsb-library-master-foot {
        display: grid; gap: 6px; padding: 7px;
        border-top: 1px solid color-mix(in srgb, var(--ctp-surface0) 72%, transparent);
      }
      #${panelId} .bsb-library-select-tools {
        display: flex; flex-wrap: wrap; gap: 4px;
      }
      #${panelId} .bsb-library-select-tools button {
        height: 24px; border-radius: 7px; padding: 0 7px; cursor: pointer; font-size: 10px;
        border: 1px solid transparent; background: transparent; color: var(--ctp-overlay1);
      }
      #${panelId} .bsb-library-select-tools button:hover {
        color: var(--ctp-text);
        background: color-mix(in srgb, var(--ctp-surface0) 55%, transparent);
      }
      #${panelId} .bsb-library-primary-tools {
        display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
      }
      #${panelId} .bsb-library-primary-tools button {
        height: 32px; border-radius: 9px; cursor: pointer; font-size: 11.5px; font-weight: 680;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 62%, transparent);
        background: color-mix(in srgb, var(--ctp-surface0) 42%, transparent); color: var(--ctp-subtext1);
        padding: 0 8px;
      }
      #${panelId} .bsb-library-primary-tools button.primary {
        border-color: color-mix(in srgb, var(--ctp-blue) 42%, transparent);
        background: color-mix(in srgb, var(--ctp-blue) 16%, var(--ctp-surface0));
        color: var(--ctp-text);
      }
      #${panelId} .bsb-library-primary-tools button:hover {
        border-color: color-mix(in srgb, var(--ctp-lavender) 40%, transparent);
      }
      #${panelId} .bsb-library-detail { min-width: 0; min-height: 0; display: flex; }
      #${panelId} .bsb-transcript-head-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
      #${panelId} .bsb-transcript-ai-link {
        height: 26px; padding: 0 8px; border-radius: 8px; cursor: pointer; font-size: 10.5px;
        border: 1px solid color-mix(in srgb, var(--ctp-lavender) 32%, transparent);
        background: color-mix(in srgb, var(--ctp-lavender) 10%, transparent); color: var(--ctp-lavender);
      }
      #${panelId} .bsb-capture-drawer {
        position: absolute; z-index: 12; top: 52px; left: 14px; right: 14px;
        padding: 12px; display: grid; gap: 9px;
        border: 1px solid color-mix(in srgb, var(--ctp-mauve) 35%, var(--ctp-surface1));
        border-radius: 14px; background: color-mix(in srgb, var(--ctp-base) 96%, transparent);
        box-shadow: 0 18px 50px rgba(0,0,0,.42); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
      }
      #${panelId} .bsb-capture-drawer[hidden] { display: none !important; }
      #${panelId} .bsb-capture-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      #${panelId} .bsb-capture-head strong { font-size: 13px; }
      #${panelId} .bsb-capture-head span { font-size: 10px; color: var(--ctp-overlay1); }
      #${panelId} .bsb-capture-actions { display:flex; gap:6px; justify-content:flex-end; }
      @media (max-width: 700px) {
        #${panelId} .bsb-library-layout { grid-template-columns: minmax(150px, 38%) minmax(0,1fr); }
        #${panelId} .bsb-library-filterbar { display: none; }
      }
      #${panelId} .bsb-transcript-shell {
        flex: 1 1 0; min-width: 0; min-height: 0; overflow: hidden;
        display: flex; flex-direction: column;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 55%, transparent);
        border-radius: 14px; background: color-mix(in srgb, var(--ctp-base) 62%, transparent);
        contain: layout paint style;
      }
      #${panelId} .bsb-transcript-head {
        display: flex; align-items: center; justify-content: space-between; gap: 8px;
        padding: 9px 10px 7px; border-bottom: 1px solid color-mix(in srgb, var(--ctp-surface0) 70%, transparent);
      }
      #${panelId} .bsb-transcript-title { min-width: 0; display: grid; gap: 2px; }
      #${panelId} .bsb-transcript-title strong {
        font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      #${panelId} .bsb-transcript-title span { font-size: 10px; color: var(--ctp-overlay1); }
      #${panelId} .bsb-transcript-tools {
        padding: 8px 10px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
        border-bottom: 1px solid color-mix(in srgb, var(--ctp-surface0) 62%, transparent);
      }
      #${panelId} .bsb-transcript-toolbar-end {
        display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-left: auto;
      }
      #${panelId} .bsb-toolbar-sep {
        width: 1px; height: 16px; background: color-mix(in srgb, var(--ctp-surface1) 70%, transparent);
      }
      #${panelId} .bsb-export-group { display: flex; gap: 4px; }
      #${panelId} .bsb-export-group button {
        height: 31px; padding: 0 8px; border-radius: 9px; cursor: pointer; font-size: 10.5px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 58%, transparent);
        background: color-mix(in srgb, var(--ctp-surface0) 50%, transparent); color: var(--ctp-text);
      }
      #${panelId} .bsb-export-group button.primary {
        border-color: color-mix(in srgb, var(--ctp-blue) 38%, transparent);
        background: color-mix(in srgb, var(--ctp-blue) 14%, var(--ctp-surface0));
      }
      #${panelId} .bsb-transcript-search {
        flex: 1 1 160px; min-width: 140px;
        height: 31px; display: grid; grid-template-columns: auto minmax(0,1fr) auto;
        align-items: center; gap: 6px; padding: 0 8px; border-radius: 9px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 58%, transparent);
        background: color-mix(in srgb, var(--ctp-mantle) 60%, transparent);
      }
      #${panelId} .bsb-transcript-search input {
        min-width: 0; width: 100%; border: 0; outline: 0; background: transparent;
        color: var(--ctp-text); font-size: 11.5px;
      }
      #${panelId} .bsb-transcript-count { font-size: 10px; color: var(--ctp-overlay1); font-variant-numeric: tabular-nums; }
      #${panelId} .bsb-transcript-track {
        max-width: 118px; height: 31px; border-radius: 9px; padding: 0 7px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 58%, transparent);
        background: color-mix(in srgb, var(--ctp-mantle) 60%, transparent); color: var(--ctp-text); font-size: 10.5px;
      }
      #${panelId} .bsb-transcript-follow { font-size: 10.5px; color: var(--ctp-subtext0); white-space: nowrap; }
      #${panelId} .bsb-transcript-follow input { accent-color: var(--ctp-sapphire); }
      #${panelId} .bsb-transcript-refresh {
        height: 31px; padding: 0 8px; border-radius: 9px; cursor: pointer;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 58%, transparent);
        background: color-mix(in srgb, var(--ctp-surface0) 50%, transparent); color: var(--ctp-text); font-size: 10.5px;
      }
      #${panelId} .bsb-transcript-list {
        flex: 1 1 0; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
        padding: 4px 7px 14px; scroll-padding-block: 38%;
      }
      #${panelId} .bsb-transcript-row {
        content-visibility: auto; contain-intrinsic-size: auto 58px; contain: layout paint style;
        display: grid; grid-template-columns: 52px minmax(0,1fr); gap: 8px; align-items: start;
        padding: 8px 7px; border-radius: 9px; border-left: 3px solid transparent;
      }
      #${panelId} .bsb-transcript-row:hover { background: color-mix(in srgb, var(--ctp-surface0) 45%, transparent); }
      #${panelId} .bsb-transcript-row.active {
        background: color-mix(in srgb, var(--ctp-sapphire) 12%, transparent);
        border-left-color: var(--ctp-sapphire);
      }
      #${panelId} .bsb-transcript-time {
        border: 0; background: transparent; color: var(--ctp-sapphire); cursor: pointer;
        padding: 2px 0; text-align: left; font-size: 10.5px; font-variant-numeric: tabular-nums;
      }
      #${panelId} .bsb-transcript-text {
        margin: 0; color: var(--ctp-subtext1); font-size: 12px; line-height: 1.62; overflow-wrap: anywhere;
      }
      #${panelId} .bsb-transcript-row.active .bsb-transcript-text { color: var(--ctp-text); font-weight: 600; }
      #${panelId} .bsb-transcript-text mark {
        background: color-mix(in srgb, var(--ctp-yellow) 48%, transparent); color: inherit; border-radius: 3px; padding: 0 .08em;
      }
      #${panelId} .bsb-transcript-empty {
        min-height: 120px; display: grid; place-items: center; text-align: center;
        color: var(--ctp-overlay1); font-size: 11.5px; line-height: 1.55; padding: 20px;
      }
      @media (max-width: 640px) {
        #${panelId} .bsb-transcript-follow { display: none; }
        #${panelId} .bsb-library-jobbar { flex-wrap: wrap; }
      }

      #${panelId} .bsb-empty {
        padding: 36px 16px; text-align: center; color: var(--ctp-overlay1);
        display: flex; flex-direction: column; align-items: center; gap: 8px;
      }
      #${panelId} .bsb-empty .bsb-empty-ico {
        width: 48px; height: 48px; border-radius: 16px;
        display: flex; align-items: center; justify-content: center;
        font-size: 22px;
        background: color-mix(in srgb, var(--ctp-surface0) 55%, transparent);
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 45%, transparent);
      }
      #${panelId} .bsb-empty strong { color: var(--ctp-subtext1); font-size: 13px; }
      #${panelId} .bsb-empty span { font-size: 12px; max-width: 280px; line-height: 1.45; }

`;
  }
  const subsStyles = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    renderSubsStyles
  }, Symbol.toStringTag, { value: "Module" }));
  function renderAiStyles(panelId) {
    return `
      /* ── AI 工作区（主画布） ── */
      #${panelId} .bsb-ai-hero {
        display: flex; align-items: flex-start; justify-content: space-between;
        gap: 12px; flex-shrink: 0;
      }
      #${panelId} .bsb-ai-hero h2 {
        margin: 0; font-size: 16px; font-weight: 750; color: var(--ctp-text);
        letter-spacing: -0.01em;
      }
      #${panelId} .bsb-ai-hero p {
        margin: 4px 0 0; font-size: 11.5px; color: var(--ctp-subtext0); line-height: 1.4;
      }
      #${panelId} .bsb-ai-hero-actions {
        display: flex; gap: 6px; flex-shrink: 0; align-items: center;
      }
      #${panelId} .bsb-ai-hero-actions .bsb-btn.accent {
        height: 40px; padding: 0 16px; font-size: 13px; border-radius: 12px;
      }
      #${panelId} .bsb-chips {
        display: flex; flex-wrap: wrap; gap: 6px; flex-shrink: 0;
      }
      #${panelId} .bsb-chip {
        display: inline-flex; align-items: center; gap: 5px;
        height: 26px; padding: 0 10px; border-radius: 999px; font-size: 11px; font-weight: 600;
        color: var(--ctp-subtext1);
        background: color-mix(in srgb, var(--ctp-surface0) 55%, transparent);
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 45%, transparent);
      }
      #${panelId} .bsb-chip em {
        font-style: normal; color: var(--ctp-lavender); font-weight: 700;
      }
      #${panelId} .bsb-chip.ok { color: var(--ctp-green); border-color: color-mix(in srgb, var(--ctp-green) 30%, transparent); }
      #${panelId} .bsb-chip.warn { color: var(--ctp-peach); }
      #${panelId} .bsb-ai-result-tabs {
        display: flex; gap: 6px; overflow-x: auto; flex-shrink: 0;
        padding: 1px 0 4px; scrollbar-width: thin;
      }
      #${panelId} .bsb-ai-result-tab {
        display: inline-flex; align-items: center; gap: 7px; flex: 0 0 auto;
        min-width: 108px; max-width: 220px; height: 32px; padding: 0 10px;
        border-radius: 10px; cursor: pointer; text-align: left;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 45%, transparent);
        background: color-mix(in srgb, var(--ctp-surface0) 38%, transparent);
        color: var(--ctp-subtext0); font-size: 11px; font-weight: 650;
      }
      #${panelId} .bsb-ai-result-tab:hover {
        color: var(--ctp-text); border-color: color-mix(in srgb, var(--ctp-lavender) 38%, transparent);
      }
      #${panelId} .bsb-ai-result-tab.active {
        color: var(--ctp-text); border-color: color-mix(in srgb, var(--ctp-mauve) 58%, transparent);
        background: color-mix(in srgb, var(--ctp-mauve) 14%, var(--ctp-surface0));
      }
      #${panelId} .bsb-ai-result-tab .dot {
        width: 7px; height: 7px; border-radius: 50%; flex: 0 0 auto;
        background: var(--ctp-overlay0);
      }
      #${panelId} .bsb-ai-result-tab.running .dot { background: var(--ctp-green); animation: bsb-pulse 1.1s ease-in-out infinite; }
      #${panelId} .bsb-ai-result-tab.done .dot { background: var(--ctp-teal); }
      #${panelId} .bsb-ai-result-tab.error .dot { background: var(--ctp-red); }
      #${panelId} .bsb-ai-result-tab.stopped .dot { background: var(--ctp-peach); }
      #${panelId} .bsb-ai-result-tab .txt { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      #${panelId} .bsb-ai-result-unit {
        display: inline-flex; align-items: stretch; min-width: 0; flex: 0 0 auto;
      }
      #${panelId} .bsb-ai-result-unit .bsb-ai-result-tab {
        border-top-right-radius: 0; border-bottom-right-radius: 0;
      }
      #${panelId} .bsb-ai-result-retry {
        width: 27px; padding: 0; margin-left: -1px; border-radius: 0 9px 9px 0;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 55%, transparent);
        background: color-mix(in srgb, var(--ctp-surface0) 42%, transparent);
        color: var(--ctp-overlay1); cursor: pointer; font-size: 15px; line-height: 1;
      }
      #${panelId} .bsb-ai-result-unit.active .bsb-ai-result-retry,
      #${panelId} .bsb-ai-result-retry:hover {
        color: var(--ctp-lavender);
        border-color: color-mix(in srgb, var(--ctp-lavender) 45%, transparent);
        background: color-mix(in srgb, var(--ctp-lavender) 12%, transparent);
      }
      #${panelId} .bsb-ai-result-empty { color: var(--ctp-overlay1); font-size: 11px; padding: 7px 2px; }

      #${panelId} .bsb-ai-canvas-wrap {
        /* 关键：绝对填充，保证内部一定有固定高度可滚动 */
        flex: 1 1 auto;
        min-height: 280px;
        position: relative;
        border-radius: 16px;
        overflow: hidden;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 45%, transparent);
        background:
          radial-gradient(120% 80% at 100% 0%,
            color-mix(in srgb, var(--ctp-mauve) 10%, transparent), transparent 55%),
          color-mix(in srgb, var(--ctp-crust) 62%, transparent);
        box-shadow: inset 0 1px 0 color-mix(in srgb, var(--ctp-overlay2) 10%, transparent);
      }
      #${panelId} .bsb-ai-canvas-bar {
        position: absolute; top: 0; left: 0; right: 0; height: 40px;
        z-index: 2;
        display: flex; align-items: center; justify-content: space-between; gap: 8px;
        padding: 0 12px;
        border-bottom: 1px solid color-mix(in srgb, var(--ctp-surface0) 70%, transparent);
        background: color-mix(in srgb, var(--ctp-mantle) 82%, transparent);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        font-size: 11px; color: var(--ctp-overlay1); font-weight: 600;
        letter-spacing: 0.04em; text-transform: uppercase;
      }
      #${panelId} .bsb-ai-canvas-bar .bsb-bar-left {
        display: inline-flex; align-items: center; gap: 8px; min-width: 0;
      }
      #${panelId} .bsb-live-dot {
        width: 7px; height: 7px; border-radius: 50%;
        background: var(--ctp-overlay0); flex-shrink: 0;
      }
      #${panelId} .bsb-ai-stream.streaming .bsb-live-dot {
        background: var(--ctp-green);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--ctp-green) 25%, transparent);
        animation: bsb-pulse 1.1s ease-in-out infinite;
      }
      #${panelId} .bsb-ai-canvas-bar .bsb-bar-actions {
        display: inline-flex; gap: 4px; align-items: center; flex-shrink: 0;
      }
      #${panelId} .bsb-ai-canvas-bar .bsb-mini {
        height: 24px; padding: 0 8px; border-radius: 7px; font-size: 10px;
        letter-spacing: 0; text-transform: none; font-weight: 650;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 50%, transparent);
        background: color-mix(in srgb, var(--ctp-surface0) 40%, transparent);
        color: var(--ctp-subtext0); cursor: pointer;
      }
      #${panelId} .bsb-ai-canvas-bar .bsb-mini:hover {
        color: var(--ctp-lavender); border-color: color-mix(in srgb, var(--ctp-lavender) 40%, transparent);
      }
      #${panelId} .bsb-ai-canvas-bar .bsb-mini.on {
        color: var(--ctp-teal);
        border-color: color-mix(in srgb, var(--ctp-teal) 40%, transparent);
        background: color-mix(in srgb, var(--ctp-teal) 12%, transparent);
      }
      #${panelId} .bsb-ai-stream {
        position: absolute;
        top: 40px; left: 0; right: 0; bottom: 0;
        overflow: hidden;
      }
      #${panelId} .bsb-ai-stream .bsb-ai-raw { display: none !important; }
      #${panelId} .bsb-studio-dock {
        display: none; position: absolute; left: 0; right: 0; bottom: 0; z-index: 3;
        padding: 8px 10px 10px;
        border-top: 1px solid color-mix(in srgb, var(--ctp-surface0) 75%, transparent);
        background: color-mix(in srgb, var(--ctp-mantle) 92%, transparent);
      }
      #${panelId} .bsb-ai-canvas-wrap.is-studio .bsb-studio-dock { display: block; }
      #${panelId} .bsb-ai-canvas-wrap.is-studio .bsb-ai-stream { bottom: 88px; }
      #${panelId} .bsb-ai-canvas-wrap.is-studio .bsb-jump-latest { display: none; }
      #${panelId} .bsb-ai-canvas-wrap.is-studio .bsb-ai-content {
        max-width: none;
        margin: 0;
        width: 100%;
      }
      #${panelId} .bsb-studio-composer {
        display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px; align-items: end;
      }
      #${panelId} .bsb-studio-composer textarea {
        width: 100%; min-height: 40px; max-height: 120px; resize: none;
        padding: 9px 11px; border-radius: 12px; line-height: 1.45;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 70%, transparent);
        background: color-mix(in srgb, var(--ctp-base) 70%, transparent);
        color: var(--ctp-text); font: inherit; font-size: 14px;
      }
      #${panelId} .bsb-studio-composer textarea:focus {
        outline: 0; border-color: color-mix(in srgb, var(--ctp-lavender) 50%, transparent);
      }
      #${panelId} .bsb-studio-composer .bsb-btn { height: 40px; padding: 0 14px; border-radius: 12px; }
      #${panelId} .bsb-studio-slash {
        position: absolute; left: 10px; right: 78px; bottom: calc(100% - 6px);
        max-height: 220px; overflow: auto; padding: 6px;
        border-radius: 12px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 60%, transparent);
        background: color-mix(in srgb, var(--ctp-base) 96%, transparent);
        box-shadow: 0 12px 32px color-mix(in srgb, var(--ctp-crust) 45%, transparent);
      }
      #${panelId} .bsb-studio-slash[hidden] { display: none !important; }
      #${panelId} .bsb-studio-slash button {
        display: grid; grid-template-columns: 5.5rem minmax(0,1fr); gap: 8px; align-items: center;
        width: 100%; text-align: left; padding: 7px 8px; border: 0; border-radius: 8px;
        background: transparent; color: var(--ctp-text); cursor: pointer; font: inherit;
      }
      #${panelId} .bsb-studio-slash button.active,
      #${panelId} .bsb-studio-slash button:hover {
        background: color-mix(in srgb, var(--ctp-lavender) 12%, var(--ctp-surface0));
      }
      #${panelId} .bsb-studio-slash code {
        font-size: 11.5px; font-weight: 750; color: var(--ctp-lavender);
      }
      #${panelId} .bsb-studio-slash span { font-size: 11px; color: var(--ctp-overlay1); }
      #${panelId} .bsb-studio-thread {
        display: flex; flex-direction: column; gap: 16px;
        padding: 8px 2px 20px; width: 100%;
      }
      #${panelId} .bsb-studio-msg.user {
        align-self: flex-end;
        display: flex; flex-direction: column; align-items: flex-end;
        width: fit-content; max-width: min(78%, 32rem);
      }
      #${panelId} .bsb-studio-msg.user .bsb-studio-bubble {
        padding: 9px 12px; border-radius: 14px 14px 4px 14px;
        background: color-mix(in srgb, var(--ctp-lavender) 16%, var(--ctp-surface0));
        color: var(--ctp-text); font-size: 14px; line-height: 1.55; white-space: pre-wrap;
      }
      #${panelId} .bsb-studio-msg.user .bsb-studio-role { text-align: right; }
      #${panelId} .bsb-studio-msg.assistant {
        align-self: center; width: min(100%, 40em);
      }
      #${panelId} .bsb-studio-msg.assistant .bsb-studio-answer,
      #${panelId} .bsb-studio-msg.assistant .bsb-preprocess-block-body,
      #${panelId} .bsb-studio-msg.assistant .bsb-knowledge-card-body {
        font-size: var(--bsb-knowledge-font); line-height: 1.7; color: var(--ctp-text);
      }
      #${panelId} .bsb-studio-msg.system {
        align-self: center; max-width: 28rem; text-align: center;
        font-size: 14px; color: var(--ctp-overlay1); line-height: 1.5;
      }
      #${panelId} .bsb-studio-role {
        display: block; margin-bottom: 4px; font-size: 11px; font-weight: 750;
        letter-spacing: .08em; text-transform: uppercase; color: var(--ctp-overlay0);
      }

      /*
       * 唯一滚动层：绝对定位铺满画布，height 明确，overflow-y: scroll
       * （flex 链常导致“看起来能滚其实高度在变、滚动无效”）
       */
      #${panelId} .bsb-ai-md {
        position: absolute;
        inset: 0;
        overflow-y: scroll !important;
        overflow-x: hidden !important;
        padding: 32px 28px 88px;
        box-sizing: border-box;
        font-size: var(--bsb-note-font);
        line-height: 1.9;
        letter-spacing: 0.03em;
        color: var(--ctp-text);
        scroll-behavior: auto;
        overscroll-behavior: contain;
        overflow-anchor: none; /* 禁止浏览器滚动锚定与 stick 互抢 */
        -webkit-overflow-scrolling: touch;
        touch-action: pan-y;
        font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI",
          "Microsoft YaHei", "Noto Sans SC", "Source Han Sans SC", system-ui, sans-serif;
      }
      #${panelId} .bsb-ai-content {
        max-width: 40em;
        margin: 0 auto;
        min-height: min-content;
        overflow-anchor: none;
      }
      #${panelId} .bsb-ai-stream-body {
        margin: 0;
        padding: 0;
        border: none;
        background: transparent;
        white-space: pre-wrap;
        word-break: break-word;
        overflow-wrap: anywhere;
        font-size: 14px;
        line-height: 2.15;
        letter-spacing: 0.04em;
        color: var(--ctp-text);
        font-family: inherit;
        display: block;
        overflow-anchor: none;
      }
      #${panelId} .bsb-ai-caret {
        display: inline-block;
        width: 0.5em; height: 1.1em;
        margin-left: 3px;
        vertical-align: text-bottom;
        background: var(--ctp-lavender);
        border-radius: 1px;
        animation: bsb-caret 1s step-end infinite;
      }
      @keyframes bsb-caret {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
      }
      #${panelId} .bsb-ai-anchor {
        height: 24px; width: 100%; pointer-events: none; flex-shrink: 0;
      }
      /* 浮层：不在底部时跳到最新（ChatGPT 风格） */
      #${panelId} .bsb-jump-latest {
        position: absolute;
        right: 14px; bottom: 14px;
        z-index: 5;
        display: none;
        align-items: center; gap: 6px;
        height: 36px; padding: 0 14px;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--ctp-lavender) 40%, transparent);
        background: color-mix(in srgb, var(--ctp-mantle) 88%, transparent);
        color: var(--ctp-lavender);
        font-size: 12px; font-weight: 700;
        cursor: pointer;
        box-shadow: 0 8px 24px color-mix(in srgb, var(--ctp-crust) 45%, transparent);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        pointer-events: auto;
      }
      #${panelId} .bsb-jump-latest.show { display: inline-flex; }
      #${panelId} .bsb-jump-latest:hover {
        color: var(--ctp-crust);
        background: color-mix(in srgb, var(--ctp-lavender) 88%, transparent);
      }

      /* Markdown 阅读优化：更大间距、更松段落 */
      #${panelId} .bsb-ai-md h1,
      #${panelId} .bsb-ai-md h2,
      #${panelId} .bsb-ai-md h3,
      #${panelId} .bsb-ai-md h4 {
        color: var(--ctp-lavender);
        font-weight: 700;
        letter-spacing: 0.01em;
        line-height: 1.35;
      }
      #${panelId} .bsb-ai-md h1 {
        font-size: 14px; margin: 1.6em 0 0.8em;
        padding-bottom: 0.4em;
        border-bottom: 1px solid color-mix(in srgb, var(--ctp-surface1) 50%, transparent);
      }
      #${panelId} .bsb-ai-md h1:first-child { margin-top: 0.15em; }
      #${panelId} .bsb-ai-md h2 {
        font-size: 14px; margin: 1.55em 0 0.7em; color: var(--ctp-mauve);
      }
      #${panelId} .bsb-ai-md h3 {
        font-size: 14px; margin: 1.4em 0 0.6em; color: var(--ctp-sapphire);
      }
      #${panelId} .bsb-ai-md p {
        margin: 1.15em 0;
        line-height: 1.95;
      }
      #${panelId} .bsb-ai-md ul,
      #${panelId} .bsb-ai-md ol {
        margin: 1.1em 0;
        padding-left: 1.7em;
      }
      #${panelId} .bsb-ai-md li {
        margin: 0.65em 0;
        line-height: 1.95;
        padding-left: 0.25em;
      }
      #${panelId} .bsb-ai-md li > p { margin: 0.35em 0; }
      #${panelId} .bsb-ai-md a { color: var(--ctp-blue); text-decoration: none; }
      #${panelId} .bsb-ai-md a:hover { text-decoration: underline; }
      #${panelId} .bsb-ai-md strong { color: var(--ctp-rosewater); font-weight: 700; }
      #${panelId} .bsb-ai-md em { color: var(--ctp-subtext1); }
      #${panelId} .bsb-ai-md blockquote {
        margin: 1.1em 0;
        padding: 0.75em 1.1em;
        border-left: 3px solid var(--ctp-mauve);
        color: var(--ctp-subtext0);
        background: color-mix(in srgb, var(--ctp-surface0) 28%, transparent);
        border-radius: 0 12px 12px 0;
        line-height: 1.85;
      }
      #${panelId} .bsb-ai-md table {
        border-collapse: separate; border-spacing: 0;
        width: 100%; margin: 1.1em 0; font-size: 13.5px;
        overflow: hidden; border-radius: 12px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 55%, transparent);
      }
      #${panelId} .bsb-ai-md th, #${panelId} .bsb-ai-md td {
        border-bottom: 1px solid color-mix(in srgb, var(--ctp-surface1) 45%, transparent);
        padding: 10px 12px;
        line-height: 1.55;
      }
      #${panelId} .bsb-ai-md tr:last-child td { border-bottom: none; }
      #${panelId} .bsb-ai-md th {
        background: color-mix(in srgb, var(--ctp-surface0) 55%, transparent);
        color: var(--ctp-subtext1); font-weight: 650;
      }
      #${panelId} .bsb-ai-md pre {
        margin: 1.1em 0; padding: 14px 16px; border-radius: 14px;
        overflow: auto; max-height: 420px;
        background: var(--ctp-crust);
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 40%, transparent);
        line-height: 1.55;
      }
      #${panelId} .bsb-ai-md code {
        font-family: "JetBrains Mono", "Fira Code", ui-monospace, monospace;
        font-size: 0.9em;
      }
      #${panelId} .bsb-ai-md :not(pre) > code {
        background: color-mix(in srgb, var(--ctp-surface0) 60%, transparent);
        padding: 0.15em 0.4em; border-radius: 6px; color: var(--ctp-peach);
      }
      #${panelId} .bsb-ai-md .hljs { background: transparent; color: var(--ctp-text); }
      #${panelId} .bsb-ai-md .mermaid {
        margin: 1.25em 0;
        min-height: 86px;
        text-align: left;
      }
      #${panelId} .bsb-mermaid-error {
        overflow: hidden;
        border: 1px solid color-mix(in srgb, var(--ctp-red) 42%, var(--ctp-surface1));
        border-radius: 12px;
        background: color-mix(in srgb, var(--ctp-mantle) 78%, transparent);
      }
      #${panelId} .bsb-mermaid-error.is-setup {
        border-color: color-mix(in srgb, var(--ctp-lavender) 42%, var(--ctp-surface1));
      }
      #${panelId} .bsb-mermaid-error-head {
        min-height: 42px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 7px 10px 7px 13px;
        color: var(--ctp-peach);
        border-bottom: 1px solid color-mix(in srgb, var(--ctp-red) 24%, transparent);
      }
      #${panelId} .bsb-mermaid-error.is-setup .bsb-mermaid-error-head {
        color: var(--ctp-lavender);
        border-bottom-color: color-mix(in srgb, var(--ctp-lavender) 22%, transparent);
      }
      #${panelId} .bsb-mermaid-setup {
        display: grid; gap: 10px; padding: 12px 13px 14px;
      }
      #${panelId} .bsb-mermaid-setup-copy {
        margin: 0; color: var(--ctp-subtext0); font-size: 14px; line-height: 1.55;
      }
      #${panelId} .bsb-mermaid-setup-path {
        display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
        color: var(--ctp-overlay1); font-size: 12px;
      }
      #${panelId} .bsb-mermaid-setup-path b {
        display: inline-flex; align-items: center; height: 22px; padding: 0 8px;
        border-radius: 999px; font-weight: 700; color: var(--ctp-text);
        background: color-mix(in srgb, var(--ctp-lavender) 14%, var(--ctp-surface0));
      }
      #${panelId} .bsb-mermaid-setup-row {
        display: flex; flex-wrap: wrap; gap: 8px; align-items: end;
      }
      #${panelId} .bsb-mermaid-setup-row label,
      #${panelId} .bsb-mermaid-setup-grid label {
        display: grid; gap: 4px; min-width: 0; color: var(--ctp-overlay1); font-size: 12px;
      }
      #${panelId} .bsb-mermaid-setup-row select,
      #${panelId} .bsb-mermaid-setup-grid input {
        height: 34px; min-width: 12rem; padding: 0 10px; border-radius: 9px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 70%, transparent);
        background: color-mix(in srgb, var(--ctp-base) 70%, transparent);
        color: var(--ctp-text); font: inherit; font-size: 14px;
      }
      #${panelId} .bsb-mermaid-setup-grid {
        display: grid; gap: 8px;
        grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
      }
      #${panelId} .bsb-mermaid-setup-actions { display: flex; flex-wrap: wrap; gap: 8px; }
      #${panelId} .bsb-mermaid-error details { padding: 9px 12px 12px; }
      #${panelId} .bsb-mermaid-error summary { cursor: pointer; color: var(--ctp-overlay1); }
      #${panelId} .bsb-mermaid-error pre { margin: 10px 0 0; max-height: 280px; overflow: auto; }
      #${panelId} .bsb-llm-field-focus {
        padding: 8px; margin: -8px; border-radius: 10px;
        outline: 2px solid color-mix(in srgb, var(--ctp-lavender) 55%, transparent);
        background: color-mix(in srgb, var(--ctp-lavender) 10%, transparent);
      }
      #${panelId} .bsb-mermaid-card {
        position: relative;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        min-width: 0;
        overflow: hidden;
        border-radius: 15px;
        border: 1px solid color-mix(in srgb, var(--ctp-blue) 30%, var(--ctp-surface1));
        background: var(--ctp-mantle);
        box-shadow: 0 12px 30px color-mix(in srgb, var(--ctp-crust) 45%, transparent);
        content-visibility: visible;
        contain: layout paint style;
      }
      #${panelId} .bsb-mermaid-toolbar {
        position: sticky;
        top: 0;
        z-index: 3;
        min-height: 40px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 6px 8px 6px 11px;
        border-bottom: 1px solid color-mix(in srgb, var(--ctp-blue) 22%, transparent);
        background: color-mix(in srgb, var(--ctp-mantle) 96%, transparent);
        color: var(--ctp-subtext1);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      }
      #${panelId} .bsb-mermaid-title {
        min-width: 0;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        color: var(--ctp-text);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: .03em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #${panelId} .bsb-mermaid-title::before {
        content: "◇";
        color: #89b4fa;
      }
      #${panelId} .bsb-mermaid-card .bsb-mermaid-title {
        font-variant-numeric: tabular-nums;
      }
      #${panelId} .bsb-mermaid-tools {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        gap: 3px;
      }
      #${panelId} .bsb-mermaid-tool {
        appearance: none;
        min-width: 29px;
        height: 28px;
        padding: 0 7px;
        border: 1px solid transparent;
        border-radius: 7px;
        background: transparent;
        color: #a6adc8;
        font: 650 11px/1 system-ui, sans-serif;
        cursor: pointer;
      }
      #${panelId} .bsb-mermaid-tool:hover,
      #${panelId} .bsb-mermaid-tool:focus-visible {
        color: #f5e0dc;
        background: #313244;
        border-color: #45475a;
        outline: none;
      }
      #${panelId} .bsb-mermaid-scale {
        min-width: 42px;
        color: #89b4fa;
        text-align: center;
        font: 700 10px/1 ui-monospace, monospace;
        font-variant-numeric: tabular-nums;
      }
      #${panelId} .bsb-mermaid-viewport {
        position: relative;
        min-height: 220px;
        max-height: min(68vh, 720px);
        overflow: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
        padding: 18px;
        background:
          linear-gradient(rgba(69, 71, 90, .18) 1px, transparent 1px),
          linear-gradient(90deg, rgba(69, 71, 90, .18) 1px, transparent 1px),
          #181825;
        background-size: 24px 24px;
      }
      #${panelId} .bsb-mermaid-stage {
        width: var(--bsb-mermaid-width, 760px);
        min-width: 1px;
        margin: 0 auto;
        transform-origin: top left;
      }
      #${panelId} .bsb-mermaid-svg {
        display: block;
        width: 100% !important;
        height: auto !important;
        max-width: none !important;
        overflow: visible;
        shape-rendering: geometricPrecision;
        text-rendering: geometricPrecision;
      }
      #${panelId} .bsb-mermaid-svg text,
      #${panelId} .bsb-mermaid-svg .label,
      #${panelId} .bsb-mermaid-svg .nodeLabel,
      #${panelId} .bsb-mermaid-svg .edgeLabel {
        font-family: Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif !important;
        -webkit-font-smoothing: antialiased;
      }
      #${panelId} .bsb-mermaid-hint {
        position: absolute;
        right: 10px;
        bottom: 8px;
        z-index: 2;
        pointer-events: none;
        padding: 3px 7px;
        border-radius: 6px;
        background: rgba(17, 17, 27, .78);
        color: #7f849c;
        font-size: 9px;
      }
      #${panelId} .bsb-mermaid-modal {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        pointer-events: auto;
        display: grid;
        place-items: stretch;
        padding: 18px;
        background: rgba(10, 10, 16, .88);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      }
      #${panelId} .bsb-mermaid-modal .bsb-mermaid-card {
        width: 100%;
        height: 100%;
        max-width: none;
        border-radius: 14px;
        box-shadow: 0 25px 90px rgba(0, 0, 0, .55);
      }
      #${panelId} .bsb-mermaid-modal .bsb-mermaid-viewport {
        max-height: none;
        min-height: 0;
      }
      #${panelId} .bsb-mermaid-card[data-fit="fit"] .bsb-mermaid-stage {
        margin-inline: auto;
      }
      @media (max-width: 560px) {
        #${panelId} .bsb-mermaid-viewport { padding: 12px; min-height: 190px; }
        #${panelId} .bsb-mermaid-title { display: none; }
        #${panelId} .bsb-mermaid-modal { padding: 0; }
        #${panelId} .bsb-mermaid-modal .bsb-mermaid-card { border-radius: 0; }
      }
      /* KaTeX 数学公式（深色面板） */
      #${panelId} .bsb-ai-md .katex {
        color: var(--ctp-text);
        font-size: 1.12em;
      }
      #${panelId} .bsb-ai-md .bsb-katex-inline {
        display: inline;
        padding: 0 0.1em;
      }
      #${panelId} .bsb-ai-md .bsb-katex-display {
        display: block;
        margin: 1.2em 0;
        padding: 14px 12px;
        overflow-x: auto;
        overflow-y: hidden;
        text-align: center;
        border-radius: 12px;
        background: color-mix(in srgb, var(--ctp-mantle) 55%, transparent);
        border: 1px solid color-mix(in srgb, var(--ctp-surface0) 45%, transparent);
      }
      #${panelId} .bsb-ai-md .bsb-katex-display .katex-display {
        margin: 0;
      }
      #${panelId} .bsb-ai-md .katex-error {
        color: var(--ctp-red) !important;
      }
      #${panelId} .bsb-ai-md .bsb-math-fallback {
        color: var(--ctp-peach);
        white-space: pre-wrap;
        font-family: "JetBrains Mono", ui-monospace, monospace;
        font-size: 0.92em;
      }
      #${panelId} .bsb-ai-md pre.bsb-math-fallback {
        margin: 1em 0;
        padding: 12px 14px;
        border-radius: 12px;
        background: color-mix(in srgb, var(--ctp-mantle) 55%, transparent);
        border: 1px solid color-mix(in srgb, var(--ctp-peach) 28%, transparent);
      }
      #${panelId} .bsb-ai-md .bsb-code-lang {
        display: block; font-size: 10px; color: var(--ctp-overlay1);
        margin-bottom: 10px; text-transform: lowercase; letter-spacing: 0.06em;
      }
      #${panelId} .bsb-ai-md hr {
        border: none; height: 1px; margin: 1.6em 0;
        background: color-mix(in srgb, var(--ctp-surface1) 55%, transparent);
      }
      /* 阅读与渲染优化 */
      #${panelId}.ai-busy .bsb-sidebar,
      #${panelId} .bsb-sidebar.dragging,
      #${panelId} .bsb-sidebar.resizing {
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
      }
      #${panelId} .bsb-ai-mode-row {
        display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
        margin: 0 0 10px;
      }
      #${panelId} .bsb-ai-mode-row label {
        display: inline-flex; align-items: center; gap: 7px;
        color: var(--ctp-subtext0); font-size: 11px;
      }
      #${panelId} .bsb-ai-mode-row select {
        min-width: 108px; border-radius: 9px; padding: 6px 9px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 55%, transparent);
        background: var(--ctp-mantle); color: var(--ctp-text); outline: none;
      }
      #${panelId} .bsb-ai-content {
        overflow-anchor: none;
        text-rendering: optimizeLegibility;
      }
      #${panelId} .bsb-ai-content > :not(.bsb-toc) {
        content-visibility: auto;
        contain-intrinsic-size: auto 160px;
      }
      #${panelId} .bsb-ai-md p,
      #${panelId} .bsb-ai-md li { text-wrap: pretty; }
      #${panelId} .bsb-time-link {
        appearance: none; display: inline-flex; align-items: center;
        margin: 0 .14em; padding: .12em .46em; border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--ctp-blue) 35%, transparent);
        background: color-mix(in srgb, var(--ctp-blue) 12%, transparent);
        color: var(--ctp-blue); font: 600 .78em/1.5 ui-monospace, monospace;
        cursor: pointer; vertical-align: .08em;
      }
      #${panelId} .bsb-time-link:hover,
      #${panelId} .bsb-time-link:focus-visible {
        background: color-mix(in srgb, var(--ctp-blue) 22%, transparent);
        outline: 2px solid color-mix(in srgb, var(--ctp-blue) 32%, transparent);
      }
      #${panelId} .bsb-toc {
        margin: 0 0 1.35em; padding: 10px 12px; border-radius: 12px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 55%, transparent);
        background: color-mix(in srgb, var(--ctp-mantle) 55%, transparent);
        content-visibility: visible;
      }
      #${panelId} .bsb-toc summary {
        cursor: pointer; color: var(--ctp-lavender); font-weight: 700;
      }
      #${panelId} .bsb-toc nav { display: grid; gap: 5px; margin-top: 9px; }
      #${panelId} .bsb-toc button {
        appearance: none; border: 0; background: transparent; color: var(--ctp-subtext1);
        text-align: left; cursor: pointer; padding: 3px 5px; border-radius: 6px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      #${panelId} .bsb-toc button[data-level="3"] { padding-left: 20px; }
      #${panelId} .bsb-toc button:hover { color: var(--ctp-text); background: var(--ctp-surface0); }
      #${panelId} .mermaid[data-bsb-state="pending"]::before {
        content: "图表将在进入视区时渲染"; color: var(--ctp-overlay1); font-size: 11px;
      }
      @media (max-width: 560px) {
        #${panelId}.open:not(.docked) .bsb-sidebar {
          left: 0 !important; top: 0 !important; width: 100vw !important; height: 100dvh !important;
          border-radius: 0;
        }
        #${panelId} .bsb-ai-hero { align-items: flex-start; }
      }
      @media (prefers-reduced-motion: reduce) {
        #${panelId} *, #${panelId} *::before, #${panelId} *::after {
          animation-duration: .001ms !important; animation-iteration-count: 1 !important;
          transition-duration: .001ms !important; scroll-behavior: auto !important;
        }
      }

`;
  }
  const aiStyles = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    renderAiStyles
  }, Symbol.toStringTag, { value: "Module" }));
  function renderKnowledgeDrilldownStyles(panelId) {
    return `
      /* v6 Knowledge Drill-down */
      #${panelId} .bsb-selection-toolbar {
        pointer-events:auto;
        position:fixed; z-index:2147483646; width:300px; box-sizing:border-box;
        padding:6px; border-radius:13px; border:1px solid color-mix(in srgb,var(--ctp-mauve) 32%,var(--ctp-surface1));
        background:color-mix(in srgb,var(--ctp-base) 96%,transparent); box-shadow:0 16px 40px rgba(0,0,0,.42);
        backdrop-filter:blur(14px) saturate(1.15); -webkit-backdrop-filter:blur(14px) saturate(1.15);
      }
      #${panelId} .bsb-selection-toolbar-text { display:block; padding:3px 7px 6px; color:var(--ctp-overlay1); font-size:9.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      #${panelId} .bsb-selection-toolbar-actions { display:grid; grid-template-columns:repeat(4,1fr); gap:4px; }
      #${panelId} .bsb-selection-toolbar-actions button { border:0; border-radius:8px; padding:7px 4px; background:transparent; color:var(--ctp-subtext1); cursor:pointer; font-size:10px; font-weight:720; }
      #${panelId} .bsb-selection-toolbar-actions button:hover { background:var(--ctp-surface0); color:var(--ctp-text); }
      #${panelId} .bsb-selection-toolbar-actions button:first-child { color:var(--ctp-mauve); background:color-mix(in srgb,var(--ctp-mauve) 10%,transparent); }
      #${panelId} .bsb-knowledge-anchor-mark { padding:0 .08em; border-radius:4px; background:color-mix(in srgb,var(--ctp-mauve) 17%,transparent); color:inherit; text-decoration:underline; text-decoration-color:color-mix(in srgb,var(--ctp-mauve) 72%,transparent); text-decoration-thickness:1.5px; text-underline-offset:3px; cursor:pointer; }
      #${panelId} .bsb-knowledge-anchor-mark:hover { background:color-mix(in srgb,var(--ctp-mauve) 28%,transparent); }
      #${panelId} .bsb-preprocess-block.has-knowledge::after { content:""; position:absolute; top:11px; right:10px; width:6px; height:6px; border-radius:50%; background:var(--ctp-mauve); box-shadow:0 0 10px color-mix(in srgb,var(--ctp-mauve) 55%,transparent); }

      #${panelId} .bsb-knowledge-rail {
        position:absolute; z-index:43; top:0; right:0; bottom:0; width:var(--bsb-knowledge-rail-w,400px); max-width:calc(100% - 36px); transform:translateX(102%);
        display:flex; flex-direction:column; overflow:hidden; border-left:1px solid color-mix(in srgb,var(--ctp-mauve) 22%,var(--ctp-surface0));
        background:color-mix(in srgb,var(--ctp-base) 97%,transparent); box-shadow:-18px 0 42px rgba(0,0,0,.30); transition:transform .19s ease;
      }
      #${panelId} .bsb-knowledge-rail.open { transform:translateX(0); }
      #${panelId} .bsb-knowledge-rail.resizing { transition:none; user-select:none; }
      #${panelId} .bsb-knowledge-rail-resize {
        position:absolute; z-index:5; left:0; top:0; bottom:0; width:8px; cursor:col-resize;
        background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--ctp-mauve) 18%,transparent));
      }
      #${panelId} .bsb-knowledge-rail-resize:hover,
      #${panelId} .bsb-knowledge-rail.resizing .bsb-knowledge-rail-resize { background:color-mix(in srgb,var(--ctp-mauve) 36%,transparent); }
      #${panelId} [data-view-panel="ai"].knowledge-open .bsb-ai-commandbar,
      #${panelId} [data-view-panel="ai"].knowledge-open .bsb-preprocess-nav,
      #${panelId} [data-view-panel="ai"].knowledge-open .bsb-output-nav,
      #${panelId} [data-view-panel="ai"].knowledge-open .bsb-ai-canvas-wrap { margin-right:var(--bsb-knowledge-rail-w,400px); }
      #${panelId} .bsb-knowledge-rail-head { flex:0 0 auto; display:flex; align-items:flex-start; gap:10px; padding:13px 12px 11px 14px; border-bottom:1px solid var(--ctp-surface0); background:linear-gradient(180deg,color-mix(in srgb,var(--ctp-mauve) 7%,transparent),transparent); }
      #${panelId} .bsb-knowledge-anchor-title { flex:1 1 auto; min-width:0; }
      #${panelId} .bsb-knowledge-kicker { display:block; color:var(--ctp-overlay1); font-size:8px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
      #${panelId} .bsb-knowledge-anchor-title strong { display:block; margin-top:3px; color:var(--ctp-text); font-size:14px; line-height:1.35; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      #${panelId} .bsb-knowledge-anchor-title small { display:block; margin-top:3px; color:var(--ctp-overlay1); font-size:9.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      #${panelId} .bsb-knowledge-rail-actions { display:flex; gap:3px; }
      #${panelId} .bsb-knowledge-rail-actions .active { color:var(--ctp-mauve); background:color-mix(in srgb,var(--ctp-mauve) 12%,var(--ctp-surface0)); }
      #${panelId} .bsb-knowledge-rail-body { flex:1 1 auto; min-height:0; display:flex; flex-direction:column; }
      #${panelId} .bsb-knowledge-evidence {
        flex:0 0 auto; position:relative; padding:6px 14px 8px; border-bottom:1px solid color-mix(in srgb,var(--ctp-surface0) 80%,transparent);
      }
      #${panelId} .bsb-knowledge-evidence-chip {
        max-width:100%; display:inline-flex; align-items:center; gap:6px; border:1px solid color-mix(in srgb,var(--ctp-mauve) 28%,var(--ctp-surface1));
        border-radius:999px; padding:5px 10px; background:color-mix(in srgb,var(--ctp-mauve) 8%,var(--ctp-mantle));
        color:var(--ctp-subtext1); cursor:pointer; font-size:10.5px; line-height:1.3; text-align:left;
      }
      #${panelId} .bsb-knowledge-evidence-chip:hover { color:var(--ctp-text); border-color:color-mix(in srgb,var(--ctp-mauve) 48%,var(--ctp-surface1)); }
      #${panelId} .bsb-knowledge-evidence-chip strong { color:var(--ctp-mauve); font-weight:780; }
      #${panelId} .bsb-knowledge-evidence-chip em { font-style:normal; color:var(--ctp-text); max-width:min(42ch,52vw); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      #${panelId} .bsb-knowledge-evidence-chip span.action { color:var(--ctp-overlay1); white-space:nowrap; }
      #${panelId} .bsb-knowledge-evidence-panel {
        position:absolute; z-index:8; left:14px; right:14px; top:calc(100% - 2px); max-height:220px; overflow:auto;
        border:1px solid color-mix(in srgb,var(--ctp-mauve) 24%,var(--ctp-surface1)); border-radius:12px;
        background:color-mix(in srgb,var(--ctp-base) 98%,transparent); box-shadow:0 14px 36px rgba(0,0,0,.34);
        padding:10px 12px; display:flex; flex-direction:column; gap:8px;
      }
      #${panelId} .bsb-knowledge-evidence-panel[hidden] { display:none !important; }
      #${panelId} .bsb-knowledge-evidence-panel strong { display:block; margin-bottom:3px; color:var(--ctp-mauve); font-size:9px; letter-spacing:.08em; text-transform:uppercase; }
      #${panelId} .bsb-knowledge-evidence-panel pre {
        margin:0; white-space:pre-wrap; overflow-wrap:anywhere; color:var(--ctp-subtext1);
        font:500 11px/1.55 ui-sans-serif,system-ui,sans-serif;
      }
      #${panelId} .bsb-knowledge-rail-split {
        flex:1 1 auto; min-height:0; display:grid; grid-template-columns:minmax(0,1fr); overflow:hidden;
      }
      #${panelId} .bsb-knowledge-rail-split.with-tree {
        grid-template-columns:minmax(110px,36%) minmax(0,1fr);
      }
      #${panelId} .bsb-knowledge-split-main { min-width:0; min-height:0; display:flex; flex-direction:column; overflow:hidden; }
      #${panelId} .bsb-knowledge-splitter {
        flex:0 0 auto; width:5px; cursor:col-resize; background:color-mix(in srgb,var(--ctp-surface0) 80%,transparent);
        border:0; padding:0; position:relative;
      }
      #${panelId} .bsb-knowledge-splitter::after {
        content:""; position:absolute; inset:12% 1px; border-radius:99px;
        background:color-mix(in srgb,var(--ctp-overlay0) 45%,transparent);
      }
      #${panelId} .bsb-knowledge-splitter:hover::after,
      #${panelId}.knowledge-resizing .bsb-knowledge-splitter::after { background:var(--ctp-mauve); }
      #${panelId} .bsb-knowledge-pane-head {
        flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; gap:6px; padding:6px 8px 4px;
      }
      #${panelId} .bsb-knowledge-crumbs { flex:0 0 auto; min-height:28px; display:flex; align-items:center; gap:4px; overflow-x:auto; padding:5px 12px; border-bottom:1px solid color-mix(in srgb,var(--ctp-surface0) 75%,transparent); scrollbar-width:none; }
      #${panelId} .bsb-knowledge-crumbs button { flex:0 0 auto; max-width:145px; border:0; background:transparent; color:var(--ctp-overlay1); cursor:pointer; font-size:9px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding:2px 3px; }
      #${panelId} .bsb-knowledge-crumbs button:last-of-type { color:var(--ctp-subtext1); }
      #${panelId} .bsb-knowledge-crumbs span { color:var(--ctp-surface2); }
      #${panelId} .bsb-knowledge-panel-main { flex:1 1 auto; min-height:0; overflow:auto; padding:14px 16px 18px; }
      #${panelId} .bsb-knowledge-question-meta { display:flex; align-items:center; justify-content:space-between; gap:8px; }
      #${panelId} .bsb-knowledge-question-meta > span { color:var(--ctp-overlay1); font-size:8.5px; font-weight:850; letter-spacing:.08em; }
      #${panelId} .bsb-knowledge-node-star { width:28px; height:28px; display:grid; place-items:center; border:0; border-radius:8px; background:transparent; color:var(--ctp-overlay1); cursor:pointer; font-size:15px; line-height:1; }
      #${panelId} .bsb-knowledge-node-star:hover { background:var(--ctp-surface0); color:var(--ctp-yellow); }
      #${panelId} .bsb-knowledge-node-star.active { color:var(--ctp-yellow); background:color-mix(in srgb,var(--ctp-yellow) 9%,transparent); }
      #${panelId} .bsb-knowledge-question-card {
        --bsb-block-accent: var(--ctp-mauve);
        position:relative; overflow:hidden; margin:0 0 12px auto; max-width:min(92%, 36em);
        padding:12px 16px 13px 14px; border-radius:13px;
        border:1px solid color-mix(in srgb,var(--ctp-mauve) 22%,var(--ctp-surface0));
        background:
          linear-gradient(255deg,color-mix(in srgb,var(--ctp-mauve) 8%,transparent),transparent 40%),
          color-mix(in srgb,var(--ctp-mantle) 70%,transparent);
        box-shadow:0 4px 16px color-mix(in srgb,var(--ctp-crust) 15%,transparent);
      }
      #${panelId} .bsb-knowledge-question-card::before {
        content:""; position:absolute; inset:9px 0 9px auto; width:3px; border-radius:999px 0 0 999px;
        background:var(--ctp-mauve); opacity:.8;
      }
      #${panelId} .bsb-knowledge-question h3 { margin:5px 0 0; color:var(--ctp-text); font-size:var(--bsb-knowledge-font); line-height:1.5; font-weight:760; }
      #${panelId} .bsb-knowledge-answer { color:var(--ctp-text); }
      #${panelId} .bsb-knowledge-answer-reading {
        display:flex; flex-direction:column; gap:10px;
      }
      #${panelId} .bsb-knowledge-answer-card.bsb-preprocess-block {
        /* reuse preprocess card chrome; accent cycles via nth-of-type */
      }
      #${panelId} .bsb-knowledge-card-body {
        white-space:normal;
        color:color-mix(in srgb,var(--ctp-text) 94%,var(--ctp-subtext1));
        font-size:var(--bsb-knowledge-font); line-height:1.7; letter-spacing:.01em;
        overflow-wrap:anywhere; text-wrap:pretty;
      }
      #${panelId} .bsb-knowledge-card-body h1,
      #${panelId} .bsb-knowledge-card-body h2,
      #${panelId} .bsb-knowledge-card-body h3,
      #${panelId} .bsb-knowledge-card-body h4 {
        margin:.75em 0 .35em; color:var(--ctp-lavender); font-size:var(--bsb-knowledge-font);
        font-weight:760; line-height:1.4;
      }
      #${panelId} .bsb-knowledge-card-body > *:first-child { margin-top:0; }
      #${panelId} .bsb-knowledge-card-body > *:last-child { margin-bottom:0; }
      #${panelId} .bsb-knowledge-card-body p { margin:0 0 .7em; }
      #${panelId} .bsb-knowledge-card-body ul,
      #${panelId} .bsb-knowledge-card-body ol { margin:.35em 0 .7em; padding-left:1.25em; }
      #${panelId} .bsb-knowledge-card-body li { margin:.2em 0; }
      #${panelId} .bsb-knowledge-card-body strong {
        color:color-mix(in srgb,var(--ctp-rosewater) 88%,var(--ctp-text));
        font-weight:800;
      }
      /* ==核心记忆点== ：荧光笔只划文字下半，高度/颜色受控错落，文字 baseline 不乱 */
      #${panelId} .bsb-md-highlight {
        --bsb-hl-color:color-mix(in srgb,var(--ctp-mauve) 38%,transparent);
        --bsb-hl-start:58%;
        --bsb-hl-end:94%;
        color:inherit;
        font-weight:760;
        padding:0 .07em;
        margin:0 .015em;
        border-radius:.18em;
        background:linear-gradient(
          180deg,
          transparent 0,
          transparent var(--bsb-hl-start),
          var(--bsb-hl-color) var(--bsb-hl-start),
          var(--bsb-hl-color) var(--bsb-hl-end),
          transparent var(--bsb-hl-end)
        );
        -webkit-box-decoration-break:clone;
        box-decoration-break:clone;
      }
      #${panelId} .bsb-md-highlight-0 {
        --bsb-hl-color:color-mix(in srgb,var(--ctp-mauve) 38%,transparent);
        --bsb-hl-start:61%;
        --bsb-hl-end:96%;
      }
      #${panelId} .bsb-md-highlight-1 {
        --bsb-hl-color:color-mix(in srgb,var(--ctp-teal) 31%,transparent);
        --bsb-hl-start:52%;
        --bsb-hl-end:89%;
      }
      #${panelId} .bsb-md-highlight-2 {
        --bsb-hl-color:color-mix(in srgb,var(--ctp-peach) 29%,transparent);
        --bsb-hl-start:64%;
        --bsb-hl-end:93%;
      }
      #${panelId} .bsb-md-highlight-3 {
        --bsb-hl-color:color-mix(in srgb,var(--ctp-lavender) 30%,transparent);
        --bsb-hl-start:56%;
        --bsb-hl-end:92%;
      }
      #${panelId} .bsb-knowledge-card-body code {
        font:650 .9em/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;
        padding:.08em .35em; border-radius:5px;
        background:color-mix(in srgb,var(--bsb-block-accent) 10%,var(--ctp-surface0));
      }
      #${panelId} .bsb-knowledge-card-body pre {
        margin:.5em 0 .8em; padding:10px 12px; border-radius:10px; overflow:auto;
        background:color-mix(in srgb,var(--ctp-crust) 35%,var(--ctp-mantle));
        border:1px solid color-mix(in srgb,var(--ctp-surface1) 70%,transparent);
      }
      #${panelId} .bsb-knowledge-card-body pre code { padding:0; background:transparent; }
      #${panelId} .bsb-knowledge-card-body .bsb-katex-display,
      #${panelId} .bsb-knowledge-answer .bsb-katex-display {
        display:block; overflow-x:auto; overflow-y:hidden; margin:.65em 0 .85em; padding:.35em 0;
        text-align:center;
      }
      #${panelId} .bsb-knowledge-card-body .bsb-katex-inline,
      #${panelId} .bsb-knowledge-answer .bsb-katex-inline {
        display:inline-block; max-width:100%; overflow-x:auto; vertical-align:middle;
      }
      #${panelId} .bsb-knowledge-card-body .katex,
      #${panelId} .bsb-knowledge-answer .katex { font-size:1.05em; }
      #${panelId} .bsb-knowledge-card-body .bsb-math-fallback {
        white-space:pre-wrap; color:var(--ctp-subtext1); font-family:ui-monospace,Consolas,monospace;
      }
      #${panelId} .bsb-knowledge-card-body blockquote {
        margin:.5em 0 .8em; padding:.2em 0 .2em .9em;
        border-left:3px solid color-mix(in srgb,var(--bsb-block-accent) 55%,transparent);
        color:var(--ctp-subtext1);
      }
      #${panelId} .bsb-knowledge-answer.streaming .bsb-knowledge-answer-card:last-of-type .bsb-knowledge-card-body::after {
        content:""; display:inline-block; width:7px; height:13px; margin-left:4px; vertical-align:-2px;
        border-radius:2px; background:var(--ctp-mauve); animation:bsb-pulse 1s ease-in-out infinite;
      }
      #${panelId} .bsb-knowledge-thinking {
        color:var(--ctp-overlay1); padding:18px 14px; border-radius:13px;
        border:1px dashed color-mix(in srgb,var(--ctp-surface2) 55%,transparent);
        background:color-mix(in srgb,var(--ctp-mantle) 55%,transparent); font-size:12px; line-height:1.55;
      }
      #${panelId} .bsb-knowledge-suggestions {
        margin-top:14px; padding:12px 12px 10px; border-radius:13px;
        border:1px solid color-mix(in srgb,var(--ctp-mauve) 14%,var(--ctp-surface0));
        background:color-mix(in srgb,var(--ctp-mantle) 58%,transparent);
      }
      #${panelId} .bsb-knowledge-suggestions .bsb-knowledge-kicker { display:block; margin-bottom:6px; }
      #${panelId} .bsb-knowledge-suggestions button {
        width:100%; display:flex; gap:7px; align-items:flex-start; border:0; border-radius:9px;
        padding:8px 7px; background:transparent; color:var(--ctp-subtext1); cursor:pointer;
        text-align:left; line-height:1.45; font-size:11px;
      }
      #${panelId} .bsb-knowledge-suggestions button:hover { background:var(--ctp-surface0); color:var(--ctp-text); }
      #${panelId} .bsb-knowledge-suggestions button span { color:var(--ctp-mauve); flex:0 0 auto; }
      #${panelId} .bsb-knowledge-composer {
        flex:0 0 auto; padding:10px 14px 12px; border-top:1px solid var(--ctp-surface0);
        background:color-mix(in srgb,var(--ctp-mantle) 88%,transparent); backdrop-filter:blur(10px);
      }
      #${panelId} .bsb-knowledge-composer-box {
        display:flex; flex-direction:column; gap:6px; border:1px solid var(--ctp-surface1); border-radius:14px;
        background:var(--ctp-base); padding:8px 10px 8px; box-shadow:0 1px 0 color-mix(in srgb,var(--ctp-surface0) 55%,transparent);
      }
      #${panelId} .bsb-knowledge-composer-box:focus-within {
        border-color:color-mix(in srgb,var(--ctp-mauve) 55%,var(--ctp-surface1));
        box-shadow:0 0 0 3px color-mix(in srgb,var(--ctp-mauve) 10%,transparent);
      }
      #${panelId} .bsb-knowledge-composer textarea {
        width:100%; min-height:44px; max-height:120px; resize:none; box-sizing:border-box; border:0; padding:4px 2px;
        background:transparent; color:var(--ctp-text); outline:none; font:inherit;
        font-size:var(--bsb-knowledge-font); line-height:1.5;
      }
      #${panelId} .bsb-knowledge-composer-tools { display:flex; align-items:center; justify-content:space-between; gap:8px; }
      #${panelId} .bsb-knowledge-model-select {
        min-width:0; max-width:min(220px,48%); height:28px; border:0; border-radius:8px; background:var(--ctp-mantle);
        color:var(--ctp-overlay1); padding:0 24px 0 8px; outline:none; font-size:10px;
      }
      #${panelId} .bsb-knowledge-composer-tools .bsb-btn { min-width:72px; height:30px; border-radius:9px; }
      #${panelId} .bsb-knowledge-welcome { min-height:220px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; color:var(--ctp-overlay1); }
      #${panelId} .bsb-knowledge-welcome strong { color:var(--ctp-text); margin-top:8px; font-size:14px; }
      #${panelId} .bsb-knowledge-welcome span { max-width:260px; margin-top:6px; font-size:10px; line-height:1.55; }
      #${panelId} .bsb-knowledge-welcome button { margin-top:14px; border:1px solid color-mix(in srgb,var(--ctp-mauve) 30%,var(--ctp-surface1)); border-radius:9px; padding:7px 11px; background:color-mix(in srgb,var(--ctp-mauve) 10%,transparent); color:var(--ctp-mauve); cursor:pointer; }
      #${panelId} .bsb-knowledge-orb { width:36px; height:36px; display:grid; place-items:center; border-radius:12px; background:color-mix(in srgb,var(--ctp-mauve) 14%,var(--ctp-surface0)); color:var(--ctp-mauve); font-size:17px; }
      #${panelId} .bsb-knowledge-tree { display:flex; flex-direction:column; gap:2px; }
      #${panelId} .bsb-knowledge-tree-node > button { width:100%; display:grid; grid-template-columns:14px minmax(0,1fr) auto; gap:5px; align-items:start; padding:6px 7px 6px calc(7px + var(--depth) * 13px); border:1px solid transparent; border-radius:8px; background:transparent; color:var(--ctp-subtext0); cursor:pointer; text-align:left; font-size:10px; line-height:1.35; }
      #${panelId} .bsb-knowledge-tree-node > button:hover { background:var(--ctp-surface0); color:var(--ctp-text); }
      #${panelId} .bsb-knowledge-tree-node > button.active { border-color:color-mix(in srgb,var(--ctp-mauve) 28%,transparent); background:color-mix(in srgb,var(--ctp-mauve) 9%,var(--ctp-surface0)); color:var(--ctp-text); }
      #${panelId} .bsb-knowledge-tree-branch { color:var(--ctp-overlay0); }
      #${panelId} .bsb-knowledge-star { color:var(--ctp-yellow); font-size:9px; }
      #${panelId} .bsb-knowledge-empty-small { padding:12px; color:var(--ctp-overlay1); font-size:10px; text-align:center; }
      #${panelId} .bsb-knowledge-rail-empty { height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:7px; padding:24px; color:var(--ctp-overlay1); text-align:center; }
      #${panelId} .bsb-knowledge-rail-empty > span { color:var(--ctp-mauve); font-size:26px; }
      #${panelId} .bsb-knowledge-rail-empty strong { color:var(--ctp-text); font-size:15px; }
      #${panelId} .bsb-knowledge-rail-empty p { max-width:260px; font-size:10.5px; line-height:1.55; }

`;
  }
  const knowledgeStyles = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    renderKnowledgeDrilldownStyles
  }, Symbol.toStringTag, { value: "Module" }));
  function renderSettingsStyles(panelId) {
    return `
      /* 设置页 */
      #${panelId} .bsb-settings {
        overflow: auto; flex: 1; min-height: 0;
        display: flex; flex-direction: column; gap: 12px;
        padding-right: 2px;
      }
      #${panelId} .bsb-card {
        border-radius: 14px; padding: 12px 14px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 45%, transparent);
        background: color-mix(in srgb, var(--ctp-mantle) 45%, transparent);
      }
      #${panelId} .bsb-card h3 {
        margin: 0 0 10px; font-size: 12px; font-weight: 700;
        color: var(--ctp-subtext1); letter-spacing: 0.04em; text-transform: uppercase;
      }
      #${panelId} .bsb-ai-config label,
      #${panelId} .bsb-field label {
        display: flex; flex-direction: column; gap: 4px;
        font-size: 11.5px; color: var(--ctp-subtext1); margin-bottom: 8px;
      }
      #${panelId} .bsb-ai-config input,
      #${panelId} .bsb-ai-config textarea,
      #${panelId} .bsb-field input {
        width: 100%; border-radius: 10px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 55%, transparent);
        background: color-mix(in srgb, var(--ctp-base) 60%, transparent);
        color: var(--ctp-text); padding: 8px 10px; font-size: 12.5px; font-family: inherit;
        outline: none;
      }
      #${panelId} .bsb-ai-config input:focus,
      #${panelId} .bsb-ai-config textarea:focus {
        border-color: color-mix(in srgb, var(--ctp-mauve) 50%, transparent);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--ctp-mauve) 16%, transparent);
      }
      #${panelId} .bsb-ai-config textarea {
        min-height: 88px; resize: vertical; line-height: 1.45;
      }
      #${panelId} .bsb-ai-config .row2 {
        display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
      }
      #${panelId} .bsb-ai-cfg-actions {
        display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px;
      }
      #${panelId} .bsb-ai-config-head {
        display: flex; align-items: flex-start; justify-content: space-between; gap: 10px;
        margin-bottom: 10px;
      }
      #${panelId} .bsb-ai-config-head p {
        margin: 0; color: var(--ctp-subtext0); font-size: 11px; line-height: 1.5;
      }
      #${panelId} .bsb-ai-profiles { display: flex; flex-direction: column; gap: 10px; }
      #${panelId} .bsb-ai-profile {
        padding: 11px; border-radius: 12px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 48%, transparent);
        background: color-mix(in srgb, var(--ctp-base) 32%, transparent);
      }
      #${panelId} .bsb-ai-profile.disabled { opacity: .62; }
      #${panelId} .bsb-ai-profile-title {
        display: flex; align-items: center; gap: 8px; margin-bottom: 9px;
      }
      #${panelId} .bsb-ai-profile-title input[type="checkbox"] { width: auto; flex: 0 0 auto; }
      #${panelId} .bsb-ai-profile-title input[type="text"] { flex: 1 1 auto; min-width: 0; font-weight: 700; }
      #${panelId} .bsb-ai-profile-tools { display: inline-flex; gap: 5px; flex: 0 0 auto; }
      #${panelId} .bsb-ai-profile-tools button {
        height: 28px; padding: 0 8px; border-radius: 8px; font-size: 10.5px;
      }
      #${panelId} .bsb-ai-profile-summary {
        color: var(--ctp-overlay1); font-size: 10.5px; margin: -2px 0 8px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      #${panelId} .bsb-prompt-profiles { display: flex; flex-direction: column; gap: 10px; }
      #${panelId} .bsb-prompt-card {
        padding: 11px; border-radius: 12px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 48%, transparent);
        background: color-mix(in srgb, var(--ctp-base) 32%, transparent);
      }
      #${panelId} .bsb-prompt-card.active {
        border-color: color-mix(in srgb, var(--ctp-green) 56%, transparent);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ctp-green) 18%, transparent);
      }
      #${panelId} .bsb-prompt-card-title {
        display: flex; align-items: center; gap: 8px; margin-bottom: 9px;
      }
      #${panelId} .bsb-prompt-card-title input[type="text"] { flex: 1 1 auto; min-width: 0; font-weight: 700; }
      #${panelId} .bsb-prompt-tools { display: inline-flex; gap: 5px; flex: 0 0 auto; }
      #${panelId} .bsb-prompt-tools button {
        height: 28px; padding: 0 8px; border-radius: 8px; font-size: 10.5px;
      }
      #${panelId} .bsb-prompt-card textarea[data-prompt-field="systemPrompt"] { min-height: 250px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 11.5px; }
      #${panelId} .bsb-prompt-card textarea[data-prompt-field="userPromptTemplate"] { min-height: 190px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 11.5px; }
      #${panelId} .bsb-prompt-vars {
        margin-top: -3px; color: var(--ctp-overlay1); font-size: 10.5px; line-height: 1.5;
      }
      #${panelId} .bsb-prompt-vars code { color: var(--ctp-blue); }
      #${panelId} .bsb-prompt-profile-note {
        margin-top: -3px; color: var(--ctp-overlay1); font-size: 10.5px; line-height: 1.5;
      }
      #${panelId} .bsb-prompt-architecture {
        margin-top: 10px; padding: 9px 10px; border-radius: 10px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 45%, transparent);
        background: color-mix(in srgb, var(--ctp-mantle) 38%, transparent);
      }
      #${panelId} .bsb-prompt-architecture summary {
        cursor: pointer; color: var(--ctp-blue); font-weight: 700; font-size: 11.5px;
      }
      #${panelId} .bsb-prompt-architecture-grid {
        display: grid; gap: 7px; margin-top: 9px;
      }
      #${panelId} .bsb-prompt-architecture-grid > div {
        display: grid; grid-template-columns: minmax(112px, .34fr) 1fr; gap: 8px;
        padding: 7px 8px; border-radius: 8px;
        background: color-mix(in srgb, var(--ctp-base) 44%, transparent);
        font-size: 10.5px; line-height: 1.45;
      }
      #${panelId} .bsb-prompt-architecture-grid strong { color: var(--ctp-text); }
      #${panelId} .bsb-prompt-architecture-grid span { color: var(--ctp-subtext0); }


      /* v5.5 设置：Prompt / LLM + Master–Detail */
      #${panelId} .bsb-settings {
        overflow: hidden;
        gap: 10px;
        padding-right: 0;
      }
      #${panelId} .bsb-ai-pipeline {
        display: flex; align-items: center; gap: 6px; min-width: 0; flex-wrap: wrap;
      }
      #${panelId} .bsb-pipeline-stage {
        display: inline-flex; align-items: center; gap: 5px; min-width: 0;
        padding: 3px 6px; border: 1px solid var(--ctp-surface0); border-radius: 8px;
        background: color-mix(in srgb, var(--ctp-mantle) 84%, transparent);
      }
      #${panelId} .bsb-pipeline-stage > span { color: var(--ctp-subtext0); font-size: 10.5px; white-space: nowrap; }
      #${panelId} .bsb-pipeline-stage select { max-width: 180px; min-width: 90px; }
      #${panelId} .bsb-pipeline-toggle { display:inline-flex; align-items:center; gap:4px; font-size:10.5px; color:var(--ctp-text); white-space:nowrap; }
      #${panelId} .bsb-pipeline-arrow { color: var(--ctp-overlay1); font-weight: 800; }
      #${panelId} .bsb-config-stage-badge {
        flex: 0 0 auto; font-size: 9px; line-height: 1; padding: 4px 5px; border-radius: 5px;
        color: var(--ctp-subtext1); background: var(--ctp-surface0); text-transform: uppercase;
      }
      #${panelId} .bsb-config-stage-badge.preprocess { color: var(--ctp-green); }
      #${panelId} .bsb-config-stage-badge.postprocess { color: var(--ctp-blue); }
      #${panelId} .bsb-prompt-stage-tabs {
        display:flex; gap:4px; flex:0 0 auto; padding:6px; border:1px solid var(--ctp-surface0);
        border-radius:10px; background:color-mix(in srgb,var(--ctp-mantle) 84%,transparent);
      }
      #${panelId} .bsb-prompt-stage-tabs button {
        flex:1 1 0; border:0; border-radius:7px; padding:7px 10px; cursor:pointer;
        color:var(--ctp-subtext0); background:transparent; font-size:11px; font-weight:750;
      }
      #${panelId} .bsb-prompt-stage-tabs button.active {
        color:var(--ctp-text); background:var(--ctp-surface0); box-shadow:inset 0 0 0 1px var(--ctp-surface1);
      }
      #${panelId} .bsb-prompt-stage-tabs button[data-prompt-stage-tab="preprocess"].active { color:var(--ctp-green); }
      #${panelId} .bsb-prompt-stage-tabs button[data-prompt-stage-tab="postprocess"].active { color:var(--ctp-blue); }
      #${panelId} .bsb-prompt-stage-tabs button[data-prompt-stage-tab="knowledge"].active { color:var(--ctp-mauve); }
      #${panelId} .bsb-prompt-stage-context {
        display:flex; align-items:center; justify-content:space-between; gap:8px; padding:1px 2px 0;
        color:var(--ctp-overlay1); font-size:9.5px; line-height:1.4;
      }
      #${panelId} [data-prompt-create-stage][hidden] { display:none !important; }
      #${panelId} .bsb-preprocess-note {
        margin: 8px 0 0; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--ctp-surface0);
        color: var(--ctp-subtext0); background: var(--ctp-mantle); font-size: 10.5px; line-height: 1.55;
      }

`;
  }
  const settingsStyles = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    renderSettingsStyles
  }, Symbol.toStringTag, { value: "Module" }));
  function renderKnowledgeWorkspaceStyles(panelId) {
    return `
      /* Knowledge Workspace: Navigator | Reader only.
         严禁在此写无条件 display:flex —— 会覆盖 .bsb-view{display:none} 叠到 AI/字幕上。 */
      #${panelId} .bsb-view[data-view-panel="knowledge"] {
        min-height:0; height:100%; padding:0; gap:0; overflow:hidden;
      }
      #${panelId} .bsb-knowledge-workspace {
        flex:1 1 auto; height:100%; min-height:0; display:grid;
        grid-template-columns:minmax(0,var(--bsb-knowledge-nav-w,280px)) 5px minmax(0,1fr);
      }
      #${panelId} .bsb-knowledge-nav {
        min-width:0; min-height:0; display:flex; flex-direction:column; overflow:hidden;
        background:color-mix(in srgb,var(--ctp-mantle) 78%,var(--ctp-base)); border-right:1px solid var(--ctp-surface0);
      }
      #${panelId} .bsb-knowledge-nav-head {
        flex:0 0 auto; display:flex; flex-direction:column; gap:8px; padding:12px 12px 10px;
        border-bottom:1px solid var(--ctp-surface0);
      }
      #${panelId} .bsb-knowledge-nav-title {
        display:flex; align-items:baseline; justify-content:space-between; gap:8px;
        color:var(--ctp-overlay1); font-size:10px; font-weight:800; letter-spacing:.1em; text-transform:uppercase;
      }
      #${panelId} .bsb-knowledge-nav-title span { color:var(--ctp-subtext0); font-size:10px; font-weight:650; letter-spacing:0; text-transform:none; }
      #${panelId} .bsb-knowledge-search {
        display:flex; align-items:center; gap:7px; border:1px solid var(--ctp-surface1); border-radius:10px;
        padding:0 10px; background:var(--ctp-base);
      }
      #${panelId} .bsb-knowledge-search input { width:100%; height:32px; border:0; outline:none; background:transparent; color:var(--ctp-text); font-size:12px; }
      #${panelId} .bsb-knowledge-nav-scroll { flex:1 1 auto; min-height:0; overflow:auto; padding:8px; }
      #${panelId} .bsb-knowledge-source-group { margin-bottom:10px; }
      #${panelId} .bsb-knowledge-source-label {
        padding:4px 8px 6px; color:var(--ctp-overlay1); font-size:9px; font-weight:800;
        letter-spacing:.08em; text-transform:uppercase; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
      }
      #${panelId} .bsb-knowledge-nav-anchor { margin-bottom:2px; }
      #${panelId} .bsb-knowledge-list-item {
        width:100%; display:grid; grid-template-columns:8px minmax(0,1fr) auto; gap:7px; align-items:start;
        padding:8px; border:1px solid transparent; border-radius:10px; background:transparent; color:var(--ctp-text);
        cursor:pointer; text-align:left;
      }
      #${panelId} .bsb-knowledge-list-item:hover { background:var(--ctp-surface0); }
      #${panelId} .bsb-knowledge-list-item.active {
        border-color:color-mix(in srgb,var(--ctp-mauve) 32%,transparent);
        background:color-mix(in srgb,var(--ctp-mauve) 9%,var(--ctp-surface0));
      }
      #${panelId} .bsb-knowledge-list-dot { width:6px; height:6px; margin-top:5px; border-radius:50%; background:var(--ctp-mauve); }
      #${panelId} .bsb-knowledge-list-main { min-width:0; }
      #${panelId} .bsb-knowledge-list-main strong {
        display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
        font-size:11.5px; line-height:1.35; font-weight:720;
      }
      #${panelId} .bsb-knowledge-list-main small {
        display:block; margin-top:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        color:var(--ctp-overlay1); font-size:9px;
      }
      #${panelId} .bsb-knowledge-nav-threads {
        margin:2px 0 6px 14px; padding-left:8px; border-left:1px solid color-mix(in srgb,var(--ctp-surface1) 80%,transparent);
      }
      #${panelId} .bsb-knowledge-nav-threads .bsb-knowledge-tree-node > button {
        font-size:10px; padding:5px 6px 5px calc(6px + var(--depth) * 10px);
      }
      #${panelId} .bsb-knowledge-library-empty { padding:28px 14px; color:var(--ctp-overlay1); text-align:center; font-size:11px; line-height:1.6; }
      #${panelId} .bsb-knowledge-reader {
        min-width:0; min-height:0; display:flex; flex-direction:column; overflow:hidden; background:var(--ctp-base);
      }
      #${panelId} .bsb-knowledge-reader-head {
        flex:0 0 auto; display:flex; align-items:flex-start; justify-content:space-between; gap:10px;
        min-height:64px; max-height:84px; padding:10px 16px 8px; border-bottom:1px solid var(--ctp-surface0);
      }
      #${panelId} .bsb-knowledge-reader-head-main { min-width:0; flex:1 1 auto; }
      #${panelId} .bsb-knowledge-reader-title {
        margin:0; color:var(--ctp-text); font-size:15px; font-weight:780; line-height:1.35;
        display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
      }
      #${panelId} .bsb-knowledge-reader-meta {
        margin:4px 0 0; color:var(--ctp-overlay1); font-size:10px; line-height:1.35;
        overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
      }
      #${panelId} .bsb-knowledge-reader-actions { flex:0 0 auto; display:flex; align-items:center; gap:4px; }
      #${panelId} .bsb-knowledge-reader-actions .active {
        color:var(--ctp-yellow); border-color:color-mix(in srgb,var(--ctp-yellow) 30%,var(--ctp-surface1));
        background:color-mix(in srgb,var(--ctp-yellow) 8%,transparent);
      }
      #${panelId} .bsb-knowledge-more { position:relative; }
      #${panelId} .bsb-knowledge-more-menu {
        position:absolute; z-index:12; right:0; top:calc(100% + 4px); min-width:132px;
        border:1px solid var(--ctp-surface1); border-radius:10px; padding:4px;
        background:color-mix(in srgb,var(--ctp-base) 98%,transparent); box-shadow:0 12px 28px rgba(0,0,0,.32);
      }
      #${panelId} .bsb-knowledge-more-menu[hidden] { display:none !important; }
      #${panelId} .bsb-knowledge-more-menu button {
        width:100%; border:0; border-radius:8px; padding:8px 10px; background:transparent;
        color:var(--ctp-subtext1); cursor:pointer; text-align:left; font-size:11px;
      }
      #${panelId} .bsb-knowledge-more-menu button:hover { background:var(--ctp-surface0); color:var(--ctp-text); }
      #${panelId} .bsb-knowledge-more-menu button.danger { color:var(--ctp-red); }
      #${panelId} .bsb-knowledge-reader .bsb-knowledge-crumbs { padding:4px 16px; }
      #${panelId} .bsb-knowledge-reader-scroll {
        flex:1 1 auto; min-height:0; overflow:auto; padding:8px 0 18px;
      }
      #${panelId} .bsb-knowledge-reader-scroll-inner {
        width:min(860px, 100%); max-width:82ch; margin:0 auto; padding:4px 20px 8px; box-sizing:border-box;
      }
      #${panelId} .bsb-knowledge-reader .bsb-knowledge-composer {
        padding:10px 16px 12px;
      }
      #${panelId} .bsb-knowledge-reader .bsb-knowledge-composer-box {
        width:min(860px, 100%); max-width:82ch; margin:0 auto;
      }
      #${panelId} .bsb-knowledge-tree-pane { min-height:0; overflow:auto; padding:8px 6px 12px; display:flex; flex-direction:column; border-right:1px solid var(--ctp-surface0); }
      #${panelId} .bsb-knowledge-tree-pane .bsb-knowledge-tree { flex:1 1 auto; min-height:0; overflow:auto; }
`;
  }
  const knowledgeWorkspaceStyles = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    renderKnowledgeWorkspaceStyles
  }, Symbol.toStringTag, { value: "Module" }));
  function renderReadingStyles(panelId) {
    return `
      /* v5.8 AI Workbench：主界面展示产物，不展示执行参数 */
      #${panelId} [data-view-panel="ai"] { position: relative; overflow: hidden; }
      #${panelId} .bsb-workbench-commandbar { gap: 10px; }
      #${panelId} .bsb-workbench-context { display:flex; align-items:center; gap:6px; min-width:0; }
      #${panelId} .bsb-context-button {
        display:flex; flex-direction:column; align-items:flex-start; gap:1px; min-width:0; max-width:220px;
        padding:5px 8px; border-radius:9px; border:1px solid transparent; background:transparent;
        color:var(--ctp-text); cursor:pointer; text-align:left;
      }
      #${panelId} .bsb-context-button:hover { background:var(--ctp-surface0); border-color:var(--ctp-surface1); }
      #${panelId} .bsb-context-button strong { max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11.5px; }
      #${panelId} .bsb-context-kicker { color:var(--ctp-overlay1); font-size:8.5px; font-weight:900; letter-spacing:.08em; }
      #${panelId} .bsb-workbench-arrow { color:var(--ctp-overlay0); font-weight:900; }
      #${panelId} .bsb-ai-stage-tabs { display:flex; align-items:center; gap:6px; min-width:0; }
      #${panelId} .bsb-ai-stage-tabs > button { display:flex; align-items:center; gap:7px; min-width:118px; padding:6px 10px; border:1px solid var(--ctp-surface1); border-radius:10px; background:color-mix(in srgb,var(--ctp-base) 62%,transparent); color:var(--ctp-subtext0); cursor:pointer; text-align:left; }
      #${panelId} .bsb-ai-stage-tabs > button:hover { border-color:var(--ctp-overlay0); color:var(--ctp-text); }
      #${panelId} .bsb-ai-stage-tabs > button.active { border-color:color-mix(in srgb,var(--ctp-mauve) 62%,var(--ctp-surface1)); background:color-mix(in srgb,var(--ctp-mauve) 13%,var(--ctp-base)); color:var(--ctp-text); box-shadow:inset 0 -2px 0 var(--ctp-mauve); }
      #${panelId} .bsb-ai-stage-tabs strong { display:block; font-size:11.5px; line-height:1.2; }
      #${panelId} .bsb-ai-stage-tabs small { display:block; margin-top:2px; font-size:9px; color:var(--ctp-overlay1); white-space:nowrap; }
      #${panelId} .bsb-stage-index { width:20px; height:20px; border-radius:7px; display:grid; place-items:center; flex:0 0 auto; background:var(--ctp-surface0); color:var(--ctp-overlay1); font-size:9.5px; font-weight:850; }
      #${panelId} .bsb-ai-stage-tabs > button.active .bsb-stage-index { background:var(--ctp-mauve); color:var(--ctp-crust); }
      #${panelId} .bsb-stage-connector { color:var(--ctp-overlay0); font-size:14px; }
      #${panelId} .bsb-preprocess-nav { flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:5px 8px; border-bottom:1px solid var(--ctp-surface0); background:color-mix(in srgb,var(--ctp-mantle) 78%,transparent); }
      #${panelId} .bsb-preprocess-tabs { display:flex; gap:4px; min-width:0; }
      #${panelId} .bsb-preprocess-tabs button { display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border:0; border-radius:8px; background:transparent; color:var(--ctp-subtext0); cursor:pointer; font-size:10.5px; font-weight:750; }
      #${panelId} .bsb-preprocess-tabs button:hover { background:var(--ctp-surface0); color:var(--ctp-text); }
      #${panelId} .bsb-preprocess-tabs button.active { background:var(--ctp-surface0); color:var(--ctp-text); box-shadow:inset 0 -2px 0 var(--ctp-sapphire); }
      #${panelId} .bsb-preprocess-tabs .dot { width:7px; height:7px; border-radius:50%; background:var(--ctp-overlay0); }
      #${panelId} .bsb-preprocess-tabs .dot.raw { background:var(--ctp-blue); }
      #${panelId} .bsb-preprocess-tabs .dot.processed { background:var(--ctp-green); }
      #${panelId} .bsb-preprocess-status { color:var(--ctp-overlay1); font-size:9.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      #${panelId} .bsb-main-input-preview { margin:0; min-height:100%; white-space:pre-wrap; word-break:break-word; color:var(--ctp-text); background:transparent; border:0; padding:2px 0 24px; font:inherit; line-height:1.8; }

      /* v5.10.2 · 规范化字幕阅读卡片：让“处理后的字幕”具有明显的学习材料层级 */
      #${panelId} .bsb-preprocess-reading {
        --bsb-block-accent: var(--ctp-green);
        display:grid; gap:13px; padding:2px 0 34px;
      }
      #${panelId} .bsb-preprocess-source {
        display:flex; align-items:center; gap:9px; min-width:0;
        margin:3px 0 2px; padding:9px 11px; border-radius:11px;
        border:1px solid color-mix(in srgb,var(--ctp-teal) 22%,var(--ctp-surface0));
        background:linear-gradient(135deg,color-mix(in srgb,var(--ctp-teal) 9%,transparent),color-mix(in srgb,var(--ctp-base) 72%,transparent));
        color:var(--ctp-subtext1);
      }
      #${panelId} .bsb-preprocess-source-mark {
        width:25px; height:25px; flex:0 0 auto; display:grid; place-items:center;
        border-radius:8px; background:color-mix(in srgb,var(--ctp-teal) 16%,var(--ctp-surface0));
        color:var(--ctp-teal); font-size:11px; font-weight:900;
      }
      #${panelId} .bsb-preprocess-source-text { min-width:0; }
      #${panelId} .bsb-preprocess-source-text strong {
        display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        color:var(--ctp-text); font-size:11.5px; font-weight:820;
      }
      #${panelId} .bsb-preprocess-source-text span { display:block; margin-top:1px; color:var(--ctp-overlay1); font-size:9.5px; }
      #${panelId} .bsb-preprocess-section-title {
        display:flex; align-items:center; gap:9px; margin:9px 2px 0;
        color:var(--ctp-subtext1); font-size:11.5px; font-weight:820; letter-spacing:.015em;
      }
      #${panelId} .bsb-preprocess-section-title::before {
        content:""; width:4px; height:14px; border-radius:999px;
        background:linear-gradient(180deg,var(--ctp-green),var(--ctp-teal));
        box-shadow:0 0 14px color-mix(in srgb,var(--ctp-green) 30%,transparent);
      }
      #${panelId} .bsb-preprocess-block {
        --bsb-block-accent: var(--ctp-green);
        position:relative; overflow:hidden; padding:12px 14px 13px 16px; border-radius:13px;
        border:1px solid color-mix(in srgb,var(--bsb-block-accent) 15%,var(--ctp-surface0));
        background:
          linear-gradient(105deg,color-mix(in srgb,var(--bsb-block-accent) 5.5%,transparent),transparent 36%),
          color-mix(in srgb,var(--ctp-mantle) 62%,transparent);
        box-shadow:0 4px 16px color-mix(in srgb,var(--ctp-crust) 15%,transparent);
        transition:border-color .16s ease, background .16s ease, transform .16s ease, box-shadow .16s ease;
      }
      #${panelId} .bsb-preprocess-block::before {
        content:""; position:absolute; inset:9px auto 9px 0; width:3px; border-radius:0 999px 999px 0;
        background:var(--bsb-block-accent); opacity:.7;
      }
      #${panelId} .bsb-preprocess-block:nth-of-type(4n+1) { --bsb-block-accent:var(--ctp-green); }
      #${panelId} .bsb-preprocess-block:nth-of-type(4n+2) { --bsb-block-accent:var(--ctp-teal); }
      #${panelId} .bsb-preprocess-block:nth-of-type(4n+3) { --bsb-block-accent:var(--ctp-blue); }
      #${panelId} .bsb-preprocess-block:nth-of-type(4n+4) { --bsb-block-accent:var(--ctp-lavender); }
      #${panelId} .bsb-preprocess-block:hover {
        transform:translateY(-1px);
        border-color:color-mix(in srgb,var(--bsb-block-accent) 30%,var(--ctp-surface1));
        background:
          linear-gradient(105deg,color-mix(in srgb,var(--bsb-block-accent) 9%,transparent),transparent 42%),
          color-mix(in srgb,var(--ctp-mantle) 76%,transparent);
        box-shadow:0 8px 24px color-mix(in srgb,var(--ctp-crust) 22%,transparent);
      }
      #${panelId} .bsb-preprocess-block-head {
        display:flex; align-items:center; gap:7px; min-height:22px; margin-bottom:7px;
      }
      #${panelId} .bsb-preprocess-block-index {
        display:inline-grid; place-items:center; min-width:23px; height:20px; padding:0 5px; box-sizing:border-box;
        border-radius:7px; background:color-mix(in srgb,var(--bsb-block-accent) 13%,var(--ctp-surface0));
        color:color-mix(in srgb,var(--bsb-block-accent) 88%,white 5%); font:800 9px/1 ui-monospace,monospace;
      }
      #${panelId} .bsb-preprocess-block-topic {
        min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        color:var(--ctp-overlay1); font-size:9.5px; font-weight:650;
      }
      #${panelId} .bsb-preprocess-block-time {
        margin-left:auto; flex:0 0 auto; display:inline-flex; align-items:center; gap:5px;
      }
      #${panelId} .bsb-preprocess-block-time .bsb-time-link {
        margin:0; padding:.18em .58em; background:color-mix(in srgb,var(--bsb-block-accent) 9%,transparent);
        border-color:color-mix(in srgb,var(--bsb-block-accent) 25%,transparent); color:var(--bsb-block-accent);
      }
      #${panelId} .bsb-preprocess-time-end { color:var(--ctp-overlay1); font:650 9px/1.4 ui-monospace,monospace; }
      #${panelId} .bsb-preprocess-warning {
        display:inline-flex; align-items:center; gap:4px; flex:0 0 auto; padding:3px 6px; border-radius:999px;
        border:1px solid color-mix(in srgb,var(--ctp-peach) 28%,transparent);
        background:color-mix(in srgb,var(--ctp-peach) 8%,transparent); color:var(--ctp-peach); font-size:8.5px; font-weight:760;
      }
      #${panelId} .bsb-preprocess-block-body {
        color:color-mix(in srgb,var(--ctp-text) 94%,var(--ctp-subtext1));
        font-size:var(--bsb-note-font); line-height:1.86; letter-spacing:.018em;
        white-space:pre-wrap; overflow-wrap:anywhere; text-wrap:pretty;
      }
      /* AI 处理字幕：Markdown / 公式 / ==高亮== 富文本正文 */
      #${panelId} .bsb-preprocess-block-body.bsb-md-rich {
        white-space:normal;
      }
      #${panelId} .bsb-preprocess-block-body.bsb-md-rich > *:first-child { margin-top:0; }
      #${panelId} .bsb-preprocess-block-body.bsb-md-rich > *:last-child { margin-bottom:0; }
      #${panelId} .bsb-preprocess-block-body.bsb-md-rich p { margin:0 0 .7em; }
      #${panelId} .bsb-preprocess-block-body.bsb-md-rich ul,
      #${panelId} .bsb-preprocess-block-body.bsb-md-rich ol { margin:.35em 0 .7em; padding-left:1.25em; }
      #${panelId} .bsb-preprocess-block-body.bsb-md-rich li { margin:.2em 0; }
      #${panelId} .bsb-preprocess-block-body.bsb-md-rich strong {
        color:color-mix(in srgb,var(--ctp-rosewater) 88%,var(--ctp-text));
        font-weight:800;
      }
      #${panelId} .bsb-preprocess-block-body.bsb-md-rich code {
        font:650 .9em/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;
        padding:.08em .35em; border-radius:5px;
        background:color-mix(in srgb,var(--bsb-block-accent) 10%,var(--ctp-surface0));
      }
      #${panelId} .bsb-preprocess-block-body.bsb-md-rich pre {
        margin:.5em 0 .8em; padding:10px 12px; border-radius:10px; overflow:auto;
        background:color-mix(in srgb,var(--ctp-crust) 35%,var(--ctp-mantle));
        border:1px solid color-mix(in srgb,var(--ctp-surface1) 70%,transparent);
      }
      #${panelId} .bsb-preprocess-block-body.bsb-md-rich pre code { padding:0; background:transparent; }
      #${panelId} .bsb-preprocess-block-body.bsb-md-rich blockquote {
        margin:.5em 0 .8em; padding:.2em 0 .2em .9em;
        border-left:3px solid color-mix(in srgb,var(--bsb-block-accent) 55%,transparent);
        color:var(--ctp-subtext1);
      }
      #${panelId} .bsb-preprocess-block-body.bsb-md-rich .bsb-katex-display {
        display:block; overflow-x:auto; margin:.65em 0 .85em; padding:.35em 0; text-align:center;
      }
      #${panelId} .bsb-preprocess-block-body.bsb-md-rich .bsb-katex-inline {
        display:inline-block; max-width:100%; overflow-x:auto; vertical-align:middle;
      }
      #${panelId} .bsb-preprocess-block-body.bsb-md-rich .katex { font-size:1.05em; }
      #${panelId} .bsb-preprocess-block-body::selection {
        background:color-mix(in srgb,var(--bsb-block-accent) 28%,transparent); color:var(--ctp-text);
      }
      #${panelId}[data-panel-size="small"] .bsb-preprocess-block { padding:10px 11px 11px 13px; border-radius:11px; }
      #${panelId}[data-panel-size="small"] .bsb-preprocess-block-topic { display:none; }
      #${panelId}[data-panel-size="small"] .bsb-preprocess-block-body { font-size:calc(var(--bsb-note-font) * .92); line-height:1.78; }
      #${panelId}[data-panel-size="small"] .bsb-knowledge-card-body,
      #${panelId}[data-panel-size="small"] .bsb-studio-answer .bsb-preprocess-block-body {
        font-size:var(--bsb-knowledge-font); line-height:1.7;
      }
`;
  }
  const readingStyles = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    renderReadingStyles
  }, Symbol.toStringTag, { value: "Module" }));
  function renderFolioStyles(panelId) {
    return `
      /* ── HTML Folio：后处理阅读页（模型只产语义，壳负责版式） ── */
      #${panelId} .bsb-ai-md:has([data-role="html-folio"]) {
        padding-left: 0;
        padding-right: 0;
      }
      #${panelId} .bsb-ai-md:has([data-role="html-folio"]) .bsb-ai-content {
        max-width: none;
        width: 100%;
        margin: 0;
      }
      #${panelId} .bsb-folio-shell {
        position: relative;
        display: grid; grid-template-columns: 16.25rem minmax(0, 1fr);
        align-items: start;
        gap: 0; min-height: 0;
        background: var(--ctp-base);
      }
      #${panelId} .bsb-folio-toc {
        position: sticky; top: 0; align-self: start; z-index: 3;
        display: flex; flex-direction: column; gap: 12px;
        height: var(--folio-toc-h, 100%);
        max-height: var(--folio-toc-h, 100%);
        overflow: hidden;
        padding: 16px 10px 18px 12px;
        background: color-mix(in srgb, var(--ctp-mantle) 92%, var(--ctp-base));
        border-right: 1px solid color-mix(in srgb, var(--ctp-surface0) 88%, transparent);
        box-shadow: inset -1px 0 0 color-mix(in srgb, var(--ctp-lavender) 6%, transparent);
      }
      #${panelId} .bsb-folio-toc-head { flex: 0 0 auto; padding: 2px 6px 0 4px; }
      #${panelId} .bsb-folio-toc-kicker {
        display: block; margin: 0 0 4px;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        font-size: 10px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase;
        color: var(--ctp-lavender);
      }
      #${panelId} .bsb-folio-toc-title {
        display: block; margin: 0; font-size: 14px; font-weight: 750; letter-spacing: -.02em;
        color: var(--ctp-text);
      }
      #${panelId} .bsb-folio-toc-meta {
        display: block; margin: 5px 0 0; font-style: normal;
        font-size: 11px; color: var(--ctp-overlay1);
      }
      #${panelId} .bsb-folio-toc-progress {
        display: block; height: 3px; margin: 10px 0 0; border-radius: 99px; overflow: hidden;
        background: color-mix(in srgb, var(--ctp-surface0) 80%, transparent);
      }
      #${panelId} .bsb-folio-toc-progress > i {
        display: block; height: 100%; width: 0%; border-radius: inherit;
        background: linear-gradient(90deg, var(--ctp-lavender), var(--ctp-sapphire));
        transition: width .18s ease;
      }
      #${panelId} .bsb-folio-toc-nav {
        flex: 1 1 auto; min-height: 0; overflow-x: hidden; overflow-y: auto;
        padding: 2px 2px 8px 0; scrollbar-width: thin;
      }
      #${panelId} .bsb-folio-toc-item { position: relative; margin: 0 0 2px; }
      #${panelId} .bsb-folio-toc-row { display: flex; align-items: stretch; gap: 2px; }
      #${panelId} .bsb-folio-toc-twist {
        flex: 0 0 18px; width: 18px; margin: 2px 0; padding: 0; border: 0;
        background: transparent; color: var(--ctp-overlay0); cursor: pointer; border-radius: 6px;
      }
      #${panelId} .bsb-folio-toc-twist:hover { color: var(--ctp-text); background: var(--ctp-surface0); }
      #${panelId} .bsb-folio-toc-twist::before {
        content: ""; display: block; width: 0; height: 0; margin: 0 auto;
        border-left: 5px solid currentColor;
        border-top: 3.5px solid transparent; border-bottom: 3.5px solid transparent;
        transform: rotate(0deg); transition: transform .16s ease;
      }
      #${panelId} .bsb-folio-toc-item.is-open > .bsb-folio-toc-row .bsb-folio-toc-twist::before {
        transform: rotate(90deg);
      }
      #${panelId} .bsb-folio-toc-item:not(.has-kids) .bsb-folio-toc-twist { visibility: hidden; }
      #${panelId} .bsb-folio-toc-link {
        flex: 1 1 auto; display: flex; align-items: flex-start; gap: 8px;
        min-width: 0; margin: 0; padding: 6px 8px 6px 6px;
        border: 0; border-radius: 9px; background: transparent;
        color: var(--ctp-subtext0); text-decoration: none; text-align: left;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        font-size: 12.5px; font-weight: 650; line-height: 1.35; cursor: pointer;
      }
      #${panelId} .bsb-folio-toc-link:hover {
        color: var(--ctp-text);
        background: color-mix(in srgb, var(--ctp-surface0) 72%, transparent);
      }
      #${panelId} .bsb-folio-toc-link.is-current {
        color: var(--ctp-text);
        background: color-mix(in srgb, var(--ctp-lavender) 16%, var(--ctp-surface0));
        box-shadow: inset 2px 0 0 var(--ctp-lavender);
      }
      #${panelId} .bsb-folio-toc-index {
        flex: 0 0 1.35rem; width: 1.35rem; height: 1.35rem; margin-top: 1px;
        display: inline-flex; align-items: center; justify-content: center;
        border-radius: 6px; font-size: 9px; font-weight: 800; letter-spacing: .02em;
        color: var(--ctp-lavender);
        background: color-mix(in srgb, var(--ctp-lavender) 14%, var(--ctp-surface0));
      }
      #${panelId} .bsb-folio-toc-link.is-current .bsb-folio-toc-index {
        color: var(--ctp-base); background: var(--ctp-lavender);
      }
      #${panelId} .bsb-folio-toc-label {
        min-width: 0; overflow: hidden; display: -webkit-box;
        -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      }
      #${panelId} .bsb-folio-toc-kids {
        display: none; position: relative; margin: 1px 0 6px 27px;
        padding: 2px 0 2px 10px;
      }
      #${panelId} .bsb-folio-toc-kids::before {
        content: ""; position: absolute; left: 0; top: 4px; bottom: 4px; width: 1px;
        background: color-mix(in srgb, var(--ctp-overlay0) 28%, transparent);
      }
      #${panelId} .bsb-folio-toc-item.is-open > .bsb-folio-toc-kids { display: block; }
      #${panelId} .bsb-folio-toc-kids .bsb-folio-toc-link {
        padding: 4px 8px 4px 6px; font-size: 12px; font-weight: 500; color: var(--ctp-overlay1);
      }
      #${panelId} .bsb-folio-toc-dot {
        flex: 0 0 6px; width: 6px; height: 6px; margin: 6px 2px 0 0; border-radius: 50%;
        background: color-mix(in srgb, var(--ctp-overlay0) 55%, transparent);
      }
      #${panelId} .bsb-folio-toc-kids .bsb-folio-toc-link.is-current {
        color: var(--ctp-text);
        box-shadow: inset 2px 0 0 var(--ctp-sapphire);
        background: color-mix(in srgb, var(--ctp-sapphire) 12%, var(--ctp-surface0));
      }
      #${panelId} .bsb-folio-toc-kids .bsb-folio-toc-link.is-current .bsb-folio-toc-dot {
        background: var(--ctp-sapphire);
      }
      #${panelId} .bsb-folio-toc-fab, #${panelId} .bsb-folio-toc-scrim { display: none; }
      #${panelId} .bsb-folio h2.folio-flash, #${panelId} .bsb-folio h3.folio-flash {
        animation: bsb-folio-flash .9s ease;
      }
      @keyframes bsb-folio-flash {
        from { background: color-mix(in srgb, var(--ctp-lavender) 22%, transparent); }
        to { background: transparent; }
      }
      #${panelId} .bsb-folio-frame { min-width: 0; padding: 28px 28px 64px; }
      #${panelId} .bsb-folio {
        max-width: 40rem; margin: 0 auto;
        color: var(--ctp-text);
        font-family: "Iowan Old Style", "Palatino Linotype", Palatino, "Songti SC", "Source Han Serif SC", "Noto Serif SC", Georgia, serif;
        font-size: 14px; line-height: 1.72; letter-spacing: .005em;
      }
      #${panelId} .bsb-folio header { margin: 0 0 2.2em; }
      #${panelId} .bsb-folio .kicker {
        margin: 0 0 .7em; font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        font-size: 14px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase;
        color: var(--ctp-overlay0);
      }
      #${panelId} .bsb-folio h1 {
        margin: 0 0 .55em; font-size: 14px; font-weight: 650; line-height: 1.22;
        letter-spacing: -.02em; color: var(--ctp-text);
      }
      #${panelId} .bsb-folio .lede {
        margin: 0; font-size: 14px; line-height: 1.65; color: var(--ctp-subtext0);
      }
      #${panelId} .bsb-folio section { margin: 0 0 2.1em; }
      #${panelId} .bsb-folio h2 {
        margin: 0 0 .7em; padding-top: .2em; scroll-margin-top: 18px;
        font-size: 14px; font-weight: 650; letter-spacing: -.015em;
      }
      #${panelId} .bsb-folio h3 {
        margin: 1.2em 0 .45em; scroll-margin-top: 18px;
        font-size: 14px; font-weight: 650; color: var(--ctp-subtext1);
      }
      #${panelId} .bsb-folio p { margin: 0 0 .9em; }
      #${panelId} .bsb-folio ul, #${panelId} .bsb-folio ol { margin: 0 0 1em; padding-left: 1.25em; }
      #${panelId} .bsb-folio li { margin: .28em 0; }
      #${panelId} .bsb-folio ol.steps {
        list-style: none; padding: 0; counter-reset: folio-step;
      }
      #${panelId} .bsb-folio ol.steps li {
        position: relative; padding: .15em 0 .55em 2.1em;
        border-left: 1px solid color-mix(in srgb, var(--ctp-surface1) 70%, transparent);
        margin: 0 0 0 .45em;
      }
      #${panelId} .bsb-folio ol.steps li::before {
        counter-increment: folio-step; content: counter(folio-step);
        position: absolute; left: -.72em; top: .15em;
        width: 1.35em; height: 1.35em; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        font-size: .68em; font-weight: 750;
        color: var(--ctp-base); background: var(--ctp-lavender);
      }
      #${panelId} .bsb-folio aside.callout,
      #${panelId} .bsb-folio aside[data-kind] {
        margin: 1.1em 0 1.25em; padding: .75em 1em .75em 1.05em;
        border-left: 2px solid var(--ctp-lavender);
        background: color-mix(in srgb, var(--ctp-surface0) 42%, transparent);
        border-radius: 0 10px 10px 0;
        font-size: .96em;
      }
      #${panelId} .bsb-folio aside[data-kind="key"] { border-left-color: var(--ctp-yellow); }
      #${panelId} .bsb-folio aside[data-kind="warn"] { border-left-color: var(--ctp-peach); }
      #${panelId} .bsb-folio aside[data-kind="note"] { border-left-color: var(--ctp-sapphire); }
      #${panelId} .bsb-folio aside.callout p:last-child,
      #${panelId} .bsb-folio aside[data-kind] p:last-child { margin-bottom: 0; }
      #${panelId} .bsb-folio figure.quote, #${panelId} .bsb-folio blockquote {
        margin: 1.15em 0 1.3em; padding: 0 0 0 1em;
        border-left: 2px solid color-mix(in srgb, var(--ctp-overlay0) 45%, transparent);
        color: var(--ctp-subtext1); font-style: italic;
      }
      #${panelId} .bsb-folio .meta {
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        font-size: .78em; color: var(--ctp-overlay1); letter-spacing: .02em;
      }
      #${panelId} .bsb-folio table {
        width: 100%; border-collapse: collapse; margin: 0 0 1.2em;
        font-size: .92em; font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      }
      #${panelId} .bsb-folio th, #${panelId} .bsb-folio td {
        text-align: left; padding: .45em .55em;
        border-bottom: 1px solid color-mix(in srgb, var(--ctp-surface1) 55%, transparent);
      }
      #${panelId} .bsb-folio th { color: var(--ctp-subtext0); font-weight: 650; }
      #${panelId} .bsb-folio code, #${panelId} .bsb-folio pre {
        font-family: "JetBrains Mono", "Fira Code", ui-monospace, monospace;
      }
      #${panelId} .bsb-folio :not(pre) > code {
        font-size: .86em; padding: .08em .35em; border-radius: 5px;
        background: color-mix(in srgb, var(--ctp-surface0) 70%, transparent);
      }
      #${panelId} .bsb-folio pre {
        margin: 0 0 1.2em; padding: 12px 14px; border-radius: 10px; overflow: auto;
        background: var(--ctp-crust); font-size: .84em; line-height: 1.55;
      }
      #${panelId} .bsb-folio mark {
        background: color-mix(in srgb, var(--ctp-yellow) 38%, transparent);
        color: inherit; padding: 0 .12em; border-radius: 3px;
      }
      #${panelId} .bsb-folio hr {
        border: 0; height: 1px; margin: 1.8em 0;
        background: color-mix(in srgb, var(--ctp-surface1) 70%, transparent);
      }
      @media (max-width: 820px) {
        #${panelId} .bsb-folio-shell { grid-template-columns: 1fr; }
        #${panelId} .bsb-folio-toc {
          position: absolute; left: 0; top: 0; bottom: 0; width: min(18.5rem, 88vw);
          height: auto; max-height: none;
          transform: translateX(-104%); transition: transform .2s ease;
          box-shadow: none; border-right: 1px solid var(--ctp-surface0);
        }
        #${panelId} .bsb-folio-shell.is-toc-open .bsb-folio-toc {
          transform: none;
          box-shadow: 16px 0 40px rgba(0,0,0,.28);
        }
        #${panelId} .bsb-folio-toc-fab {
          display: inline-flex; align-items: center; gap: 6px;
          position: absolute; top: 10px; left: 10px; z-index: 4;
          height: 30px; padding: 0 10px 0 8px; border-radius: 999px;
          border: 1px solid color-mix(in srgb, var(--ctp-surface1) 70%, transparent);
          background: color-mix(in srgb, var(--ctp-mantle) 88%, transparent);
          color: var(--ctp-text); font-size: 12px; font-weight: 700; cursor: pointer;
          backdrop-filter: blur(10px);
        }
        #${panelId} .bsb-folio-toc-scrim {
          display: none; position: absolute; inset: 0; z-index: 2;
          background: color-mix(in srgb, var(--ctp-crust) 42%, transparent);
        }
        #${panelId} .bsb-folio-shell.is-toc-open .bsb-folio-toc-scrim { display: block; }
        #${panelId} .bsb-folio-frame { padding: 48px 16px 48px; }
      }

`;
  }
  const folioStyles = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    renderFolioStyles
  }, Symbol.toStringTag, { value: "Module" }));
  function renderWorkspaceOverrides(panelId) {
    return `
      /* 仅当知识页 active 时调整 Toast，避免误伤其他工作区 */
      #${panelId}[data-panel-view="knowledge"] .bsb-view[data-view-panel="knowledge"].active ~ .bsb-statusbar,
      #${panelId}[data-panel-view="knowledge"] .bsb-statusbar {
        top:10px; bottom:auto; right:12px; left:auto;
        max-width:min(360px, calc(100% - 24px));
      }
      #${panelId}[data-panel-size="small"] [data-view-panel="ai"].knowledge-open .bsb-ai-commandbar,
      #${panelId}[data-panel-size="small"] [data-view-panel="ai"].knowledge-open .bsb-preprocess-nav,
      #${panelId}[data-panel-size="small"] [data-view-panel="ai"].knowledge-open .bsb-output-nav,
      #${panelId}[data-panel-size="small"] [data-view-panel="ai"].knowledge-open .bsb-ai-canvas-wrap { margin-right:0; visibility:hidden; }
      #${panelId}[data-panel-size="small"] .bsb-knowledge-rail { width:100%; max-width:100%; --bsb-knowledge-rail-w:100%; }
      #${panelId} .bsb-knowledge-mobile-back { display:none; }
      #${panelId}[data-panel-size="medium"] .bsb-knowledge-workspace { --bsb-knowledge-nav-w:240px; grid-template-columns:minmax(0,var(--bsb-knowledge-nav-w,240px)) 5px minmax(0,1fr); }
      #${panelId}[data-panel-size="small"] .bsb-knowledge-workspace { position:relative; grid-template-columns:1fr; }
      #${panelId}[data-panel-size="small"] .bsb-knowledge-workspace > .bsb-knowledge-splitter { display:none; }
      #${panelId}[data-panel-size="small"] .bsb-knowledge-nav { border-right:0; }
      #${panelId}[data-panel-size="small"] .bsb-knowledge-reader { display:none; }
      #${panelId}[data-panel-size="small"] .bsb-knowledge-workspace.detail-open .bsb-knowledge-nav { display:none; }
      #${panelId}[data-panel-size="small"] .bsb-knowledge-workspace.detail-open .bsb-knowledge-reader {
        display:flex; position:absolute; inset:0; z-index:2; background:var(--ctp-base);
      }
      #${panelId}[data-panel-size="small"] .bsb-knowledge-mobile-back { display:inline-flex; }
      #${panelId}[data-panel-size="small"] .bsb-knowledge-rail-split.with-tree { grid-template-columns:1fr; grid-template-rows:minmax(90px,36%) 1fr; }
      #${panelId}[data-panel-size="small"] .bsb-knowledge-rail-split.with-tree .bsb-knowledge-tree-pane { border-bottom:1px solid var(--ctp-surface0); border-right:0; }
      /* 可见文字默认 14px。图标/公式除外。 */
      #${panelId} .bsb-fab,
      #${panelId} .bsb-sidebar,
      #${panelId} .bsb-dock-tab,
      #${panelId} .bsb-selection-toolbar {
        font-size: 14px;
      }
      #${panelId} .bsb-sidebar :is(h1,h2,h3,h4,h5,h6,p,li,td,th,dt,dd,button,input,textarea,select,label,span,strong,small,em,b,i,a,code,pre,summary,option,legend,blockquote,cite,figcaption):not(.bsb-empty-ico):not(.bsb-knowledge-orb),
      #${panelId} .bsb-selection-toolbar :is(button,span),
      #${panelId} .bsb-dock-tab,
      #${panelId} .bsb-folio,
      #${panelId} .bsb-folio :is(h1,h2,h3,h4,p,li,td,th,code,pre,blockquote,figcaption,.kicker,.lede),
      #${panelId} .bsb-ai-md,
      #${panelId} .bsb-ai-md :is(h1,h2,h3,h4,p,li,td,th,code,pre,blockquote),
      #${panelId} .bsb-preprocess-block-body,
      #${panelId} .bsb-knowledge-card-body,
      #${panelId} .bsb-knowledge-card-body :is(h1,h2,h3,h4,p,li),
      #${panelId}[data-panel-size="small"] .bsb-preprocess-block-body,
      #${panelId}[data-panel-size="small"] .bsb-knowledge-card-body {
        font-size: 14px !important;
      }
      #${panelId} [hidden] { display:none !important; }
      #${panelId} .bsb-output-nav { flex:0 0 auto; border-bottom:1px solid var(--ctp-surface0); background:color-mix(in srgb,var(--ctp-mantle) 78%,transparent); }
      #${panelId} .bsb-output-tabs { display:flex; gap:3px; overflow-x:auto; padding:6px 8px 3px; scrollbar-width:thin; }
      #${panelId} .bsb-output-tab {
        display:inline-flex; align-items:center; gap:6px; max-width:220px; flex:0 0 auto;
        border:0; border-radius:9px 9px 5px 5px; padding:7px 10px; background:transparent;
        color:var(--ctp-subtext0); cursor:pointer; font-size:11.5px; font-weight:750;
      }
      #${panelId} .bsb-output-tab:hover { background:var(--ctp-surface0); color:var(--ctp-text); }
      #${panelId} .bsb-output-tab.active { color:var(--ctp-text); background:var(--ctp-surface0); box-shadow:inset 0 -2px 0 var(--ctp-mauve); }
      #${panelId} .bsb-output-tab .dot { width:7px; height:7px; border-radius:50%; background:var(--ctp-overlay0); flex:0 0 auto; }
      #${panelId} .bsb-output-tab.running .dot { background:var(--ctp-green); animation:bsb-pulse 1.1s ease-in-out infinite; }
      #${panelId} .bsb-output-tab.done .dot { background:var(--ctp-teal); }
      #${panelId} .bsb-output-tab.error .dot { background:var(--ctp-red); }
      #${panelId} .bsb-output-tab.stopped .dot { background:var(--ctp-peach); }
      #${panelId} .bsb-output-tab .name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      #${panelId} .bsb-output-tab .count { color:var(--ctp-overlay1); font-size:9.5px; font-weight:700; }
      #${panelId} .bsb-model-tabs { min-height:32px; display:flex; align-items:center; gap:4px; overflow-x:auto; padding:3px 8px 6px; }
      #${panelId} .bsb-model-tab {
        display:inline-flex; align-items:center; gap:5px; flex:0 0 auto; max-width:190px;
        border:1px solid transparent; border-radius:999px; padding:4px 9px; background:transparent;
        color:var(--ctp-overlay1); cursor:pointer; font-size:10.5px;
      }
      #${panelId} .bsb-model-tab:hover { color:var(--ctp-text); background:var(--ctp-surface0); }
      #${panelId} .bsb-model-tab.active { color:var(--ctp-text); border-color:var(--ctp-surface2); background:var(--ctp-surface1); }
      #${panelId} .bsb-model-tab .dot { width:6px; height:6px; border-radius:50%; background:var(--ctp-overlay0); }
      #${panelId} .bsb-model-tab.running .dot { background:var(--ctp-green); animation:bsb-pulse 1.1s ease-in-out infinite; }
      #${panelId} .bsb-model-tab.done .dot { background:var(--ctp-teal); }
      #${panelId} .bsb-model-tab.error .dot { background:var(--ctp-red); }
      #${panelId} .bsb-model-tab.stopped .dot { background:var(--ctp-peach); }
      #${panelId} .bsb-ai-drawer-backdrop { position:absolute; inset:0; z-index:44; background:rgba(10,10,18,.34); backdrop-filter:blur(1.5px); }
      #${panelId} .bsb-ai-drawer {
        position:absolute; z-index:45; top:0; right:0; bottom:0; width:min(520px,92%); transform:translateX(102%);
        display:flex; flex-direction:column; overflow:hidden; border-left:1px solid var(--ctp-surface1);
        background:color-mix(in srgb,var(--ctp-base) 96%,transparent); box-shadow:-18px 0 42px rgba(0,0,0,.28);
        transition:transform .18s ease;
      }
      #${panelId} .bsb-ai-drawer.open { transform:translateX(0); }
      #${panelId} .bsb-ai-input-drawer { width:min(620px,94%); }
      #${panelId} .bsb-drawer-head { flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:14px 16px 11px; border-bottom:1px solid var(--ctp-surface0); }
      #${panelId} .bsb-drawer-title { min-width:0; }
      #${panelId} .bsb-drawer-title strong { display:block; font-size:14px; }
      #${panelId} .bsb-drawer-title span { display:block; margin-top:2px; color:var(--ctp-overlay1); font-size:10.5px; }
      #${panelId} .bsb-drawer-body { flex:1 1 auto; min-height:0; overflow:auto; padding:12px 14px 18px; }
      /* Flow controls — visually quiet, native semantics underneath. */
      #${panelId} .bsb-flow-section {
        padding:14px; margin-bottom:10px; border-radius:15px;
        border:1px solid color-mix(in srgb,var(--ctp-surface1) 58%,transparent);
        background:linear-gradient(180deg,color-mix(in srgb,var(--ctp-mantle) 92%,transparent),color-mix(in srgb,var(--ctp-base) 72%,transparent));
        box-shadow:0 1px 0 color-mix(in srgb,var(--ctp-text) 3%,transparent) inset;
      }
      #${panelId} .bsb-flow-section-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; }
      #${panelId} .bsb-flow-section-head > div { min-width:0; }
      #${panelId} .bsb-flow-section-head strong { display:block; font-size:12.5px; line-height:1.2; letter-spacing:.01em; }
      #${panelId} .bsb-flow-section-head span { display:block; margin-top:3px; color:var(--ctp-overlay1); font-size:10px; line-height:1.35; }
      #${panelId} .bsb-flow-grid { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:10px; }
      #${panelId} .bsb-flow-field { min-width:0; display:flex; flex-direction:column; gap:6px; }
      #${panelId} .bsb-flow-label { color:var(--ctp-subtext0); font-size:10px; font-weight:700; letter-spacing:.02em; }

      #${panelId} .bsb-flow-select {
        position:relative; min-width:0; height:38px; border-radius:11px;
        border:1px solid color-mix(in srgb,var(--ctp-surface2) 58%,transparent);
        background:color-mix(in srgb,var(--ctp-base) 66%,transparent);
        transition:border-color .14s ease,background .14s ease,box-shadow .14s ease;
      }
      #${panelId} .bsb-flow-select:hover { border-color:color-mix(in srgb,var(--ctp-overlay0) 64%,transparent); background:color-mix(in srgb,var(--ctp-base) 82%,transparent); }
      #${panelId} .bsb-flow-select:focus-within { border-color:color-mix(in srgb,var(--ctp-blue) 68%,transparent); box-shadow:0 0 0 3px color-mix(in srgb,var(--ctp-blue) 13%,transparent); }
      #${panelId} .bsb-flow-select select {
        appearance:none; -webkit-appearance:none; width:100%; height:100%; min-width:0; border:0!important; outline:0!important;
        padding:0 34px 0 11px!important; border-radius:inherit; background:transparent!important; box-shadow:none!important;
        color:var(--ctp-text); font:inherit; font-size:11.5px; font-weight:650; cursor:pointer;
      }
      #${panelId} .bsb-flow-select select:disabled { cursor:not-allowed; color:var(--ctp-overlay0); }
      #${panelId} .bsb-flow-select:has(select:disabled) { opacity:.46; }
      #${panelId} .bsb-flow-select-icon {
        pointer-events:none; position:absolute; right:11px; top:50%; transform:translateY(-54%);
        color:var(--ctp-overlay1); font-size:15px; font-weight:800; line-height:1;
      }

      #${panelId} .bsb-flow-stepper {
        height:38px; display:grid; grid-template-columns:34px minmax(0,1fr) 34px; align-items:stretch;
        overflow:hidden; border-radius:11px; border:1px solid color-mix(in srgb,var(--ctp-surface2) 58%,transparent);
        background:color-mix(in srgb,var(--ctp-base) 66%,transparent);
        transition:border-color .14s ease,box-shadow .14s ease;
      }
      #${panelId} .bsb-flow-stepper:focus-within { border-color:color-mix(in srgb,var(--ctp-blue) 68%,transparent); box-shadow:0 0 0 3px color-mix(in srgb,var(--ctp-blue) 13%,transparent); }
      #${panelId} .bsb-flow-stepper.disabled { opacity:.46; }
      #${panelId} .bsb-flow-stepper > button {
        width:34px; border:0; background:transparent; color:var(--ctp-subtext0); cursor:pointer;
        font:700 17px/1 ui-sans-serif,system-ui,sans-serif; transition:background .12s ease,color .12s ease;
      }
      #${panelId} .bsb-flow-stepper > button:first-child { border-right:1px solid color-mix(in srgb,var(--ctp-surface1) 70%,transparent); }
      #${panelId} .bsb-flow-stepper > button:last-child { border-left:1px solid color-mix(in srgb,var(--ctp-surface1) 70%,transparent); }
      #${panelId} .bsb-flow-stepper > button:hover:not(:disabled) { background:var(--ctp-surface0); color:var(--ctp-text); }
      #${panelId} .bsb-flow-stepper > button:active:not(:disabled) { background:var(--ctp-surface1); }
      #${panelId} .bsb-flow-stepper > button:disabled { cursor:not-allowed; }
      #${panelId} .bsb-flow-stepper-value { min-width:0; display:flex; align-items:center; justify-content:center; gap:5px; padding:0 5px; }
      #${panelId} .bsb-flow-stepper input[type="number"] {
        width:100%; min-width:0; height:100%; padding:0; border:0!important; outline:0!important; background:transparent!important; box-shadow:none!important;
        color:var(--ctp-text); text-align:center; font:750 11.5px/1 ui-sans-serif,system-ui,sans-serif; appearance:textfield; -moz-appearance:textfield;
      }
      #${panelId} .bsb-flow-stepper input[type="number"]::-webkit-inner-spin-button,
      #${panelId} .bsb-flow-stepper input[type="number"]::-webkit-outer-spin-button { -webkit-appearance:none; margin:0; }
      #${panelId} .bsb-flow-stepper-unit { flex:0 0 auto; color:var(--ctp-overlay1); font-size:9.5px; font-weight:650; white-space:nowrap; }

      #${panelId} .bsb-flow-switch { display:inline-flex; align-items:center; gap:7px; cursor:pointer; user-select:none; }
      #${panelId} .bsb-flow-switch input { position:absolute; opacity:0; pointer-events:none; }
      #${panelId} .bsb-flow-switch-track {
        width:34px; height:20px; padding:2px; box-sizing:border-box; border-radius:999px;
        background:var(--ctp-surface1); border:1px solid color-mix(in srgb,var(--ctp-surface2) 70%,transparent);
        transition:background .16s ease,border-color .16s ease,box-shadow .16s ease;
      }
      #${panelId} .bsb-flow-switch-track::after {
        content:""; display:block; width:14px; height:14px; border-radius:50%; background:var(--ctp-subtext0);
        box-shadow:0 1px 3px rgba(0,0,0,.28); transition:transform .16s ease,background .16s ease;
      }
      #${panelId} .bsb-flow-switch input:checked + .bsb-flow-switch-track { background:color-mix(in srgb,var(--ctp-green) 72%,var(--ctp-surface1)); border-color:color-mix(in srgb,var(--ctp-green) 72%,transparent); }
      #${panelId} .bsb-flow-switch input:checked + .bsb-flow-switch-track::after { transform:translateX(14px); background:var(--ctp-base); }
      #${panelId} .bsb-flow-switch input:focus-visible + .bsb-flow-switch-track { box-shadow:0 0 0 3px color-mix(in srgb,var(--ctp-green) 16%,transparent); }
      #${panelId} .bsb-flow-switch-text { color:var(--ctp-subtext0); font-size:10px; font-weight:750; }

      #${panelId} .bsb-flow-advanced { margin-top:11px; padding-top:9px; border-top:1px solid color-mix(in srgb,var(--ctp-surface1) 70%,transparent); }
      #${panelId} .bsb-flow-advanced > summary {
        list-style:none; display:flex; align-items:center; gap:7px; cursor:pointer; color:var(--ctp-subtext0);
        font-size:10.5px; font-weight:700; user-select:none; outline:none;
      }
      #${panelId} .bsb-flow-advanced > summary::-webkit-details-marker { display:none; }
      #${panelId} .bsb-flow-advanced > summary::before { content:"›"; color:var(--ctp-overlay1); font-size:16px; line-height:1; transition:transform .14s ease; }
      #${panelId} .bsb-flow-advanced[open] > summary::before { transform:rotate(90deg); }
      #${panelId} .bsb-flow-advanced .bsb-flow-grid { margin-top:10px; }

      #${panelId} .bsb-output-task-card {
        padding:11px; margin-top:8px; border-radius:13px; border:1px solid color-mix(in srgb,var(--ctp-surface1) 64%,transparent);
        background:color-mix(in srgb,var(--ctp-base) 52%,transparent);
      }
      #${panelId} .bsb-output-task-head { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
      #${panelId} .bsb-output-task-index { width:24px; height:24px; display:grid; place-items:center; flex:0 0 auto; border-radius:8px; background:var(--ctp-surface0); color:var(--ctp-overlay1); font-size:9.5px; font-weight:850; }
      #${panelId} .bsb-output-task-name { flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11.5px; font-weight:800; }
      #${panelId} .bsb-model-picks { display:flex; flex-wrap:wrap; gap:6px; margin-top:7px; }
      #${panelId} .bsb-model-order { display:grid; gap:8px; margin-top:7px; }
      #${panelId} .bsb-model-rank-list { display:flex; flex-direction:column; gap:5px; }
      #${panelId} .bsb-model-rank {
        display:grid; grid-template-columns:14px 28px minmax(0,1fr) 22px; align-items:center; gap:6px;
        min-height:32px; padding:0 6px 0 8px; user-select:none;
        border:1px solid color-mix(in srgb,var(--ctp-blue) 32%,var(--ctp-surface1));
        border-radius:10px; background:color-mix(in srgb,var(--ctp-blue) 10%,var(--ctp-base));
        color:var(--ctp-text);
      }
      #${panelId} .bsb-model-rank[draggable="true"] { cursor:grab; }
      #${panelId} .bsb-model-rank.dragging { opacity:.45; cursor:grabbing; }
      #${panelId} .bsb-model-rank.drag-over {
        border-color:color-mix(in srgb,var(--ctp-sapphire) 55%,transparent);
        box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ctp-sapphire) 30%,transparent);
      }
      #${panelId} .bsb-model-rank-handle { color:var(--ctp-overlay0); font-size:12px; letter-spacing:-1px; }
      #${panelId} .bsb-model-rank-n {
        width:22px; height:18px; display:grid; place-items:center; border-radius:6px;
        background:var(--ctp-lavender); color:var(--ctp-crust); font-size:9px; font-weight:850;
      }
      #${panelId} .bsb-model-rank-name { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px; font-weight:700; }
      #${panelId} .bsb-model-rank-remove {
        width:22px; height:22px; border:0; border-radius:7px; background:transparent;
        color:var(--ctp-overlay1); cursor:pointer; font-size:14px; line-height:1;
      }
      #${panelId} .bsb-model-rank-remove:hover { color:var(--ctp-red); background:color-mix(in srgb,var(--ctp-red) 12%,transparent); }
      #${panelId} .bsb-model-add-list { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
      #${panelId} .bsb-model-add {
        min-height:28px; padding:0 9px; border-radius:999px; cursor:pointer; font-size:10.5px; font-weight:650;
        border:1px dashed color-mix(in srgb,var(--ctp-overlay0) 45%,transparent);
        background:transparent; color:var(--ctp-subtext0);
      }
      #${panelId} .bsb-model-add:hover { color:var(--ctp-text); border-color:var(--ctp-lavender); background:color-mix(in srgb,var(--ctp-lavender) 10%,transparent); }
      #${panelId} .bsb-model-pick {
        position:relative; display:inline-flex; align-items:center; gap:6px; min-height:30px; padding:0 9px;
        border:1px solid color-mix(in srgb,var(--ctp-surface1) 75%,transparent); border-radius:999px;
        background:color-mix(in srgb,var(--ctp-base) 42%,transparent); color:var(--ctp-subtext0); font-size:10px; font-weight:650; cursor:pointer;
        transition:background .12s ease,border-color .12s ease,color .12s ease;
      }
      #${panelId} .bsb-model-pick:hover { border-color:var(--ctp-surface2); color:var(--ctp-text); }
      #${panelId} .bsb-model-pick::before { content:""; width:12px; height:12px; display:grid; place-items:center; border:1px solid var(--ctp-overlay0); border-radius:4px; box-sizing:border-box; font-size:8px; font-weight:900; }
      #${panelId} .bsb-model-pick:has(input:checked) { color:var(--ctp-text); border-color:color-mix(in srgb,var(--ctp-blue) 56%,var(--ctp-surface1)); background:color-mix(in srgb,var(--ctp-blue) 12%,transparent); }
      #${panelId} .bsb-model-pick:has(input:checked)::before { content:"✓"; color:var(--ctp-base); border-color:var(--ctp-blue); background:var(--ctp-blue); }
      #${panelId} .bsb-model-pick input { position:absolute; opacity:0; pointer-events:none; }
      #${panelId} .bsb-input-tabs { display:inline-flex; gap:3px; padding:3px; border:1px solid var(--ctp-surface0); border-radius:9px; background:var(--ctp-mantle); }
      #${panelId} .bsb-input-tabs button { border:0; border-radius:7px; padding:5px 9px; background:transparent; color:var(--ctp-overlay1); cursor:pointer; font-size:10.5px; }
      #${panelId} .bsb-input-tabs button.active { background:var(--ctp-surface1); color:var(--ctp-text); }
      #${panelId} .bsb-input-preview { margin:10px 0 0; white-space:pre-wrap; word-break:break-word; font:11px/1.65 ui-monospace,SFMono-Regular,Consolas,monospace; color:var(--ctp-subtext1); }
      #${panelId} .bsb-input-empty { padding:28px 12px; text-align:center; color:var(--ctp-overlay1); font-size:11px; line-height:1.6; }
      #${panelId} .bsb-settings-tabs {
        flex: 0 0 auto;
        display: inline-flex; align-self: flex-start; gap: 4px;
        padding: 4px; border-radius: 12px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 52%, transparent);
        background: color-mix(in srgb, var(--ctp-mantle) 58%, transparent);
      }
      #${panelId} .bsb-settings-tabs button {
        min-width: 92px; height: 32px; padding: 0 16px;
        border-radius: 9px; border: 0; background: transparent;
        color: var(--ctp-subtext0); font-weight: 800; font-size: 12px; cursor: pointer;
      }
      #${panelId} .bsb-settings-tabs button.active {
        color: var(--ctp-text);
        background: color-mix(in srgb, var(--ctp-surface1) 72%, transparent);
        box-shadow: 0 1px 7px color-mix(in srgb, var(--ctp-crust) 35%, transparent);
      }
      #${panelId} .bsb-settings-pane { display: none; flex: 1 1 auto; min-height: 0; }
      #${panelId} .bsb-settings-pane.active { display: block; }
      #${panelId} .bsb-config-master-detail {
        height: 100%; min-height: 0;
        display: grid; grid-template-columns: minmax(190px, 230px) minmax(0, 1fr); gap: 10px;
      }
      #${panelId} .bsb-config-sidebar,
      #${panelId} .bsb-config-editor-shell {
        min-height: 0; border-radius: 14px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 48%, transparent);
        background: color-mix(in srgb, var(--ctp-mantle) 43%, transparent);
      }
      #${panelId} .bsb-config-sidebar {
        display: flex; flex-direction: column; overflow: hidden;
      }
      #${panelId} .bsb-config-sidebar-head { padding: 10px; display: grid; gap: 8px; }
      #${panelId} .bsb-config-search {
        display: flex; align-items: center; gap: 7px; padding: 0 9px; height: 34px;
        border-radius: 9px; border: 1px solid color-mix(in srgb, var(--ctp-surface2) 52%, transparent);
        background: color-mix(in srgb, var(--ctp-base) 55%, transparent); color: var(--ctp-overlay1);
      }
      #${panelId} .bsb-config-search input {
        width: 100%; min-width: 0; border: 0; outline: 0; padding: 0; background: transparent;
        color: var(--ctp-text); font: inherit; font-size: 12px;
      }
      #${panelId} .bsb-config-create { width: 100%; justify-content: center; }
      #${panelId} .bsb-config-list {
        flex: 1 1 auto; min-height: 0; overflow: auto; padding: 2px 7px 8px;
        display: flex; flex-direction: column; gap: 4px;
      }
      #${panelId} .bsb-config-list-item {
        width: 100%; text-align: left; border: 1px solid transparent; cursor: pointer;
        padding: 9px 8px; border-radius: 10px; background: transparent; color: var(--ctp-text);
        display: grid; grid-template-columns: 14px 10px minmax(0, 1fr) auto; column-gap: 6px; row-gap: 2px;
        align-items: start; user-select: none;
      }
      #${panelId} .bsb-config-list-item:hover { background: color-mix(in srgb, var(--ctp-surface0) 55%, transparent); }
      #${panelId} .bsb-config-list-item.selected {
        border-color: color-mix(in srgb, var(--ctp-blue) 38%, transparent);
        background: color-mix(in srgb, var(--ctp-blue) 12%, var(--ctp-surface0));
      }
      #${panelId} .bsb-config-list-item[draggable="true"] { cursor: grab; }
      #${panelId} .bsb-config-list-item.dragging {
        opacity: 0.45; cursor: grabbing;
        border-color: color-mix(in srgb, var(--ctp-blue) 45%, transparent);
      }
      #${panelId} .bsb-config-list-item.drag-over {
        border-color: color-mix(in srgb, var(--ctp-sapphire) 55%, transparent);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ctp-sapphire) 35%, transparent);
        background: color-mix(in srgb, var(--ctp-sapphire) 10%, var(--ctp-surface0));
      }
      #${panelId} .bsb-config-list[data-reorder-locked="1"] .bsb-config-list-item { cursor: pointer; }
      #${panelId} .bsb-config-list[data-reorder-locked="1"] .bsb-config-drag { opacity: 0.28; cursor: default; }
      #${panelId} .bsb-config-drag {
        display: inline-flex; align-items: center; justify-content: center;
        margin-top: 2px; width: 14px; height: 16px; line-height: 1;
        color: var(--ctp-overlay0); font-size: 12px; letter-spacing: -1px;
        cursor: grab; touch-action: none;
      }
      #${panelId} .bsb-config-list-item.dragging .bsb-config-drag { cursor: grabbing; }
      #${panelId} .bsb-config-dot {
        width: 7px; height: 7px; margin-top: 5px; border-radius: 50%;
        background: var(--ctp-overlay0); box-shadow: 0 0 0 2px color-mix(in srgb, var(--ctp-overlay0) 18%, transparent);
      }
      #${panelId} .bsb-config-dot.current,
      #${panelId} .bsb-config-dot.enabled { background: var(--ctp-green); box-shadow: 0 0 0 2px color-mix(in srgb, var(--ctp-green) 18%, transparent); }
      #${panelId} .bsb-config-item-main { min-width: 0; }
      #${panelId} .bsb-config-item-name { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11.5px; font-weight:750; }
      #${panelId} .bsb-config-item-sub { display:block; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--ctp-overlay1); font-size:10px; }
      #${panelId} .bsb-config-badge {
        align-self: start; padding: 2px 5px; border-radius: 999px; font-size: 9px; line-height: 1.3;
        color: var(--ctp-green); background: color-mix(in srgb, var(--ctp-green) 12%, transparent);
      }
      #${panelId} .bsb-config-sidebar-foot {
        flex: 0 0 auto; padding: 8px; border-top: 1px solid color-mix(in srgb, var(--ctp-surface0) 58%, transparent);
      }
      #${panelId} .bsb-config-sidebar-foot button { width: 100%; }
      #${panelId} .bsb-config-editor-shell { overflow: auto; padding: 12px 14px; }
      #${panelId} .bsb-config-editor-empty {
        height: 100%; min-height: 260px; display:flex; align-items:center; justify-content:center; text-align:center;
        color: var(--ctp-overlay1); font-size:12px; line-height:1.6;
      }
      #${panelId} .bsb-config-editor-head {
        display:flex; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom:12px;
      }
      #${panelId} .bsb-config-editor-title { min-width:0; }
      #${panelId} .bsb-config-editor-title strong { display:block; font-size:14px; color:var(--ctp-text); }
      #${panelId} .bsb-config-editor-title span { display:block; margin-top:3px; font-size:10.5px; color:var(--ctp-overlay1); line-height:1.45; }
      #${panelId} .bsb-config-editor-actions { display:flex; gap:5px; flex-wrap:wrap; justify-content:flex-end; }
      #${panelId} .bsb-config-editor-actions button { height:28px; padding:0 8px; font-size:10.5px; border-radius:8px; }
      #${panelId} .bsb-config-editor-shell textarea[data-prompt-field="systemPrompt"] { min-height: 300px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 11.5px; }
      #${panelId} .bsb-config-editor-shell textarea[data-prompt-field="userPromptTemplate"] { min-height: 220px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 11.5px; }
      #${panelId} .bsb-config-list-empty { padding:16px 8px; color:var(--ctp-overlay1); font-size:11px; text-align:center; line-height:1.5; }
      @media (max-width: 720px) {
        #${panelId} .bsb-config-master-detail { grid-template-columns: minmax(150px, 185px) minmax(0, 1fr); }
      }

      /* 底栏状态 */
      #${panelId} .bsb-statusbar {
        flex-shrink: 0;
        display: flex; align-items: center; gap: 8px;
        padding: 8px 14px 10px;
        border-top: 1px solid color-mix(in srgb, var(--ctp-surface0) 75%, transparent);
        background: color-mix(in srgb, var(--ctp-mantle) 50%, transparent);
        font-size: 11.5px; color: var(--ctp-subtext0);
        min-height: 36px;
      }
      #${panelId} .bsb-status-dot {
        width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
        background: var(--ctp-overlay0);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--ctp-overlay0) 20%, transparent);
      }
      #${panelId} .bsb-status-dot.ok {
        background: var(--ctp-green);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--ctp-green) 22%, transparent);
      }
      #${panelId} .bsb-status-dot.err {
        background: var(--ctp-red);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--ctp-red) 22%, transparent);
      }
      #${panelId} .bsb-status-dot.busy {
        background: var(--ctp-yellow);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--ctp-yellow) 22%, transparent);
        animation: bsb-pulse 1.2s ease-in-out infinite;
      }
      @keyframes bsb-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.45; }
      }
      #${panelId} .bsb-status {
        flex: 1; min-width: 0; word-break: break-word; line-height: 1.35;
      }
      #${panelId} .bsb-status.ok { color: var(--ctp-green); }
      #${panelId} .bsb-status.err { color: var(--ctp-red); }

      /* 滚动条 */
      #${panelId} .bsb-list::-webkit-scrollbar,
      #${panelId} .bsb-ai-md::-webkit-scrollbar,
      #${panelId} .bsb-settings::-webkit-scrollbar { width: 8px; height: 8px; }
      #${panelId} .bsb-list::-webkit-scrollbar-thumb,
      #${panelId} .bsb-ai-md::-webkit-scrollbar-thumb,
      #${panelId} .bsb-settings::-webkit-scrollbar-thumb {
        background: color-mix(in srgb, var(--ctp-surface2) 65%, transparent);
        border-radius: 8px;
      }
      #${panelId} .bsb-list::-webkit-scrollbar-thumb:hover,
      #${panelId} .bsb-ai-md::-webkit-scrollbar-thumb:hover {
        background: var(--ctp-overlay0);
      }

`;
  }
  const workspaceOverridesStyles = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    renderWorkspaceOverrides
  }, Symbol.toStringTag, { value: "Module" }));
  function renderLateStudioStyles(panelId) {
    return `
      /* ── v5.2 阅读优先布局：默认紧凑，专注模式铺满视口 ── */
      #${panelId} .bsb-view[data-view-panel="ai"] {
        gap: 6px;
        padding: 7px 8px 8px;
      }
      #${panelId} .bsb-ai-commandbar {
        min-height: 36px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        flex: 0 0 auto;
      }
      #${panelId} .bsb-ai-command-main {
        min-width: 0;
        flex: 1 1 auto;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      #${panelId} .bsb-ai-mode-compact {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        flex: 0 0 auto;
        color: var(--ctp-subtext0);
        font-size: 10.5px;
        font-weight: 650;
      }
      #${panelId} .bsb-ai-mode-compact select {
        width: auto;
        max-width: 150px;
        height: 30px;
        padding: 0 25px 0 8px;
        border-radius: 9px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 55%, transparent);
        background: var(--ctp-mantle);
        color: var(--ctp-text);
        outline: none;
        font-size: 11px;
      }
      #${panelId} .bsb-ai-compact-stats {
        flex-wrap: nowrap;
        overflow: hidden;
        gap: 4px;
      }
      #${panelId} .bsb-ai-compact-stats .bsb-chip {
        height: 24px;
        padding: 0 7px;
        font-size: 10px;
        white-space: nowrap;
      }
      #${panelId} .bsb-mode-hint { display: none; }
      #${panelId} .bsb-ai-command-actions {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        flex: 0 0 auto;
      }
      #${panelId} .bsb-ai-command-actions .bsb-btn {
        height: 30px;
        padding: 0 10px;
        border-radius: 9px;
        font-size: 11px;
      }
      #${panelId} .bsb-ai-command-actions .bsb-btn.accent {
        height: 32px;
        padding-inline: 12px;
      }
      #${panelId} .bsb-ai-result-tabs {
        padding: 0 0 2px;
        gap: 5px;
      }
      #${panelId} .bsb-ai-result-tab {
        height: 30px;
        min-width: 96px;
        border-radius: 9px;
      }
      #${panelId} .bsb-ai-canvas-wrap {
        min-height: 320px;
        border-radius: 12px;
      }
      #${panelId} .bsb-ai-md {
        padding: 24px clamp(16px, 4vw, 44px) 72px;
      }
      #${panelId} .bsb-ai-content {
        width: 100%;
        max-width: 56em;
      }
      #${panelId}:not(.ai-focus) .bsb-focus-stop { display: none !important; }
      #${panelId} .bsb-focus-stop {
        color: var(--ctp-red) !important;
        border-color: color-mix(in srgb, var(--ctp-red) 42%, transparent) !important;
      }
      #${panelId} .focus-exit { display: none; }

      #${panelId}.ai-focus .bsb-sidebar {
        display: flex !important;
        left: 6px !important;
        top: 6px !important;
        right: auto !important;
        bottom: auto !important;
        width: calc(100vw - 12px) !important;
        height: calc(100dvh - 12px) !important;
        min-width: 0 !important;
        min-height: 0 !important;
        border-radius: 12px !important;
      }
      #${panelId}.ai-focus .bsb-head,
      #${panelId}.ai-focus .bsb-nav,
      #${panelId}.ai-focus .bsb-ai-commandbar,
      #${panelId}.ai-focus .bsb-dock-tab,
      #${panelId}.ai-focus .bsb-resize {
        display: none !important;
      }
      #${panelId}.ai-focus .bsb-view { display: none !important; }
      #${panelId}.ai-focus .bsb-view[data-view-panel="ai"] {
        display: flex !important;
        gap: 5px;
        padding: 6px;
      }
      #${panelId}.ai-focus .bsb-ai-result-tabs {
        flex: 0 0 31px;
        min-height: 31px;
        padding: 0;
      }
      #${panelId}.ai-focus .bsb-output-nav { flex:0 0 auto; border-radius:8px; overflow:hidden; }
      #${panelId}.ai-focus .bsb-output-tabs { padding-top:3px; }
      #${panelId}.ai-focus .bsb-ai-canvas-wrap {
        min-height: 0;
        border-radius: 9px;
      }
      #${panelId}.ai-focus .bsb-ai-md {
        padding-top: 28px;
        padding-bottom: 76px;
      }
      #${panelId}.ai-focus .focus-enter { display: none; }
      #${panelId}.ai-focus .focus-exit { display: inline; }
      #${panelId}.ai-focus .bsb-focus-toggle {
        color: var(--ctp-lavender);
        border-color: color-mix(in srgb, var(--ctp-lavender) 42%, transparent);
      }

      @media (max-width: 700px) {
        #${panelId} .bsb-ai-compact-stats .bsb-chip:not([data-role="chip-model"]) { display: none; }
      }
      @media (max-width: 520px) {
        #${panelId} .bsb-ai-mode-compact > span,
        #${panelId} .bsb-ai-compact-stats { display: none; }
        #${panelId} .bsb-ai-command-actions .bsb-btn { padding-inline: 8px; }
        #${panelId} .bsb-ai-md { padding-inline: 15px; }
      }

      /* ── v5.10 Studio Shell ──────────────────────────────────────────────
         Design goal: navigation is spatial (left rail), actions are contextual,
         and the reading canvas owns the visual hierarchy. Historical rules
         above are intentionally overridden here so the runtime logic stays
         stable while the product shell changes substantially. */
      #${panelId} {
        --studio-bg: #111319;
        --studio-panel: #171a21;
        --studio-raised: #1d212a;
        --studio-hover: #242936;
        --studio-line: rgba(255,255,255,.075);
        --studio-line-strong: rgba(255,255,255,.115);
        --studio-text: #eef0f6;
        --studio-muted: #9299a8;
        --studio-faint: #666d7b;
        --studio-accent: #a99df7;
        --studio-accent-soft: rgba(169,157,247,.13);
        --studio-success: #75c995;
        --studio-danger: #ef8299;
      }
      #${panelId} .bsb-sidebar {
        display: none;
        grid-template-columns: 64px minmax(0, 1fr);
        grid-template-rows: 54px minmax(0, 1fr);
        flex-direction: initial;
        border-radius: 16px;
        border: 1px solid var(--studio-line-strong);
        background: color-mix(in srgb, var(--studio-bg) 96%, transparent);
        backdrop-filter: blur(24px) saturate(1.15);
        -webkit-backdrop-filter: blur(24px) saturate(1.15);
        box-shadow: 0 26px 80px rgba(0,0,0,.48), 0 1px 0 rgba(255,255,255,.04) inset;
      }
      #${panelId}.open:not(.docked) .bsb-sidebar,
      #${panelId}.docked.dock-expanded .bsb-sidebar { display: grid; }

      #${panelId} .bsb-head {
        grid-column: 1 / -1;
        grid-row: 1;
        min-width: 0;
        padding: 8px 10px 8px 12px;
        border-bottom: 1px solid var(--studio-line);
        background: rgba(17,19,25,.88);
      }
      #${panelId} .bsb-head-title { flex-wrap: nowrap !important; gap: 9px !important; }
      #${panelId} .bsb-logo {
        width: 30px; height: 30px; border-radius: 9px;
        color: #111319;
        background: #d8d2ff;
        box-shadow: none;
        font-size: 13px;
      }
      #${panelId} .bsb-brand-stack { display:flex; min-width:0; align-items:baseline; gap:8px; }
      #${panelId} .bsb-head strong { font-size: 13px; font-weight: 720; letter-spacing: -.01em; }
      #${panelId} .bsb-head-context {
        color: var(--studio-muted); font-size: 11px; font-weight: 560;
        overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
      }
      #${panelId} .bsb-ver {
        border:0 !important; padding:0 !important; background:transparent !important;
        color:var(--studio-faint) !important; font-size:9.5px !important;
      }
      #${panelId} .bsb-size-switch {
        height: 28px; padding: 2px; border-radius: 8px;
        border-color: var(--studio-line); background: #14171e;
      }
      #${panelId} .bsb-size-switch button {
        width: 23px; height:22px; border-radius:6px; color:var(--studio-faint); font-size:9px;
      }
      #${panelId} .bsb-size-switch button.active {
        color: var(--studio-text); background: var(--studio-hover); box-shadow:none;
      }
      #${panelId} .bsb-icon-btn {
        width: 28px; height:28px; border-radius:8px;
        border:1px solid transparent; background:transparent; color:var(--studio-muted);
      }
      #${panelId} .bsb-icon-btn:hover {
        color:var(--studio-text); border-color:var(--studio-line); background:var(--studio-hover);
      }

      #${panelId} .bsb-nav {
        grid-column: 1;
        grid-row: 2;
        min-width: 0;
        padding: 10px 7px 9px;
        border: 0;
        border-right: 1px solid var(--studio-line);
        background: #12151b;
        display:flex;
        flex-direction:column;
        justify-content:space-between;
        gap:10px;
      }
      #${panelId} .bsb-nav-primary,
      #${panelId} .bsb-nav-secondary { display:flex; flex-direction:column; gap:5px; }
      #${panelId} .bsb-nav button {
        flex:0 0 auto;
        width:50px; height:48px;
        padding:5px 3px 4px;
        border-radius:10px;
        display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px;
        color:var(--studio-muted); background:transparent; box-shadow:none;
      }
      #${panelId} .bsb-nav button:hover { color:var(--studio-text); background:var(--studio-hover); }
      #${panelId} .bsb-nav button.active {
        color:var(--studio-text);
        background:var(--studio-accent-soft);
        box-shadow: inset 2px 0 0 var(--studio-accent);
      }
      #${panelId} .bsb-nav-icon { font-size:17px; line-height:18px; font-weight:550; }
      #${panelId} .bsb-nav-label { font-size:9.5px; line-height:12px; font-weight:650; }

      #${panelId} .bsb-body {
        grid-column: 2;
        grid-row: 2;
        min-width:0; min-height:0;
        background:var(--studio-panel);
      }
      #${panelId} .bsb-view { padding:12px; gap:8px; }
      #${panelId} .bsb-view[data-view-panel="ai"] { padding:10px 12px 12px; gap:7px; }

      /* Contextual AI toolbar: phase first, controls second. */
      #${panelId} .bsb-ai-commandbar {
        min-height:42px;
        padding:0;
        border:0;
        background:transparent;
      }
      #${panelId} .bsb-ai-command-main { gap:10px; }
      #${panelId} .bsb-ai-stage-tabs {
        height:34px; padding:3px; gap:2px;
        border:1px solid var(--studio-line); border-radius:10px;
        background:#13161d;
      }
      #${panelId} .bsb-ai-stage-tabs .bsb-stage-connector { display:none; }
      #${panelId} .bsb-ai-stage-tabs button {
        min-width:105px; height:26px; padding:0 10px;
        border-radius:7px; border:0; background:transparent;
        display:flex; align-items:center; gap:6px; color:var(--studio-muted);
      }
      #${panelId} .bsb-ai-stage-tabs button.active {
        color:var(--studio-text); background:var(--studio-hover); box-shadow:none;
      }
      #${panelId} .bsb-ai-stage-tabs button small,
      #${panelId} .bsb-ai-stage-tabs .bsb-stage-index { display:none; }
      #${panelId} .bsb-ai-stage-tabs button strong { font-size:11.5px; font-weight:680; }
      #${panelId} .bsb-ai-compact-stats { opacity:.76; }
      #${panelId} .bsb-chip {
        border-color:var(--studio-line) !important; background:transparent !important;
        color:var(--studio-muted) !important; box-shadow:none !important;
      }
      #${panelId} .bsb-ai-command-actions .bsb-btn {
        height:31px; border-radius:9px; border-color:var(--studio-line);
        background:transparent; color:var(--studio-muted);
      }
      #${panelId} .bsb-ai-command-actions .bsb-btn:hover { color:var(--studio-text); background:var(--studio-hover); }
      #${panelId} .bsb-ai-command-actions .bsb-btn.accent {
        color:#111319; background:#d8d2ff; border-color:#d8d2ff; font-weight:720; box-shadow:none;
      }
      #${panelId} .bsb-ai-command-actions .bsb-btn.accent:hover { background:#e3dfff; }

      #${panelId} .bsb-preprocess-nav,
      #${panelId} .bsb-output-nav {
        border:1px solid var(--studio-line);
        border-radius:11px;
        background:#14171e;
        box-shadow:none;
      }
      #${panelId} .bsb-preprocess-tabs button,
      #${panelId} .bsb-output-tabs button,
      #${panelId} .bsb-model-tabs button {
        box-shadow:none !important;
      }
      #${panelId} .bsb-ai-canvas-wrap {
        border:1px solid var(--studio-line);
        background:#15181f;
        border-radius:13px;
        box-shadow:none;
      }
      #${panelId} .bsb-ai-canvas-bar {
        min-height:38px;
        border-bottom:1px solid var(--studio-line);
        background:#15181f;
      }
      #${panelId} .bsb-ai-md { padding-top:30px; }
      #${panelId} .bsb-ai-content { color:var(--studio-text); }

      /* Library: source list behaves like a stable product sidebar. */
      #${panelId} .bsb-library-topbar {
        gap:7px; padding:0; background:transparent; border:0;
      }
      #${panelId} .bsb-library-search,
      #${panelId} .bsb-config-search,
      #${panelId} .bsb-transcript-search {
        border-color:var(--studio-line) !important;
        background:#13161d !important;
        box-shadow:none !important;
      }
      #${panelId} .bsb-library-filterbar {
        border-color:var(--studio-line); background:#13161d;
      }
      #${panelId} .bsb-library-layout {
        gap:0;
        border:1px solid var(--studio-line);
        border-radius:13px;
        overflow:hidden;
        background:#14171e;
      }
      #${panelId} .bsb-library-master {
        border:0; border-right:1px solid var(--studio-line); border-radius:0; background:#12151b;
      }
      #${panelId} .bsb-library-detail { background:#171a21; }
      #${panelId} .bsb-transcript-shell { border:0; border-radius:0; background:transparent; }
      #${panelId} .bsb-library-master-foot {
        border-top:1px solid var(--studio-line); background:#12151b;
      }
      #${panelId} .bsb-library-master-foot button { border-radius:7px; }

      /* Settings: editor owns the page; category navigation stays compact. */
      #${panelId} .bsb-settings { gap:9px; }
      #${panelId} .bsb-settings-tabs {
        align-self:flex-start; width:auto; padding:3px;
        border:1px solid var(--studio-line); border-radius:10px; background:#13161d;
      }
      #${panelId} .bsb-settings-tabs button {
        min-width:82px; height:28px; border:0; border-radius:7px; background:transparent;
        color:var(--studio-muted); box-shadow:none;
      }
      #${panelId} .bsb-settings-tabs button.active { color:var(--studio-text); background:var(--studio-hover); }
      #${panelId} .bsb-prompt-stage-tabs {
        border-bottom:1px solid var(--studio-line); background:transparent;
      }
      #${panelId} .bsb-config-master-detail {
        border:1px solid var(--studio-line); border-radius:13px; overflow:hidden; background:#14171e;
      }
      #${panelId} .bsb-config-sidebar {
        border:0; border-right:1px solid var(--studio-line); border-radius:0; background:#12151b;
      }
      #${panelId} .bsb-config-editor-shell { background:#171a21; }

      /* Status is feedback, not permanent navigation. */
      #${panelId} .bsb-statusbar {
        position:absolute;
        right:12px; bottom:12px;
        z-index:20;
        width:auto; max-width:min(420px, calc(100% - 92px));
        min-height:32px; padding:7px 10px;
        border:1px solid var(--studio-line-strong);
        border-radius:10px;
        background:rgba(23,26,33,.94);
        box-shadow:0 10px 28px rgba(0,0,0,.28);
        backdrop-filter:blur(12px);
        pointer-events:none;
      }
      #${panelId} .bsb-status { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--studio-muted); }
      #${panelId} .bsb-status-dot { width:6px; height:6px; box-shadow:none !important; }

      /* Small shell keeps icons only; medium/large show labels. */
      #${panelId}[data-panel-size="small"] .bsb-sidebar { grid-template-columns:50px minmax(0,1fr); }
      #${panelId}[data-panel-size="small"] .bsb-nav { padding-inline:5px; }
      #${panelId}[data-panel-size="small"] .bsb-nav button { width:39px; height:40px; }
      #${panelId}[data-panel-size="small"] .bsb-nav-label { display:none; }
      #${panelId}[data-panel-size="small"] .bsb-ai-stage-tabs button { min-width:78px; padding-inline:8px; }
      #${panelId}[data-panel-size="small"] .bsb-brand-stack { gap:5px; }
      #${panelId}[data-panel-size="small"] .bsb-head-context { display:none; }

      /* v6.0.1 · shortcut center */
      #${panelId} .bsb-shortcut-settings { height:100%; min-height:0; overflow:auto; }
      #${panelId} .bsb-appearance-settings {
        height: 100%; min-height: 0; overflow: auto; padding: 14px 16px 18px;
      }
      #${panelId} .bsb-appearance-head {
        display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px;
      }
      #${panelId} .bsb-appearance-head strong {
        font-size: 13.5px; color: var(--ctp-text); font-weight: 750;
      }
      #${panelId} .bsb-appearance-head span {
        font-size: 11px; color: var(--ctp-overlay1); line-height: 1.45;
      }
      #${panelId} .bsb-theme-grid {
        display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px;
      }
      #${panelId} .bsb-theme-card {
        display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: 10px; align-items: center;
        width: 100%; text-align: left; cursor: pointer; padding: 10px 11px;
        border-radius: 12px; border: 1px solid color-mix(in srgb, var(--ctp-surface1) 55%, transparent);
        background: color-mix(in srgb, var(--ctp-base) 55%, transparent); color: var(--ctp-text);
        transition: border-color .15s ease, background .15s ease, transform .12s ease;
      }
      #${panelId} .bsb-theme-card:hover {
        border-color: color-mix(in srgb, var(--ctp-lavender) 42%, transparent);
        background: color-mix(in srgb, var(--ctp-surface0) 45%, transparent);
        transform: translateY(-1px);
      }
      #${panelId} .bsb-theme-card.selected {
        border-color: color-mix(in srgb, var(--ctp-lavender) 55%, transparent);
        background: color-mix(in srgb, var(--ctp-lavender) 12%, var(--ctp-surface0));
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--ctp-lavender) 18%, transparent);
      }
      #${panelId} .bsb-theme-preview {
        width: 52px; height: 40px; border-radius: 10px; overflow: hidden; position: relative;
        border: 1px solid color-mix(in srgb, var(--p2) 70%, transparent);
        background:
          linear-gradient(135deg, var(--p0) 0 42%, transparent 42%),
          linear-gradient(225deg, var(--p1) 0 55%, transparent 55%),
          var(--p2);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tx) 8%, transparent);
      }
      #${panelId} .bsb-theme-preview i {
        position: absolute; width: 8px; height: 8px; border-radius: 50%;
        bottom: 6px; box-shadow: 0 0 0 1px color-mix(in srgb, var(--p0) 35%, transparent);
      }
      #${panelId} .bsb-theme-preview i:nth-child(1) { left: 7px; background: var(--a0); }
      #${panelId} .bsb-theme-preview i:nth-child(2) { left: 18px; background: var(--a1); }
      #${panelId} .bsb-theme-preview i:nth-child(3) { left: 29px; background: var(--a2); }
      #${panelId} .bsb-theme-meta { min-width: 0; display: grid; gap: 2px; }
      #${panelId} .bsb-theme-meta strong {
        display: block; font-size: 12px; font-weight: 750; color: var(--ctp-text);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      #${panelId} .bsb-theme-meta small {
        display: block; font-size: 10.5px; color: var(--ctp-overlay1); line-height: 1.35;
      }
      @media (max-width: 720px) {
        #${panelId} .bsb-theme-grid { grid-template-columns: 1fr; }
      }
      #${panelId} .bsb-shortcut-page { display:flex; flex-direction:column; gap:10px; max-width:920px; padding:2px 0 14px; }
      #${panelId} .bsb-shortcut-hero {
        display:flex; align-items:flex-start; justify-content:space-between; gap:18px;
        padding:15px 16px; border:1px solid var(--studio-line); border-radius:13px;
        background:linear-gradient(135deg,rgba(137,180,250,.08),rgba(203,166,247,.035) 55%,rgba(23,26,33,.5));
      }
      #${panelId} .bsb-shortcut-kicker { display:block; margin-bottom:4px; color:var(--ctp-blue); font-size:9px; font-weight:850; letter-spacing:.16em; }
      #${panelId} .bsb-shortcut-hero h3 { margin:0; color:var(--studio-text); font-size:16px; line-height:1.35; }
      #${panelId} .bsb-shortcut-hero p { margin:5px 0 0; max-width:650px; color:var(--studio-muted); font-size:10.5px; line-height:1.55; }
      #${panelId} .bsb-shortcut-card { border:1px solid var(--studio-line); border-radius:13px; overflow:hidden; background:#14171e; }
      #${panelId} .bsb-shortcut-section-title { display:flex; align-items:baseline; gap:9px; padding:12px 14px 10px; border-bottom:1px solid var(--studio-line); background:#15181f; }
      #${panelId} .bsb-shortcut-section-title strong { color:var(--studio-text); font-size:12px; }
      #${panelId} .bsb-shortcut-section-title span { color:var(--studio-muted); font-size:9.5px; }
      #${panelId} .bsb-shortcut-prefs { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:9px; padding:12px 14px 14px; }
      #${panelId} .bsb-shortcut-prefs > label { display:flex; flex-direction:column; gap:5px; min-width:0; color:var(--studio-muted); font-size:9.5px; }
      #${panelId} .bsb-shortcut-prefs .bsb-flow-select { width:100%; }
      #${panelId} .bsb-shortcut-list { display:flex; flex-direction:column; }
      #${panelId} .bsb-shortcut-row {
        display:grid; grid-template-columns:minmax(180px,1fr) minmax(230px,auto); gap:14px; align-items:center;
        padding:11px 14px; border-bottom:1px solid color-mix(in srgb,var(--studio-line) 72%,transparent);
      }
      #${panelId} .bsb-shortcut-row:last-child { border-bottom:0; }
      #${panelId} .bsb-shortcut-row:hover { background:rgba(255,255,255,.018); }
      #${panelId} .bsb-shortcut-copy { display:flex; flex-direction:column; gap:3px; min-width:0; }
      #${panelId} .bsb-shortcut-copy strong { color:var(--studio-text); font-size:11.5px; }
      #${panelId} .bsb-shortcut-copy span { color:var(--studio-muted); font-size:9.5px; line-height:1.42; }
      #${panelId} .bsb-shortcut-control { display:grid; grid-template-columns:minmax(150px,1fr) 30px; gap:6px; align-items:center; min-width:230px; }
      #${panelId} .bsb-shortcut-key {
        height:34px; min-width:150px; padding:0 10px; border:1px solid var(--studio-line-strong); border-radius:9px;
        background:#10131a; color:var(--studio-text); font:700 10.5px/1 ui-monospace,SFMono-Regular,Consolas,monospace;
        letter-spacing:.015em; cursor:pointer; box-shadow:inset 0 1px 0 rgba(255,255,255,.025); outline:none;
      }
      #${panelId} .bsb-shortcut-key:hover { border-color:color-mix(in srgb,var(--ctp-blue) 40%,var(--studio-line-strong)); background:#151a24; }
      #${panelId} .bsb-shortcut-key:focus-visible { border-color:var(--ctp-blue); box-shadow:0 0 0 3px rgba(137,180,250,.12); }
      #${panelId} .bsb-shortcut-key.recording { color:var(--ctp-blue); border-color:var(--ctp-blue); background:rgba(137,180,250,.08); animation:bsb-shortcut-pulse 1.1s ease-in-out infinite; }
      @keyframes bsb-shortcut-pulse { 50% { box-shadow:0 0 0 4px rgba(137,180,250,.08); } }
      #${panelId} .bsb-shortcut-reset { width:30px; height:30px; border:1px solid transparent; border-radius:8px; background:transparent; color:var(--studio-muted); cursor:pointer; }
      #${panelId} .bsb-shortcut-reset:hover { color:var(--studio-text); background:var(--studio-hover); border-color:var(--studio-line); }
      #${panelId} .bsb-shortcut-state { grid-column:1 / -1; justify-self:end; min-height:13px; color:var(--studio-muted); font-size:8.8px; }
      #${panelId} .bsb-shortcut-state.ok { color:var(--ctp-green); }
      #${panelId} .bsb-shortcut-state.warn { color:var(--ctp-yellow); }
      #${panelId} .bsb-shortcut-state.error { color:var(--ctp-red); }
      #${panelId} .bsb-shortcut-state.off { color:var(--ctp-overlay0); }
      #${panelId} .bsb-shortcut-foot { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 14px; border-top:1px solid var(--studio-line); color:var(--studio-muted); font-size:9px; background:#12151b; }
      #${panelId}[data-panel-size="small"] .bsb-shortcut-prefs { grid-template-columns:1fr; }
      #${panelId}[data-panel-size="small"] .bsb-shortcut-row { grid-template-columns:1fr; gap:8px; }
      #${panelId}[data-panel-size="small"] .bsb-shortcut-control { width:100%; min-width:0; }
      #${panelId}[data-panel-size="small"] .bsb-shortcut-foot { align-items:flex-start; flex-direction:column; }

      /* Focus mode: rail and chrome leave, content becomes a clean reading surface. */
      #${panelId}.ai-focus .bsb-sidebar {
        display:grid !important;
        grid-template-columns:minmax(0,1fr) !important;
        grid-template-rows:minmax(0,1fr) !important;
      }
      #${panelId}.ai-focus .bsb-body { grid-column:1; grid-row:1; }
      #${panelId}.ai-focus .bsb-head,
      #${panelId}.ai-focus .bsb-nav,
      #${panelId}.ai-focus .bsb-statusbar { display:none !important; }
`;
  }
  const lateStyles = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    renderLateStudioStyles
  }, Symbol.toStringTag, { value: "Module" }));
  function stageOf(value) {
    return value === "postprocess" || value === "chat" ? value : "preprocess";
  }
  function applyWorkbenchStageUi(root, stageValue, inputView) {
    const stage = stageOf(stageValue);
    root.querySelectorAll("[data-ai-stage]").forEach((button) => {
      const active = button.dataset.aiStage === stage;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    const preNav = root.querySelector('[data-role="ai-preprocess-nav"]');
    const postNav = root.querySelector('[data-role="ai-postprocess-nav"]');
    const dock = root.querySelector('[data-role="studio-dock"]');
    const wrap = root.querySelector(".bsb-ai-canvas-wrap");
    if (preNav) preNav.hidden = stage !== "preprocess";
    if (postNav) postNav.hidden = stage !== "postprocess";
    if (dock) dock.hidden = stage !== "chat";
    wrap?.classList.toggle("is-studio", stage === "chat");
    root.querySelectorAll("[data-preprocess-action]").forEach((node) => {
      node.hidden = stage !== "preprocess";
    });
    root.querySelectorAll("[data-postprocess-action]").forEach((node) => {
      node.hidden = stage !== "postprocess";
    });
    root.querySelectorAll("[data-studio-action]").forEach((node) => {
      node.hidden = stage !== "chat";
    });
    root.querySelectorAll("[data-pipeline-action]").forEach((node) => {
      node.hidden = stage === "chat";
    });
    const label = root.querySelector('[data-role="ai-canvas-stage-label"]');
    if (label) label.textContent = stage === "preprocess" ? "预处理" : stage === "chat" ? "对话" : "后处理";
    root.querySelectorAll("[data-ai-preprocess-view]").forEach((button) => {
      const active = button.dataset.aiPreprocessView === inputView;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
  }
  const studioController = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    applyWorkbenchStageUi,
    stageOf
  }, Symbol.toStringTag, { value: "Module" }));
  const bindings$3 = /* @__PURE__ */ new WeakMap();
  function bind$3(root, ports) {
    bindings$3.get(root)?.();
    const input = root.querySelector('[data-role="studio-input"]');
    if (!input) return () => {
    };
    const onInput = () => {
      input.style.height = "auto";
      input.style.height = `${Math.min(120, Math.max(40, input.scrollHeight))}px`;
      ports.renderMenu();
    };
    const onKey = (event) => {
      if (event.isComposing || event.keyCode === 229) return;
      const menu = root.querySelector('[data-role="studio-slash"]');
      const open = menu && !menu.hidden;
      const items = open ? Array.from(menu.querySelectorAll("[data-studio-slash]")) : [];
      if (open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault();
        ports.setIndex((ports.getIndex() + (event.key === "ArrowDown" ? 1 : -1) + items.length) % Math.max(1, items.length));
        ports.renderMenu();
      } else if (open && (event.key === "Tab" || event.key === "Enter" && !event.shiftKey)) {
        event.preventDefault();
        const active = items[ports.getIndex()] || items[0];
        if (active?.dataset.studioSlash) {
          input.value = "";
          ports.hideMenu();
          ports.runCommand(active.dataset.studioSlash);
        }
      } else if (event.key === "Escape" && open) {
        event.preventDefault();
        ports.hideMenu();
      } else if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        const text = input.value;
        input.value = "";
        input.style.height = "40px";
        ports.hideMenu();
        void ports.send(text).catch(ports.onError);
      }
    };
    const onClick = (event) => {
      const target = event.target instanceof Element ? event.target.closest("[data-studio-slash], [data-act]") : null;
      if (!target || !root.contains(target)) return;
      const command2 = target.dataset.studioSlash;
      const action = target.dataset.act;
      if (!command2 && !["studio-send", "studio-clear", "studio-copy", "studio-export"].includes(action || "")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (command2) {
        input.value = "";
        ports.hideMenu();
        ports.runCommand(command2);
      } else if (action === "studio-send") {
        const text = input.value;
        input.value = "";
        input.style.height = "40px";
        ports.hideMenu();
        void ports.send(text).catch(ports.onError);
      } else if (action === "studio-clear") ports.clear();
      else if (action === "studio-copy") ports.copy();
      else if (action === "studio-export") ports.exportChat();
    };
    root.addEventListener("click", onClick, true);
    input.addEventListener("input", onInput);
    input.addEventListener("keydown", onKey);
    const dispose = () => {
      root.removeEventListener("click", onClick, true);
      input.removeEventListener("input", onInput);
      input.removeEventListener("keydown", onKey);
      if (bindings$3.get(root) === dispose) bindings$3.delete(root);
    };
    bindings$3.set(root, dispose);
    return dispose;
  }
  const studioInteractionController = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    bind: bind$3
  }, Symbol.toStringTag, { value: "Module" }));
  function status(item) {
    const value = String(item?.subStatus || "wait");
    return value === "ok" || value === "empty" || value === "error" ? value : "wait";
  }
  function statusLabel(item) {
    const value = status(item);
    if (value === "ok") return String(item?.cue_count || item?.data?.length || 0) + " 条";
    if (value === "empty") return "无字幕";
    if (value === "error") return "失败";
    return "待抓取";
  }
  function filteredEntries(items, queryValue, filterValue) {
    const query = String(queryValue || "").trim().toLocaleLowerCase();
    const filter = String(filterValue || "all");
    return items.map((item, index) => ({ item, index })).filter(({ item }) => filter === "all" || status(item) === filter).filter(({ item }) => {
      if (!query) return true;
      const haystack = [
        item?.title,
        item?.bvid,
        item?.author,
        item?.part,
        item?.groupFolder,
        item?.parentFolder,
        item?.collectionName,
        item?.videoTitle,
        item?.collectionShortUrl,
        ...Array.isArray(item?.sources) ? item.sources : []
      ].filter(Boolean).join(" ").toLocaleLowerCase();
      return haystack.includes(query);
    });
  }
  const libraryController = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    filteredEntries,
    status,
    statusLabel
  }, Symbol.toStringTag, { value: "Module" }));
  function formatTime(seconds, withHours = false) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor(total % 3600 / 60);
    const sec = total % 60;
    if (withHours || h > 0) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    }
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  function filterIndexes(cues, query) {
    const needle = String(query || "").trim().toLocaleLowerCase();
    const indexes = [];
    (cues || []).forEach((cue, index) => {
      if (!needle || String(cue?.content || "").toLocaleLowerCase().includes(needle)) indexes.push(index);
    });
    return indexes;
  }
  function cueIndexAt(cues, time, parseSeconds2) {
    let low = 0;
    let high = cues.length - 1;
    let candidate = -1;
    while (low <= high) {
      const mid = low + high >> 1;
      const cue2 = cues[mid];
      const from = Number(cue2.from_sec ?? parseSeconds2(cue2.from));
      if (time < from) high = mid - 1;
      else {
        candidate = mid;
        low = mid + 1;
      }
    }
    if (candidate < 0) return -1;
    const cue = cues[candidate];
    const to = Number(cue.to_sec ?? parseSeconds2(cue.to));
    return time <= to + 0.2 ? candidate : -1;
  }
  const SUBTITLE_STATE_FIELDS = [
    "aid",
    "cid",
    "pages",
    "subStatus",
    "cue_count",
    "data",
    "error",
    "lan",
    "lan_doc",
    "tracks",
    "activeTrackIndex",
    "cachePath",
    "cacheLevel",
    "cacheStale",
    "source",
    "autoCaptured"
  ];
  function copySubtitleState(target, source) {
    if (!target || !source) return target;
    for (const field of SUBTITLE_STATE_FIELDS) {
      if (source[field] !== void 0) target[field] = source[field];
    }
    return target;
  }
  function appendHighlightedText(container, text, query) {
    if (!query) {
      container.textContent = text;
      return;
    }
    const doc = container.ownerDocument;
    const source = String(text || "");
    const lower = source.toLocaleLowerCase();
    const needle = query.toLocaleLowerCase();
    let cursor = 0;
    let index = lower.indexOf(needle);
    while (index >= 0) {
      if (index > cursor) container.append(doc.createTextNode(source.slice(cursor, index)));
      const mark = doc.createElement("mark");
      mark.textContent = source.slice(index, index + query.length);
      container.append(mark);
      cursor = index + query.length;
      index = lower.indexOf(needle, cursor);
    }
    if (cursor < source.length) container.append(doc.createTextNode(source.slice(cursor)));
  }
  function populateTrackSelect(select, item, state2, preferredTrack) {
    if (!select) return;
    const tracks = item?.tracks || [];
    const add = (label, value) => {
      const option = select.ownerDocument.createElement("option");
      option.textContent = label;
      option.value = value;
      select.appendChild(option);
    };
    select.replaceChildren();
    if (!tracks.length) {
      add(item?.lan_doc || item?.lan || "默认字幕", "0");
      select.disabled = true;
      return;
    }
    tracks.forEach((track, index) => add(track.lan_doc || track.lan || `字幕 ${index + 1}`, String(index)));
    const active = item?.activeTrackIndex;
    const selected = active !== void 0 && Number.isInteger(active) ? active : preferredTrack(tracks);
    state2.transcriptTrackIndex = selected;
    select.value = String(Math.max(0, selected));
    select.disabled = tracks.length <= 1;
  }
  function renderPanel(root, item, state2, ports) {
    if (!root) return false;
    const list = root.querySelector('[data-role="transcript-list"]');
    const title = root.querySelector('[data-role="transcript-title"]');
    const meta = root.querySelector('[data-role="transcript-meta"]');
    const count = root.querySelector('[data-role="transcript-count"]');
    if (!list || !title || !meta || !count) return false;
    const select = root.querySelector('[data-role="transcript-track"]');
    if (!item || item.subStatus !== "ok" || !item.data?.length) {
      title.textContent = item?.title || "当前视频字幕";
      const value = status(item);
      const page = item?.page || 1;
      meta.textContent = !item ? "从左侧选择一个视频" : `${item.bvid || ""}${page > 1 ? ` · P${page}` : ""} · ${value === "error" ? "抓取失败" : value === "empty" ? "无字幕" : "待抓取"}`;
      count.textContent = "";
      populateTrackSelect(select, null, state2, ports.preferredTrack);
      list.innerHTML = item ? `<div class="bsb-transcript-empty">${value === "error" ? "字幕抓取失败，可点击右上角刷新重试。" : value === "empty" ? "这个视频没有可读取字幕。" : "该视频尚未抓取字幕，可勾选后点击左侧「抓取所选」。"}</div>` : '<div class="bsb-transcript-empty">从左侧选择一个视频。<br>已有字幕的项目会直接显示全文。</div>';
      return false;
    }
    if (!state2.transcriptItemKey) state2.transcriptItemKey = ports.routeKey(item.bvid, item.page || 1);
    title.textContent = item.title || `${item.bvid} 字幕`;
    meta.textContent = `${item.cue_count || item.data.length} 条 · ${item.lan_doc || item.lan || "字幕"} · ${item.cachePath || item.source || "已加载"}`;
    populateTrackSelect(select, item, state2, ports.preferredTrack);
    const query = state2.transcriptQuery.trim();
    const indexes = filterIndexes(item.data, query);
    state2.transcriptFilteredIndexes = query ? indexes : null;
    count.textContent = query ? `${indexes.length}/${item.data.length}` : String(item.data.length);
    const epoch = ++state2.transcriptRenderEpoch;
    const doc = root.ownerDocument;
    const fragment = doc.createDocumentFragment();
    for (const index of indexes) {
      const cue = item.data[index];
      if (!cue) continue;
      const row2 = doc.createElement("div");
      row2.className = "bsb-transcript-row";
      if (index === state2.transcriptActiveCueIndex) row2.classList.add("active");
      row2.dataset.cueIndex = String(index);
      const seconds = cue.from_sec ?? ports.parseSeconds(cue.from);
      const time = doc.createElement("button");
      time.type = "button";
      time.className = "bsb-transcript-time";
      time.dataset.transcriptTime = String(seconds);
      time.textContent = formatTime(seconds);
      time.title = `跳转到 ${formatTime(seconds, true)}`;
      const text = doc.createElement("p");
      text.className = "bsb-transcript-text";
      appendHighlightedText(text, cue.content || "", query);
      row2.append(time, text);
      fragment.appendChild(row2);
    }
    if (epoch !== state2.transcriptRenderEpoch) return false;
    list.replaceChildren(fragment);
    return true;
  }
  function updateActiveCue(root, cues, state2, time, force, ports) {
    if (!cues.length) return;
    const index = cueIndexAt(cues, Number(time) || 0, ports.parseSeconds);
    if (index < 0) {
      root?.querySelector(".bsb-transcript-row.active")?.classList.remove("active");
      state2.transcriptActiveCueIndex = -1;
      return;
    }
    if (!force && index === state2.transcriptActiveCueIndex) return;
    root?.querySelector(".bsb-transcript-row.active")?.classList.remove("active");
    state2.transcriptActiveCueIndex = index;
    const row2 = root?.querySelector(`.bsb-transcript-row[data-cue-index="${index}"]`);
    row2?.classList.add("active");
    if (!row2 || !state2.transcriptAutoFollow || state2.ui?.view !== "subs") return;
    if (!force && ports.now() < state2.transcriptUserScrollUntil) return;
    row2.scrollIntoView({ block: "center", behavior: ports.reducedMotion() ? "auto" : "smooth" });
  }
  const transcriptController = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    appendHighlightedText,
    copySubtitleState,
    cueIndexAt,
    filterIndexes,
    formatTime,
    populateTrackSelect,
    renderPanel,
    updateActiveCue
  }, Symbol.toStringTag, { value: "Module" }));
  function nodesForAnchor(nodes, anchorId) {
    return nodes.filter((node) => node.anchorId === anchorId);
  }
  function anchorById(anchors, id) {
    return anchors.find((anchor) => anchor.id === id) || null;
  }
  function nodeById(nodes, id) {
    return nodes.find((node) => node.id === id) || null;
  }
  function filterAnchors(anchors, nodes, search) {
    const query = String(search || "").trim().toLocaleLowerCase();
    if (!query) return anchors;
    const nodeMatches = /* @__PURE__ */ new Set();
    for (const node of nodes) {
      const haystack = [node.question || "", node.answer || "", node.preview || ""].join("\n").toLocaleLowerCase();
      if (haystack.includes(query)) nodeMatches.add(node.anchorId);
    }
    return anchors.filter((anchor) => [anchor.selectedText, anchor.title, anchor.contextText].join("\n").toLocaleLowerCase().includes(query) || nodeMatches.has(anchor.id));
  }
  function resolveSelection(anchors, nodes, anchorId, nodeId, isSmall) {
    let selectedAnchor = anchorId;
    let selectedNode = nodeId;
    if (!anchors.some((anchor) => anchor.id === selectedAnchor)) {
      selectedAnchor = isSmall ? "" : anchors[0]?.id || "";
      selectedNode = "";
    }
    if (selectedAnchor) {
      const candidates = nodesForAnchor(nodes, selectedAnchor);
      if (!candidates.some((node) => node.id === selectedNode)) {
        selectedNode = [...candidates].sort(
          (a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0)
        )[0]?.id || "";
      }
    }
    return { anchorId: selectedAnchor, nodeId: selectedNode };
  }
  function groupAnchors(anchors, sourceKey) {
    const groups = /* @__PURE__ */ new Map();
    for (const anchor of anchors) {
      const key = String(anchor.sourceKey || sourceKey(anchor) || "unknown");
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: String(anchor.title || anchor.bvid || "未命名来源") + (anchor.bvid ? " · " + anchor.bvid : "") + (Number(anchor.page) > 1 ? " P" + anchor.page : ""),
          anchors: []
        });
      }
      groups.get(key).anchors.push(anchor);
    }
    return [...groups.values()];
  }
  const knowledgeNavigationController = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    anchorById,
    filterAnchors,
    groupAnchors,
    nodeById,
    nodesForAnchor,
    resolveSelection
  }, Symbol.toStringTag, { value: "Module" }));
  function treeHtml(anchorId, activeNodeId, nodes, escapeHtml, escapeAttr) {
    const scoped = nodes.filter((node) => node.anchorId === anchorId);
    const children = /* @__PURE__ */ new Map();
    for (const node of scoped) {
      const key = node.parentId || "__root__";
      if (!children.has(key)) children.set(key, []);
      children.get(key).push(node);
    }
    const renderLevel = (parentId, depth = 0) => {
      if (depth > 64) return "";
      return (children.get(parentId || "__root__") || []).map((node) => {
        const kids = children.get(node.id) || [];
        const cls = node.id === activeNodeId ? " active" : "";
        return `<div class="bsb-knowledge-tree-node" style="--depth:${depth}"><button type="button" class="${cls}" data-knowledge-node-id="${escapeAttr(node.id)}"><span class="bsb-knowledge-tree-branch">${kids.length ? "⌄" : "·"}</span><span>${escapeHtml(node.question)}</span>${node.starred ? '<span class="bsb-knowledge-star">★</span>' : ""}</button>${kids.length ? renderLevel(node.id, depth + 1) : ""}</div>`;
      }).join("");
    };
    return renderLevel(null) || '<div class="bsb-knowledge-empty-small">还没有追问。直接提出第一个问题。</div>';
  }
  function breadcrumbHtml(node, ancestors, escapeHtml, escapeAttr) {
    if (!node) return "";
    const chain = [...ancestors, node];
    return chain.map((n, i) => `<button type="button" data-knowledge-node-id="${escapeAttr(n.id)}" title="${escapeAttr(n.question)}">${escapeHtml(n.question.length > 28 ? `${n.question.slice(0, 28)}…` : n.question)}</button>${i < chain.length - 1 ? "<span>›</span>" : ""}`).join("");
  }
  function suggestionsHtml(node, escapeAttr, escapeHtml) {
    const suggestions = Array.isArray(node?.suggestions) ? node.suggestions.filter(Boolean).slice(0, 4) : [];
    if (!suggestions.length) return "";
    return `<div class="bsb-knowledge-suggestions"><span class="bsb-knowledge-kicker">继续深入</span>${suggestions.map((q) => `<button type="button" data-knowledge-suggestion="${escapeAttr(q)}"><span>→</span>${escapeHtml(q)}</button>`).join("")}</div>`;
  }
  function dispatchNavigationClick(target, actions) {
    if (!target) return false;
    for (const [selector, action] of [
      ["[data-knowledge-back-list]", "backList"],
      ["[data-knowledge-tree-toggle]", "toggleTree"],
      ["[data-knowledge-open-workspace]", "openWorkspace"],
      ["[data-knowledge-new-root]", "newRoot"]
    ]) {
      if (target.closest?.(selector)) {
        actions[action]();
        return true;
      }
    }
    const anchor = target.closest?.("[data-knowledge-anchor-list]");
    if (anchor) {
      actions.selectAnchor(anchor.getAttribute("data-knowledge-anchor-list") || "");
      return true;
    }
    const node = target.closest?.("[data-knowledge-node-id]");
    if (node) {
      actions.selectNode(node.getAttribute("data-knowledge-node-id") || "");
      return true;
    }
    const suggestion = target.closest?.("[data-knowledge-suggestion]");
    if (suggestion) {
      actions.askSuggestion(suggestion.getAttribute("data-knowledge-suggestion") || "");
      return true;
    }
    return false;
  }
  const knowledgeTreeRenderer = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    breadcrumbHtml,
    dispatchNavigationClick,
    suggestionsHtml,
    treeHtml
  }, Symbol.toStringTag, { value: "Module" }));
  function readerHtml(anchor, options) {
    const { isSmall = false, escapeAttr, escapeHtml, formatClock: formatClock2, contextHtml, breadcrumbHtml: breadcrumbHtml2, answerHtml, composerHtml: composerHtml2 } = options;
    const meta = [
      anchor.title || "",
      anchor.bvid ? `${anchor.bvid}${(anchor.page || 1) > 1 ? ` P${anchor.page}` : ""}` : "",
      anchor.timeStart != null ? formatClock2(anchor.timeStart) : ""
    ].filter(Boolean).join(" · ");
    return `<header class="bsb-knowledge-reader-head">
        <div class="bsb-knowledge-reader-head-main">
          ${isSmall ? '<button type="button" class="bsb-btn ghost bsb-knowledge-mobile-back" data-knowledge-back-list style="margin-bottom:4px">← 返回列表</button>' : ""}
          <h2 class="bsb-knowledge-reader-title" title="${escapeAttr(anchor.selectedText || "")}">${escapeHtml(anchor.selectedText || "")}</h2>
          <p class="bsb-knowledge-reader-meta" title="${escapeAttr(meta)}">${escapeHtml(meta || "局部字幕锚点")}</p>
        </div>
        <div class="bsb-knowledge-reader-actions">
          <button type="button" class="bsb-icon-btn${anchor.starred ? " active" : ""}" data-knowledge-star-anchor title="${anchor.starred ? "取消收藏" : "收藏"}">${anchor.starred ? "★" : "☆"}</button>
          <button type="button" class="bsb-icon-btn" data-knowledge-seek title="回到字幕">⏱</button>
          <div class="bsb-knowledge-more">
            <button type="button" class="bsb-icon-btn" data-knowledge-more-toggle title="更多" aria-haspopup="menu">···</button>
            <div class="bsb-knowledge-more-menu" data-role="knowledge-more-menu" hidden>
              <button type="button" class="danger" data-knowledge-delete-anchor>删除锚点</button>
            </div>
          </div>
        </div>
      </header>
      ${contextHtml}
      <div class="bsb-knowledge-crumbs">${breadcrumbHtml2}</div>
      <div class="bsb-knowledge-reader-scroll" data-role="knowledge-reader-scroll">
        <div class="bsb-knowledge-reader-scroll-inner">${answerHtml}</div>
      </div>
      ${composerHtml2}`;
  }
  function dispatchReaderClick(target, actions) {
    if (!target) return false;
    for (const [selector, action] of [
      ["[data-knowledge-star-anchor]", "starAnchor"],
      ["[data-knowledge-star-node]", "starNode"],
      ["[data-knowledge-delete-anchor]", "deleteAnchor"],
      ["[data-knowledge-more-toggle]", "toggleMore"]
    ]) {
      if (target.closest?.(selector)) {
        actions[action]();
        return true;
      }
    }
    return false;
  }
  const knowledgeReaderController = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    dispatchReaderClick,
    readerHtml
  }, Symbol.toStringTag, { value: "Module" }));
  function evidenceHtml(anchor, open, escapeHtml) {
    const selected = String(anchor?.selectedText || "").trim();
    const context = String(anchor?.contextText || "").trim();
    if (!selected && !context) return "";
    const showContext = context && context !== selected;
    const preview = selected.replace(/\s+/g, " ");
    const short = preview.length > 28 ? `${preview.slice(0, 28)}…` : preview;
    return `<div class="bsb-knowledge-evidence" data-role="knowledge-context">
      <button type="button" class="bsb-knowledge-evidence-chip" data-knowledge-evidence-toggle aria-expanded="${open ? "true" : "false"}">
        <strong>字幕依据</strong><em>${escapeHtml(short)}</em><span class="action">${open ? "收起" : "查看上下文"}</span>
      </button>
      <div class="bsb-knowledge-evidence-panel" data-role="knowledge-evidence-panel" ${open ? "" : "hidden"}>
        <div><strong>选区</strong><pre>${escapeHtml(selected)}</pre></div>
        ${showContext ? `<div><strong>前后文</strong><pre>${escapeHtml(context)}</pre></div>` : ""}
      </div>
    </div>`;
  }
  function answerBodyHtml(activeNode, options) {
    const { escapeHtml, visibleAnswer, renderCards, suggestionsHtml: suggestionsHtml2 } = options;
    if (!activeNode) {
      return `<div class="bsb-knowledge-welcome"><div class="bsb-knowledge-orb">✦</div><strong>从这里向下钻</strong><span>这个锚点还没有问题。可以直接提问，或者先让 AI 解释它。</span><button type="button" data-knowledge-quick="explain">解释这个概念</button></div>`;
    }
    const answer = visibleAnswer(activeNode.answer || activeNode.preview || "");
    const streaming = activeNode.status === "running";
    const statusLabel2 = streaming ? "正在回答" : activeNode.status === "stopped" ? "已停止" : activeNode.status === "error" ? "回答失败" : "当前问题";
    const answerFallback = activeNode.status === "error" ? `<div class="bsb-knowledge-thinking">回答失败${activeNode.error ? `：${escapeHtml(activeNode.error)}` : ""}</div>` : activeNode.status === "stopped" ? '<div class="bsb-knowledge-thinking">回答已停止。可以从这个节点继续提出新的问题。</div>' : '<div class="bsb-knowledge-thinking">正在组织回答…</div>';
    const answerHtml = answer ? renderCards(answer, { streaming }) : answerFallback;
    return `<article class="bsb-knowledge-question-card"><div class="bsb-knowledge-question"><div class="bsb-knowledge-question-meta"><span>${statusLabel2}</span><button type="button" class="bsb-knowledge-node-star${activeNode.starred ? " active" : ""}" data-knowledge-star-node title="${activeNode.starred ? "取消收藏这个回答" : "收藏这个回答"}">${activeNode.starred ? "★" : "☆"}</button></div><h3>${escapeHtml(activeNode.question)}</h3></div></article>
      <div class="bsb-knowledge-answer${streaming ? " streaming" : ""}">${answerHtml}</div>
      ${suggestionsHtml2(activeNode)}`;
  }
  function composerHtml(busy, modelOptionsHtml) {
    return `<div class="bsb-knowledge-composer">
      <div class="bsb-knowledge-composer-box">
        <textarea data-role="knowledge-question" rows="2" placeholder="继续追问… Enter 发送 · Shift+Enter 换行" ${busy ? "disabled" : ""}></textarea>
        <div class="bsb-knowledge-composer-tools">
          <select class="bsb-knowledge-model-select" data-role="knowledge-model" title="回答模型" ${busy ? "disabled" : ""}>${modelOptionsHtml}</select>
          <button type="button" class="bsb-btn accent" data-knowledge-send ${busy ? "disabled" : ""}>${busy ? "生成中" : "发送"}</button>
        </div>
      </div>
    </div>`;
  }
  function answerCardsHtml(text, options) {
    const { streaming = false, prepare, blocks: splitBlocks, chunkHtml, escapeHtml } = options;
    const source = String(text || "").trim();
    if (!source) return "";
    const { md, maths } = prepare(source);
    const blocks = splitBlocks(md);
    if (!blocks.length) {
      return `<div class="bsb-preprocess-reading bsb-knowledge-answer-reading"><article class="bsb-preprocess-block bsb-knowledge-answer-card"><div class="bsb-preprocess-block-head"><span class="bsb-preprocess-block-index">01</span></div><div class="bsb-preprocess-block-body bsb-knowledge-card-body">${chunkHtml(md, maths)}</div></article></div>`;
    }
    let paragraphIndex = 0;
    const html = blocks.map((block) => {
      if (block.type === "heading") {
        return `<div class="bsb-preprocess-section-title">${escapeHtml(block.text)}</div>`;
      }
      paragraphIndex += 1;
      const bodyHtml = chunkHtml(block.text, maths);
      return `<article class="bsb-preprocess-block bsb-knowledge-answer-card"><div class="bsb-preprocess-block-head"><span class="bsb-preprocess-block-index">${String(paragraphIndex).padStart(2, "0")}</span>${block.topic ? `<span class="bsb-preprocess-block-topic">${escapeHtml(block.topic)}</span>` : ""}</div><div class="bsb-preprocess-block-body bsb-knowledge-card-body">${bodyHtml}</div></article>`;
    }).join("");
    return `<div class="bsb-preprocess-reading bsb-knowledge-answer-reading${streaming ? " is-streaming" : ""}">${html}</div>`;
  }
  const knowledgeAnswerView = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    answerBodyHtml,
    answerCardsHtml,
    composerHtml,
    evidenceHtml
  }, Symbol.toStringTag, { value: "Module" }));
  const CONFIG_ITEM = ".bsb-config-list-item[draggable='true']";
  const FLOW_ITEM = ".bsb-model-rank[draggable='true']";
  const CONFIG_LIST = '[data-role="prompt-list"], [data-role="ai-list"]';
  const FLOW_CARD = "[data-flow-task-id]";
  const ACTIVE = ".bsb-config-list-item.dragging, .bsb-config-list-item.drag-over, .bsb-model-rank.dragging, .bsb-model-rank.drag-over";
  const bindings$2 = /* @__PURE__ */ new WeakMap();
  function element(event) {
    const target = event.target;
    return target && typeof target.closest === "function" ? target : null;
  }
  function attr(el, key) {
    return el.dataset[key] || "";
  }
  function bind$2(root, ports) {
    bindings$2.get(root)?.();
    let dragging = null;
    const clear = () => {
      root.querySelectorAll(ACTIVE).forEach((item) => item.classList.remove("dragging", "drag-over"));
    };
    const onStart = (event) => {
      const target = element(event);
      if (!target) return;
      clear();
      dragging = null;
      const config = target.closest(CONFIG_ITEM);
      if (config && root.contains(config)) {
        const list = config.closest(CONFIG_LIST);
        if (!list || list.dataset.reorderLocked === "1") {
          event.preventDefault();
          return;
        }
        const id = attr(config, "promptListId") || attr(config, "aiListId");
        if (!id) {
          event.preventDefault();
          return;
        }
        dragging = { type: "config", kind: list.dataset.role === "prompt-list" ? "prompt" : "llm", id, list };
        config.classList.add("dragging");
      } else {
        const model = target.closest(FLOW_ITEM);
        if (!model || !root.contains(model)) return;
        const card = model.closest(FLOW_CARD);
        const id = attr(model, "flowModelId");
        if (!card || !id) return;
        if (target.closest("[data-flow-task-model-remove]")) {
          event.preventDefault();
          return;
        }
        dragging = { type: "flow", id, taskId: attr(card, "flowTaskId"), card };
        model.classList.add("dragging");
      }
      try {
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", dragging.id);
        }
      } catch {
      }
    };
    const targetFor = (target, drag) => {
      if (drag.type === "config") {
        const item2 = target.closest(CONFIG_ITEM);
        return item2?.closest(CONFIG_LIST) === drag.list ? item2 : null;
      }
      const item = target.closest(FLOW_ITEM);
      const card = item?.closest(FLOW_CARD);
      return card && attr(card, "flowTaskId") === drag.taskId ? item || null : null;
    };
    const onOver = (event) => {
      const target = element(event);
      if (!target || !dragging) return;
      const item = targetFor(target, dragging);
      if (!item) return;
      event.preventDefault();
      try {
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      } catch {
      }
      const scope = dragging.type === "config" ? dragging.list : dragging.card;
      const selector = dragging.type === "config" ? ".bsb-config-list-item.drag-over" : ".bsb-model-rank.drag-over";
      scope.querySelectorAll(selector).forEach((el) => {
        if (el !== item) el.classList.remove("drag-over");
      });
      const id = dragging.type === "config" ? attr(item, "promptListId") || attr(item, "aiListId") : attr(item, "flowModelId");
      if (id !== dragging.id) item.classList.add("drag-over");
    };
    const onLeave = (event) => {
      const target = element(event);
      const item = target?.closest(".bsb-config-list-item, .bsb-model-rank");
      if (!item) return;
      const related = event.relatedTarget;
      if (related && item.contains(related)) return;
      item.classList.remove("drag-over");
    };
    const onEnd = () => {
      clear();
      dragging = null;
    };
    const onDrop = (event) => {
      const target = element(event);
      if (!target || !dragging) return;
      const item = targetFor(target, dragging);
      if (!item) return;
      event.preventDefault();
      const drag = dragging;
      const toId = drag.type === "config" ? attr(item, "promptListId") || attr(item, "aiListId") : attr(item, "flowModelId");
      onEnd();
      if (!toId || toId === drag.id) return;
      if (drag.type === "config") ports.reorderConfig(drag.kind, drag.id, toId);
      else ports.reorderFlow(drag.taskId, drag.id, toId);
    };
    root.addEventListener("dragstart", onStart);
    root.addEventListener("dragover", onOver);
    root.addEventListener("dragleave", onLeave);
    root.addEventListener("drop", onDrop);
    root.addEventListener("dragend", onEnd);
    const dispose = () => {
      root.removeEventListener("dragstart", onStart);
      root.removeEventListener("dragover", onOver);
      root.removeEventListener("dragleave", onLeave);
      root.removeEventListener("drop", onDrop);
      root.removeEventListener("dragend", onEnd);
      onEnd();
      if (bindings$2.get(root) === dispose) bindings$2.delete(root);
    };
    bindings$2.set(root, dispose);
    return dispose;
  }
  const reorderInteraction = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    bind: bind$2
  }, Symbol.toStringTag, { value: "Module" }));
  const bindings$1 = /* @__PURE__ */ new WeakMap();
  function closest(event, selector) {
    const target = event.target;
    return typeof target?.closest === "function" ? target.closest(selector) : null;
  }
  function debounceInput(target, delay, onValue) {
    if (!target) return () => {
    };
    let timer = null;
    const handler = (event) => {
      const input = event.target;
      const value = String(input?.value || "");
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        onValue(value);
      }, delay);
    };
    target.addEventListener("input", handler);
    return () => {
      target.removeEventListener("input", handler);
      if (timer !== null) clearTimeout(timer);
    };
  }
  function bind$1(root, ports) {
    bindings$1.get(root)?.();
    const disposers = [];
    const listen = (target, name, fn, passive = false) => {
      if (!target) return;
      target.addEventListener(name, fn, passive ? { passive: true } : void 0);
      disposers.push(() => target.removeEventListener(name, fn));
    };
    const list = root.querySelector('[data-role="list"]');
    listen(list, "change", (event) => {
      const group = closest(event, 'input[type="checkbox"][data-group-check]');
      if (group) {
        ports.selectGroup(group.getAttribute("data-group-check") || "", !!group.checked);
        return;
      }
      const item = closest(event, 'input[type="checkbox"][data-i]');
      if (item) ports.selectItem(Number(item.getAttribute("data-i")), !!item.checked);
    });
    listen(list, "click", (event) => {
      const folder = closest(event, "[data-folder-toggle]");
      if (folder) {
        event.preventDefault();
        event.stopPropagation();
        ports.toggleFolder(folder.getAttribute("data-folder-toggle") || "");
        return;
      }
      if (closest(event, 'input[type="checkbox"]') || closest(event, ".bsb-resource-folder")) return;
      const item = closest(event, "[data-transcript-i]");
      if (item) ports.openItem(Number(item.dataset.transcriptI));
    });
    disposers.push(debounceInput(
      root.querySelector('[data-role="library-search"]'),
      70,
      (value) => ports.searchLibrary(value.trim())
    ));
    listen(root.querySelector('[data-role="library-filters"]'), "click", (event) => {
      const button = closest(event, "[data-library-filter]");
      if (button) ports.filterLibrary(button.dataset.libraryFilter || "all");
    });
    disposers.push(debounceInput(
      root.querySelector('[data-role="transcript-search"]'),
      80,
      (value) => ports.searchTranscript(value.trim())
    ));
    listen(root.querySelector('[data-role="transcript-track"]'), "change", (event) => {
      ports.switchTrack(Number(event.target?.value));
    });
    const follow = root.querySelector('[data-role="transcript-follow"]');
    if (follow) follow.checked = ports.followEnabled();
    listen(follow, "change", (event) => {
      ports.setFollow(!!event.target?.checked);
    });
    const transcript2 = root.querySelector('[data-role="transcript-list"]');
    listen(transcript2, "click", (event) => {
      const time = closest(event, "[data-transcript-time]");
      if (time) ports.seekTranscript(Number(time.dataset.transcriptTime));
    });
    listen(transcript2, "wheel", () => ports.recordUserScroll(), true);
    listen(transcript2, "touchmove", () => ports.recordUserScroll(), true);
    const dispose = () => {
      disposers.splice(0).forEach((fn) => fn());
      if (bindings$1.get(root) === dispose) bindings$1.delete(root);
    };
    bindings$1.set(root, dispose);
    return dispose;
  }
  const resourceInteraction = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    bind: bind$1
  }, Symbol.toStringTag, { value: "Module" }));
  function record$1(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
  }
  function numberOrDefault(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }
  function allowed(value, options, fallback) {
    return typeof value === "string" && options.includes(value) ? value : fallback;
  }
  function normalizeNoteFont(value, savedDefault, options) {
    const n = Number(value);
    if (!Number.isFinite(n)) return options.noteFontDefault;
    const clamped = Math.max(options.noteFontMin, Math.min(options.noteFontMax, n));
    if (Number(savedDefault) !== options.noteFontDefault && clamped === 17) return options.noteFontDefault;
    return clamped;
  }
  function clampKnowledgeRailWidth(value, panelWidth = 520) {
    const max = Math.max(300, Math.floor(Number(panelWidth) || 520) - 40);
    return Math.min(max, Math.max(280, Number(value) || 400));
  }
  function clampKnowledgeNavWidth(value, panelWidth = 520, sizePreset = "") {
    const def = sizePreset === "small" || sizePreset === "medium" ? 240 : 280;
    const max = Math.max(200, Math.floor((Number(panelWidth) || 520) * 0.48));
    return Math.min(max, Math.max(200, Number(value) || def));
  }
  function defaultUiGeometry(options) {
    const sizePreset = options.defaultSizePreset;
    const w = options.presetWidth(sizePreset, options.viewportWidth);
    const h = options.highHeight(options.viewportHeight);
    return {
      x: Math.max(8, options.viewportWidth - w - 16),
      y: Math.max(8, Math.floor((options.viewportHeight - h) / 2)),
      w,
      h,
      sizePreset,
      heightMode: "high",
      dock: null,
      dockExpanded: false,
      view: "ai",
      aiStage: "preprocess",
      settingsTab: "prompt",
      promptStage: "preprocess",
      noteFont: options.noteFontDefault,
      ctpFlavor: options.defaultFlavor,
      knowledgeRailW: 400,
      knowledgeNavW: 280,
      knowledgeContextOpen: false
    };
  }
  function loadUiGeometry(raw, options) {
    const defaults = defaultUiGeometry(options);
    if (!raw) return defaults;
    try {
      const saved = record$1(JSON.parse(raw));
      const hasPreset = options.isPreset(saved.sizePreset) || saved.sizePreset === "custom";
      const sizePreset = hasPreset ? String(saved.sizePreset) : options.defaultSizePreset;
      const heightMode = hasPreset && saved.heightMode === "custom" ? "custom" : "high";
      const w = options.isPreset(sizePreset) ? options.presetWidth(sizePreset, options.viewportWidth) : Math.max(options.minWidth, Number(saved.w) || defaults.w);
      const h = heightMode === "high" ? options.highHeight(options.viewportHeight) : Math.max(options.minHeight, Number(saved.h) || defaults.h);
      return {
        x: numberOrDefault(saved.x, defaults.x),
        y: numberOrDefault(saved.y, defaults.y),
        w,
        h,
        sizePreset,
        heightMode,
        dock: saved.dock === "left" || saved.dock === "right" ? saved.dock : null,
        dockExpanded: false,
        view: allowed(saved.view, ["ai", "subs", "knowledge", "settings"], "ai"),
        aiStage: allowed(saved.aiStage, ["preprocess", "chat", "postprocess"], "preprocess"),
        settingsTab: allowed(saved.settingsTab, ["prompt", "llm", "shortcuts", "appearance"], "prompt"),
        promptStage: allowed(saved.promptStage, ["preprocess", "postprocess", "knowledge"], "preprocess"),
        noteFont: normalizeNoteFont(saved.noteFont, saved.noteFontDefault, options),
        ctpFlavor: options.normalizeFlavor(saved.ctpFlavor ?? defaults.ctpFlavor),
        knowledgeRailW: clampKnowledgeRailWidth(saved.knowledgeRailW ?? defaults.knowledgeRailW, w),
        // Keep historical width migration. Initial load does not yet have state.ui.
        knowledgeNavW: clampKnowledgeNavWidth(
          saved.knowledgeNavW ?? saved.knowledgeListW ?? defaults.knowledgeNavW,
          w,
          options.currentSizePreset
        ),
        knowledgeContextOpen: saved.knowledgeContextOpen === true
      };
    } catch {
      return defaults;
    }
  }
  function serializeUiGeometry(ui2, options) {
    return JSON.stringify({
      x: ui2.x,
      y: ui2.y,
      w: ui2.w,
      h: ui2.h,
      sizePreset: ui2.sizePreset || options.defaultSizePreset,
      heightMode: ui2.heightMode === "custom" ? "custom" : "high",
      dock: ui2.dock,
      view: ui2.view || "ai",
      aiStage: ui2.aiStage || "preprocess",
      settingsTab: ui2.settingsTab || "prompt",
      promptStage: ui2.promptStage || "preprocess",
      noteFont: normalizeNoteFont(ui2.noteFont, options.noteFontDefault, options),
      noteFontDefault: options.noteFontDefault,
      ctpFlavor: options.normalizeFlavor(ui2.ctpFlavor),
      knowledgeRailW: clampKnowledgeRailWidth(ui2.knowledgeRailW, ui2.w),
      knowledgeNavW: clampKnowledgeNavWidth(ui2.knowledgeNavW, ui2.w, options.currentSizePreset),
      knowledgeContextOpen: ui2.knowledgeContextOpen === true
    });
  }
  const persistence = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    clampKnowledgeNavWidth,
    clampKnowledgeRailWidth,
    defaultUiGeometry,
    loadUiGeometry,
    normalizeNoteFont,
    serializeUiGeometry
  }, Symbol.toStringTag, { value: "Module" }));
  const bindings = /* @__PURE__ */ new WeakMap();
  function bind(root, ports, defaults) {
    bindings.get(root)?.();
    const disposers = [];
    const listen = (element2, name, action) => {
      if (!element2) return;
      element2.addEventListener(name, action);
      disposers.push(() => element2.removeEventListener(name, action));
    };
    const onValue = (selector, action) => {
      listen(root.querySelector(selector), "change", (event) => {
        action(String(event.target?.value || ""));
      });
    };
    const onCheck = (selector, initial, action) => {
      const input = root.querySelector(selector);
      if (input) input.checked = initial;
      listen(input, "change", (event) => {
        action(Boolean(event.target?.checked));
      });
    };
    const debounceInput2 = (selector, delayMs, action) => {
      const element2 = root.querySelector(selector);
      if (!element2) return;
      let timer = null;
      const handler = (event) => {
        const value = String(event.target?.value || "");
        if (timer !== null) clearTimeout(timer);
        timer = setTimeout(() => {
          timer = null;
          action(value);
        }, delayMs);
      };
      listen(element2, "input", handler);
      disposers.push(() => {
        if (timer !== null) clearTimeout(timer);
      });
    };
    root.querySelectorAll("[data-view]").forEach((button) => {
      listen(button, "click", () => ports.selectWorkspace(button.getAttribute("data-view") || ""));
    });
    onValue('[data-role="max-pages"]', (value) => ports.maxPages(Math.max(1, Math.min(100, Number(value) || defaults.maxPages))));
    onValue('[data-role="delay"]', (value) => ports.delayMs(Math.max(0, Math.min(5e3, Number(value) || defaults.delayMs))));
    onCheck('[data-role="auto-capture"]', defaults.autoCapture, ports.autoCapture);
    onCheck('[data-role="auto-analyze"]', defaults.autoAnalyze, ports.autoAnalyze);
    onCheck('[data-role="player-subtitle"]', defaults.playerSubtitle, ports.playerSubtitle);
    onValue('[data-role="mode"]', (value) => ports.mode(value || "auto"));
    onValue('[data-role="prompt-select"]', ports.promptSelect);
    onCheck('[data-role="preprocess-enabled"]', defaults.preprocessEnabled, ports.preprocessEnabled);
    onValue('[data-role="preprocess-prompt-select"]', ports.preprocessPrompt);
    onValue('[data-role="preprocess-model-select"]', ports.preprocessModel);
    debounceInput2('[data-role="prompt-search"]', 60, ports.promptSearch);
    debounceInput2('[data-role="ai-search"]', 60, ports.aiSearch);
    debounceInput2('[data-role="knowledge-search"]', 70, ports.knowledgeSearch);
    const dispose = () => {
      disposers.splice(0).forEach((remove) => remove());
      if (bindings.get(root) === dispose) bindings.delete(root);
    };
    bindings.set(root, dispose);
    return dispose;
  }
  const flowBindings = /* @__PURE__ */ new WeakMap();
  function bindFlowChanges(root, ports) {
    flowBindings.get(root)?.();
    const onChange = (event) => {
      const target = event.target;
      if (!target || typeof target.closest !== "function") return;
      const near = (selector) => target.closest(selector);
      const shortcut2 = near("[data-shortcut-pref]");
      if (shortcut2) {
        const key = shortcut2.dataset.shortcutPref || "";
        if (key === "enabled" || key === "summonLayout" || key === "summonTarget" || key === "preferredDock") {
          ports.shortcutPreference(key, shortcut2.value, shortcut2.checked);
        }
        return;
      }
      const knowledge2 = near('[data-role="knowledge-model"]');
      if (knowledge2) {
        ports.knowledgeModel(knowledge2.value);
        return;
      }
      const preEnabled = near("[data-flow-preprocess-enabled]");
      if (preEnabled) {
        ports.preprocessEnabled(preEnabled.checked);
        return;
      }
      const changes = [
        { selector: "[data-flow-preprompt]", handle: ports.preprocessPrompt },
        { selector: "[data-flow-premodel]", handle: ports.preprocessModel },
        { selector: "[data-flow-preconcurrency]", handle: ports.preprocessConcurrency },
        { selector: "[data-flow-pretarget-minutes]", handle: ports.preprocessTargetMinutes },
        { selector: "[data-flow-preoverlap-seconds]", handle: ports.preprocessOverlapSeconds },
        { selector: "[data-flow-premax-chars]", handle: ports.preprocessMaxChars },
        { selector: "[data-flow-preretries]", handle: ports.preprocessRetries },
        { selector: "[data-flow-studiomodel]", handle: ports.studioModel },
        { selector: "[data-flow-studiocontext]", handle: ports.studioContext }
      ];
      for (const change of changes) {
        const match = near(change.selector);
        if (!match) continue;
        change.handle(match.value);
        return;
      }
      const card = near("[data-flow-task-id]");
      const prompt2 = near("[data-flow-task-prompt]");
      if (card && prompt2 && card.contains(prompt2)) {
        const taskId = card.dataset.flowTaskId || "";
        if (taskId) ports.taskPrompt(taskId, prompt2.value);
      }
    };
    root.addEventListener("change", onChange);
    const dispose = () => {
      root.removeEventListener("change", onChange);
      if (flowBindings.get(root) === dispose) flowBindings.delete(root);
    };
    flowBindings.set(root, dispose);
    return dispose;
  }
  const settingsInteraction = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    bind,
    bindFlowChanges
  }, Symbol.toStringTag, { value: "Module" }));
  const ui = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    aiStyles,
    folioStyles,
    knowledgeAnswerView,
    knowledgeDrilldownStyles: knowledgeStyles,
    knowledgeNavigation: knowledgeNavigationController,
    knowledgeReader: knowledgeReaderController,
    knowledgeTreeRenderer,
    knowledgeWorkspaceStyles,
    lateStudioStyles: lateStyles,
    libraryController,
    panelChrome: chromeController,
    panelGeometry: geometry,
    panelInteraction: interaction,
    panelMarkup: markup$1,
    panelPersistence: persistence,
    panelPointer: pointerController,
    panelState: state,
    panelStyles: styles,
    readingStyles,
    reorderInteraction,
    resourceInteraction,
    settingsInteraction,
    settingsStyles,
    studioController,
    studioInteractionController,
    subsStyles,
    transcriptController,
    workspaceControlsStyles: controlsStyles,
    workspaceLayoutStyles: layoutStyles,
    workspaceMarkup: markup,
    workspaceOverrides: workspaceOverridesStyles
  }, Symbol.toStringTag, { value: "Module" }));
  function parseResponseHeaders(raw) {
    const headers = {};
    for (const line of String(raw || "").split(/\r?\n/)) {
      const separator = line.indexOf(":");
      if (separator <= 0) continue;
      headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
    }
    return headers;
  }
  async function readFetchStream(response, onChunk, signal) {
    if (!onChunk) {
      return response.text();
    }
    if (!response.body) {
      const text2 = await response.text();
      if (text2) onChunk(text2);
      return text2;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    try {
      while (true) {
        if (signal?.aborted) {
          await reader.cancel();
          throw new DOMException("Aborted", "AbortError");
        }
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        text += chunk;
        onChunk(chunk);
      }
      const tail = decoder.decode();
      if (tail) {
        text += tail;
        onChunk(tail);
      }
      return text;
    } catch (error) {
      try {
        await reader.cancel();
      } catch {
      }
      throw error;
    }
  }
  class FetchNetworkError extends Error {
    cause;
    constructor(cause) {
      super(cause instanceof Error ? cause.message : String(cause));
      this.name = "FetchNetworkError";
      this.cause = cause;
    }
  }
  async function fetchRequest(pageWindow, url, request2 = {}) {
    let response;
    try {
      const fetchFn = pageWindow.fetch || fetch;
      response = await fetchFn.call(pageWindow, url, {
        ...request2.method ? { method: request2.method } : {},
        ...request2.headers ? { headers: request2.headers } : {},
        ...request2.body !== void 0 ? { body: request2.body } : {},
        ...request2.signal ? { signal: request2.signal } : {},
        ...request2.credentials ? { credentials: request2.credentials } : {},
        ...request2.cache ? { cache: request2.cache } : {}
      });
    } catch (error) {
      throw new FetchNetworkError(error);
    }
    const headers = Object.fromEntries(response.headers.entries());
    const useStream = request2.stream === true && typeof request2.onChunk === "function";
    const text = useStream ? await readFetchStream(response, request2.onChunk, request2.signal) : await response.text();
    return {
      status: response.status,
      ok: response.ok,
      text,
      headers
    };
  }
  function privilegedRequest(url, request2 = {}) {
    if (typeof GM_xmlhttpRequest !== "function") {
      return Promise.reject(new Error("GM_xmlhttpRequest is unavailable"));
    }
    if (request2.signal?.aborted) {
      return Promise.reject(new DOMException("Aborted", "AbortError"));
    }
    const useStream = request2.stream === true && typeof request2.onChunk === "function";
    return new Promise((resolve2, reject) => {
      let lastLength = 0;
      let settled = false;
      const requestHandle = {};
      const onAbort = () => {
        try {
          requestHandle.current?.abort?.();
        } catch {
        }
        fail(new DOMException("Aborted", "AbortError"));
      };
      const cleanup = () => request2.signal?.removeEventListener("abort", onAbort);
      const finish = (response) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve2(response);
      };
      const fail = (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      const emitChunk = (chunk) => {
        if (!chunk || settled) return !settled;
        try {
          request2.onChunk?.(chunk);
          return true;
        } catch (error) {
          fail(error);
          try {
            requestHandle.current?.abort?.();
          } catch {
          }
          return false;
        }
      };
      const details = {
        url,
        ...request2.method ? { method: request2.method } : {},
        ...request2.headers ? { headers: request2.headers } : {},
        ...request2.body !== void 0 ? { data: request2.body } : {},
        onload: (response) => {
          const text = String(response.responseText || "");
          if (useStream && text.length > lastLength) {
            if (!emitChunk(text.slice(lastLength))) return;
            lastLength = text.length;
          }
          finish({
            status: response.status,
            ok: response.status >= 200 && response.status < 300,
            text,
            headers: parseResponseHeaders(response.responseHeaders)
          });
        },
        onerror: (error) => fail(error),
        onabort: () => fail(new DOMException("Aborted", "AbortError"))
      };
      if (useStream) {
        details.responseType = "text";
        details.onprogress = (response) => {
          const full = String(response.responseText || "");
          if (full.length > lastLength) {
            if (!emitChunk(full.slice(lastLength))) return;
            lastLength = full.length;
          }
        };
      }
      request2.signal?.addEventListener("abort", onAbort, { once: true });
      requestHandle.current = GM_xmlhttpRequest(details);
      if (settled) cleanup();
    });
  }
  function mayReplayAcrossTransports(request2) {
    if (request2.transport === "page" || request2.transport === "privileged") return false;
    const method = String(request2.method || "GET").toUpperCase();
    return method === "GET" || method === "HEAD" || method === "OPTIONS";
  }
  function registerShortcuts(bindings2, options = {}) {
    return shortcut.register(bindings2, {
      ...options,
      target: document,
      capture: true,
      stopOnMatch: true
    });
  }
  function resolvePageWindow() {
    return typeof unsafeWindow !== "undefined" && unsafeWindow ? unsafeWindow : window;
  }
  function pageHrefOf(pageWindow) {
    try {
      return String(pageWindow.location?.href || location.href);
    } catch {
      return location.href;
    }
  }
  function onNavigate(listener) {
    const pageWindow = resolvePageWindow();
    const handle = spa.observe(
      {
        historyWindow: pageWindow,
        eventWindow: pageWindow,
        documentRef: document,
        // Prefer page/unsafeWindow location so SPA history and href stay aligned.
        getHref: () => pageHrefOf(pageWindow),
        pollIntervalMs: 2e3
      },
      listener
    );
    return () => handle.dispose();
  }
  function createUserscriptHost() {
    const pageWindow = resolvePageWindow();
    return {
      storageGet: (key, fallback) => typeof GM_getValue === "function" ? GM_getValue(key, fallback) : fallback,
      storageSet: (key, value) => {
        if (typeof GM_setValue === "function") GM_setValue(key, value);
      },
      storageRemove: (key) => {
        if (typeof GM_deleteValue === "function") GM_deleteValue(key);
      },
      request: async (url, request2) => {
        if (request2?.transport === "privileged") {
          return privilegedRequest(url, request2);
        }
        if (request2?.transport !== "page" && new URL(url, pageHrefOf(pageWindow)).hostname === "aisubtitle.hdslb.com") {
          return privilegedRequest(url, request2);
        }
        try {
          const response = await fetchRequest(pageWindow, url, request2);
          if (!response.ok && request2?.fallback === "network-or-http" && mayReplayAcrossTransports(request2)) {
            return privilegedRequest(url, request2);
          }
          return response;
        } catch (error) {
          if (request2?.signal?.aborted) throw error;
          if (error instanceof FetchNetworkError && request2?.fallback !== "never" && mayReplayAcrossTransports(request2 ?? {})) {
            return privilegedRequest(url, request2);
          }
          throw error;
        }
      },
      writeClipboard: async (text) => {
        if (typeof GM_setClipboard === "function") GM_setClipboard(text);
        else await navigator.clipboard.writeText(text);
      },
      addStyle: (css) => {
        if (typeof GM_addStyle === "function") {
          GM_addStyle(css);
          return;
        }
        const style = document.createElement("style");
        style.textContent = css;
        document.head.appendChild(style);
      },
      pageWindow,
      pageHref: () => pageHrefOf(pageWindow),
      registerShortcuts,
      onNavigate
    };
  }
  function parseMermaidViewBox(svg) {
    const raw = String(svg?.getAttribute("viewBox") || "").trim();
    const [x = 0, y = 0, w = 0, h = 0] = raw.split(/[\s,]+/).map(Number);
    const values = [x, y, w, h];
    if (values.length === 4 && values.every(Number.isFinite) && w > 0 && h > 0) {
      return { x, y, width: w, height: h };
    }
    const width = Number.parseFloat(svg?.getAttribute("width") || "") || 960;
    const height = Number.parseFloat(svg?.getAttribute("height") || "") || 540;
    return { x: 0, y: 0, width, height };
  }
  function getMermaidScale(card) {
    const scale = Number(card?.dataset?.scale);
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
  }
  function updateMermaidScaleLabel(card) {
    const label = card?.querySelector(".bsb-mermaid-scale");
    if (label)
      label.textContent = `${Math.round(getMermaidScale(card) * 100)}%`;
  }
  function setMermaidScale(card, scale, mode = "manual") {
    if (!card)
      return;
    const stage = card.querySelector(".bsb-mermaid-stage");
    if (!stage)
      return;
    const baseWidth = Number(stage.dataset.baseWidth) || 760;
    const next = Math.max(0.35, Math.min(3, Number(scale) || 1));
    card.dataset.scale = String(next);
    card.dataset.fit = mode;
    stage.style.setProperty("--bsb-mermaid-width", `${Math.max(240, Math.round(baseWidth * next))}px`);
    updateMermaidScaleLabel(card);
  }
  function fitMermaidToViewport(card) {
    const viewport = card?.querySelector(".bsb-mermaid-viewport");
    const stage = card?.querySelector(".bsb-mermaid-stage");
    if (!viewport || !stage)
      return;
    const baseWidth = Number(stage.dataset.baseWidth) || 760;
    const available = Math.max(240, viewport.clientWidth - 36);
    setMermaidScale(card, Math.min(1.5, available / baseWidth), "fit");
    viewport.scrollLeft = 0;
    viewport.scrollTop = 0;
  }
  function buildMermaidCard(svg, idx, host2) {
    svg.classList.add("bsb-mermaid-svg");
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.setAttribute("preserveAspectRatio", "xMinYMin meet");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `架构流程图 ${idx + 1}`);
    const viewBox = parseMermaidViewBox(svg);
    if (!svg.hasAttribute("viewBox"))
      svg.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
    const baseWidth = Math.round(Math.max(760, Math.min(3600, viewBox.width)));
    const card = document.createElement("section");
    card.className = "bsb-mermaid-card";
    card.dataset.scale = "1";
    card.dataset.fit = "actual";
    const toolbar = document.createElement("div");
    toolbar.className = "bsb-mermaid-toolbar";
    const title = document.createElement("span");
    title.className = "bsb-mermaid-title";
    const repaired = !!host2?._bsbMermaidJob?.repaired;
    title.textContent = `架构流程图 ${idx + 1}${repaired ? " · AI 已修复" : ""} · 可滚动查看`;
    const tools = document.createElement("span");
    tools.className = "bsb-mermaid-tools";
    const makeButton = (toolAction, text, titleText) => {
      const toolButton = document.createElement("button");
      toolButton.type = "button";
      toolButton.className = "bsb-mermaid-tool";
      toolButton.dataset.mmdAct = toolAction;
      toolButton.textContent = text;
      toolButton.title = titleText;
      toolButton.setAttribute("aria-label", titleText);
      return toolButton;
    };
    tools.append(makeButton("fit", "适宽", "适应可视区域宽度"), makeButton("actual", "100%", "恢复清晰原始尺寸"), makeButton("zoom-out", "−", "缩小图表"));
    const scaleLabel = document.createElement("span");
    scaleLabel.className = "bsb-mermaid-scale";
    scaleLabel.textContent = "100%";
    tools.append(scaleLabel, makeButton("zoom-in", "+", "放大图表"), makeButton("retry", "重绘", "先重试渲染；若语法失败则只修复该 Mermaid 代码块"), makeButton("fullscreen", "全屏", "全屏查看"));
    toolbar.append(title, tools);
    const viewport = document.createElement("div");
    viewport.className = "bsb-mermaid-viewport";
    viewport.tabIndex = 0;
    viewport.setAttribute("aria-label", "可滚动和缩放的 Mermaid 图表");
    const stage = document.createElement("div");
    stage.className = "bsb-mermaid-stage";
    stage.dataset.baseWidth = String(baseWidth);
    stage.style.setProperty("--bsb-mermaid-width", `${baseWidth}px`);
    stage.appendChild(svg);
    const hint = document.createElement("span");
    hint.className = "bsb-mermaid-hint";
    hint.textContent = "Ctrl + 滚轮缩放";
    viewport.append(stage, hint);
    card.append(toolbar, viewport);
    card._bsbMermaidHost = host2 || null;
    card._bsbMermaidJob = host2?._bsbMermaidJob || null;
    return card;
  }
  function createMermaidFullscreen(ports) {
    function closeMermaidFullscreen() {
      const root = ports.root();
      const modal = root?.querySelector(".bsb-mermaid-modal");
      if (!modal)
        return;
      const card = modal.querySelector(".bsb-mermaid-card");
      const placeholder = card?._bsbMermaidPlaceholder;
      if (card && placeholder?.parentNode) {
        card.classList.remove("is-fullscreen");
        placeholder.replaceWith(card);
        card._bsbMermaidPlaceholder = null;
        const full = card.querySelector('[data-mmd-act="fullscreen"]');
        if (full) {
          full.textContent = "全屏";
          full.title = "全屏查看";
        }
      }
      modal.remove();
    }
    function openMermaidFullscreen(card) {
      if (!card || card.closest(".bsb-mermaid-modal"))
        return;
      closeMermaidFullscreen();
      const root = ports.root();
      if (!root)
        return;
      const placeholder = document.createComment("bsb-mermaid-placeholder");
      card.before(placeholder);
      card._bsbMermaidPlaceholder = placeholder;
      const modal = document.createElement("div");
      modal.className = "bsb-mermaid-modal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-label", "Mermaid 图表全屏查看");
      modal.addEventListener("click", (e) => {
        if (e.target === modal)
          closeMermaidFullscreen();
      });
      card.classList.add("is-fullscreen");
      const full = card.querySelector('[data-mmd-act="fullscreen"]');
      if (full) {
        full.textContent = "退出";
        full.title = "退出全屏";
      }
      modal.appendChild(card);
      root.appendChild(modal);
      ports.requestFrame(() => fitMermaidToViewport(card));
    }
    return { closeMermaidFullscreen, openMermaidFullscreen };
  }
  function record(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  }
  function strings(value) {
    return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
  }
  function normalizeCachedSessionInput(value) {
    const input = record(value);
    const vars = record(input?.vars);
    if (!input || !vars || typeof vars.subtitle !== "string") return null;
    const meta = record(input.commonMeta);
    return {
      ...input,
      sessionId: Number(input.sessionId) || 0,
      routeKey: String(input.routeKey || ""),
      vars: { ...vars, subtitle: vars.subtitle },
      promptProfile: record(input.promptProfile),
      preprocessPrompt: record(input.preprocessPrompt),
      preprocessConfig: record(input.preprocessConfig),
      preprocessEnabled: !!input.preprocessEnabled,
      taskSnapshots: Array.isArray(input.taskSnapshots) ? input.taskSnapshots.flatMap((entry) => {
        const snapshot = record(entry);
        if (!snapshot) return [];
        const task = record(snapshot.task);
        return [{
          task: task ? { ...task, modelIds: strings(task.modelIds) } : null,
          prompt: record(snapshot.prompt)
        }];
      }) : [],
      commonMeta: { ...meta, sourceBvids: strings(meta?.sourceBvids) }
    };
  }
  function applyRestoredRunOutput(target, draft) {
    return Object.assign(target, {
      raw: draft.raw,
      status: draft.status,
      statusText: draft.statusText,
      error: draft.error,
      sourceIds: [...draft.sourceIds],
      sourceBvids: [...draft.sourceBvids],
      startedAt: draft.startedAt,
      finishedAt: draft.finishedAt,
      scrollTop: draft.scrollTop,
      busy: false,
      mermaidRepairing: false
    });
  }
  function restorePreprocessRun(snapshot, runtime2) {
    return {
      runtime: runtime2,
      childRuntimes: /* @__PURE__ */ new Set(),
      busy: false,
      raw: snapshot.raw || "",
      text: snapshot.text || snapshot.raw || "",
      preview: snapshot.preview || "",
      status: snapshot.status === "error" ? "error" : snapshot.status === "stopped" ? "stopped" : "done",
      statusText: snapshot.statusText || "缓存",
      modelName: snapshot.modelName || "",
      promptName: snapshot.promptName || "",
      cacheHits: snapshot.cacheHits || 0,
      total: snapshot.total || 0,
      totalChunks: snapshot.totalChunks || 0,
      completedChunks: snapshot.completedChunks || 0,
      settings: settings({
        preprocessConcurrency: snapshot.settings?.concurrency,
        preprocessTargetMinutes: snapshot.settings?.targetMinutes,
        preprocessOverlapSeconds: snapshot.settings?.overlapSeconds,
        preprocessMaxChars: snapshot.settings?.maxChars,
        preprocessRetries: snapshot.settings?.retries
      })
    };
  }
  function resolveAiScrollState(s, ev) {
    let stick = !!s.stick;
    let userReading = !!s.userReading;
    const prog = !!s.progScroll;
    const type = ev && ev.type || "";
    const gap = ev && typeof ev.gap === "number" ? ev.gap : null;
    if (type === "start" || type === "resume") {
      stick = true;
      userReading = false;
    } else if (type === "wheel-up" || type === "detach") {
      stick = false;
      userReading = true;
    } else if (type === "scroll") {
      if (prog) ;
      else if (gap != null && gap > 24) {
        stick = false;
        userReading = true;
      } else if (gap != null && gap <= 12 && userReading) {
        stick = true;
        userReading = false;
      }
    }
    const allowPaintScroll = stick && !userReading;
    return { stick, userReading, allowPaintScroll };
  }
  function readSessionCache(storage, prefix, kind, key, ttlMs, now = Date.now()) {
    try {
      const fullKey = prefix + kind + ":" + key;
      const raw = storage().getItem(fullKey);
      if (!raw) return null;
      const record2 = JSON.parse(raw);
      if (!record2 || now - Number(record2.at || 0) > ttlMs) {
        storage().removeItem(fullKey);
        return null;
      }
      return record2.value;
    } catch {
      return null;
    }
  }
  function writeSessionCache(storage, prefix, kind, key, value, now = Date.now()) {
    try {
      storage().setItem(prefix + kind + ":" + key, JSON.stringify({ at: now, value }));
    } catch {
    }
  }
  function createPersistentCache(options) {
    let databasePromise = null;
    let channel = null;
    const now = options.now || Date.now;
    function open() {
      if (databasePromise) return databasePromise;
      databasePromise = new Promise((resolve2, reject) => {
        const factory = options.indexedDb();
        if (!factory) return reject(new Error("IndexedDB unavailable"));
        const request2 = factory.open(options.databaseName, options.databaseVersion);
        request2.onupgradeneeded = () => {
          const db = request2.result;
          if (!db.objectStoreNames.contains(options.storeName)) {
            db.createObjectStore(options.storeName, { keyPath: "key" });
          }
        };
        request2.onsuccess = () => resolve2(request2.result);
        request2.onerror = () => reject(request2.error || new Error("cache database open failed"));
      }).catch((error) => {
        databasePromise = null;
        throw error;
      });
      return databasePromise;
    }
    async function remove(key) {
      try {
        const db = await open();
        await new Promise((resolve2, reject) => {
          const tx = db.transaction(options.storeName, "readwrite");
          tx.objectStore(options.storeName).delete(key);
          tx.oncomplete = () => resolve2();
          tx.onerror = () => reject(tx.error);
        });
      } catch {
      }
    }
    async function read(key) {
      try {
        const db = await open();
        const record2 = await new Promise((resolve2, reject) => {
          const tx = db.transaction(options.storeName, "readonly");
          const req = tx.objectStore(options.storeName).get(key);
          req.onsuccess = () => resolve2(req.result || null);
          req.onerror = () => reject(req.error);
        });
        if (!record2) return null;
        if (Number(record2.expiresAt || 0) < now()) {
          void remove(key);
          return null;
        }
        return record2;
      } catch {
        return null;
      }
    }
    async function write(key, value, ttlMs) {
      const record2 = { key, value, updatedAt: now(), expiresAt: now() + ttlMs };
      try {
        const db = await open();
        await new Promise((resolve2, reject) => {
          const tx = db.transaction(options.storeName, "readwrite");
          tx.objectStore(options.storeName).put(record2);
          tx.oncomplete = () => resolve2();
          tx.onerror = () => reject(tx.error);
        });
        channel?.postMessage({ type: "cache-updated", key, updatedAt: record2.updatedAt });
      } catch {
      }
      return record2;
    }
    function initChannel() {
      if (channel) return;
      try {
        const Constructor = options.broadcastChannel();
        if (!Constructor) return;
        channel = new Constructor(options.channelName);
        channel.addEventListener("message", (event) => {
          const msg = event.data;
          if (!msg || msg.type !== "cache-updated" || !String(msg.key).startsWith("subtitle:")) return;
          options.onSubtitleChanged(String(msg.key).slice("subtitle:".length));
        });
      } catch {
      }
    }
    return { read, write, remove, initChannel };
  }
  function createWorkbenchState(defaults) {
    return {
      open: false,
      // busy 仅作旧状态栏兼容；真实互斥由 scanBusy / batchBusy 分别管理。
      busy: false,
      scanBusy: false,
      batchBusy: false,
      scanSeq: 0,
      batchSeq: 0,
      cancel: false,
      // legacy bridge
      cancelScan: false,
      cancelBatch: false,
      scanPaused: false,
      batchPaused: false,
      libraryJob: { kind: "", index: 0, total: 0, label: "" },
      pendingRescan: false,
      pendingAiSend: false,
      mode: "auto",
      // auto | video | selection | user | favorite | collection | search
      autoCtx: null,
      ctx: null,
      items: [],
      // { bvid, title, author, page, selected, groupType?, groupKey?, … }
      /** groupKey -> true when folder is collapsed */
      libraryFolderCollapsed: {},
      meta: {},
      delayMs: defaults.delayMs,
      maxPages: defaults.maxPages,
      ui: null,
      // geometry + dock
      aiFocus: false,
      // AI 专注阅读：铺满视口并隐藏非阅读控件
      ai: null,
      // active/legacy-compatible config
      aiProfiles: [],
      // persisted model configurations
      promptProfiles: [],
      // user-editable prompt templates (preprocess + postprocess)
      activePromptId: "",
      // active postprocess prompt
      activePrePromptId: "",
      // active preprocess prompt
      activeKnowledgePromptId: "",
      // Knowledge Drill-down prompt
      preprocessEnabled: defaults.preprocessEnabled,
      preprocessModelId: defaults.preprocessModelId,
      preprocessConcurrency: defaults.preprocessConcurrency,
      preprocessTargetMinutes: defaults.preprocessTargetMinutes,
      preprocessOverlapSeconds: defaults.preprocessOverlapSeconds,
      preprocessMaxChars: defaults.preprocessMaxChars,
      preprocessRetries: defaults.preprocessRetries,
      preprocessRun: null,
      // shared subtitle normalization stage for current session
      studioBusy: false,
      studioRuntime: null,
      studioMessages: [],
      studioMemory: "",
      studioMemoryUntilId: "",
      studioMemoryTurns: 0,
      studioLastContextMeta: null,
      studioContextPref: "auto",
      // auto | raw | processed
      studioModelId: defaults.studioModelId,
      studioSlashIndex: 0,
      forcePreprocessOnce: false,
      aiViewingPreprocess: false,
      // legacy bridge; v5.8 input preview lives in drawer
      postTasks: [],
      // output artifacts: each POST Prompt + selected LLMs
      aiActiveTaskId: "",
      // first-level result navigation: output artifact
      aiDrawer: "",
      // "flow" | "input" | ""
      aiInputView: "raw",
      // raw | processed
      promptEditorId: "",
      // settings master-detail current prompt editor
      aiEditorId: "",
      // settings master-detail current LLM editor
      promptSearch: "",
      aiSearch: "",
      aiRuns: /* @__PURE__ */ new Map(),
      // current analysis session: runId -> independent runtime/result
      aiRunOrder: [],
      aiActiveRunId: "",
      aiSessionSeq: 0,
      // 当前批次已经组装好的共享输入。单模型/全部重新生成直接复用，不重新抓字幕。
      aiSessionInput: null,
      aiBusy: false,
      // true while any model run is active
      aiAbort: false,
      // stop-all / subtitle preparation flag
      aiRaw: "",
      // active result markdown buffer (legacy rendering bridge)
      aiXhr: null,
      // legacy field; model requests use per-run handles
      aiAbortController: null,
      // legacy field; model requests use per-run handles
      aiStickBottom: true,
      // 仅「跟随模式」时 paint 才改 scrollTop
      aiUserReading: false,
      // 用户主动离开底部后锁住，禁止自动回粘
      aiProgScroll: false,
      // 程序化滚动中，忽略 scroll 事件回写
      aiPaintRaf: 0,
      aiPaintTimer: 0,
      aiPendingText: "",
      aiRenderedText: "",
      aiStreamTextNode: null,
      renderEpoch: 0,
      renderLibs: { core: false, highlight: false, mermaid: false, katex: false },
      mermaidObserver: null,
      mermaidRenderSeq: 0,
      mermaidQueue: Promise.resolve(),
      mermaidRepairing: false,
      aiSourceBvids: [],
      autoCaptureEnabled: defaults.autoCaptureEnabled,
      autoCaptureKey: "",
      autoCaptureEpoch: 0,
      autoCaptureTimer: 0,
      autoCaptureAbortController: null,
      autoAnalyzeEnabled: defaults.autoAnalyzeEnabled,
      autoAnalyzeKey: "",
      autoAnalyzePendingKey: "",
      autoAnalyzeTimer: 0,
      aiSessionRouteKey: "",
      aiSessionRestorePromise: null,
      aiSessionRestoreKey: "",
      fastViewCache: /* @__PURE__ */ new Map(),
      fastTrackCache: /* @__PURE__ */ new Map(),
      fastSubtitleCache: /* @__PURE__ */ new Map(),
      fastTrackBodyCache: /* @__PURE__ */ new Map(),
      transcriptItemKey: "",
      transcriptItem: null,
      // 当前阅读字幕独立于扫描列表，扫描合集时不会被覆盖
      transcriptQuery: "",
      transcriptFilteredIndexes: null,
      transcriptActiveCueIndex: -1,
      transcriptTrackIndex: -1,
      transcriptAutoFollow: defaults.transcriptAutoFollow,
      autoEnablePlayerSubtitle: defaults.autoEnablePlayerSubtitle,
      playerSubtitleOperation: null,
      transcriptUserScrollUntil: 0,
      transcriptVideoAbort: null,
      transcriptSwitchAbort: null,
      transcriptRenderEpoch: 0,
      libraryQuery: "",
      libraryFilter: "all",
      // all | ok | wait | error | empty
      captureDrawerOpen: false,
      knowledgeAnchors: [],
      knowledgeNodes: [],
      knowledgeSearch: "",
      knowledgeActiveAnchorId: "",
      knowledgeActiveNodeId: "",
      knowledgeRailOpen: false,
      knowledgeTreeOpen: false,
      knowledgeSelection: null,
      knowledgeBusy: false,
      knowledgeResetScroll: false,
      knowledgeRuntime: null,
      knowledgePaintRaf: 0,
      knowledgeModelId: defaults.knowledgeModelId,
      shortcutConfig: defaults.shortcutConfig,
      shortcutRecordingId: ""
    };
  }
  function isRecord(value) {
    return value !== null && (typeof value === "object" || typeof value === "function");
  }
  function resolveAppMethod(registry, path) {
    if (!isRecord(registry) || !path) return null;
    const parts = path.split(".");
    if (parts.some((part) => !part || part === "__proto__" || part === "constructor" || part === "prototype")) {
      return null;
    }
    let cursor = registry;
    for (const part of parts) {
      if (!isRecord(cursor) || !Object.hasOwn(cursor, part)) return null;
      cursor = cursor[part];
    }
    return typeof cursor === "function" ? cursor : null;
  }
  function callApp(registry, path, ...args) {
    const fn = resolveAppMethod(registry, path);
    if (!fn) throw new Error("Application capability missing: " + path);
    return fn(...args);
  }
  function mountWorkbench(SubBatch2) {
    const { closeMermaidFullscreen, openMermaidFullscreen } = createMermaidFullscreen({
      root: () => document.getElementById(PANEL_ID),
      requestFrame: (callback) => requestAnimationFrame(callback)
    });
    function errorMessage(value) {
      if (value && typeof value === "object" && "message" in value && value.message) return String(value.message);
      return String(value);
    }
    function isAbortError2(value) {
      return !!value && typeof value === "object" && "name" in value && value.name === "AbortError";
    }
    function isMermaidSetupError(value) {
      return !!value && typeof value === "object" && "mermaidSetup" in value && value.mermaidSetup === true;
    }
    const SCRIPT_VERSION = typeof GM_info !== "undefined" && GM_info?.script?.version || "6.10.4";
    const PANEL_ID = "bili-subbatch-panel";
    const UI_STORE_KEY = "bili-subbatch-ui-v2";
    const DEFAULT_CTP_FLAVOR = "mocha";
    const CTP_FLAVOR_IDS = Object.freeze(["latte", "frappe", "macchiato", "mocha"]);
    const CTP_FLAVORS = Object.freeze([
      Object.freeze({ id: "mocha", label: "Mocha", hint: "默认深色", emoji: "🌿" }),
      Object.freeze({ id: "macchiato", label: "Macchiato", hint: "中等深色", emoji: "🌺" }),
      Object.freeze({ id: "frappe", label: "Frappé", hint: "柔和深色", emoji: "🪴" }),
      Object.freeze({ id: "latte", label: "Latte", hint: "浅色日间", emoji: "🌻" })
    ]);
    const CTP_PALETTES = Object.freeze({
      latte: Object.freeze({
        rosewater: "#dc8a78",
        flamingo: "#dd7878",
        pink: "#ea76cb",
        mauve: "#8839ef",
        red: "#d20f39",
        maroon: "#e64553",
        peach: "#fe640b",
        yellow: "#df8e1d",
        green: "#40a02b",
        teal: "#179299",
        sky: "#04a5e5",
        sapphire: "#209fb5",
        blue: "#1e66f5",
        lavender: "#7287fd",
        text: "#4c4f69",
        subtext1: "#5c5f77",
        subtext0: "#6c6f85",
        overlay2: "#7c7f93",
        overlay1: "#8c8fa1",
        overlay0: "#9ca0b0",
        surface2: "#acb0be",
        surface1: "#bcc0cc",
        surface0: "#ccd0da",
        base: "#eff1f5",
        mantle: "#e6e9ef",
        crust: "#dce0e8"
      }),
      frappe: Object.freeze({
        rosewater: "#f2d5cf",
        flamingo: "#eebebe",
        pink: "#f4b8e4",
        mauve: "#ca9ee6",
        red: "#e78284",
        maroon: "#ea999c",
        peach: "#ef9f76",
        yellow: "#e5c890",
        green: "#a6d189",
        teal: "#81c8be",
        sky: "#99d1db",
        sapphire: "#85c1dc",
        blue: "#8caaee",
        lavender: "#babbf1",
        text: "#c6d0f5",
        subtext1: "#b5bfe2",
        subtext0: "#a5adce",
        overlay2: "#949cbb",
        overlay1: "#838ba7",
        overlay0: "#737994",
        surface2: "#626880",
        surface1: "#51576d",
        surface0: "#414559",
        base: "#303446",
        mantle: "#292c3c",
        crust: "#232634"
      }),
      macchiato: Object.freeze({
        rosewater: "#f4dbd6",
        flamingo: "#f0c6c6",
        pink: "#f5bde6",
        mauve: "#c6a0f6",
        red: "#ed8796",
        maroon: "#ee99a0",
        peach: "#f5a97f",
        yellow: "#eed49f",
        green: "#a6da95",
        teal: "#8bd5ca",
        sky: "#91d7e3",
        sapphire: "#7dc4e4",
        blue: "#8aadf4",
        lavender: "#b7bdf8",
        text: "#cad3f5",
        subtext1: "#b8c0e0",
        subtext0: "#a5adcb",
        overlay2: "#939ab7",
        overlay1: "#8087a2",
        overlay0: "#6e738d",
        surface2: "#5b6078",
        surface1: "#494d64",
        surface0: "#363a4f",
        base: "#24273a",
        mantle: "#1e2030",
        crust: "#181926"
      }),
      mocha: Object.freeze({
        rosewater: "#f5e0dc",
        flamingo: "#f2cdcd",
        pink: "#f5c2e7",
        mauve: "#cba6f7",
        red: "#f38ba8",
        maroon: "#eba0ac",
        peach: "#fab387",
        yellow: "#f9e2af",
        green: "#a6e3a1",
        teal: "#94e2d5",
        sky: "#89dceb",
        sapphire: "#74c7ec",
        blue: "#89b4fa",
        lavender: "#b4befe",
        text: "#cdd6f4",
        subtext1: "#bac2de",
        subtext0: "#a6adc8",
        overlay2: "#9399b2",
        overlay1: "#7f849c",
        overlay0: "#6c7086",
        surface2: "#585b70",
        surface1: "#45475a",
        surface0: "#313244",
        base: "#1e1e2e",
        mantle: "#181825",
        crust: "#11111b"
      })
    });
    function normalizeCtpFlavor(value) {
      const id = String(value || "").trim().toLowerCase();
      return CTP_FLAVOR_IDS.find((flavor) => flavor === id) || DEFAULT_CTP_FLAVOR;
    }
    function getCtpPalette(flavor = DEFAULT_CTP_FLAVOR) {
      return CTP_PALETTES[normalizeCtpFlavor(flavor)] || CTP_PALETTES[DEFAULT_CTP_FLAVOR];
    }
    function buildCtpFlavorCss(panelId) {
      return CTP_FLAVOR_IDS.map((id) => {
        const palette = CTP_PALETTES[id];
        const vars = Object.entries(palette).map(([key, hex]) => `--ctp-${key}: ${hex};`).join("\n        ");
        if (id === DEFAULT_CTP_FLAVOR) {
          return `#${panelId},
      #${panelId}[data-ctp-flavor="${id}"] {
        ${vars}
      }`;
        }
        return `#${panelId}[data-ctp-flavor="${id}"] {
        ${vars}
      }`;
      }).join("\n\n      ");
    }
    const AI_STORE_KEY = "bili-subbatch-ai-v2";
    const AI_PROFILES_STORE_KEY = "bili-subbatch-ai-profiles-v1";
    const AI_PROFILES_SCHEMA_VERSION = 4;
    const PROMPT_STORE_KEY = "bili-subbatch-prompts-v1";
    const PROMPT_SCHEMA_VERSION = 9;
    const DEFAULT_PROMPT_ID = "builtin-mermaid-learning-map";
    const DEFAULT_PREPROCESS_PROMPT_ID = "builtin-subtitle-normalizer";
    const DEFAULT_KNOWLEDGE_PROMPT_ID = "builtin-knowledge-drilldown";
    const DEFAULT_HTML_FOLIO_PROMPT_ID = "builtin-html-reading-folio";
    const STUDIO_CHAT_STORE_KEY = "bili-subbatch-studio-chat-v1";
    const STUDIO_MODEL_STORE_KEY = "bili-subbatch-studio-model-v1";
    const STUDIO_CHAT_KEEP_RECENT = 8;
    const STUDIO_CHAT_MEMORY_CHARS = 2400;
    const STUDIO_SLASH_COMMANDS = Object.freeze([
      Object.freeze({ id: "clear", aliases: ["clear", "清空", "new", "新建"], hint: "清空当前对话" }),
      Object.freeze({ id: "stop", aliases: ["stop", "停止"], hint: "停止生成" }),
      Object.freeze({ id: "copy", aliases: ["copy", "复制"], hint: "复制上一条回答" }),
      Object.freeze({ id: "export", aliases: ["export", "导出"], hint: "导出对话为 Markdown" }),
      Object.freeze({ id: "compress", aliases: ["compress", "压缩"], hint: "立刻压缩旧对话记忆" }),
      Object.freeze({ id: "memory", aliases: ["memory", "记忆"], hint: "查看当前压缩记忆" }),
      Object.freeze({ id: "raw", aliases: ["raw", "原文"], hint: "改用原始字幕当上下文" }),
      Object.freeze({ id: "norm", aliases: ["norm", "规范化"], hint: "改用规范化稿当上下文" }),
      Object.freeze({ id: "help", aliases: ["help", "帮助"], hint: "列出可用命令" })
    ]);
    const PREPROCESS_ENABLED_STORE_KEY = "bili-subbatch-preprocess-enabled-v1";
    const PREPROCESS_MODEL_STORE_KEY = "bili-subbatch-preprocess-model-v1";
    const PREPROCESS_CONCURRENCY_STORE_KEY = "bili-subbatch-preprocess-concurrency-v1";
    const PREPROCESS_TARGET_MINUTES_STORE_KEY = "bili-subbatch-preprocess-target-minutes-v1";
    const PREPROCESS_OVERLAP_SECONDS_STORE_KEY = "bili-subbatch-preprocess-overlap-seconds-v1";
    const PREPROCESS_MAX_CHARS_STORE_KEY = "bili-subbatch-preprocess-max-chars-v1";
    const PREPROCESS_RETRIES_STORE_KEY = "bili-subbatch-preprocess-retries-v1";
    const POST_TASKS_STORE_KEY = "bili-subbatch-post-tasks-v1";
    const POST_TASKS_SCHEMA_VERSION = 2;
    const KNOWLEDGE_MODEL_STORE_KEY = "bili-subbatch-knowledge-model-v1";
    const SHORTCUT_STORE_KEY = "bili-subbatch-shortcuts-v1";
    const SHORTCUT_SCHEMA_VERSION = 2;
    const SHORTCUT_COMMANDS2 = Object.freeze([
      Object.freeze({ id: "toggle-panel", label: "召唤 / 隐藏面板", hint: "打开时按你的召唤布局与默认内容进入；再次按下收起。", defaultChord: "Ctrl+KeyB" }),
      Object.freeze({ id: "open-processed", label: "AI 处理字幕", hint: "直接打开 AI 工作台 → 预处理 → AI 处理字幕。", defaultChord: "Ctrl+Alt+Digit1" }),
      Object.freeze({ id: "open-postprocess", label: "后处理结果", hint: "直接打开 AI 工作台 → 后处理，并恢复当前/上次产物与模型。", defaultChord: "Ctrl+Alt+Digit2" }),
      Object.freeze({ id: "toggle-dock", label: "悬浮 / 靠边", hint: "在悬浮模式和你偏好的贴边方向之间切换。", defaultChord: "Ctrl+Alt+KeyD" })
    ]);
    const KNOWLEDGE_ANCHOR_STORE = "anchors";
    const KNOWLEDGE_NODE_STORE = "nodes";
    const KNOWLEDGE_SELECTION_MIN = 2;
    const KNOWLEDGE_SELECTION_MAX = 1200;
    const PREPROCESS_CACHE_TTL_MS = 30 * 24 * 60 * 6e4;
    const PREPROCESS_DEFAULT_CONCURRENCY = 6;
    const PREPROCESS_DEFAULT_TARGET_MINUTES = 8;
    const PREPROCESS_DEFAULT_OVERLAP_SECONDS = 30;
    const PREPROCESS_DEFAULT_MAX_CHARS = 24e3;
    const PREPROCESS_DEFAULT_RETRIES = 2;
    const AUTO_CAPTURE_STORE_KEY = "bili-subbatch-auto-capture-v1";
    const AUTO_ANALYZE_STORE_KEY = "bili-subbatch-auto-analyze-v1";
    const TRANSCRIPT_FOLLOW_STORE_KEY = "bili-subbatch-transcript-follow-v2";
    const PLAYER_SUBTITLE_STORE_KEY = "bili-subbatch-player-subtitle-v2";
    const PLAYER_SUBTITLE_SELECTORS = Object.freeze({
      button: ".bpx-player-ctrl-subtitle",
      panel: ".bpx-player-ctrl-subtitle-box",
      item: ".bpx-player-ctrl-subtitle-language-item[data-lan]",
      active: ".bpx-player-ctrl-subtitle-language-item.bpx-state-active",
      close: ".bpx-player-ctrl-subtitle-close-switch"
    });
    const CACHE_DB_NAME = "bili-subbatch-cache-v2";
    const CACHE_DB_VERSION = 1;
    const CACHE_STORE_NAME = "records";
    const CACHE_CHANNEL_NAME = "bili-subbatch-cache-v2";
    const CACHE_SESSION_PREFIX = "bsb:v2:";
    const MEMORY_CACHE_LIMIT = 32;
    const VIEW_CACHE_TTL_MS = 30 * 6e4;
    const SUBTITLE_EXPORT_ROOT2 = "loop-bilibili-subbatch";
    const SUBTITLE_EXPORT_INDEX_NAME2 = "index.md";
    const SUBTITLE_EXPORT_INDEX_STORE_KEY = "bili-subbatch-export-index-v1";
    const TRACK_CACHE_TTL_MS = 10 * 6e4;
    const SUBTITLE_CACHE_TTL_MS = 30 * 24 * 60 * 6e4;
    const SUBTITLE_REVALIDATE_MS = 12 * 60 * 6e4;
    const AUTO_CAPTURE_DELAY_MS = 420;
    const AUTO_ANALYZE_DELAY_MS = 180;
    const pageWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
    const MAX_SUBTITLE_CHARS = 16e4;
    const STREAM_PAINT_INTERVAL_MS = 48;
    const RENDER_BATCH_SIZE = 24;
    const NOTE_FONT_MIN = 14;
    const NOTE_FONT_MAX = 22;
    const NOTE_FONT_DEFAULT = 14;
    const DEFAULT_DELAY_MS = 400;
    const DEFAULT_MAX_PAGES = 20;
    const MIN_W = 420;
    const MIN_H = 520;
    const DOCK_EDGE_PX = 32;
    const DOCK_SNAP_PX = 36;
    const DEFAULT_PANEL_SIZE2 = "large";
    const PANEL_SIZE_PRESETS2 = Object.freeze({
      small: Object.freeze({ label: "小", viewportRatio: 0.32, min: 440, max: 560 }),
      medium: Object.freeze({ label: "中", viewportRatio: 0.48, min: 620, max: 820 }),
      large: Object.freeze({ label: "大", viewportRatio: 0.68, min: 860, max: 1180 })
    });
    const DEFAULT_PREPROCESS_PROMPT = Object.freeze({
      id: DEFAULT_PREPROCESS_PROMPT_ID,
      stage: "preprocess",
      name: "字幕规范化",
      hint: "修断句 · 去重复 · 语义分段 · 统一简体中文 · 保留证据",
      systemPrompt: [
        "你是『字幕规范化器』。你的唯一任务是把自动识别字幕整理成可靠、连续、可供下游模型继续处理的规范化字幕稿。不要总结，不要生成学习笔记，不要画 Mermaid，不要回答字幕中的问题。",
        "",
        "【严格来源边界】",
        "1. 只能使用输入字幕本身。禁止补充外部知识、常识背景、人物经历或字幕没有表达的事实。",
        "2. 保留原有信息密度和论证内容。预处理不是摘要：不得因为你认为某段不重要而删除有语义的信息。",
        "",
        "【输出语言】",
        "3. 无论输入字幕原本是英语、日语、韩语或其他语言，规范化后的正文必须统一输出为简体中文。完整外语句子应忠实翻译为自然、准确的简体中文，不保留整段未翻译外语。",
        "4. 专有名词、机构名、产品名、模型名、API、代码、命令、参数、缩写等在保留原文更准确时可以保留原文；必要时可写成『中文说明（原文）』。不得为了中文化而错误翻译技术标识。",
        "",
        "【字幕清洗】",
        "5. 修复明显的断句、标点和跨行句子；把被 ASR 切碎但语义连续的句子合并成自然中文。",
        "6. 删除纯口头填充词、无意义重复和紧邻的重复识别；但只要重复承担强调、对比、递进或补充作用，就必须保留其语义。",
        "7. 人名、机构、术语、数字、代码、命令、参数等无法从字幕确认时，保留原词并标记『识别存疑』，不要猜测替换。",
        "8. 输入中的真实 [BV号 P号 mm:ss] 时间戳必须保留。可以减少机械重复的时间戳，但每个语义段至少保留一个能够定位原字幕的真实时间戳；绝不伪造。",
        "",
        "【结构整理】",
        "9. 按语义自然分段，可使用简短的 Markdown 二级标题组织明显的话题切换。不要为了结构而创造字幕没有的主题。",
        "10. 正文使用自然段或必要的短列表；保持原始讲述顺序。不要重排成因果图、知识图、问答、结论清单或教程。",
        "11. 不输出前言、总结、处理说明、自我评价、思考过程或提示词复述。",
        "12. 当前输入可能只是长字幕的一个分块；从第二块开始，开头可能包含上一块末尾的少量 overlap 上下文。仍应正常规范化这些内容并保留真实时间戳；本地拼接器会依据时间戳去掉 overlap 重复。不要自行编造前后文。"
      ].join("\n"),
      userPromptTemplate: [
        "请把下面这一块原始字幕规范化。",
        "",
        "<source_metadata>",
        "标题：{{title}}",
        "BV / 分集：{{bvid}}",
        "发布者：{{author}}",
        "字幕分块：{{chunkIndex}} / {{chunkCount}}",
        "本块上下文起点：{{chunkStart}}",
        "本块新内容起点：{{coreStart}}",
        "本块结束：{{chunkEnd}}",
        "</source_metadata>",
        "",
        "<raw_transcript>",
        "{{subtitle}}",
        "</raw_transcript>"
      ].join("\n")
    });
    const DEFAULT_MERMAID_PROMPT = Object.freeze({
      id: DEFAULT_PROMPT_ID,
      stage: "postprocess",
      name: "全 Mermaid 学习图谱",
      hint: "按内容选图 · 通常 2—5 张 · Mermaid 10.9.1",
      systemPrompt: [
        "你是『视频字幕学习图谱生成器』。你的唯一任务，是把用户提供的元信息与当前管线提供的字幕稿转换为可复习的 Mermaid 学习图谱。",
        "",
        "【来源边界】",
        "1. 只使用本次提供的元信息与字幕。不要补充外部知识、常识背景、人物经历或字幕没有支持的结论。",
        "2. 输入通常已经经过字幕规范化；若用户关闭预处理，也可能是原始自动字幕。无论哪种情况都不得改变原意。人名、机构、数字、命令、参数、代码或术语无法确认时，在节点文字中标记『识别存疑』，不要猜测替换。",
        "2a. 所有最终可见标题与 Mermaid 节点文字统一使用简体中文。若输入仍是英语、日语或其他语言，先忠实理解并转换为简体中文；专有名词、模型名、API、代码、命令、参数和缩写可保留必要原文。",
        "3. 输入中的 [BV号 P号 mm:ss] 只用于定位证据。最终 Mermaid 节点、边、子图标题以及 Markdown 标题中都不要输出 BV/P/时间戳引用，也不要伪造时间戳。",
        "",
        "【输出目标】",
        "4. 用少量、用途明确的图重建字幕中的知识关系，不按字幕顺序逐句复述。图的数量服从内容，不为凑数生成空洞图。",
        "5. 通常输出 2—5 张图。内容足够时优先包含一张知识总览；其余只从流程或论证链、因果或依赖、对比或决策、学习路径、自测关系中选择字幕真正支持的类型。",
        "6. 每张图保持单一主题，建议 8—18 个节点。优先保留核心概念、关键关系、步骤、条件、边界、例子、风险和结论；删除口头填充、重复和无信息增量内容。",
        "7. 学习路径或自测图中的问题必须能直接由本次字幕回答，不得引入字幕外知识。",
        "",
        "【严格输出格式】",
        "8. 只允许一个 Markdown 一级标题。其后每张图使用一个 Markdown 二级标题和一个独立的 ```mermaid``` 代码块。",
        "9. 除一级/二级标题与 Mermaid 代码块外，不要输出普通段落、列表、表格、引用、解释、前言、总结、提示词复述或思考过程。",
        "10. 只使用 Mermaid 10.9.1 的 flowchart TD 或 flowchart LR。禁止 mindmap、timeline、xychart、architecture-beta、click、classDef、style、init 与实验语法。",
        '11. 每个 Mermaid 代码块必须独立完整。节点 ID 只使用 ASCII 字母和数字；可见文字放进双引号标签，例如 A1["核心概念"]。标签内部避免英文双引号、反引号和花括号，只在必要时使用 <br/>。',
        "12. 输出前静默检查每个代码块的括号、引号、箭头、节点 ID 与连接关系，确保 Mermaid 10.9.1 可以解析。"
      ].join("\n"),
      userPromptTemplate: [
        "请严格按照 System Prompt，把下面的当前字幕稿转换为最终的全 Mermaid 学习图谱。",
        "",
        "<source_metadata>",
        "标题：{{title}}",
        "BV / 分集：{{bvid}}",
        "发布者：{{author}}",
        "</source_metadata>",
        "",
        "<transcript>",
        "{{subtitle}}",
        "</transcript>"
      ].join("\n")
    });
    const DEFAULT_HTML_FOLIO_PROMPT = Object.freeze({
      id: DEFAULT_HTML_FOLIO_PROMPT_ID,
      stage: "postprocess",
      name: "HTML 阅读页",
      hint: "看懂这一期 · 少而准 · 自动渲染",
      systemPrompt: [
        "把本期字幕整理成一份「看完能懂」的阅读页。只根据字幕，不补课外知识。",
        "",
        "先问自己：读者看完这一页，应该比只听视频多明白什么？只写那个增量。",
        "按需要取舍，不要凑章节：",
        "- 这一期在解决什么问题（一句话）",
        "- 讲者的核心判断或方法，以及它凭什么成立",
        "- 关键步骤、前提、边界、反例、容易做错的地方",
        "- 字幕里真实出现过的例子、数字、命令、术语",
        "- 看完该记住的，最多 3 条",
        "删口头禅、重复和按时间线复述。不确定的词标「识别存疑」，不要猜。简体中文；术语可留原文。不要写 BV、分P、时间戳。",
        "",
        '只输出一个 ```html 代码块，里面恰好一个 <article class="bsb-folio">。',
        "header：一行 kicker + 一个 h1 + 一段 lede（lede 写「看完能明白什么」，不要空套话）。",
        "每个大节一个 h2；大节里若有 2 个以上可单独跳转的要点，再用 h3 拆开，让左侧目录能分层。不要为空标题硬拆。",
        "标签够用即可：p ul ol li strong mark code pre aside table。",
        '关键结论用 <aside data-kind="key">，提醒用 note，风险用 warn。步骤用 <ol class="steps">。',
        "不要 style、script、完整网页、Mermaid、前言后记或思考过程。"
      ].join("\n"),
      userPromptTemplate: [
        "把下面字幕整理成阅读页。只写对理解这一期真正有用的内容。",
        "",
        "<source>",
        "{{title}} · {{bvid}} · {{author}}",
        "</source>",
        "",
        "<transcript>",
        "{{subtitle}}",
        "</transcript>"
      ].join("\n")
    });
    const DEFAULT_KNOWLEDGE_PROMPT = Object.freeze({
      id: DEFAULT_KNOWLEDGE_PROMPT_ID,
      stage: "knowledge",
      name: "局部知识追问",
      hint: "锚点附近字幕 + 当前分支上下文 → 聚焦解释与建议追问",
      systemPrompt: [
        "你是『局部知识钻取助手』。用户正在阅读一段已经规范化的视频字幕，并从其中选中了一个知识锚点。你的任务是围绕当前锚点和当前问题进行聚焦解释，而不是重新总结整段视频。",
        "",
        "【上下文使用】",
        "1. 优先使用提供的字幕局部上下文解释讲者当前讨论的含义，并明确区分『字幕中明确表达』与『为了回答问题而补充的通用知识』。",
        "2. 允许补充可靠的通用知识，因为用户的追问可能超出字幕；但不要伪造视频中没有说过的内容，不要把补充知识冒充成讲者原话。",
        "3. 只沿当前追问分支使用祖先上下文，不引入同一锚点其他分支的讨论。",
        "4. 默认使用简体中文。模型名、API、代码、公式、命令和国际通用术语在保留原文更准确时可保留原文。",
        "",
        "【回答风格】",
        "5. 先直接回答当前问题，再解释关键机制、必要条件、边界或对比。避免百科式漫无边际扩写。",
        "6. 可使用短标题、列表、公式和必要的代码；不要输出思考过程。",
        "7. 回答末尾必须输出一个 <suggestions> 块，包含 2—4 个真正有递进价值的下一步问题，每行一个以 '- ' 开头的问题。不要在正文中解释这个块。",
        "8. 建议问题应从当前答案自然向下一层钻取，不要重复当前问题，也不要只是换一种说法。",
        "",
        "【阅读强调】",
        "9. 可以使用 ==关键短语== 标记真正值得用户记住的内容。系统会把 ==...== 渲染为视觉高亮。",
        "10. 高亮必须克制：每个自然段通常 0—2 处；优先高亮核心概念、关键结论、因果节点、关键数字、重要边界；一处高亮尽量是一个短语，而不是整段文字；禁止连续高亮多个句子；禁止为了视觉效果随意高亮普通描述。",
        "11. **...** 只表示普通加粗；==...== 表示更高一级的『核心记忆点』。",
        "12. 不要在代码、公式、Markdown 标题中使用 ==...==；不要嵌套写成 ==**文字**==。"
      ].join("\n"),
      userPromptTemplate: [
        "<source>",
        "标题：{{title}}",
        "BV / 分集：{{bvid}}",
        "发布者：{{author}}",
        "</source>",
        "",
        "<anchor>",
        "{{anchorText}}",
        "</anchor>",
        "",
        "<local_source_context>",
        "{{sourceContext}}",
        "</local_source_context>",
        "",
        "<ancestor_branch>",
        "{{ancestorPath}}",
        "</ancestor_branch>",
        "",
        "<current_question>",
        "{{question}}",
        "</current_question>"
      ].join("\n")
    });
    const AI_DEFAULTS = {
      baseUrl: "",
      // Never ship secrets in-repo; user fills in Settings (GM/local storage only)
      apiKey: "",
      model: "openai/gpt-oss-120b",
      temperature: 0.4,
      maxTokens: 65536,
      /**
       * 必须默认 true：非流式要等整包，长请求常被扩展/代理 ~10s 空闲断开
       * 网关日志表现为 client_gone / context canceled。
       * 流式会先推 reasoning，已兼容 content+reasoning 字段。
       */
      stream: true
    };
    const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    function loadAutoCaptureSetting() {
      const raw = storageGet(AUTO_CAPTURE_STORE_KEY, true);
      return raw !== false && raw !== 0 && raw !== "0" && raw !== "false" && raw !== "off";
    }
    function saveAutoCaptureSetting(enabled) {
      storageSet(AUTO_CAPTURE_STORE_KEY, enabled ? "true" : "false");
    }
    function loadAutoAnalyzeSetting() {
      const raw = storageGet(AUTO_ANALYZE_STORE_KEY, true);
      return raw !== false && raw !== 0 && raw !== "0" && raw !== "false" && raw !== "off";
    }
    function saveAutoAnalyzeSetting(enabled) {
      storageSet(AUTO_ANALYZE_STORE_KEY, enabled ? "true" : "false");
    }
    function loadPreprocessEnabledSetting() {
      const raw = storageGet(PREPROCESS_ENABLED_STORE_KEY, true);
      return raw !== false && raw !== 0 && raw !== "0" && raw !== "false" && raw !== "off";
    }
    function savePreprocessEnabledSetting(enabled) {
      storageSet(PREPROCESS_ENABLED_STORE_KEY, enabled ? "true" : "false");
    }
    function loadBoundedNumberSetting(key, fallback, min, max, integer = true) {
      const raw = Number(storageGet(key, fallback));
      const value = Number.isFinite(raw) ? raw : fallback;
      const bounded = Math.min(max, Math.max(min, value));
      return integer ? Math.round(bounded) : bounded;
    }
    function saveBoundedNumberSetting(key, value, fallback, min, max, integer = true) {
      const raw = Number(value);
      const normalized = Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : fallback;
      const finalValue = integer ? Math.round(normalized) : normalized;
      storageSet(key, String(finalValue));
      return finalValue;
    }
    function loadTranscriptFollowSetting() {
      const raw = storageGet(TRANSCRIPT_FOLLOW_STORE_KEY, true);
      return raw !== false && raw !== 0 && raw !== "0" && raw !== "false" && raw !== "off";
    }
    function loadPlayerSubtitleSetting() {
      const raw = storageGet(PLAYER_SUBTITLE_STORE_KEY, true);
      return raw !== false && raw !== 0 && raw !== "0" && raw !== "false" && raw !== "off";
    }
    function lruGet(map, key) {
      if (!map.has(key)) return null;
      const value = map.get(key);
      if (value === void 0) return null;
      map.delete(key);
      map.set(key, value);
      return value;
    }
    function lruSet(map, key, value, max = MEMORY_CACHE_LIMIT) {
      if (map.has(key)) map.delete(key);
      map.set(key, value);
      while (map.size > max) {
        const oldestKey = map.keys().next().value;
        if (oldestKey === void 0) break;
        map.delete(oldestKey);
      }
      return value;
    }
    const TYPE_LABEL = {
      video: "单个视频",
      selection: "视频选集",
      user: "个人主页",
      favorite: "收藏夹",
      collection: "合集",
      search: "搜索页",
      unknown: "未知页面"
    };
    const MODE_OPTIONS = [
      "auto",
      "video",
      "selection",
      "user",
      "favorite",
      "collection",
      "search"
    ];
    function prepareMarkdownMath(md) {
      const maths = [];
      let s = String(md || "");
      s = s.replace(/```(?:math|latex|tex)\s*\n([\s\S]*?)```/gi, (_, tex) => {
        const i = maths.length;
        maths.push({ tex: String(tex).trim(), display: true });
        return `

@@BSBMATH${i}@@

`;
      });
      const codes = [];
      s = s.replace(/```[\s\S]*?```/g, (m) => {
        const i = codes.length;
        codes.push(m);
        return `@@BSBCODE${i}@@`;
      });
      s = s.replace(/`[^`\n]+`/g, (m) => {
        const i = codes.length;
        codes.push(m);
        return `@@BSBCODE${i}@@`;
      });
      s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
        const i = maths.length;
        maths.push({ tex: String(tex).trim(), display: true });
        return `

@@BSBMATH${i}@@

`;
      });
      s = s.replace(/\\\[([\s\S]+?)\\\]/g, (_, tex) => {
        const i = maths.length;
        maths.push({ tex: String(tex).trim(), display: true });
        return `

@@BSBMATH${i}@@

`;
      });
      s = s.replace(/\\\(([\s\S]+?)\\\)/g, (_, tex) => {
        const i = maths.length;
        maths.push({ tex: String(tex).trim(), display: false });
        return `@@BSBMATH${i}@@`;
      });
      {
        const input = s;
        let out = "";
        let cursor = 0;
        const escapedAt = (idx) => {
          let slashes = 0;
          for (let j = idx - 1; j >= 0 && input[j] === "\\"; j--) slashes += 1;
          return slashes % 2 === 1;
        };
        while (cursor < input.length) {
          let open = input.indexOf("$", cursor);
          while (open >= 0 && escapedAt(open)) open = input.indexOf("$", open + 1);
          if (open < 0) {
            out += input.slice(cursor);
            break;
          }
          out += input.slice(cursor, open);
          let close = input.indexOf("$", open + 1);
          while (close >= 0 && escapedAt(close)) close = input.indexOf("$", close + 1);
          if (close < 0) {
            out += input.slice(open);
            break;
          }
          const raw = input.slice(open + 1, close);
          const t = raw.trim();
          const hasBoundarySpace = raw !== t;
          const pureNumber = /^[\d,]+(?:\.\d+)?$/.test(t);
          const mathSignal = /[A-Za-z\\_^{}=+*/<>|]|[α-ωΑ-Ω]/.test(t);
          const valid = !!t && !hasBoundarySpace && !pureNumber && mathSignal;
          if (!valid) {
            out += "$";
            cursor = open + 1;
            continue;
          }
          const i = maths.length;
          maths.push({ tex: t, display: false });
          out += `@@BSBMATH${i}@@`;
          cursor = close + 1;
        }
        s = out;
      }
      s = s.replace(/@@BSBCODE(\d+)@@/g, (_, id) => {
        const i = Number(id);
        return codes[i] != null ? codes[i] : "";
      });
      return { md: s, maths };
    }
    function replaceMathPlaceholders(html, maths, renderToString) {
      return String(html || "").replace(/@@BSBMATH(\d+)@@/g, (full, id) => {
        const m = maths[Number(id)];
        if (!m) return full;
        if (typeof renderToString === "function") {
          try {
            const out = renderToString(m.tex, !!m.display);
            if (out != null && out !== "") return out;
          } catch {
          }
        }
        const esc = String(m.tex).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        return m.display ? `<pre class="bsb-math-fallback">${esc}</pre>` : `<code class="bsb-math-fallback">${esc}</code>`;
      });
    }
    function httpJson(url, extraHeaders = {}) {
      return new Promise((resolve2, reject) => {
        if (typeof GM_xmlhttpRequest !== "function") {
          reject(new Error("缺少 GM_xmlhttpRequest 跨域能力"));
          return;
        }
        GM_xmlhttpRequest({
          method: "GET",
          url,
          anonymous: false,
          timeout: 3e4,
          headers: Object.assign(
            {
              Accept: "application/json, text/plain, */*",
              Referer: "https://www.bilibili.com/",
              Origin: "https://www.bilibili.com",
              "User-Agent": UA
            },
            extraHeaders || {}
          ),
          onload(res) {
            if (res.status < 200 || res.status >= 300) {
              reject(
                new Error(
                  `HTTP ${res.status} for ${url}: ${(res.responseText || "").slice(0, 200)}`
                )
              );
              return;
            }
            try {
              resolve2(JSON.parse(res.responseText));
            } catch {
              reject(
                new Error(
                  `invalid JSON from ${url}: ${(res.responseText || "").slice(0, 200)}`
                )
              );
            }
          },
          onerror() {
            reject(new Error(`network error for ${url}`));
          },
          ontimeout() {
            reject(new Error(`timeout for ${url}`));
          }
        });
      });
    }
    function extractBvid2(text) {
      try {
        const pure = typeof SubBatch2 !== "undefined" ? SubBatch2?.SubBatchMonorepo?.bilibili?.extractBvid : null;
        if (typeof pure === "function") return pure(text);
      } catch {
      }
      if (!text) return "";
      text = String(text).trim();
      if (!text) return "";
      if (/^BV(?!id$)[A-Za-z0-9]+$/i.test(text)) return "BV" + text.slice(2);
      const m = text.match(/BV(?!id\b)[A-Za-z0-9]+/i);
      return m ? "BV" + m[0].slice(2) : "";
    }
    function resolveCid(view2, page = 1) {
      const pages = view2.pages || [];
      if (Array.isArray(pages) && pages.length && page >= 1 && page <= pages.length) {
        const cid = pages[page - 1]?.cid;
        return cid != null ? Number(cid) : null;
      }
      if (view2.cid == null) return null;
      const n = Number(view2.cid);
      return Number.isFinite(n) ? n : null;
    }
    function dedupeCues(cues) {
      const out = [];
      for (const cue of cues || []) {
        const content2 = String(cue?.content || "").replace(/\s+/g, " ").trim();
        if (!content2) continue;
        const normalized = content2.toLocaleLowerCase();
        const previous = out[out.length - 1];
        if (previous && previous.normalized === normalized) {
          const previousTo = Number(previous.cue.to_sec ?? coreCall("parseSeconds", previous.cue.to));
          const currentFrom = Number(cue.from_sec ?? coreCall("parseSeconds", cue.from));
          if (currentFrom - previousTo <= 1.25) {
            const nextTo = Math.max(
              previousTo,
              Number(cue.to_sec ?? coreCall("parseSeconds", cue.to))
            );
            previous.cue.to_sec = nextTo;
            previous.cue.to = `${nextTo.toFixed(2)}s`;
            continue;
          }
        }
        out.push({ cue: { ...cue, content: content2 }, normalized });
      }
      return out.map((entry) => entry.cue);
    }
    function stripHtml(s) {
      return String(s || "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
    }
    function subbatchCore() {
      try {
        return typeof SubBatch2 !== "undefined" ? SubBatch2?.SubBatchMonorepo?.core || null : null;
      } catch {
        return null;
      }
    }
    function coreFn(name) {
      const api = subbatchCore();
      const fn = api && api[name];
      return typeof fn === "function" ? fn : null;
    }
    const bili = SubBatch2.SubBatchMonorepo.bilibili;
    const BILI_FUNCTIONS = {
      "video.isChargeBlocked": bili.video.isChargeBlocked,
      "video.runtimeView": bili.video.runtimeView,
      "video.pageMeta": bili.video.pageMeta,
      "subtitle.preferredIndex": bili.subtitle.preferredIndex,
      "subtitle.runtimeTracks": bili.subtitle.runtimeTracks,
      "subtitle.normalizeUrl": bili.subtitle.normalizeUrl,
      "subtitle.pickTrack": bili.subtitle.pickTrack,
      "extractPlayingVideoHint": bili.extractPlayingVideoHint,
      "resolvePlayingVideoRef": bili.resolvePlayingVideoRef,
      "playingVideoChanged": bili.playingVideoChanged
    };
    function bilibiliFn(path) {
      return BILI_FUNCTIONS[path];
    }
    function bilibiliCall(path, ...args) {
      return Reflect.apply(bilibiliFn(path), void 0, args);
    }
    function appFn(path) {
      return resolveAppMethod(SubBatch2?.SubBatchMonorepo?.app, path);
    }
    function appCall(path, ...args) {
      return callApp(SubBatch2?.SubBatchMonorepo?.app, path, ...args);
    }
    function runtimeNetwork() {
      const network = SubBatch2.SubBatchMonorepo.runtime.network;
      if (!network) throw new Error("[bili-subbatch] missing network adapter");
      return network;
    }
    function coreCall(name, ...args) {
      const fn = coreFn(name);
      if (!fn) throw new Error("[bili-subbatch] monorepo core API missing: " + name);
      return Reflect.apply(fn, void 0, args);
    }
    function safeFilename(name) {
      return coreCall("safePathSegment", name, 120);
    }
    function buildCollectionShortUrl2(mid, seasonId) {
      return coreCall("buildCollectionShortUrl", mid, seasonId);
    }
    function buildSubtitleExportRelativePath2(item, ext) {
      return coreCall("buildSubtitleExportRelativePath", item, ext);
    }
    function buildSubtitleExportIndexPath2() {
      const fn = coreFn("buildSubtitleExportIndexPath");
      if (fn) return fn();
      return `${SUBTITLE_EXPORT_ROOT2}/${SUBTITLE_EXPORT_INDEX_NAME2}`;
    }
    function loadExportIndexMap() {
      try {
        const raw = storageGet(SUBTITLE_EXPORT_INDEX_STORE_KEY, "");
        if (!raw) return {};
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
        return parsed;
      } catch {
        return {};
      }
    }
    function saveExportIndexMap(map) {
      try {
        storageSet(SUBTITLE_EXPORT_INDEX_STORE_KEY, JSON.stringify(map || {}));
      } catch {
      }
      return map || {};
    }
    function upsertIndexForExportItem2(map, item) {
      return coreCall("upsertIndexForExportItem", map, item);
    }
    function renderExportIndexMd2(map) {
      return coreCall("renderExportIndexMd", map);
    }
    function attachSelectionGroupMeta2(items, meta = {}) {
      return SubBatch2.SubBatchMonorepo.core.attachSelectionGroupMeta(items, meta);
    }
    function attachCollectionGroupMeta2(items, meta = {}, ctx = {}) {
      return SubBatch2.SubBatchMonorepo.core.attachCollectionGroupMeta(items, meta, { mid: ctx.mid || "", season_id: ctx.season_id || "", collectionTitleHint: ctx.collectionTitleHint || "", authorHint: ctx.authorHint || "", parentFolder: "" });
    }
    function attachUserSpaceGroupMeta2(items, meta = {}) {
      return SubBatch2.SubBatchMonorepo.core.attachUserSpaceGroupMeta(items, meta);
    }
    function applySpaceCollectionMembership2(items, collections) {
      return SubBatch2.SubBatchMonorepo.core.applySpaceCollectionMembership(items, collections);
    }
    function countSpaceCollectionMatches2(items, collections) {
      return coreCall("countSpaceCollectionMatches", items, collections);
    }
    function attachSpaceLooseVideosMeta2(items) {
      return SubBatch2.SubBatchMonorepo.core.attachSpaceLooseVideosMeta(items);
    }
    function setGroupSelection2(items, groupKey, selected) {
      return coreCall("setGroupSelection", items, groupKey, selected);
    }
    function normalizeExportItem2(item, peers = []) {
      const combined = [...peers || [], ...state2.items || []];
      return coreCall("normalizeExportItem", item, combined);
    }
    function resolveLibraryGroupKey2(item) {
      return coreCall("resolveLibraryGroupKey", item);
    }
    function buildLibraryRenderNodes2(entries, collapsedMap) {
      return coreCall("buildLibraryRenderNodes", entries, collapsedMap || {});
    }
    function applyUgcSeasonToItems2(items, view2) {
      return SubBatch2.SubBatchMonorepo.core.applyUgcSeasonToItems(items, view2);
    }
    function buildGroupMetaPatches2(normalized) {
      return coreCall("buildGroupMetaPatches", normalized);
    }
    function applyGroupMetaPatchToItems2(items, patch) {
      return SubBatch2.SubBatchMonorepo.core.applyGroupMetaPatchToItems(items, patch);
    }
    function mergeGroupFields2(target, source) {
      return SubBatch2.SubBatchMonorepo.core.mergeGroupFields(target, source);
    }
    function suggestCaptureMode2(item) {
      return coreCall("suggestCaptureMode", item);
    }
    function syncCaptureModeFromItem(item, { silent = true } = {}) {
      const locked = /* @__PURE__ */ new Set(["video", "user", "favorite", "search"]);
      if (locked.has(state2.mode)) return state2.mode;
      let next = "auto";
      try {
        next = suggestCaptureMode2(item) || "auto";
      } catch {
        const pageCount = Array.isArray(item?.pages) ? item.pages.length : 0;
        if (item?.groupType === "collection" || item?.collectionSid) next = "collection";
        else if (item?.groupType === "selection" || pageCount > 1) next = "selection";
      }
      if (next === "auto" && state2.mode !== "selection" && state2.mode !== "collection") {
        return state2.mode;
      }
      if (next === state2.mode) return state2.mode;
      state2.mode = next;
      const root = document.getElementById(PANEL_ID);
      const modeSel = root?.querySelector('[data-role="mode"]');
      if (modeSel) modeSel.value = next;
      try {
        refreshContextUI();
      } catch {
      }
      if (!silent) {
        setStatus(`采集模式已自动切换为「${TYPE_LABEL[next] || next}」`, "ok");
      }
      return next;
    }
    function downloadText(filename, text, { overwrite = false } = {}) {
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const name = String(filename || "download.txt").replace(/\\/g, "/").replace(/\/{2,}/g, "/");
      const revokeLater = () => {
        setTimeout(() => {
          try {
            URL.revokeObjectURL(url);
          } catch {
          }
        }, 6e4);
      };
      const anchorFallback = () => {
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          try {
            URL.revokeObjectURL(url);
          } catch {
          }
          a.remove();
        }, 1500);
      };
      if (typeof GM_download === "function") {
        try {
          const opts = {
            url,
            name,
            saveAs: false,
            onload: revokeLater,
            onerror: anchorFallback,
            ontimeout: anchorFallback
          };
          if (overwrite) opts.conflictAction = "overwrite";
          GM_download(opts);
          return;
        } catch {
        }
      }
      anchorFallback();
    }
    async function downloadSubtitleExportBatch(pool, ext, convert) {
      let indexMap = loadExportIndexMap();
      const peerPool = [...pool, ...state2.items || []];
      let nextItems = state2.items;
      for (let i = 0; i < pool.length; i++) {
        const it = normalizeExportItem2(pool[i], peerPool);
        const patch = buildGroupMetaPatches2(it);
        if (patch) nextItems = applyGroupMetaPatchToItems2(nextItems, patch);
        indexMap = upsertIndexForExportItem2(indexMap, it);
        const sourceCues = pool[i]?.data;
        downloadText(
          buildSubtitleExportRelativePath2(it, ext),
          convert(Array.isArray(sourceCues) ? sourceCues : []),
          { overwrite: true }
        );
        if (pool.length > 1) await sleep(220);
      }
      state2.items = nextItems;
      saveExportIndexMap(indexMap);
      const indexMd = renderExportIndexMd2(indexMap);
      if (indexMd) {
        await sleep(pool.length ? 260 : 0);
        downloadText(buildSubtitleExportIndexPath2(), indexMd, { overwrite: true });
      }
      renderList({ renderTranscript: false });
      return { count: pool.length, indexEntries: Object.keys(indexMap).length };
    }
    function sleep(ms) {
      return new Promise((r) => setTimeout(r, ms));
    }
    function detectContext2(href) {
      try {
        const pure = typeof SubBatch2 !== "undefined" ? SubBatch2?.SubBatchMonorepo?.bilibili?.detectContext : null;
        if (typeof pure === "function") {
          try {
            const url = new URL(href || location.href);
            return pure(href || location.href, extractPageHints(url));
          } catch {
            return pure(String(href || ""), {});
          }
        }
      } catch {
      }
      let u;
      try {
        u = new URL(href || location.href);
      } catch {
        return { type: "unknown", source: "auto" };
      }
      const host2 = u.hostname.toLowerCase();
      const path = u.pathname;
      const hints = extractPageHints(u);
      if (/^search\.bilibili\.com$/i.test(host2)) {
        if (/^\/(all|video)\/?$/i.test(path)) {
          const keyword = (u.searchParams.get("keyword") || "").trim() || hints.keyword;
          if (keyword) {
            const allowed2 = /* @__PURE__ */ new Set([
              "totalrank",
              "click",
              "pubdate",
              "dm",
              "stow",
              "scores"
            ]);
            const order = (u.searchParams.get("order") || "totalrank").trim().toLowerCase();
            const page = Math.max(
              1,
              parseInt(u.searchParams.get("page") || "1", 10) || 1
            );
            return {
              type: "search",
              source: "auto",
              keyword,
              order: allowed2.has(order) ? order : "totalrank",
              page
            };
          }
        }
        return { type: "unknown", source: "auto" };
      }
      if (/^space\.bilibili\.com$/i.test(host2)) {
        let m = path.match(/^\/(\d+)\/lists\/(\d+)\/?$/i);
        if (m) {
          return {
            type: "collection",
            source: "auto",
            mid: m[1],
            season_id: m[2]
          };
        }
        m = path.match(/^\/(\d+)\/channel\/collectiondetail\/?$/i);
        if (m) {
          const sid = u.searchParams.get("sid") || u.searchParams.get("season_id") || hints.season_id;
          if (sid && /^\d+$/.test(sid)) {
            return {
              type: "collection",
              source: "auto",
              mid: m[1],
              season_id: String(sid)
            };
          }
        }
        m = path.match(/^\/(\d+)\/channel\/seriesdetail\/?$/i);
        if (m) {
          const sid = u.searchParams.get("sid") || u.searchParams.get("season_id") || hints.season_id;
          if (sid && /^\d+$/.test(sid)) {
            return {
              type: "collection",
              source: "auto",
              mid: m[1],
              season_id: String(sid)
            };
          }
        }
        const fid = (u.searchParams.get("fid") || hints.media_id || "").trim();
        if (fid && /^\d+$/.test(fid) && /\/favlist\/?$/i.test(path)) {
          return { type: "favorite", source: "auto", media_id: fid };
        }
        m = path.match(/^\/(\d+)/);
        if (m) {
          const segs = path.split("/").filter(Boolean);
          const mid = m[1];
          if (segs.length === 1 || segs.length === 2 && /^(video|upload|dynamic|favlist)?$/i.test(segs[1] || "") || segs.length === 3 && segs[1] === "upload" && segs[2] === "video") {
            if (segs[1] && /^favlist$/i.test(segs[1]) && !fid) {
              return { type: "user", source: "auto", mid, note: "favlist_no_fid" };
            }
            return { type: "user", source: "auto", mid };
          }
          return {
            type: "user",
            source: "auto",
            mid,
            note: "space_tab",
            bvid: hints.bvid || void 0
          };
        }
        return { type: "unknown", source: "auto", ...pickHintIds2(hints) };
      }
      if (/^(www\.)?bilibili\.com$/i.test(host2)) {
        let m = path.match(/^\/medialist\/(?:detail|play)\/ml(\d+)\/?$/i);
        if (m) return { type: "favorite", source: "auto", media_id: m[1] };
        m = path.match(/^\/list\/ml(\d+)\/?/i);
        if (m) return { type: "favorite", source: "auto", media_id: m[1] };
        m = path.match(/^\/list\/(\d+)\/?/i);
        if (m) {
          const mid = m[1];
          const sid = u.searchParams.get("sid") || u.searchParams.get("season_id") || hints.season_id;
          const bvid2 = extractBvid2(href) || extractBvid2(u.searchParams.get("bvid") || "") || hints.bvid;
          if (sid && /^\d+$/.test(String(sid))) {
            return {
              type: "collection",
              source: "auto",
              mid,
              season_id: String(sid),
              bvid: bvid2 || void 0,
              page: Math.max(1, parseInt(u.searchParams.get("p") || "1", 10) || 1)
            };
          }
          if (bvid2) {
            return {
              type: "video",
              source: "auto",
              bvid: bvid2,
              mid,
              page: Math.max(1, parseInt(u.searchParams.get("p") || "1", 10) || 1),
              note: "list_without_sid"
            };
          }
          return { type: "user", source: "auto", mid, note: "list_mid_only" };
        }
        m = path.match(/^\/(?:fav|list)\/(?:ml)?(\d+)\/?$/i);
        if (m && !path.startsWith("/list/")) {
          return { type: "favorite", source: "auto", media_id: m[1] };
        }
        if (/^\/favlist\/?$/i.test(path)) {
          const fid = (u.searchParams.get("fid") || hints.media_id || "").trim();
          if (fid && /^\d+$/.test(fid)) {
            return { type: "favorite", source: "auto", media_id: fid };
          }
        }
        const bvid = extractBvid2(path) || extractBvid2(href) || hints.bvid;
        if (bvid && (/\/video\//i.test(path) || hints.fromVideoPath)) {
          const p = Math.max(1, parseInt(u.searchParams.get("p") || "1", 10) || 1);
          const ctx = {
            type: "video",
            source: "auto",
            bvid,
            page: p
          };
          if (hints.mid && hints.season_id) {
            ctx.mid = hints.mid;
            ctx.season_id = hints.season_id;
            ctx.note = "video_has_ugc_season";
          }
          return ctx;
        }
        if (/\/list\//i.test(path)) {
          const bvid2 = extractBvid2(href) || extractBvid2(u.searchParams.get("bvid") || "") || hints.bvid;
          if (bvid2) {
            return {
              type: "video",
              source: "auto",
              bvid: bvid2,
              page: Math.max(1, parseInt(u.searchParams.get("p") || "1", 10) || 1),
              mid: hints.mid || void 0,
              season_id: hints.season_id || void 0,
              note: "list_fallback_video"
            };
          }
        }
      }
      if (hints.bvid) {
        return {
          type: "video",
          source: "auto",
          bvid: hints.bvid,
          page: 1,
          mid: hints.mid || void 0,
          season_id: hints.season_id || void 0,
          note: "dom_bvid"
        };
      }
      return { type: "unknown", source: "auto", ...pickHintIds2(hints) };
    }
    function pickHintIds2(hints) {
      const o = {};
      if (hints.mid) o.mid = hints.mid;
      if (hints.season_id) o.season_id = hints.season_id;
      if (hints.media_id) o.media_id = hints.media_id;
      if (hints.bvid) o.bvid = hints.bvid;
      if (hints.keyword) o.keyword = hints.keyword;
      return o;
    }
    function extractPageHints(u) {
      const hints = {
        bvid: "",
        mid: "",
        season_id: "",
        media_id: "",
        keyword: "",
        fromVideoPath: false
      };
      try {
        if (!u) u = new URL(location.href);
      } catch {
        return hints;
      }
      hints.bvid = extractBvid2(u.searchParams.get("bvid") || "") || extractBvid2(u.pathname) || "";
      hints.keyword = (u.searchParams.get("keyword") || "").trim();
      const sid = u.searchParams.get("sid") || u.searchParams.get("season_id") || u.searchParams.get("business_id") || "";
      if (sid && /^\d+$/.test(String(sid))) hints.season_id = String(sid);
      const fid = u.searchParams.get("fid") || "";
      if (fid && /^\d+$/.test(fid)) hints.media_id = fid;
      if (/\/video\//i.test(u.pathname)) hints.fromVideoPath = true;
      let m = u.pathname.match(/space\.bilibili\.com\/(\d+)/i);
      if (!m) m = String(location.href).match(/space\.bilibili\.com\/(\d+)/i);
      if (m?.[1]) hints.mid = m[1];
      m = u.pathname.match(/^\/list\/(\d+)/i);
      if (m?.[1]) hints.mid = m[1];
      m = u.pathname.match(/^\/(\d+)(?:\/|$)/);
      if (m?.[1] && /space\.bilibili\.com/i.test(u.hostname)) hints.mid = m[1];
      try {
        const anchors = document.querySelectorAll(
          'a[href*="lists/"], a[href*="collectiondetail"], a[href*="season_id"], a[href*="sid="], a[href*="/list/"]'
        );
        for (const a of anchors) {
          const href = a.getAttribute("href") || a.href || "";
          const lm = href.match(/\/(\d+)\/lists\/(\d+)/);
          if (lm?.[1] && lm[2]) {
            if (!hints.mid) hints.mid = lm[1];
            if (!hints.season_id) hints.season_id = lm[2];
            break;
          }
          try {
            const au = new URL(href, location.origin);
            const sm = au.searchParams.get("sid") || au.searchParams.get("season_id");
            if (sm && /^\d+$/.test(sm)) {
              if (!hints.season_id) hints.season_id = sm;
              const mm = au.pathname.match(/\/(\d+)/);
              if (mm?.[1] && !hints.mid) hints.mid = mm[1];
            }
            const listMid = au.pathname.match(/\/list\/(\d+)/i);
            if (listMid?.[1] && !hints.mid) hints.mid = listMid[1];
          } catch {
          }
        }
        if (!hints.bvid) {
          const b = extractBvid2(
            document.querySelector('meta[itemprop="url"]')?.content || ""
          );
          if (b) hints.bvid = b;
        }
        if (!hints.bvid) {
          const og = document.querySelector('meta[property="og:url"]')?.content;
          if (og) hints.bvid = extractBvid2(og);
        }
      } catch {
      }
      if (!hints.bvid) {
        const extractPlaying = bilibiliFn("extractPlayingVideoHint");
        const playing = typeof extractPlaying === "function" ? extractPlaying(pageWindow) : null;
        const playingBvid = extractBvid2(playing?.bvid || "");
        if (playingBvid) hints.bvid = playingBvid;
      }
      return hints;
    }
    function resolveContext() {
      const root = document.getElementById(PANEL_ID);
      const modeSel = root?.querySelector('[data-role="mode"]');
      const mode = (modeSel?.value || state2.mode || "auto").trim();
      state2.mode = MODE_OPTIONS.includes(mode) ? mode : "auto";
      const auto = detectContext2(location.href);
      state2.autoCtx = auto;
      if (state2.mode === "auto") {
        return { ...auto, source: "auto" };
      }
      const type = state2.mode;
      const hints = extractPageHints();
      const base = { ...auto, ...pickHintIds2(hints), type, source: "manual" };
      if (type === "video" || type === "selection") {
        base.bvid = auto.bvid || hints.bvid || extractBvid2(location.href) || "";
        base.page = auto.page || Math.max(
          1,
          parseInt(new URL(location.href).searchParams.get("p") || "1", 10) || 1
        );
      }
      if (type === "user") {
        base.mid = auto.mid || hints.mid || "";
      }
      if (type === "collection") {
        base.mid = auto.mid || hints.mid || "";
        base.season_id = auto.season_id || hints.season_id || "";
      }
      if (type === "favorite") {
        base.media_id = auto.media_id || hints.media_id || "";
      }
      if (type === "search") {
        base.keyword = auto.keyword || hints.keyword || "";
        base.order = auto.order || "totalrank";
        base.page = auto.page || 1;
      }
      return base;
    }
    function formatCtxBits(ctx) {
      const bits = [];
      if (ctx.bvid) bits.push(ctx.bvid);
      if (ctx.mid) bits.push(`mid=${ctx.mid}`);
      if (ctx.season_id) bits.push(`season=${ctx.season_id}`);
      if (ctx.media_id) bits.push(`fid=${ctx.media_id}`);
      if (ctx.keyword) bits.push(`「${ctx.keyword}」`);
      if (ctx.order && ctx.type === "search") bits.push(`order=${ctx.order}`);
      if (ctx.page && (ctx.type === "video" || ctx.type === "selection")) {
        bits.push(`p=${ctx.page}`);
      }
      if (ctx.note === "video_has_ugc_season") bits.push("页内含合集信息");
      if (ctx.note === "list_without_sid") bits.push("list页无sid");
      return bits.join(" · ") || location.href.slice(0, 80);
    }
    function currentPageNumber() {
      try {
        return Math.max(1, parseInt(new URL(location.href).searchParams.get("p") || "1", 10) || 1);
      } catch {
        return 1;
      }
    }
    function routeVideoKey2(bvid, page) {
      try {
        const pure = typeof SubBatch2 !== "undefined" ? SubBatch2?.SubBatchMonorepo?.bilibili?.routeVideoKey : null;
        if (typeof pure === "function") return pure(bvid, page);
      } catch {
      }
      return `${String(bvid || "").toUpperCase()}:P${Math.max(1, Number(page) || 1)}`;
    }
    function currentRouteVideoRef() {
      const resolved = appCall("video.resolve", location.href, pageWindow);
      if (resolved) return resolved;
      const ctx = detectContext2(location.href);
      const resolvePlaying = bilibiliFn("resolvePlayingVideoRef");
      const extractPlaying = bilibiliFn("extractPlayingVideoHint");
      const playing = typeof extractPlaying === "function" ? extractPlaying(pageWindow) : null;
      if (typeof resolvePlaying === "function") {
        const ref = resolvePlaying({
          href: location.href,
          urlBvid: ctx?.bvid || extractBvid2(location.href),
          urlPage: ctx?.page || currentPageNumber(),
          playing
        });
        if (ref) return { ...ref, ctx };
      }
      const bvid = String(ctx?.bvid || extractBvid2(location.href) || "").trim();
      if (!bvid) return null;
      const page = Math.max(1, Number(ctx?.page || currentPageNumber()) || 1);
      return { bvid, page, key: routeVideoKey2(bvid, page), ctx };
    }
    function currentRouteVideoKey() {
      return currentRouteVideoRef()?.key || "";
    }
    const persistentCache = createPersistentCache({
      databaseName: CACHE_DB_NAME,
      databaseVersion: CACHE_DB_VERSION,
      storeName: CACHE_STORE_NAME,
      channelName: CACHE_CHANNEL_NAME,
      indexedDb: () => globalThis.indexedDB,
      broadcastChannel: () => globalThis.BroadcastChannel,
      onSubtitleChanged: (key) => state2.fastSubtitleCache.delete(key)
    });
    async function fetchVideoViewFast(bvid, signal, { forceNetwork = false } = {}) {
      const key = String(bvid || "").toUpperCase();
      if (!forceNetwork) {
        const runtime2 = bilibiliCall("video.runtimeView", pageWindow, key);
        if (runtime2) {
          lruSet(state2.fastViewCache, key, runtime2);
          writeSessionCache(() => sessionStorage, CACHE_SESSION_PREFIX, "view", key, runtime2);
          return { value: runtime2, cacheLevel: "L0 页面态" };
        }
        const memory = lruGet(state2.fastViewCache, key);
        if (memory) return { value: memory, cacheLevel: "L1 内存" };
        const session = readSessionCache(() => sessionStorage, CACHE_SESSION_PREFIX, "view", key, VIEW_CACHE_TTL_MS);
        if (session) {
          lruSet(state2.fastViewCache, key, session);
          return { value: session, cacheLevel: "L2 会话" };
        }
      }
      const value = await appCall(
        "acquisition.fetchVideoView",
        runtimeNetwork(),
        bvid,
        signal
      );
      lruSet(state2.fastViewCache, key, value);
      writeSessionCache(() => sessionStorage, CACHE_SESSION_PREFIX, "view", key, value);
      return { value, cacheLevel: "NET 视频详情" };
    }
    async function fetchSubtitleTracksFast(meta, signal, { forceNetwork = false } = {}) {
      const cacheKey = `${meta.bvid}:${meta.cid}`;
      if (!forceNetwork) {
        const runtime2 = bilibiliCall("subtitle.runtimeTracks", pageWindow, meta);
        if (runtime2) {
          lruSet(state2.fastTrackCache, cacheKey, runtime2);
          writeSessionCache(() => sessionStorage, CACHE_SESSION_PREFIX, "tracks", cacheKey, runtime2);
          return { tracks: runtime2, cacheLevel: "L0 播放器态" };
        }
        const memory = lruGet(state2.fastTrackCache, cacheKey);
        if (memory) return { tracks: memory, cacheLevel: "L1 内存" };
        const session = readSessionCache(() => sessionStorage, CACHE_SESSION_PREFIX, "tracks", cacheKey, TRACK_CACHE_TTL_MS);
        if (session) {
          lruSet(state2.fastTrackCache, cacheKey, session);
          return { tracks: session, cacheLevel: "L2 会话" };
        }
      }
      const tracks = await appCall(
        "acquisition.fetchSubtitleTracks",
        runtimeNetwork(),
        meta,
        signal
      );
      lruSet(state2.fastTrackCache, cacheKey, tracks);
      writeSessionCache(() => sessionStorage, CACHE_SESSION_PREFIX, "tracks", cacheKey, tracks);
      return { tracks, cacheLevel: "NET 字幕轨道" };
    }
    async function fetchTrackBodyFast(base, tracks, trackIndex, signal, { forceNetwork = false } = {}) {
      const track = tracks[trackIndex];
      if (!track) throw new Error("字幕轨道不存在");
      const langKey = String(track.lan || trackIndex || "default");
      const cacheKey = `${base.bvid}:${base.cid}:${langKey}`;
      if (!forceNetwork) {
        const memory = lruGet(state2.fastTrackBodyCache, cacheKey);
        if (memory) return { ...memory, source: "L1 内存字幕", cacheLevel: "L1 内存" };
        const persistent = await persistentCache.read(`subtitle-track:${cacheKey}`);
        if (persistent?.value) {
          const result2 = { ...persistent.value, cacheStale: Date.now() - persistent.updatedAt > SUBTITLE_REVALIDATE_MS };
          lruSet(state2.fastTrackBodyCache, cacheKey, result2);
          return { ...result2, source: "L3 持久字幕", cacheLevel: "L3 IndexedDB" };
        }
      }
      const lan = String(track.lan || "");
      let url = bilibiliCall("subtitle.normalizeUrl", track.subtitle_url || "");
      if (!url && lan.startsWith("ai-") && base.aid) {
        const resolved = await appCall(
          "acquisition.resolveSubtitleUrl",
          runtimeNetwork(),
          track,
          { aid: base.aid, cid: base.cid },
          "",
          signal
        );
        url = resolved.url;
      }
      if (!url) return { ...base, status: "empty", lan, tracks, activeTrackIndex: trackIndex, source: "NET 无地址" };
      const body = await appCall(
        "acquisition.fetchSubtitleBody",
        runtimeNetwork(),
        url,
        signal
      );
      if (!body.length) {
        return { ...base, status: "empty", lan, tracks, activeTrackIndex: trackIndex, source: "NET 空字幕" };
      }
      const cues = dedupeCues(coreCall("toCues", body));
      const result = {
        ...base,
        status: "ok",
        cue_count: cues.length,
        lan,
        lan_doc: String(track.lan_doc || lan),
        data: cues,
        tracks,
        activeTrackIndex: trackIndex,
        source: "NET 直读",
        cacheLevel: "NET",
        cacheStale: false
      };
      lruSet(state2.fastTrackBodyCache, cacheKey, result);
      persistentCache.write(`subtitle-track:${cacheKey}`, result, SUBTITLE_CACHE_TTL_MS).catch(() => {
      });
      return result;
    }
    async function fetchCurrentSubtitleFast(bvid, page = 1, signal, { forceNetwork = false } = {}) {
      bvid = extractBvid2(bvid) || String(bvid || "").trim();
      if (!bvid) throw new Error("empty bvid");
      const viewHit = await fetchVideoViewFast(bvid, signal, { forceNetwork });
      const view2 = viewHit.value;
      if (bilibiliCall("video.isChargeBlocked", view2)) {
        return { bvid, status: "empty", error: "charge_exclusive_blocked", source: viewHit.cacheLevel };
      }
      const base = bilibiliCall("video.pageMeta", view2, bvid, page);
      const { cid } = base;
      if (!cid) return { ...base, status: "error", error: "no cid", source: viewHit.cacheLevel };
      const preferredKey = `${base.bvid}:${cid}`;
      if (!forceNetwork) {
        const memory = lruGet(state2.fastSubtitleCache, preferredKey);
        if (memory) return { ...memory, source: "L1 内存字幕", cacheLevel: "L1 内存" };
        const persistent = await persistentCache.read(`subtitle:${preferredKey}`);
        if (persistent?.value) {
          const result2 = {
            ...persistent.value,
            source: "L3 持久字幕",
            cacheLevel: "L3 IndexedDB",
            cacheStale: Date.now() - persistent.updatedAt > SUBTITLE_REVALIDATE_MS
          };
          lruSet(state2.fastSubtitleCache, preferredKey, result2);
          return result2;
        }
      }
      const trackHit = await fetchSubtitleTracksFast({ ...base, cid }, signal, { forceNetwork });
      const tracks = trackHit.tracks;
      if (!tracks.length) return { ...base, status: "empty", tracks: [], source: trackHit.cacheLevel };
      const activeTrackIndex = bilibiliCall("subtitle.preferredIndex", tracks);
      const result = await fetchTrackBodyFast({ ...base, cid }, tracks, activeTrackIndex, signal, { forceNetwork });
      const finalResult = {
        ...result,
        cachePath: `${viewHit.cacheLevel} → ${trackHit.cacheLevel} → ${result.cacheLevel || result.source}`
      };
      if (finalResult.status === "ok") {
        lruSet(state2.fastSubtitleCache, preferredKey, finalResult);
        persistentCache.write(`subtitle:${preferredKey}`, finalResult, SUBTITLE_CACHE_TTL_MS).catch(() => {
        });
      }
      return finalResult;
    }
    async function fetchSubtitle(bvid, page = 1) {
      bvid = extractBvid2(bvid) || String(bvid || "").trim();
      if (!bvid) return { bvid: "", status: "error", error: "empty bvid" };
      let detail;
      try {
        detail = await appCall("acquisition.fetchVideoDetail", runtimeNetwork(), bvid);
      } catch (e) {
        return { bvid, status: "error", error: `view/detail: ${errorMessage(e)}` };
      }
      if (detail.code !== 0) {
        return {
          bvid,
          status: "error",
          error: `view/detail code=${detail.code} ${detail.message || ""}`
        };
      }
      const view2 = detail.data && detail.data.View || {};
      if (bilibiliCall("video.isChargeBlocked", view2)) {
        return { bvid, status: "empty", error: "charge_exclusive_blocked" };
      }
      const aid = Number(view2.aid) || null;
      const cid = resolveCid(view2, page);
      const title = String(view2.title || "");
      const author = String(view2.owner && view2.owner.name || "");
      const pages = Array.isArray(view2.pages) ? view2.pages : [];
      const base = { bvid, aid, cid, title, author, pages, page };
      if (cid == null) return { ...base, status: "error", error: "no cid" };
      const { subs, source: src0 } = await appCall(
        "acquisition.collectSubtitleTracks",
        runtimeNetwork(),
        { aid, cid, bvid }
      );
      if (!subs.length) return { ...base, status: "empty" };
      const track = bilibiliCall("subtitle.pickTrack", subs);
      if (!track) return { ...base, status: "empty" };
      const lan = String(track.lan || "");
      const { url, source } = await appCall(
        "acquisition.resolveSubtitleUrl",
        runtimeNetwork(),
        track,
        { aid, cid },
        src0
      );
      if (!url) return { ...base, status: "empty", lan };
      let body;
      try {
        body = await appCall("acquisition.fetchSubtitleBody", runtimeNetwork(), url);
      } catch (e) {
        return {
          ...base,
          status: "error",
          lan,
          error: `subtitle body: ${errorMessage(e)}`
        };
      }
      if (!Array.isArray(body) || !body.length) {
        return { ...base, status: "empty", lan };
      }
      const cues = coreCall("toCues", body);
      return {
        ...base,
        status: "ok",
        cue_count: cues.length,
        lan,
        data: cues,
        source
      };
    }
    async function httpBilibiliList(url, headers) {
      return appCall("scan.parseListResponse", await httpJson(url, headers));
    }
    async function fetchListPage(ctx, page, pageSize) {
      if (ctx.type === "user") {
        const q = await appCall(
          "acquisition.signWbi",
          runtimeNetwork(),
          {
            mid: ctx.mid,
            pn: page,
            ps: pageSize,
            tid: 0,
            keyword: "",
            order: "pubdate",
            web_location: 1550101,
            order_avoided: true
          }
        );
        const result = await httpBilibiliList(
          `https://api.bilibili.com/x/space/wbi/arc/search?${q}`,
          { Referer: `https://space.bilibili.com/${ctx.mid}`, Origin: "https://space.bilibili.com" }
        );
        if (result.code !== 0) {
          throw new Error(result.message || `user list code=${result.code}`);
        }
        const vlist = result.data && result.data.list && result.data.list.vlist || [];
        const pageInfo = result.data && result.data.page || {};
        const items = vlist.map((v) => ({
          bvid: v.bvid,
          aid: v.aid,
          title: v.title || "",
          author: v.author || "",
          page: 1
        }));
        const hasMore = pageInfo.pn && pageInfo.ps && pageInfo.count != null ? pageInfo.pn * pageInfo.ps < pageInfo.count : vlist.length >= pageSize;
        return { items, hasMore, meta: { count: pageInfo.count } };
      }
      if (ctx.type === "favorite") {
        const result = await httpBilibiliList(
          `https://api.bilibili.com/x/v3/fav/resource/list?media_id=${ctx.media_id}&pn=${page}&ps=${Math.min(pageSize, 20)}&platform=web&t=${Date.now()}`,
          { Referer: "https://space.bilibili.com/", Origin: "https://www.bilibili.com" }
        );
        if (result.code !== 0) {
          throw new Error(result.message || `fav list code=${result.code}`);
        }
        const medias = result.data && result.data.medias || [];
        const items = medias.filter((v) => v && (v.type === 2 || v.bvid || v.bv_id)).map((v) => ({
          bvid: v.bvid || v.bv_id || "",
          aid: v.id || v.aid || 0,
          title: v.title || "",
          author: v.upper && v.upper.name || v.author || "",
          page: 1
        })).filter((v) => v.bvid);
        return {
          items,
          hasMore: result.data && result.data.has_more === true,
          meta: { title: result.data && result.data.info && result.data.info.title || "" }
        };
      }
      if (ctx.type === "collection") {
        const result = await httpBilibiliList(
          `https://api.bilibili.com/x/polymer/web-space/seasons_archives_list?mid=${ctx.mid}&season_id=${ctx.season_id}&sort_reverse=false&page_num=${page}&page_size=${pageSize}&web_location=333.1387`,
          {
            Referer: `https://space.bilibili.com/${ctx.mid}/channel/collectiondetail?sid=${ctx.season_id}`,
            Origin: "https://space.bilibili.com"
          }
        );
        if (result.code !== 0) {
          throw new Error(result.message || `collection code=${result.code}`);
        }
        const archives = result.data && result.data.archives || [];
        const pageInfo = result.data && result.data.page || {};
        const metaBlock = result.data && result.data.meta || {};
        const author = metaBlock.upper?.name || metaBlock.author || metaBlock.name_upper || archives.find((v) => v?.author || v?.owner?.name)?.author || archives.find((v) => v?.owner?.name)?.owner?.name || "";
        const items = archives.map((v) => ({
          bvid: v.bvid,
          aid: v.aid,
          title: v.title || "",
          author: v.author || v.owner?.name || author || "",
          page: 1
        }));
        let hasMore = false;
        if (pageInfo.total != null) {
          hasMore = page * pageSize < pageInfo.total;
        } else {
          hasMore = archives.length >= pageSize;
        }
        return {
          items,
          hasMore,
          meta: {
            total: pageInfo.total,
            name: metaBlock.name || metaBlock.title || "",
            author,
            mid: ctx.mid,
            season_id: ctx.season_id
          }
        };
      }
      if (ctx.type === "search") {
        const q = await appCall(
          "acquisition.signWbi",
          runtimeNetwork(),
          {
            search_type: "video",
            keyword: ctx.keyword,
            order: ctx.order || "totalrank",
            page,
            page_size: 42
          }
        );
        const result = await httpBilibiliList(
          `https://api.bilibili.com/x/web-interface/wbi/search/type?${q}`,
          { Referer: "https://search.bilibili.com/", Origin: "https://search.bilibili.com" }
        );
        if (result.code !== 0) {
          throw new Error(result.message || `search code=${result.code}`);
        }
        const rows2 = result.data && result.data.result || [];
        const items = rows2.map((v) => ({
          bvid: v.bvid || extractBvid2(v.arcurl || ""),
          aid: v.aid || v.id || 0,
          title: stripHtml(v.title) || "未知标题",
          author: stripHtml(v.author || v.up_name) || "",
          page: 1
        })).filter((v) => v.bvid);
        const numPages = result.data && result.data.numPages || 0;
        const hasMore = numPages ? page < numPages : items.length >= 42;
        return {
          items,
          hasMore,
          meta: {
            numResults: result.data && result.data.numResults || 0,
            keyword: ctx.keyword
          }
        };
      }
      throw new Error(`unsupported list type: ${ctx.type}`);
    }
    async function loadAllListItems(ctx, { maxPages, pageSize, onProgress, delayMs, shouldCancel }) {
      return appCall("libraryScan.collectPages", { maxPages, pageSize, ...delayMs === void 0 ? {} : { delayMs } }, {
        fetchPage: (page, size) => fetchListPage(ctx, page, size),
        waitIfPaused: () => waitIfJobPaused(),
        cancelled: () => typeof shouldCancel === "function" && shouldCancel(),
        ...onProgress ? { progress: onProgress } : {},
        sleep
      });
    }
    async function loadUserSpaceSeasons(mid, {
      maxPages = 30,
      pageSize = 20,
      onProgress,
      delayMs = 280,
      shouldCancel,
      maxSeasonArchivePages = 40
    } = {}) {
      return appCall(
        "libraryScan.collectUserSeasons",
        mid,
        { maxPages, pageSize, delayMs, maxSeasonArchivePages },
        {
          fetchPage: async (midStr, page, size) => parseUserSeasonPage(await httpJson(
            "https://api.bilibili.com/x/polymer/web-space/seasons_series_list?mid=" + encodeURIComponent(midStr) + "&page_num=" + page + "&page_size=" + size + "&web_location=333.1387",
            { Referer: "https://space.bilibili.com/" + midStr, Origin: "https://space.bilibili.com" }
          )),
          loadMembers: async (midStr, sid, archivePages, ms, progress) => {
            const full = await loadAllListItems(
              { type: "collection", mid: midStr, season_id: sid },
              {
                maxPages: archivePages,
                pageSize: 30,
                delayMs: ms,
                onProgress: progress,
                ...shouldCancel ? { shouldCancel } : {}
              }
            );
            return full.items.map((item) => item.bvid).filter(Boolean);
          },
          shortUrl: buildCollectionShortUrl2,
          ...onProgress ? { progress: onProgress } : {},
          cancelled: () => typeof shouldCancel === "function" && shouldCancel(),
          sleep,
          warn: (sid, error) => console.warn(
            "[bili-subbatch] loadUserSpaceSeasons archives",
            sid,
            errorMessage(error)
          )
        }
      );
    }
    async function expandCollectionArchivesWithParts(items, {
      onProgress,
      shouldCancel,
      delayMs = 160
    } = {}) {
      return appCall("libraryScan.expandCollectionParts", items, { delayMs }, {
        cancelled: () => typeof shouldCancel === "function" && shouldCancel(),
        waitIfPaused: () => waitIfJobPaused(),
        extractBvid: extractBvid2,
        progress: (index, total, bvid) => {
          setLibraryJob({ kind: "scan", index, total, label: "展开分P " + bvid });
          if (onProgress) onProgress("展开合集分P " + index + "/" + total + "（" + bvid + "）…");
        },
        fetchView: async (bvid) => {
          const view2 = (await fetchVideoViewFast(bvid))?.value;
          if (!view2) return {};
          const aid = Number(view2.aid);
          return {
            ...view2.title !== void 0 ? { title: view2.title } : {},
            ...view2.owner ? { owner: view2.owner } : {},
            ...view2.pages ? { pages: view2.pages } : {},
            ...Number.isFinite(aid) ? { aid } : {}
          };
        },
        onFailure: (bvid, error) => console.warn(
          "[bili-subbatch] expand collection parts",
          bvid,
          errorMessage(error)
        ),
        sleep
      });
    }
    async function loadVideoAsItems(bvid, expandAllParts) {
      const r = await fetchSubtitle(bvid, 1);
      if (r.status === "error" && !r.pages?.length && !r.title) {
        throw new Error(r.error || "无法获取视频信息");
      }
      const pages = r.pages || [];
      if (expandAllParts && pages.length > 1) {
        const videoTitle = r.title || bvid;
        const author = r.author || "";
        const rawItems = pages.map((p, i) => ({
          bvid: r.bvid || bvid,
          aid: r.aid ?? null,
          title: `${videoTitle} - P${i + 1}【${p.part || ""}】`,
          author,
          page: i + 1,
          part: p.part || ""
        }));
        return {
          items: attachSelectionGroupMeta2(rawItems, { author, title: videoTitle }),
          meta: { title: videoTitle, author, multip: true },
          pages
        };
      }
      if (expandAllParts && pages.length <= 1) {
        return {
          items: [
            {
              bvid: r.bvid || bvid,
              aid: r.aid ?? null,
              title: r.title || bvid,
              author: r.author || "",
              page: 1
            }
          ],
          meta: {
            title: r.title || "",
            author: r.author || "",
            multip: false,
            hint: "该稿只有 1P，已按单视频处理"
          },
          pages
        };
      }
      return {
        items: [
          {
            bvid: r.bvid || bvid,
            aid: r.aid ?? null,
            title: r.title || bvid,
            author: r.author || "",
            page: 1
          }
        ],
        meta: { title: r.title || "", author: r.author || "", multip: pages.length > 1 },
        pages
      };
    }
    const state2 = createWorkbenchState({
      delayMs: DEFAULT_DELAY_MS,
      maxPages: DEFAULT_MAX_PAGES,
      preprocessEnabled: loadPreprocessEnabledSetting(),
      preprocessModelId: String(storageGet(PREPROCESS_MODEL_STORE_KEY, "") || ""),
      preprocessConcurrency: loadBoundedNumberSetting(PREPROCESS_CONCURRENCY_STORE_KEY, PREPROCESS_DEFAULT_CONCURRENCY, 1, 8),
      preprocessTargetMinutes: loadBoundedNumberSetting(PREPROCESS_TARGET_MINUTES_STORE_KEY, PREPROCESS_DEFAULT_TARGET_MINUTES, 2, 30),
      preprocessOverlapSeconds: loadBoundedNumberSetting(PREPROCESS_OVERLAP_SECONDS_STORE_KEY, PREPROCESS_DEFAULT_OVERLAP_SECONDS, 0, 120),
      preprocessMaxChars: loadBoundedNumberSetting(PREPROCESS_MAX_CHARS_STORE_KEY, PREPROCESS_DEFAULT_MAX_CHARS, 8e3, 6e4),
      preprocessRetries: loadBoundedNumberSetting(PREPROCESS_RETRIES_STORE_KEY, PREPROCESS_DEFAULT_RETRIES, 0, 4),
      studioModelId: String(storageGet(STUDIO_MODEL_STORE_KEY, "") || ""),
      autoCaptureEnabled: loadAutoCaptureSetting(),
      autoAnalyzeEnabled: loadAutoAnalyzeSetting(),
      transcriptAutoFollow: loadTranscriptFollowSetting(),
      autoEnablePlayerSubtitle: loadPlayerSubtitleSetting(),
      knowledgeModelId: String(storageGet(KNOWLEDGE_MODEL_STORE_KEY, "") || ""),
      shortcutConfig: loadShortcutSettings()
    });
    function panelGeometry() {
      const api = typeof SubBatch2 !== "undefined" ? SubBatch2?.SubBatchMonorepo?.ui?.panelGeometry : null;
      if (!api) throw new Error("[bili-subbatch] panel geometry API missing");
      return api;
    }
    function panelState() {
      const api = typeof SubBatch2 !== "undefined" ? SubBatch2?.SubBatchMonorepo?.ui?.panelState : null;
      if (!api) throw new Error("[bili-subbatch] panel state API missing");
      return api;
    }
    function isPanelSizePreset2(value) {
      return panelGeometry().isPanelSizePreset(value);
    }
    function panelPresetWidth2(name, viewportWidth = window.innerWidth) {
      return panelGeometry().panelPresetWidth(name, viewportWidth);
    }
    function highPanelHeight2(viewportHeight = window.innerHeight) {
      return panelGeometry().highPanelHeight(viewportHeight);
    }
    function panelSizeClassFromWidth2(width, viewportWidth = window.innerWidth) {
      return panelGeometry().panelSizeClassFromWidth(width, viewportWidth);
    }
    function panelPersistenceOptions() {
      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        defaultSizePreset: DEFAULT_PANEL_SIZE2,
        defaultFlavor: DEFAULT_CTP_FLAVOR,
        noteFontDefault: NOTE_FONT_DEFAULT,
        noteFontMin: NOTE_FONT_MIN,
        noteFontMax: NOTE_FONT_MAX,
        minWidth: MIN_W,
        minHeight: MIN_H,
        currentSizePreset: String(state2.ui?.sizePreset || ""),
        presetWidth: panelPresetWidth2,
        highHeight: highPanelHeight2,
        isPreset: isPanelSizePreset2,
        normalizeFlavor: normalizeCtpFlavor
      };
    }
    function clampKnowledgeRailW(value, panelWidth = state2.ui?.w || 520) {
      return SubBatch2.SubBatchMonorepo.ui.panelPersistence.clampKnowledgeRailWidth(value, panelWidth);
    }
    function clampKnowledgeNavW(value, panelWidth = state2.ui?.w || 520) {
      return SubBatch2.SubBatchMonorepo.ui.panelPersistence.clampKnowledgeNavWidth(
        value,
        panelWidth,
        String(state2.ui?.sizePreset || "")
      );
    }
    function applyKnowledgeLayoutVars(root = document.getElementById(PANEL_ID)) {
      if (!root || !state2.ui) return;
      const railW = clampKnowledgeRailW(state2.ui.knowledgeRailW, state2.ui.w);
      const size = String(state2.ui.sizePreset || "");
      const navDefault = size === "small" ? 240 : size === "medium" ? 240 : 280;
      const navW = clampKnowledgeNavW(state2.ui.knowledgeNavW ?? navDefault, state2.ui.w);
      state2.ui.knowledgeNavW = navW;
      root.style.setProperty("--bsb-knowledge-rail-w", `${railW}px`);
      root.style.setProperty("--bsb-knowledge-nav-w", `${navW}px`);
      root.dataset.panelView = state2.ui.view || "ai";
    }
    function normalizeNoteFont2(value, savedDefault) {
      return SubBatch2.SubBatchMonorepo.ui.panelPersistence.normalizeNoteFont(
        value,
        savedDefault,
        panelPersistenceOptions()
      );
    }
    function loadUiGeom() {
      try {
        return SubBatch2.SubBatchMonorepo.ui.panelPersistence.loadUiGeometry(
          localStorage.getItem(UI_STORE_KEY),
          panelPersistenceOptions()
        );
      } catch {
        return SubBatch2.SubBatchMonorepo.ui.panelPersistence.defaultUiGeometry(panelPersistenceOptions());
      }
    }
    function saveUiGeom() {
      if (!state2.ui) return;
      try {
        localStorage.setItem(UI_STORE_KEY, SubBatch2.SubBatchMonorepo.ui.panelPersistence.serializeUiGeometry(
          state2.ui,
          panelPersistenceOptions()
        ));
      } catch {
      }
    }
    function clampUiToViewport(ui2) {
      Object.assign(ui2, panelGeometry().clampPanelRect(ui2, window.innerWidth, window.innerHeight));
      return ui2;
    }
    function injectStyles() {
      GM_addStyle?.(`
      ${buildCtpFlavorCss(PANEL_ID)}

      ${SubBatch2.SubBatchMonorepo.ui.panelStyles.renderShellStyles(PANEL_ID, MIN_W, MIN_H, DOCK_EDGE_PX)}
      ${SubBatch2.SubBatchMonorepo.ui.workspaceLayoutStyles.renderWorkspaceLayoutStyles(PANEL_ID)}
      ${SubBatch2.SubBatchMonorepo.ui.workspaceControlsStyles.renderWorkspaceControlsStyles(PANEL_ID)}
      ${SubBatch2.SubBatchMonorepo.ui.subsStyles.renderSubsStyles(PANEL_ID)}
      ${SubBatch2.SubBatchMonorepo.ui.folioStyles.renderFolioStyles(PANEL_ID)}
      ${SubBatch2.SubBatchMonorepo.ui.aiStyles.renderAiStyles(PANEL_ID)}
      ${SubBatch2.SubBatchMonorepo.ui.settingsStyles.renderSettingsStyles(PANEL_ID)}
      ${SubBatch2.SubBatchMonorepo.ui.readingStyles.renderReadingStyles(PANEL_ID)}
      ${SubBatch2.SubBatchMonorepo.ui.knowledgeDrilldownStyles.renderKnowledgeDrilldownStyles(PANEL_ID)}
      ${SubBatch2.SubBatchMonorepo.ui.knowledgeWorkspaceStyles.renderKnowledgeWorkspaceStyles(PANEL_ID)}
      ${SubBatch2.SubBatchMonorepo.ui.workspaceOverrides.renderWorkspaceOverrides(PANEL_ID)}
      ${SubBatch2.SubBatchMonorepo.ui.lateStudioStyles.renderLateStudioStyles(PANEL_ID)}
    `);
    }
    function applyPanelGeometry() {
      const root = document.getElementById(PANEL_ID);
      if (!root || !state2.ui) return;
      const sidebar = root.querySelector(".bsb-sidebar");
      if (!sidebar) return;
      const ui2 = clampUiToViewport(state2.ui);
      const panelSizeClass = isPanelSizePreset2(ui2.sizePreset) ? ui2.sizePreset : panelSizeClassFromWidth2(ui2.w);
      root.setAttribute("data-panel-size", panelSizeClass);
      root.style.setProperty("--bsb-note-font", `${normalizeNoteFont2(ui2.noteFont, NOTE_FONT_DEFAULT)}px`);
      root.querySelectorAll('[data-act="panel-size"]').forEach((button) => {
        const active = isPanelSizePreset2(ui2.sizePreset) && button.dataset.size === ui2.sizePreset;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
      root.classList.toggle("open", !!state2.open);
      root.classList.toggle("ai-focus", !!state2.aiFocus);
      root.classList.toggle("docked", !!ui2.dock);
      root.querySelectorAll('[data-act="ai-focus"]').forEach((button) => {
        button.setAttribute("aria-pressed", state2.aiFocus ? "true" : "false");
        button.title = state2.aiFocus ? "退出专注阅读（Esc）" : "铺满窗口，只保留模型标签与正文";
      });
      root.classList.toggle("dock-expanded", !!(ui2.dock && ui2.dockExpanded));
      if (ui2.dock) root.setAttribute("data-dock", ui2.dock);
      else root.removeAttribute("data-dock");
      if (ui2.dock && !ui2.dockExpanded) {
        sidebar.style.left = "";
        sidebar.style.top = "";
        sidebar.style.width = "";
        sidebar.style.height = "";
      } else {
        if (ui2.dock === "right") {
          sidebar.style.left = Math.max(0, window.innerWidth - ui2.w - 8) + "px";
          sidebar.style.top = Math.max(8, Math.min(ui2.y, window.innerHeight - ui2.h - 8)) + "px";
        } else if (ui2.dock === "left") {
          sidebar.style.left = "8px";
          sidebar.style.top = Math.max(8, Math.min(ui2.y, window.innerHeight - ui2.h - 8)) + "px";
        } else {
          sidebar.style.left = ui2.x + "px";
          sidebar.style.top = ui2.y + "px";
        }
        sidebar.style.width = ui2.w + "px";
        sidebar.style.height = ui2.h + "px";
        sidebar.style.right = "auto";
        sidebar.style.bottom = "auto";
      }
      sidebar.setAttribute(
        "aria-hidden",
        state2.open && (!ui2.dock || ui2.dockExpanded) ? "false" : "true"
      );
      const fab = root.querySelector(".bsb-fab");
      if (fab) fab.setAttribute("aria-expanded", state2.open || !!ui2.dock ? "true" : "false");
      applyKnowledgeLayoutVars(root);
    }
    function bindPanelChrome(root) {
      const ui2 = state2.ui = loadUiGeom();
      applyCtpFlavor(ui2.ctpFlavor, { silent: true, persist: false });
      function setOpen(open) {
        const next = panelState().setPanelOpen({ ...ui2, open: state2.open, aiFocus: state2.aiFocus }, open);
        state2.open = next.open;
        state2.aiFocus = next.aiFocus;
        ui2.dock = next.dock;
        ui2.dockExpanded = next.dockExpanded;
        if (open) {
          refreshContextUI();
        } else {
          closeMermaidFullscreen();
        }
        applyPanelGeometry();
        saveUiGeom();
      }
      function setDock(side) {
        const next = panelState().setPanelDock({ ...ui2, open: state2.open, aiFocus: state2.aiFocus }, side, window.innerWidth);
        Object.assign(ui2, { dock: next.dock, dockExpanded: next.dockExpanded, x: next.x });
        state2.open = next.open;
        state2.aiFocus = next.aiFocus;
        if (side) {
          closeMermaidFullscreen();
        }
        applyPanelGeometry();
        saveUiGeom();
        setStatus(
          side ? `已贴边收起（${side === "right" ? "右" : "左"}侧）· 点标签展开` : "已取消贴边 · 悬浮模式"
        );
      }
      function toggleDockExpanded(force) {
        if (!ui2.dock) return;
        const next = panelState().expandPanelDock({ ...ui2, open: state2.open, aiFocus: state2.aiFocus }, force);
        ui2.dockExpanded = next.dockExpanded;
        state2.open = next.open;
        applyPanelGeometry();
        if (ui2.dockExpanded) refreshContextUI();
      }
      const chromeController2 = typeof SubBatch2 !== "undefined" ? SubBatch2?.SubBatchMonorepo?.ui?.panelChrome?.bindPanelChromeControls : null;
      if (typeof chromeController2 !== "function") throw new Error("[bili-subbatch] missing panel chrome controller");
      chromeController2({
        root,
        state: () => ({ open: state2.open, dock: ui2.dock, dockExpanded: ui2.dockExpanded }),
        setOpen,
        setDock,
        expandDock: toggleDockExpanded,
        preferredDockSide: () => panelState().preferredDockSide(ui2, window.innerWidth),
        selectSize: (next) => {
          if (!isPanelSizePreset2(next)) return;
          const oldWidth = ui2.w;
          const oldRight = ui2.x + oldWidth;
          const anchorRight = ui2.dock === "right" || !ui2.dock && ui2.x + oldWidth / 2 >= window.innerWidth / 2;
          ui2.sizePreset = next;
          ui2.w = panelPresetWidth2(next);
          if (anchorRight && !ui2.dock) ui2.x = oldRight - ui2.w;
          clampUiToViewport(ui2);
          applyPanelGeometry();
          saveUiGeom();
          setStatus(`面板宽度：${PANEL_SIZE_PRESETS2[next].label} · ${Math.round(ui2.w)}px；高度保持${ui2.heightMode === "custom" ? "自定义" : "约 90% 视口"}`);
        }
      });
      const pointerController2 = typeof SubBatch2 !== "undefined" ? SubBatch2?.SubBatchMonorepo?.ui?.panelPointer?.bindPanelPointerController : null;
      if (typeof pointerController2 !== "function") throw new Error("[bili-subbatch] missing panel pointer controller");
      pointerController2({
        root,
        getState: () => ui2,
        update: (patch) => Object.assign(ui2, patch),
        setOpen: (open) => {
          state2.open = open;
        },
        setDock,
        render: applyPanelGeometry,
        persist: saveUiGeom,
        viewport: () => ({ width: window.innerWidth, height: window.innerHeight }),
        snapThreshold: DOCK_SNAP_PX
      });
      window.addEventListener("resize", () => {
        if (!ui2) return;
        clampUiToViewport(ui2);
        applyPanelGeometry();
      });
      if (ui2.dock) {
        state2.open = true;
        ui2.dockExpanded = false;
      }
      applyPanelGeometry();
      try {
        setWorkspace(ui2.view || "ai", { silent: true });
      } catch {
      }
      root._bsbSetOpen = setOpen;
      root._bsbSetDock = setDock;
      root._bsbToggleDockExpanded = toggleDockExpanded;
    }
    function ensurePanel() {
      let root = document.getElementById(PANEL_ID);
      if (root) return root;
      injectStyles();
      root = document.createElement("div");
      root.id = PANEL_ID;
      root.setAttribute("data-ctp-flavor", normalizeCtpFlavor(state2.ui?.ctpFlavor || DEFAULT_CTP_FLAVOR));
      root.innerHTML = `
      ${SubBatch2.SubBatchMonorepo.ui.panelMarkup.renderPanelHeader(SCRIPT_VERSION)}
        <div class="bsb-body">
          <!-- AI 主画布 -->
          ${SubBatch2.SubBatchMonorepo.ui.workspaceMarkup.renderAiWorkspace()}

          <!-- 字幕资源库 -->
          ${SubBatch2.SubBatchMonorepo.ui.workspaceMarkup.renderSubsWorkspace(DEFAULT_MAX_PAGES, DEFAULT_DELAY_MS)}

          <!-- Knowledge Workspace · Navigator | Reader（仅本 view active 时可见） -->
          ${SubBatch2.SubBatchMonorepo.ui.workspaceMarkup.renderKnowledgeWorkspaceMarkup()}

          <!-- 设置 · v5.5 Master–Detail -->
          ${SubBatch2.SubBatchMonorepo.ui.workspaceMarkup.renderSettingsWorkspace()}
        </div>
        <div class="bsb-statusbar">
          <span class="bsb-status-dot" data-role="status-dot"></span>
          <div class="bsb-status" data-role="status" role="status" aria-live="polite">就绪 · AI 工作台</div>
        </div>
      </aside>
      <div class="bsb-selection-toolbar" data-role="knowledge-selection-toolbar" hidden>
        <span class="bsb-selection-toolbar-text" data-role="knowledge-selection-text"></span>
        <div class="bsb-selection-toolbar-actions">
          <button type="button" data-knowledge-selection-act="explain">✦ 解释</button>
          <button type="button" data-knowledge-selection-act="deep">↳ 深入</button>
          <button type="button" data-knowledge-selection-act="question">? 提问</button>
          <button type="button" data-knowledge-selection-act="save">☆ 收藏</button>
        </div>
      </div>
      <button type="button" class="bsb-fab" title="SubBatch 工作台" aria-expanded="false">CC</button>
    `;
      document.documentElement.appendChild(root);
      bindPanelChrome(root);
      bindKnowledgeLayoutInteractions(root);
      applyKnowledgeLayoutVars(root);
      SubBatch2.SubBatchMonorepo.ui.settingsInteraction.bind(root, {
        selectWorkspace: (view2) => setWorkspace(view2),
        maxPages: (value) => {
          state2.maxPages = value;
        },
        delayMs: (value) => {
          state2.delayMs = value;
        },
        autoCapture: (enabled) => {
          state2.autoCaptureEnabled = enabled;
          saveAutoCaptureSetting(enabled);
          if (enabled) {
            setStatus("已开启：打开视频自动抓字幕");
            scheduleAutoCapture("setting-enabled", 0);
          } else {
            state2.autoCaptureAbortController?.abort();
            clearTimeout(state2.autoCaptureTimer);
            setStatus("已关闭自动抓取；仍可手动扫描", "ok");
          }
        },
        autoAnalyze: (enabled) => {
          state2.autoAnalyzeEnabled = enabled;
          saveAutoAnalyzeSetting(enabled);
          clearTimeout(state2.autoAnalyzeTimer);
          state2.autoAnalyzePendingKey = "";
          if (enabled) {
            state2.autoAnalyzeKey = "";
            const item = currentTranscriptItem();
            if (item?.subStatus === "ok" && item.data?.length) {
              scheduleAutoAnalyze(item, routeVideoKey2(item.bvid, item.page || 1), "setting-enabled", 0);
            } else {
              setStatus("已开启：抓到字幕后自动开始分析");
            }
          } else {
            setStatus("已关闭自动分析；仍可点击“开始分析”", "ok");
          }
        },
        playerSubtitle: (enabled) => {
          state2.autoEnablePlayerSubtitle = enabled;
          storageSet(PLAYER_SUBTITLE_STORE_KEY, enabled ? "true" : "false");
          if (enabled) enablePlayerSubtitle(currentTranscriptItem()).catch(() => {
          });
        },
        mode: (value) => {
          state2.mode = value;
          refreshContextUI();
          setStatus(value === "auto" ? "已切回自动识别（默认偏单个视频）" : "已手动指定：" + (TYPE_LABEL[value] || value));
        },
        promptSelect: (activeId) => {
          savePromptProfilesFromForm({ activeId });
          updatePromptUi(root, getActivePromptProfile());
          setStatus(activeId ? "提示词：" + (getActivePromptProfile()?.name || "未命名") : "当前没有提示词", activeId ? "ok" : "err");
        },
        preprocessEnabled: (enabled) => {
          state2.preprocessEnabled = enabled;
          savePreprocessEnabledSetting(enabled);
          refreshPromptSelector(root);
          refreshPreprocessModelSelector(root);
          setStatus(enabled ? "字幕预处理已开启" : "字幕预处理已关闭：后处理将直接使用原始字幕", "ok");
        },
        preprocessPrompt: (id) => {
          savePromptProfilesFromForm({ activeId: state2.activePromptId });
          savePromptProfiles(state2.promptProfiles, state2.activePromptId, id);
          setStatus("预处理 Prompt：" + (getActivePreprocessPromptProfile()?.name || "未命名"), "ok");
        },
        preprocessModel: (id) => {
          state2.preprocessModelId = id;
          storageSet(PREPROCESS_MODEL_STORE_KEY, id);
          const cfg = getPreprocessModelConfig();
          setStatus("预处理模型：" + (cfg?.name || cfg?.model || "未选择"), cfg ? "ok" : "err");
        },
        promptSearch: (value) => {
          state2.promptSearch = value;
          renderPromptList(root);
        },
        aiSearch: (value) => {
          state2.aiSearch = value;
          renderAiList(root);
        },
        knowledgeSearch: (value) => {
          state2.knowledgeSearch = value;
          renderKnowledgeWorkspace().catch(() => {
          });
        }
      }, {
        maxPages: DEFAULT_MAX_PAGES,
        delayMs: DEFAULT_DELAY_MS,
        autoCapture: !!state2.autoCaptureEnabled,
        autoAnalyze: !!state2.autoAnalyzeEnabled,
        playerSubtitle: !!state2.autoEnablePlayerSubtitle,
        preprocessEnabled: !!state2.preprocessEnabled
      });
      SubBatch2.SubBatchMonorepo.ui.reorderInteraction.bind(root, {
        reorderConfig: commitConfigListReorder,
        reorderFlow: commitFlowModelReorder
      });
      SubBatch2.SubBatchMonorepo.ui.studioInteractionController.bind(root, {
        getIndex: () => state2.studioSlashIndex,
        setIndex: (index) => {
          state2.studioSlashIndex = index;
        },
        renderMenu: renderStudioSlashMenu,
        hideMenu: hideStudioSlashMenu,
        runCommand: runStudioSlash,
        send: sendStudioChat,
        clear: studioClearChat,
        copy: studioCopyLast,
        exportChat: studioExportChat,
        onError: (error) => setStatus(`对话失败：${errorMessage(error)}`, "err")
      });
      root.addEventListener("mouseup", (e) => {
        const target = e.target instanceof Element ? e.target : e.target instanceof Text ? e.target.parentElement : null;
        if (!target) return;
        if (target.closest('[data-role="knowledge-selection-toolbar"], [data-role="knowledge-rail"]')) return;
        setTimeout(captureKnowledgeSelection, 0);
      });
      SubBatch2.SubBatchMonorepo.ui.resourceInteraction.bind(root, {
        followEnabled: () => !!state2.transcriptAutoFollow,
        selectGroup: (key, checked) => {
          setGroupSelection2(state2.items, key, checked);
          renderList({ renderTranscript: false });
        },
        selectItem: (index, checked) => {
          const item = state2.items[Number(index)];
          if (item) item.selected = checked;
          renderList({ renderTranscript: false });
        },
        toggleFolder: (key) => {
          if (!state2.libraryFolderCollapsed) state2.libraryFolderCollapsed = {};
          state2.libraryFolderCollapsed[key] = !state2.libraryFolderCollapsed[key];
          renderList({ renderTranscript: false });
        },
        openItem: (index) => {
          const item = state2.items[Number(index)];
          if (item) selectTranscriptItem(item);
        },
        searchLibrary: (query) => {
          state2.libraryQuery = query;
          renderList({ renderTranscript: false });
        },
        filterLibrary: (filter) => {
          state2.libraryFilter = filter;
          renderList({ renderTranscript: false });
        },
        searchTranscript: (query) => {
          state2.transcriptQuery = query;
          renderTranscriptPanel();
        },
        switchTrack: (index) => {
          switchTranscriptTrack(index).catch((error) => {
            if (!isAbortError2(error)) setStatus("切换字幕失败: " + errorMessage(error), "err");
          });
        },
        setFollow: (enabled) => {
          state2.transcriptAutoFollow = enabled;
          storageSet(TRANSCRIPT_FOLLOW_STORE_KEY, enabled ? "true" : "false");
          if (enabled) updateTranscriptActiveCue(currentVideoTime(), true);
        },
        seekTranscript: seekTranscriptTime,
        recordUserScroll: () => {
          state2.transcriptUserScrollUntil = Date.now() + 3500;
        }
      });
      SubBatch2.SubBatchMonorepo.ui.settingsInteraction.bindFlowChanges(root, {
        shortcutPreference: (key, value, checked) => {
          if (key === "enabled") state2.shortcutConfig.enabled = checked;
          else if (key === "summonLayout" || key === "summonTarget" || key === "preferredDock") state2.shortcutConfig[key] = value;
          saveShortcutSettings();
          renderShortcutSettings(root);
          setStatus(key === "enabled" ? `快捷键已${state2.shortcutConfig.enabled ? "开启" : "关闭"}` : "快捷召唤偏好已保存", "ok");
        },
        knowledgeModel: (value) => {
          state2.knowledgeModelId = value;
          storageSet(KNOWLEDGE_MODEL_STORE_KEY, value);
        },
        preprocessEnabled: (value) => {
          state2.preprocessEnabled = value;
          savePreprocessEnabledSetting(value);
          renderAiFlowDrawer();
          refreshAiChips();
        },
        preprocessPrompt: (value) => {
          savePromptProfiles(state2.promptProfiles, state2.activePromptId, value);
          renderAiFlowDrawer();
        },
        preprocessModel: (value) => {
          state2.preprocessModelId = value;
          storageSet(PREPROCESS_MODEL_STORE_KEY, value);
          renderAiFlowDrawer();
        },
        preprocessConcurrency: (raw) => {
          state2.preprocessConcurrency = saveBoundedNumberSetting(PREPROCESS_CONCURRENCY_STORE_KEY, raw, PREPROCESS_DEFAULT_CONCURRENCY, 1, 8);
        },
        preprocessTargetMinutes: (raw) => {
          state2.preprocessTargetMinutes = saveBoundedNumberSetting(PREPROCESS_TARGET_MINUTES_STORE_KEY, raw, PREPROCESS_DEFAULT_TARGET_MINUTES, 2, 30);
        },
        preprocessOverlapSeconds: (raw) => {
          state2.preprocessOverlapSeconds = saveBoundedNumberSetting(PREPROCESS_OVERLAP_SECONDS_STORE_KEY, raw, PREPROCESS_DEFAULT_OVERLAP_SECONDS, 0, 120);
        },
        preprocessMaxChars: (raw) => {
          state2.preprocessMaxChars = saveBoundedNumberSetting(PREPROCESS_MAX_CHARS_STORE_KEY, raw, PREPROCESS_DEFAULT_MAX_CHARS, 8e3, 6e4);
        },
        preprocessRetries: (raw) => {
          state2.preprocessRetries = saveBoundedNumberSetting(PREPROCESS_RETRIES_STORE_KEY, raw, PREPROCESS_DEFAULT_RETRIES, 0, 4);
        },
        studioModel: (value) => {
          state2.studioModelId = value;
          storageSet(STUDIO_MODEL_STORE_KEY, value);
          renderAiFlowDrawer();
        },
        studioContext: (value) => {
          state2.studioContextPref = value === "raw" || value === "processed" ? value : "auto";
          persistStudioChat();
          if (currentAiWorkbenchStage() === "chat") renderStudioCanvas();
        },
        taskPrompt: (taskId, promptId) => {
          const tasks = currentPostTasks().map((task2) => ({ ...task2, modelIds: [...task2.modelIds || []] }));
          const task = tasks.find((item) => item.id === taskId);
          if (!task) return;
          task.promptId = promptId;
          savePostTasks(tasks);
        }
      });
      root.addEventListener("click", (e) => {
        const target = e.target instanceof Element ? e.target : e.target instanceof Text ? e.target.parentElement : null;
        if (!target) return;
        const knowledgeSelectionAction = target.closest("[data-knowledge-selection-act]");
        if (knowledgeSelectionAction) {
          e.preventDefault();
          const action = knowledgeSelectionAction.dataset.knowledgeSelectionAct;
          Promise.resolve((async () => {
            const anchor = await ensureKnowledgeAnchorFromSelection({ starred: action === "save" });
            if (!anchor) return;
            if (action === "save") {
              setStatus(`已收藏知识锚点：${anchor.selectedText}`, "ok");
              return;
            }
            if (action === "question") {
              await renderKnowledgeRail();
              ensurePanel().querySelector('[data-role="knowledge-rail"] [data-role="knowledge-question"]')?.focus();
              return;
            }
            const question = action === "deep" ? `请深入解释「${anchor.selectedText}」，重点说明它在当前字幕语境中的机制、为什么重要、常见误解以及与相邻概念的关系。` : `什么是「${anchor.selectedText}」？请结合当前字幕说明它在这里的具体含义和作用。`;
            await knowledgeAsk(anchor.id, null, question);
          })()).catch((error) => setStatus(`Knowledge 操作失败：${errorMessage(error)}`, "err"));
          return;
        }
        const knowledgeMark = target.closest("[data-knowledge-anchor-id]");
        if (knowledgeMark) {
          e.preventDefault();
          openKnowledgeAnchor(knowledgeMark.dataset.knowledgeAnchorId || "").catch((error) => setStatus(`打开知识锚点失败：${errorMessage(error)}`, "err"));
          return;
        }
        if (target.closest("[data-knowledge-close]")) {
          e.preventDefault();
          closeKnowledgeRail();
          return;
        }
        if (target.closest("[data-knowledge-stop]")) {
          e.preventDefault();
          abortKnowledgeRequest();
          return;
        }
        const handledKnowledgeReader = SubBatch2.SubBatchMonorepo.ui.knowledgeReader.dispatchReaderClick(target, {
          starAnchor: () => {
            const anchor = knowledgeAnchorById(state2.knowledgeActiveAnchorId);
            if (!anchor) return;
            const updated = { ...anchor, starred: !anchor.starred, updatedAt: Date.now() };
            knowledgePutAnchor(updated).then(async () => {
              if (state2.ui?.view === "knowledge") return renderKnowledgeWorkspace();
              await Promise.all([renderKnowledgeRail(), decorateKnowledgeAnchors()]);
            }).catch((error) => setStatus("收藏失败：" + errorMessage(error), "err"));
          },
          starNode: () => {
            const node = knowledgeNodeById(state2.knowledgeActiveNodeId);
            if (!node) return;
            const updated = { ...node, starred: !node.starred, updatedAt: Date.now() };
            knowledgePutNode(updated).then(() => {
              if (state2.ui?.view === "knowledge") return renderKnowledgeWorkspace();
              return renderKnowledgeRail();
            }).catch((error) => setStatus("收藏失败：" + errorMessage(error), "err"));
          },
          deleteAnchor: () => {
            const anchor = knowledgeAnchorById(state2.knowledgeActiveAnchorId);
            if (!anchor || !confirm("删除知识锚点「" + anchor.selectedText + "」及其全部追问？")) return;
            knowledgeDeleteAnchor(anchor.id).then(() => renderKnowledgeWorkspace()).then(() => decorateKnowledgeAnchors()).catch((error) => setStatus("删除失败：" + errorMessage(error), "err"));
          },
          toggleMore: () => {
            const menu = target.closest(".bsb-knowledge-more")?.querySelector('[data-role="knowledge-more-menu"]');
            if (menu) menu.hidden = !menu.hidden;
          }
        });
        if (handledKnowledgeReader) {
          e.preventDefault();
          return;
        }
        const handledKnowledgeNavigation = SubBatch2.SubBatchMonorepo.ui.knowledgeTreeRenderer.dispatchNavigationClick(target, {
          backList: () => {
            state2.knowledgeActiveAnchorId = "";
            state2.knowledgeActiveNodeId = "";
            renderKnowledgeWorkspace().catch(() => {
            });
          },
          toggleTree: () => {
            state2.knowledgeTreeOpen = !state2.knowledgeTreeOpen;
            renderKnowledgeRail().catch(() => {
            });
          },
          openWorkspace: () => {
            setWorkspace("knowledge");
            renderKnowledgeWorkspace().catch(() => {
            });
          },
          newRoot: () => {
            state2.knowledgeActiveNodeId = "";
            renderKnowledgeRail().then(() => ensurePanel().querySelector('[data-role="knowledge-question"]')?.focus()).catch(() => {
            });
          },
          selectAnchor: (id) => {
            state2.knowledgeActiveAnchorId = id;
            state2.knowledgeActiveNodeId = "";
            renderKnowledgeWorkspace().catch(() => {
            });
          },
          selectNode: (id) => {
            state2.knowledgeActiveNodeId = id;
            if (state2.ui?.view === "knowledge") renderKnowledgeWorkspace().catch(() => {
            });
            else renderKnowledgeRail().catch(() => {
            });
          },
          askSuggestion: (question) => {
            knowledgeAsk(state2.knowledgeActiveAnchorId, state2.knowledgeActiveNodeId || null, question).catch((error) => setStatus("Knowledge 追问失败：" + errorMessage(error), "err"));
          }
        });
        if (handledKnowledgeNavigation) {
          e.preventDefault();
          return;
        }
        if (target.closest("[data-knowledge-evidence-toggle]")) {
          e.preventDefault();
          if (state2.ui) {
            state2.ui.knowledgeContextOpen = !state2.ui.knowledgeContextOpen;
            saveUiGeom();
          }
          if (state2.ui?.view === "knowledge") renderKnowledgeWorkspace().catch(() => {
          });
          else if (state2.knowledgeRailOpen) renderKnowledgeRail().catch(() => {
          });
          return;
        }
        if (!target.closest(".bsb-knowledge-more")) {
          root.querySelectorAll('[data-role="knowledge-more-menu"]').forEach((menu) => {
            menu.hidden = true;
          });
        }
        const knowledgeQuick = target.closest("[data-knowledge-quick]");
        if (knowledgeQuick) {
          e.preventDefault();
          const anchor = knowledgeAnchorById(state2.knowledgeActiveAnchorId);
          if (anchor) knowledgeAsk(anchor.id, null, `什么是「${anchor.selectedText}」？请结合当前字幕说明它在这里的具体含义和作用。`).catch((error) => setStatus(`Knowledge 追问失败：${errorMessage(error)}`, "err"));
          return;
        }
        const knowledgeSend = target.closest("[data-knowledge-send]");
        if (knowledgeSend) {
          e.preventDefault();
          const shell = knowledgeSend.closest(".bsb-knowledge-composer, .bsb-knowledge-reader, .bsb-knowledge-rail-body") || root;
          const input = shell.querySelector('[data-role="knowledge-question"]');
          const q = String(input?.value || "").trim();
          if (q) {
            knowledgeAsk(state2.knowledgeActiveAnchorId, state2.knowledgeActiveNodeId || null, q).then(() => {
              if (input) input.value = "";
            }).catch((error) => setStatus(`Knowledge 追问失败：${errorMessage(error)}`, "err"));
          }
          return;
        }
        if (target.closest("[data-knowledge-seek]")) {
          e.preventDefault();
          const anchor = knowledgeAnchorById(state2.knowledgeActiveAnchorId);
          if (anchor) {
            setWorkspace("ai");
            state2.aiInputView = "processed";
            setAiWorkbenchStage("preprocess").then(() => {
              if (anchor.timeStart != null) seekToVideoTimestamp(anchor.timeStart, anchor.bvid || "", anchor.page || 1);
              openKnowledgeAnchor(anchor.id).catch(() => {
              });
            });
          }
          return;
        }
        const flowStep = target.closest("[data-flow-step]");
        if (flowStep) {
          e.preventDefault();
          const shell = flowStep.closest(".bsb-flow-stepper");
          const input = shell?.querySelector('input[type="number"]');
          if (!input || input.disabled) return;
          const direction = Number(flowStep.dataset.flowStep || 0);
          const step = Math.max(1e-6, Number(input.step) || 1);
          const min = input.min === "" ? -Infinity : Number(input.min);
          const max = input.max === "" ? Infinity : Number(input.max);
          const current = Number(input.value);
          const base = Number.isFinite(current) ? current : 0;
          const next = Math.min(max, Math.max(min, base + direction * step));
          input.value = String(next);
          input.dispatchEvent(new Event("change", { bubbles: true }));
          return;
        }
        const drawerBackdrop = target.closest('[data-role="ai-drawer-backdrop"]');
        if (drawerBackdrop) {
          e.preventDefault();
          setAiDrawer("");
          return;
        }
        const drawerAction = target.closest('[data-role="ai-flow-drawer"] button[data-act], [data-role="ai-input-drawer"] button[data-act]');
        if (drawerAction) {
          e.preventDefault();
          Promise.resolve(onAction(drawerAction.dataset.act || null)).catch((error) => setStatus(`操作失败: ${errorMessage(error)}`, "err"));
          return;
        }
        const inputView = target.closest("[data-input-view]");
        if (inputView) {
          e.preventDefault();
          state2.aiInputView = String(inputView.dataset.inputView || "raw");
          renderAiInputDrawer();
          return;
        }
        const aiStageTab = target.closest("[data-ai-stage]");
        if (aiStageTab) {
          e.preventDefault();
          setAiWorkbenchStage(aiStageTab.dataset.aiStage || "").catch((error) => setStatus(`切换 AI 阶段失败: ${errorMessage(error)}`, "err"));
          return;
        }
        const preprocessView = target.closest("[data-ai-preprocess-view]");
        if (preprocessView) {
          e.preventDefault();
          state2.aiInputView = String(preprocessView.dataset.aiPreprocessView || "raw");
          renderPreprocessCanvas().catch((error) => setStatus(`打开字幕失败: ${errorMessage(error)}`, "err"));
          return;
        }
        const outputTask = target.closest("[data-ai-output-task]");
        if (outputTask) {
          e.preventDefault();
          selectAiOutputTask(outputTask.dataset.aiOutputTask || "").catch((error) => setStatus(`切换产物失败: ${errorMessage(error)}`, "err"));
          return;
        }
        const taskRemove = target.closest("[data-flow-task-remove]");
        if (taskRemove) {
          e.preventDefault();
          const id = String(taskRemove.dataset.flowTaskRemove || "");
          savePostTasks(currentPostTasks().filter((t) => t.id !== id));
          renderAiFlowDrawer();
          return;
        }
        const modelAdd = target.closest("[data-flow-task-model-add]");
        if (modelAdd) {
          e.preventDefault();
          const card = modelAdd.closest("[data-flow-task-id]");
          const taskId = String(card?.dataset.flowTaskId || "");
          const modelId = String(modelAdd.dataset.flowTaskModelAdd || "");
          const tasks = currentPostTasks().map((t) => ({ ...t, modelIds: [...t.modelIds || []] }));
          const task = tasks.find((t) => t.id === taskId);
          if (task && modelId && !task.modelIds.includes(modelId)) {
            task.modelIds.push(modelId);
            savePostTasks(tasks);
            renderAiFlowDrawer();
          }
          return;
        }
        const modelRemove = target.closest("[data-flow-task-model-remove]");
        if (modelRemove) {
          e.preventDefault();
          e.stopPropagation();
          const card = modelRemove.closest("[data-flow-task-id]");
          const taskId = String(card?.dataset.flowTaskId || "");
          const modelId = String(modelRemove.dataset.flowTaskModelRemove || "");
          const tasks = currentPostTasks().map((t) => ({ ...t, modelIds: [...t.modelIds || []] }));
          const task = tasks.find((t) => t.id === taskId);
          if (task && modelId) {
            task.modelIds = task.modelIds.filter((id) => id !== modelId);
            savePostTasks(tasks);
            renderAiFlowDrawer();
          }
          return;
        }
        const editorAction = target.closest('[data-role="prompt-editor"] button[data-act], [data-role="ai-editor"] button[data-act]');
        if (editorAction) {
          e.preventDefault();
          Promise.resolve(onAction(editorAction.dataset.act || null)).catch((error) => {
            setStatus(`设置操作失败: ${errorMessage(error)}`, "err");
          });
          return;
        }
        const shortcutRecord = target.closest("[data-shortcut-record]");
        if (shortcutRecord) {
          e.preventDefault();
          const id = String(shortcutRecord.dataset.shortcutRecord || "");
          if (!SHORTCUT_COMMANDS2.some((command2) => command2.id === id)) return;
          state2.shortcutRecordingId = id;
          renderShortcutSettings(root);
          root.querySelector(`[data-shortcut-record="${CSS.escape(id)}"]`)?.focus();
          setStatus("快捷键录制中 · 按 Esc 取消，Backspace / Delete 清除");
          return;
        }
        const shortcutReset = target.closest("[data-shortcut-reset]");
        if (shortcutReset) {
          e.preventDefault();
          const id = String(shortcutReset.dataset.shortcutReset || "");
          const command2 = SHORTCUT_COMMANDS2.find((item) => item.id === id);
          if (!command2) return;
          state2.shortcutRecordingId = "";
          state2.shortcutConfig.bindings[id] = command2.defaultChord;
          saveShortcutSettings();
          renderShortcutSettings(root);
          setStatus(`已恢复：${command2.label} · ${shortcutDisplayChord(command2.defaultChord)}`, "ok");
          return;
        }
        const shortcutResetAll = target.closest("[data-shortcut-reset-all]");
        if (shortcutResetAll) {
          e.preventDefault();
          const preserved = {
            enabled: state2.shortcutConfig.enabled,
            summonLayout: state2.shortcutConfig.summonLayout,
            summonTarget: state2.shortcutConfig.summonTarget,
            preferredDock: state2.shortcutConfig.preferredDock
          };
          state2.shortcutConfig = { ...shortcutDefaults(), ...preserved, bindings: shortcutDefaults().bindings };
          state2.shortcutRecordingId = "";
          saveShortcutSettings();
          renderShortcutSettings(root);
          setStatus("已恢复默认快捷键", "ok");
          return;
        }
        const settingsTab = target.closest("[data-settings-tab]");
        if (settingsTab) {
          e.preventDefault();
          try {
            savePromptProfilesFromForm({ activeId: state2.activePromptId });
          } catch {
          }
          try {
            saveAiProfilesFromForm();
          } catch {
          }
          setSettingsTab(settingsTab.dataset.settingsTab || "");
          return;
        }
        const flavorPick = target.closest("[data-ctp-flavor-pick]");
        if (flavorPick) {
          e.preventDefault();
          applyCtpFlavor(flavorPick.dataset.ctpFlavorPick);
          return;
        }
        const promptStageTab = target.closest("[data-prompt-stage-tab]");
        if (promptStageTab) {
          e.preventDefault();
          try {
            savePromptProfilesFromForm({ activeId: state2.activePromptId });
          } catch {
          }
          setPromptStageTab(promptStageTab.dataset.promptStageTab || "");
          return;
        }
        const promptListItem = target.closest("[data-prompt-list-id]");
        if (promptListItem) {
          e.preventDefault();
          savePromptProfilesFromForm({ activeId: state2.activePromptId });
          state2.promptEditorId = String(promptListItem.dataset.promptListId || "");
          fillPromptConfigForm(root);
          return;
        }
        const aiListItem = target.closest("[data-ai-list-id]");
        if (aiListItem) {
          e.preventDefault();
          saveAiProfilesFromForm();
          state2.aiEditorId = String(aiListItem.dataset.aiListId || "");
          fillAiConfigForm(root);
          return;
        }
        const promptTool = target.closest("[data-prompt-act]");
        if (promptTool) {
          e.preventDefault();
          handlePromptProfileAction(promptTool);
          return;
        }
        const profileTool = target.closest("[data-ai-profile-act]");
        if (profileTool) {
          e.preventDefault();
          handleAiProfileAction(profileTool);
          return;
        }
        const preprocessTab = target.closest("[data-ai-preprocess-tab]");
        if (preprocessTab) {
          e.preventDefault();
          selectPreprocessResult().catch((error) => setStatus(`打开预处理稿失败: ${errorMessage(error)}`, "err"));
          return;
        }
        const retryTab = target.closest("[data-ai-retry-id]");
        if (retryTab) {
          e.preventDefault();
          const runId = retryTab.dataset.aiRetryId;
          selectAiRun(runId || "").then(() => regenerateActiveAiRun()).catch((error) => setStatus(`重新生成失败: ${errorMessage(error)}`, "err"));
          return;
        }
        const resultTab = target.closest("[data-ai-result-id]");
        if (resultTab) {
          e.preventDefault();
          selectAiRun(resultTab.dataset.aiResultId || "").catch((error) => {
            setStatus(`切换结果失败: ${errorMessage(error)}`, "err");
          });
          return;
        }
        const mermaidTool = target.closest("[data-mmd-act]");
        if (mermaidTool) {
          e.preventDefault();
          handleMermaidTool(mermaidTool);
          return;
        }
        const ts = target.closest(".bsb-time-link");
        if (!ts) return;
        e.preventDefault();
        seekToVideoTimestamp(
          Number(ts.dataset.seconds),
          ts.dataset.bvid || "",
          Number(ts.dataset.page) || 1
        );
      });
      root.addEventListener("wheel", (e) => {
        const target = e.target instanceof Element ? e.target : e.target instanceof Text ? e.target.parentElement : null;
        if (!target) return;
        const viewport = target.closest(".bsb-mermaid-viewport");
        if (!viewport || !e.ctrlKey) return;
        const card = viewport.closest(".bsb-mermaid-card");
        if (!card) return;
        e.preventDefault();
        setMermaidScale(card, getMermaidScale(card) + (e.deltaY < 0 ? 0.12 : -0.12));
      }, { passive: false });
      root.addEventListener("keydown", (e) => {
        const target = e.target instanceof Element ? e.target : e.target instanceof Text ? e.target.parentElement : null;
        if (!target) return;
        const input = target.closest('[data-role="knowledge-question"]');
        if (!input || e.key !== "Enter" || !(e.ctrlKey || e.metaKey)) return;
        e.preventDefault();
        const q = String(input.value || "").trim();
        if (q) knowledgeAsk(state2.knowledgeActiveAnchorId, state2.knowledgeActiveNodeId || null, q).catch((error) => setStatus(`Knowledge 追问失败：${errorMessage(error)}`, "err"));
      });
      window.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        hideKnowledgeSelectionToolbar();
        if (state2.knowledgeRailOpen) {
          closeKnowledgeRail();
          return;
        }
        if (state2.aiDrawer) {
          setAiDrawer("");
          return;
        }
        const hadMermaidModal = !!root.querySelector(".bsb-mermaid-modal");
        if (hadMermaidModal) {
          closeMermaidFullscreen();
          return;
        }
        if (state2.aiFocus) {
          state2.aiFocus = false;
          applyPanelGeometry();
          setStatus("已退出专注阅读");
        }
      });
      root.querySelectorAll("button[data-act]").forEach((btn) => {
        const act = btn.getAttribute("data-act");
        if (act === "dock" || act === "collapse") return;
        btn.addEventListener("click", () => onAction(act));
      });
      fillPromptConfigForm(root);
      setPromptStageTab(state2.ui?.promptStage || "preprocess", { silent: true, preserveEditor: true });
      fillAiConfigForm(root);
      renderShortcutSettings(root);
      refreshShortcutHints();
      loadPostTasks();
      renderAiFlowDrawer();
      renderAiInputDrawer();
      refreshPreprocessModelSelector(root);
      setSettingsTab(state2.ui?.settingsTab || "prompt", { silent: true });
      const captureDrawer = root.querySelector('[data-role="capture-drawer"]');
      if (captureDrawer) captureDrawer.hidden = !state2.captureDrawerOpen;
      renderAiResultTabs();
      setAiWorkbenchStage(state2.ui?.aiStage || "preprocess", { silent: true }).catch(() => {
      });
      bindAiScrollBehavior(root);
      setWorkspace(state2.ui && state2.ui.view || "ai", { silent: true });
      refreshAiChips();
      return root;
    }
    function setWorkspace(view2, opts = {}) {
      const v = ["ai", "subs", "knowledge", "settings"].includes(view2) ? view2 : "ai";
      const root = ensurePanel();
      if (state2.ui) state2.ui.view = v;
      root.dataset.panelView = v;
      applyKnowledgeLayoutVars(root);
      const workspaceTitle = root.querySelector('[data-role="workspace-title"]');
      if (workspaceTitle) workspaceTitle.textContent = v === "subs" ? "字幕库" : v === "knowledge" ? "知识库" : v === "settings" ? "设置" : "AI 工作台";
      root.querySelectorAll(".bsb-nav [data-view]").forEach((b) => {
        b.classList.toggle("active", b.getAttribute("data-view") === v);
      });
      root.querySelectorAll("[data-view-panel]").forEach((p) => {
        p.classList.toggle("active", p.getAttribute("data-view-panel") === v);
      });
      if (v === "ai") setAiWorkbenchStage(state2.ui?.aiStage || "preprocess", { silent: true }).catch(() => {
      });
      if (v === "knowledge") renderKnowledgeWorkspace().catch((error) => setStatus(`知识库加载失败: ${errorMessage(error)}`, "err"));
      if (!opts?.silent) {
        saveUiGeom();
        if (v === "ai") refreshAiChips();
        if (v === "subs") {
          renderTranscriptPanel();
          bindTranscriptVideoEvents();
        }
        if (v === "settings") {
          setPromptStageTab(state2.ui?.promptStage || "preprocess", { silent: true, preserveEditor: true });
          fillPromptConfigForm(root);
          fillAiConfigForm(root);
          setSettingsTab(state2.ui?.settingsTab || "prompt", { silent: true });
        }
      }
    }
    function setSettingsTab(tab, opts = {}) {
      const root = ensurePanel();
      const next = ["prompt", "llm", "shortcuts", "appearance"].includes(tab) ? tab : "prompt";
      if (next !== "shortcuts" && state2.shortcutRecordingId) state2.shortcutRecordingId = "";
      if (state2.ui) state2.ui.settingsTab = next;
      root.querySelectorAll("[data-settings-tab]").forEach((button) => {
        const active = button.dataset.settingsTab === next;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", active ? "true" : "false");
      });
      root.querySelectorAll("[data-settings-pane]").forEach((pane) => {
        pane.classList.toggle("active", pane.dataset.settingsPane === next);
      });
      if (next === "shortcuts") renderShortcutSettings(root);
      if (next === "appearance") renderAppearanceSettings(root);
      if (!opts?.silent) saveUiGeom();
    }
    function mermaidThemeVariablesForFlavor(flavor = state2.ui?.ctpFlavor) {
      const id = normalizeCtpFlavor(flavor);
      const t = getCtpPalette(id);
      return {
        darkMode: id !== "latte",
        background: t.mantle,
        primaryColor: t.surface0,
        primaryTextColor: t.rosewater,
        primaryBorderColor: t.blue,
        secondaryColor: t.surface1,
        secondaryTextColor: t.text,
        secondaryBorderColor: t.green,
        tertiaryColor: t.base,
        tertiaryTextColor: t.text,
        tertiaryBorderColor: t.mauve,
        lineColor: t.subtext1,
        textColor: t.text,
        mainBkg: t.surface0,
        nodeBorder: t.blue,
        clusterBkg: t.base,
        clusterBorder: t.surface2,
        edgeLabelBackground: t.mantle,
        actorBkg: t.surface0,
        actorBorder: t.blue,
        actorTextColor: t.rosewater,
        signalColor: t.subtext1,
        signalTextColor: t.text,
        labelBoxBkgColor: t.surface0,
        labelBoxBorderColor: t.blue,
        labelTextColor: t.rosewater,
        loopTextColor: t.text,
        noteBkgColor: t.surface1,
        noteBorderColor: t.yellow,
        noteTextColor: t.rosewater,
        fontSize: "16px"
      };
    }
    function mermaidThemeCssForFlavor(flavor = state2.ui?.ctpFlavor) {
      const t = getCtpPalette(flavor);
      return `
          .nodeLabel, .edgeLabel, .label, text { font-size: 16px !important; }
          .edgeLabel rect { fill: ${t.mantle} !important; opacity: .96 !important; }
          .flowchart-link { stroke-width: 2px !important; }
          .marker { fill: ${t.subtext1} !important; stroke: ${t.subtext1} !important; }
          .cluster rect { rx: 10px; ry: 10px; }
        `;
    }
    function refreshMermaidTheme() {
      if (typeof mermaid === "undefined" || !state2.renderLibs?.mermaid) return;
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          securityLevel: "strict",
          fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
          suppressErrorRendering: true,
          deterministicIds: false,
          themeVariables: mermaidThemeVariablesForFlavor(),
          themeCSS: mermaidThemeCssForFlavor()
        });
      } catch (error) {
        console.warn("[bili-subbatch] mermaid theme refresh", error);
      }
    }
    function applyCtpFlavor(flavor, { silent = false, persist: persist2 = true } = {}) {
      const next = normalizeCtpFlavor(flavor);
      if (state2.ui) state2.ui.ctpFlavor = next;
      const root = document.getElementById(PANEL_ID) || ensurePanel();
      root.setAttribute("data-ctp-flavor", next);
      root.style.colorScheme = next === "latte" ? "light" : "dark";
      refreshMermaidTheme();
      if (persist2) saveUiGeom();
      if (document.getElementById(PANEL_ID)?.querySelector('[data-settings-pane="appearance"].active')) {
        renderAppearanceSettings(root);
      }
      if (!silent) {
        const meta = CTP_FLAVORS.find((f) => f.id === next);
        setStatus(`主题已切换：Catppuccin ${meta?.label || next}${next === DEFAULT_CTP_FLAVOR ? "（默认）" : ""}`, "ok");
      }
      return next;
    }
    function renderAppearanceSettings(root) {
      const host2 = root?.querySelector?.('[data-role="appearance-settings"]');
      if (!host2) return;
      const current = normalizeCtpFlavor(state2.ui?.ctpFlavor || DEFAULT_CTP_FLAVOR);
      host2.innerHTML = `
      <div class="bsb-appearance-head">
        <strong>Catppuccin 主题</strong>
        <span>在 Latte / Frappé / Macchiato / Mocha 间切换。默认 Mocha，选择会保存在本机。</span>
      </div>
      <div class="bsb-theme-grid" role="listbox" aria-label="Catppuccin 风格">
        ${CTP_FLAVORS.map((flavor) => {
        const p = getCtpPalette(flavor.id);
        const selected = flavor.id === current;
        return `<button type="button" class="bsb-theme-card${selected ? " selected" : ""}" data-ctp-flavor-pick="${escapeAttr(flavor.id)}" role="option" aria-selected="${selected ? "true" : "false"}" title="切换到 ${escapeAttr(flavor.label)}">
            <span class="bsb-theme-preview" style="--p0:${p.base};--p1:${p.mantle};--p2:${p.surface0};--a0:${p.lavender};--a1:${p.mauve};--a2:${p.green};--tx:${p.text}">
              <i></i><i></i><i></i>
            </span>
            <span class="bsb-theme-meta">
              <strong>${flavor.emoji} ${escapeHtml(flavor.label)}</strong>
              <small>${escapeHtml(flavor.hint)}${flavor.id === DEFAULT_CTP_FLAVOR ? " · 默认" : ""}</small>
            </span>
          </button>`;
      }).join("")}
      </div>
    `;
    }
    function panelIsVisiblyOpen() {
      return !!(state2.open && state2.ui && (!state2.ui.dock || state2.ui.dockExpanded));
    }
    function applyShortcutSummonLayout(layout = state2.shortcutConfig?.summonLayout || "remember") {
      const root = ensurePanel();
      const mode = ["remember", "floating", "right", "left"].includes(layout) ? layout : "remember";
      if (mode === "floating") {
        root._bsbSetDock?.(null);
        root._bsbSetOpen?.(true);
        return;
      }
      if (mode === "right" || mode === "left") {
        root._bsbSetDock?.(mode);
        root._bsbSetOpen?.(true);
        return;
      }
      root._bsbSetOpen?.(true);
    }
    async function openShortcutTarget(target = "remember") {
      const next = ["remember", "processed", "postprocess"].includes(target) ? target : "remember";
      if (next === "remember") return;
      setWorkspace("ai");
      if (next === "processed") {
        state2.aiInputView = "processed";
        await setAiWorkbenchStage("preprocess");
        setStatus("快捷打开：AI 处理字幕", "ok");
        return;
      }
      await setAiWorkbenchStage("postprocess");
      setStatus("快捷打开：后处理结果", "ok");
    }
    async function executeShortcutCommand(commandId) {
      const root = ensurePanel();
      const config = state2.shortcutConfig || loadShortcutSettings();
      if (commandId === "toggle-panel") {
        if (panelIsVisiblyOpen()) {
          if (state2.ui?.dock) root._bsbToggleDockExpanded?.(false);
          else root._bsbSetOpen?.(false);
          return;
        }
        applyShortcutSummonLayout(config.summonLayout);
        await openShortcutTarget(config.summonTarget);
        return;
      }
      if (commandId === "open-processed") {
        applyShortcutSummonLayout(config.summonLayout);
        await openShortcutTarget("processed");
        return;
      }
      if (commandId === "open-postprocess") {
        applyShortcutSummonLayout(config.summonLayout);
        await openShortcutTarget("postprocess");
        return;
      }
      if (commandId === "toggle-dock") {
        if (state2.ui?.dock) {
          root._bsbSetDock?.(null);
          root._bsbSetOpen?.(true);
          setStatus("快捷切换：悬浮模式", "ok");
        } else {
          const side = config.preferredDock === "left" ? "left" : "right";
          root._bsbSetDock?.(side);
          root._bsbSetOpen?.(true);
          setStatus(`快捷切换：${side === "right" ? "右" : "左"}侧靠边`, "ok");
        }
      }
    }
    let shortcutKeyHandlerBound = false;
    function bindGlobalShortcuts() {
      if (shortcutKeyHandlerBound) return;
      shortcutKeyHandlerBound = true;
      document.addEventListener("keydown", (event) => {
        if (state2.shortcutRecordingId) {
          event.preventDefault();
          event.stopImmediatePropagation();
          const commandId = state2.shortcutRecordingId;
          if (event.key === "Escape") {
            state2.shortcutRecordingId = "";
            renderShortcutSettings();
            setStatus("已取消快捷键录制");
            return;
          }
          if ((event.key === "Backspace" || event.key === "Delete") && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey) {
            state2.shortcutConfig.bindings[commandId] = "";
            state2.shortcutRecordingId = "";
            saveShortcutSettings();
            renderShortcutSettings();
            setStatus("已清除快捷键", "ok");
            return;
          }
          if (event.getModifierState?.("AltGraph")) {
            setStatus("AltGr 属于输入法修饰键，请换一个组合", "err");
            return;
          }
          const chord2 = shortcutChordFromEvent(event);
          if (!chord2) return;
          if (!shortcutHasStrongModifier(chord2)) {
            setStatus("为避免和 Bilibili 播放器冲突，请至少使用 Ctrl / Alt / Meta 之一", "err");
            return;
          }
          const conflict = shortcutConflictInfo(chord2, commandId);
          if (conflict.level === "error") {
            setStatus(`快捷键冲突：${conflict.text}`, "err");
            return;
          }
          state2.shortcutConfig.bindings[commandId] = chord2;
          state2.shortcutRecordingId = "";
          saveShortcutSettings();
          renderShortcutSettings();
          setStatus(conflict.level === "warn" ? `已绑定 ${shortcutDisplayChord(chord2)} · ${conflict.text}` : `已绑定 ${shortcutDisplayChord(chord2)}`, conflict.level === "warn" ? "" : "ok");
          return;
        }
        const config = state2.shortcutConfig || loadShortcutSettings();
        if (!config.enabled || event.repeat || event.isComposing || event.getModifierState?.("AltGraph")) return;
        if (shortcutEditableTarget(event.target)) return;
        const chord = shortcutChordFromEvent(event);
        if (!chord) return;
        const command2 = SHORTCUT_COMMANDS2.find((item) => config.bindings?.[item.id] && config.bindings[item.id] === chord);
        if (!command2) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        Promise.resolve(executeShortcutCommand(command2.id)).catch((error) => setStatus(`快捷键执行失败：${errorMessage(error)}`, "err"));
      }, true);
    }
    function setPromptStageTab(stage, opts = {}) {
      const root = ensurePanel();
      const next = stage === "postprocess" ? "postprocess" : stage === "knowledge" ? "knowledge" : "preprocess";
      if (state2.ui) state2.ui.promptStage = next;
      if (!opts?.preserveEditor) {
        const prompts = state2.promptProfiles?.length ? state2.promptProfiles : loadPromptProfiles().prompts;
        const preferredId = next === "preprocess" ? state2.activePrePromptId : next === "knowledge" ? state2.activeKnowledgePromptId : state2.activePromptId;
        state2.promptEditorId = prompts.find((p) => p.stage === next && p.id === preferredId)?.id || prompts.find((p) => p.stage === next)?.id || "";
        state2.promptSearch = "";
      }
      root.querySelectorAll("[data-prompt-stage-tab]").forEach((button) => {
        const active = button.dataset.promptStageTab === next;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", active ? "true" : "false");
      });
      root.querySelectorAll("[data-prompt-create-stage]").forEach((button) => {
        button.hidden = button.dataset.promptCreateStage !== next;
      });
      const search = root.querySelector('[data-role="prompt-search"]');
      if (search) {
        search.placeholder = next === "preprocess" ? "搜索预处理 Prompt…" : next === "knowledge" ? "搜索 Knowledge Prompt…" : "搜索后处理 Prompt…";
        if (search.value !== state2.promptSearch) search.value = state2.promptSearch;
      }
      const context = root.querySelector('[data-role="prompt-stage-context"]');
      if (context) {
        context.innerHTML = next === "preprocess" ? "<span>预处理 · 原始字幕 → 规范化简体中文字幕稿</span><span>PRE</span>" : next === "knowledge" ? "<span>Knowledge · 字幕锚点 → 独立追问树</span><span>DRILL</span>" : "<span>后处理 · 规范化字幕稿 → Mermaid / 笔记 / 自测等产物</span><span>POST</span>";
      }
      fillPromptConfigForm(root);
      if (!opts?.silent) saveUiGeom();
    }
    function refreshAiChips() {
      const root = document.getElementById(PANEL_ID);
      if (!root) return;
      const sel = state2.items.filter((it) => it.selected).length;
      const ok = state2.items.filter((it) => it.selected && it.subStatus === "ok").length;
      const elSel = root.querySelector('[data-role="chip-sel"]');
      const elOk = root.querySelector('[data-role="chip-ok"]');
      const elModel = root.querySelector('[data-role="chip-model"]');
      if (elSel) elSel.textContent = String(sel);
      if (elOk) elOk.textContent = String(ok);
      if (elModel) {
        const tasks = currentPostTasks().filter((t) => t.enabled !== false);
        const runCount = tasks.reduce((n, t) => n + (t.modelIds || []).length, 0);
        elModel.textContent = `${tasks.length} 产物 · ${runCount} runs`;
      }
      const inputLabel = root.querySelector('[data-role="ai-input-label"]');
      if (inputLabel) {
        const ready = !!state2.aiSessionInput;
        const mode = state2.preprocessEnabled ? state2.aiSessionInput?.vars?.processedSubtitle ? "已规范化" : "预处理开启" : "原始字幕";
        inputLabel.textContent = `输入 · ${sel} 视频 · ${ready ? mode : "待运行"}`;
      }
      const flowSummary = root.querySelector('[data-role="flow-summary"]');
      if (flowSummary) {
        const tasks = currentPostTasks().filter((t) => t.enabled !== false);
        const runs = tasks.reduce((n, t) => n + (t.modelIds || []).length, 0);
        flowSummary.textContent = `${tasks.length} 个产物 · ${runs} 个版本`;
      }
      renderAiResultTabs();
      applyAiWorkbenchStageUi();
      if (currentAiWorkbenchStage() === "preprocess") {
        const status2 = root.querySelector('[data-role="ai-preprocess-status"]');
        if (status2) {
          const raw = currentInputPreviewText("raw");
          const processed = currentInputPreviewText("processed");
          status2.textContent = !raw ? "当前视频暂无字幕" : processed ? "AI 字幕已就绪" : state2.preprocessEnabled ? "原始字幕已就绪" : "预处理已关闭";
        }
      }
    }
    function setStatus(text, cls) {
      const el = document.querySelector(`#${PANEL_ID} [data-role="status"]`);
      if (!el) return;
      el.textContent = text;
      el.classList.remove("ok", "err");
      if (cls) el.classList.add(cls);
      const dot = document.querySelector(`#${PANEL_ID} [data-role="status-dot"]`);
      if (dot) {
        dot.classList.remove("ok", "err", "busy");
        if (cls === "ok") dot.classList.add("ok");
        else if (cls === "err") dot.classList.add("err");
        else if (state2.busy || state2.aiBusy) dot.classList.add("busy");
      }
      const meta = document.querySelector(`#${PANEL_ID} [data-role="ai-canvas-meta"]`);
      if (meta && (state2.ui?.view === "ai" || !state2.ui)) {
        meta.textContent = (text || "").slice(0, 48);
      }
    }
    function operationBusy() {
      return !!(state2.scanBusy || state2.batchBusy);
    }
    function refreshActionDisabledState() {
      const root = document.getElementById(PANEL_ID);
      if (!root) return;
      const mainActions = /* @__PURE__ */ new Set([
        "scan",
        "sel-all",
        "sel-none",
        "ai-send",
        "cancel",
        "ai-stop",
        "dock",
        "collapse",
        "job-pause",
        "job-stop"
      ]);
      const batchActions = /* @__PURE__ */ new Set(["copy", "copy-bvid", "dl-srt", "dl-txt", "dl-ok-only", "fetch-selected"]);
      root.querySelectorAll("button[data-act]").forEach((button) => {
        const act = button.getAttribute("data-act") || "";
        if (act === "cancel") {
          button.style.display = operationBusy() ? "" : "none";
          button.disabled = false;
          return;
        }
        if (act === "job-pause" || act === "job-stop") {
          button.disabled = !operationBusy();
          return;
        }
        if (mainActions.has(act)) {
          button.disabled = false;
          return;
        }
        button.disabled = batchActions.has(act) && operationBusy();
      });
    }
    function syncOperationBusy() {
      state2.busy = operationBusy();
      refreshActionDisabledState();
    }
    function setScanBusy(busy) {
      appCall("libraryJob.setBusy", state2, "scan", busy);
      syncOperationBusy();
      updateLibraryJobBar();
    }
    function setBatchBusy(busy) {
      appCall("libraryJob.setBusy", state2, "fetch", busy);
      syncOperationBusy();
      updateLibraryJobBar();
    }
    function setLibraryJob(patch = {}) {
      appCall("libraryJob.setProgress", state2, patch);
      updateLibraryJobBar();
    }
    function clearLibraryJob() {
      appCall("libraryJob.clearProgress", state2);
      updateLibraryJobBar();
    }
    function updateLibraryJobBar() {
      const root = document.getElementById(PANEL_ID);
      const bar = root?.querySelector('[data-role="library-jobbar"]');
      if (!bar) return;
      const job = appCall("libraryJob.view", state2);
      bar.hidden = !job.busy;
      bar.classList.toggle("is-on", job.busy);
      bar.classList.toggle("is-paused", job.busy && job.paused);
      const title = bar.querySelector('[data-role="job-title"]');
      const meta = bar.querySelector('[data-role="job-meta"]');
      const meter = bar.querySelector('[data-role="job-meter"]');
      const pauseBtn = bar.querySelector('[data-act="job-pause"]');
      if (title) title.textContent = job.title;
      if (meta) meta.textContent = job.meta;
      if (meter) meter.style.width = String(job.percent) + "%";
      if (pauseBtn) {
        pauseBtn.textContent = job.pauseLabel;
        pauseBtn.setAttribute("aria-pressed", job.paused ? "true" : "false");
        pauseBtn.title = job.pauseTitle;
      }
    }
    async function waitIfJobPaused() {
      if (!appCall("libraryJob.isPaused", state2)) return;
      updateLibraryJobBar();
      await appCall("libraryJob.waitWhilePaused", state2, sleep);
    }
    function toggleLibraryJobPause() {
      const result = appCall("libraryJob.togglePause", state2);
      setStatus(result.text, result.css);
      if (result.changed) updateLibraryJobBar();
    }
    function stopLibraryJob() {
      appCall("libraryJob.stop", state2);
      setStatus("正在停止扫描/字幕任务…已完成的条目会保留");
      updateLibraryJobBar();
    }
    function flushPendingMainAction() {
      if (operationBusy()) return;
      if (state2.pendingRescan) {
        state2.pendingRescan = false;
        window.setTimeout(() => doScan(), 0);
        return;
      }
      if (state2.pendingAiSend) {
        state2.pendingAiSend = false;
        window.setTimeout(() => doAiAnalyze(), 0);
      }
    }
    function stopAiBatchForRestart() {
      if (!state2.aiBusy) return;
      state2.aiSessionSeq += 1;
      state2.aiAbort = true;
      abortAllAiRuns();
      state2.aiRunOrder.forEach((id) => {
        const run = state2.aiRuns.get(id);
        if (!run || !run.busy) return;
        run.busy = false;
        run.status = "stopped";
        run.statusText = "已停止 · 准备重新分析";
        run.finishedAt = Date.now();
      });
      setAiBusy(false);
      state2.aiAbort = false;
    }
    function refreshContextUI() {
      const root = ensurePanel();
      const modeSel = root.querySelector('[data-role="mode"]');
      if (modeSel) {
        if (MODE_OPTIONS.includes(modeSel.value)) state2.mode = modeSel.value;
        else modeSel.value = state2.mode || "auto";
      }
      const auto = detectContext2(location.href);
      state2.autoCtx = auto;
      const ctx = resolveContext();
      state2.ctx = ctx;
      const badge = root.querySelector('[data-role="type"]');
      if (badge) badge.textContent = (ctx.source === "manual" ? "手动 · " : "自动 · ") + (TYPE_LABEL[ctx.type] || ctx.type);
      badge?.classList.toggle("manual", ctx.source === "manual");
      const contextLabel = root.querySelector('[data-role="ctx"]');
      if (contextLabel) contextLabel.textContent = formatCtxBits(ctx);
      const hint = root.querySelector('[data-role="auto-hint"]');
      if (hint) {
        const autoLabel = TYPE_LABEL[auto.type] || auto.type;
        if (state2.mode === "auto") {
          hint.innerHTML = `识别：<strong>${escapeHtml(autoLabel)}</strong>`;
        } else {
          hint.innerHTML = `自动本会是：<strong>${escapeHtml(autoLabel)}</strong>（已手动覆盖）`;
        }
      }
    }
    function renderLibraryCounts(root) {
      const counts = { all: state2.items.length, ok: 0, wait: 0, error: 0, empty: 0 };
      state2.items.forEach((item) => {
        counts[SubBatch2.SubBatchMonorepo.ui.libraryController.status(item)] += 1;
      });
      Object.entries(counts).forEach(([key, value]) => {
        const el = root.querySelector(`[data-library-count="${key}"]`);
        if (el) el.textContent = String(value);
      });
      root.querySelectorAll("[data-library-filter]").forEach((button) => {
        button.classList.toggle("active", button.dataset.libraryFilter === state2.libraryFilter);
      });
      return counts;
    }
    function libraryItemRowHtml(it, i, { child = false, depth = 0 } = {}) {
      if (!it) return "";
      const status2 = SubBatch2.SubBatchMonorepo.ui.libraryController.status(it);
      const stClass = status2 === "ok" ? "st-ok" : status2 === "empty" ? "st-empty" : status2 === "error" ? "st-err" : "st-wait";
      const active = routeVideoKey2(it.bvid, Number(it.page) || 1) === state2.transcriptItemKey;
      const page = Math.max(1, Number(it.page) || 1);
      const displayTitle = it.groupType === "selection" || it.groupType === "collection" ? it.groupType === "selection" ? it.part ? `P${page}${it.part}` : `P${page}` : it.title || it.bvid || "未命名视频" : it.title || it.bvid || "未命名视频";
      const bvPart = `${escapeHtml(it.bvid || "")}${page > 1 ? ` · P${page}` : ""}`;
      const author = escapeHtml(it.author || "");
      const source = Array.isArray(it.sources) && it.sources.length ? escapeHtml(it.sources[it.sources.length - 1]) : "";
      const secondary = [author, bvPart, source].filter(Boolean).join(" · ");
      const depthClass = depth >= 2 ? " child child-2" : child || depth > 0 ? " child" : "";
      return `<div class="bsb-resource-item${depthClass}${active ? " active" : ""}" data-transcript-i="${i}" title="${escapeAttr(it.title || it.bvid || "")}">
        <input type="checkbox" data-i="${i}" ${it.selected ? "checked" : ""} aria-label="选择 ${escapeAttr(displayTitle)}">
        <div class="bsb-resource-main">
          <div class="bsb-resource-title">${escapeHtml(displayTitle)}</div>
          <div class="bsb-resource-meta"><span>${secondary}</span><span class="bsb-resource-status ${stClass}">${SubBatch2.SubBatchMonorepo.ui.libraryController.statusLabel(it)}</span></div>
        </div>
      </div>`;
    }
    function libraryFolderKindLabel(groupType, groupKey) {
      if (String(groupKey || "").startsWith("space-videos:")) return "视频";
      if (groupType === "collection") return "合集";
      if (groupType === "selection") return "视频选集";
      if (groupType === "space") return "个人主页";
      if (groupType === "single") return "视频";
      return "文件夹";
    }
    function libraryRenderNodeHtml(node, depth = 0) {
      if (node.type === "item") {
        return libraryItemRowHtml(node.entry.item, node.entry.index, {
          child: depth > 0,
          depth
        });
      }
      const kindLabel = libraryFolderKindLabel(node.groupType, node.groupKey);
      const checked = node.checkState === "all" ? "checked" : "";
      const partial = node.checkState === "partial" ? "1" : "0";
      const chevron = node.collapsed ? "▶" : "▼";
      const depthClass = depth >= 2 ? " child child-2" : depth > 0 ? " child" : "";
      const chunks = [];
      chunks.push(`<div class="bsb-resource-folder${depthClass}" data-group-key="${escapeAttr(node.groupKey)}">
        <button type="button" class="bsb-folder-toggle" data-folder-toggle="${escapeAttr(node.groupKey)}" aria-label="${node.collapsed ? "展开" : "收起"} ${escapeAttr(node.folderLabel)}">${chevron}</button>
        <input type="checkbox" data-group-check="${escapeAttr(node.groupKey)}" data-partial="${partial}" ${checked} aria-label="选择文件夹 ${escapeAttr(node.folderLabel)}">
        <div class="bsb-resource-main">
          <div class="bsb-resource-title">📁 ${escapeHtml(node.folderLabel)}</div>
          <div class="bsb-resource-meta"><span>${kindLabel} · ${node.selectedCount}/${node.total} 已选</span><span>${node.total} 项</span></div>
        </div>
      </div>`);
      if (!node.collapsed) {
        if (Array.isArray(node.nodes) && node.nodes.length) {
          for (const nested2 of node.nodes) {
            chunks.push(libraryRenderNodeHtml(nested2, depth + 1));
          }
        } else {
          for (const child of node.children || []) {
            chunks.push(libraryItemRowHtml(child.item, child.index, {
              child: true,
              depth: depth + 1
            }));
          }
        }
      }
      return chunks.join("");
    }
    function renderList({ renderTranscript = true } = {}) {
      const root = document.getElementById(PANEL_ID);
      const box = root?.querySelector('[data-role="list"]');
      if (!box || !root) return;
      renderLibraryCounts(root);
      const entries = SubBatch2.SubBatchMonorepo.ui.libraryController.filteredEntries(state2.items, state2.libraryQuery, state2.libraryFilter);
      const visible = root.querySelector('[data-role="library-visible-count"]');
      if (visible) visible.textContent = `${entries.length} / ${state2.items.length}`;
      if (!state2.items.length) {
        box.innerHTML = `<div class="bsb-empty"><div class="bsb-empty-ico">≡</div><strong>字幕库为空</strong><span>点击「＋ 采集视频」，或直接打开一个视频自动加入。</span></div>`;
        if (renderTranscript) renderTranscriptPanel();
        refreshAiChips();
        return;
      }
      if (!entries.length) {
        box.innerHTML = `<div class="bsb-empty"><strong>没有匹配项</strong><span>调整搜索词或字幕状态筛选。</span></div>`;
        if (renderTranscript) renderTranscriptPanel();
        refreshAiChips();
        return;
      }
      if (!state2.libraryFolderCollapsed || typeof state2.libraryFolderCollapsed !== "object") {
        state2.libraryFolderCollapsed = {};
      }
      let nodes = [];
      try {
        nodes = buildLibraryRenderNodes2(entries, state2.libraryFolderCollapsed);
      } catch (error) {
        console.warn("[bili-subbatch] library render fallback", error);
      }
      if (!Array.isArray(nodes) || !nodes.length) {
        nodes = entries.map((entry) => ({ type: "item", entry, depth: 0 }));
      }
      box.innerHTML = nodes.map((node) => libraryRenderNodeHtml(node, node.depth || 0)).join("");
      box.querySelectorAll('input[data-group-check][data-partial="1"]').forEach((el) => {
        el.checked = false;
        el.indeterminate = false;
      });
      refreshAiChips();
      if (renderTranscript) renderTranscriptPanel();
    }
    function waitForPlayerElement(selector, timeout = 8e3) {
      return new Promise((resolve2, reject) => {
        const existing = document.querySelector(selector);
        if (existing) return resolve2(existing);
        const observer = new MutationObserver(() => {
          const element2 = document.querySelector(selector);
          if (!element2) return;
          observer.disconnect();
          clearTimeout(timer);
          resolve2(element2);
        });
        const timer = window.setTimeout(() => {
          observer.disconnect();
          reject(new Error(`等待播放器元素超时: ${selector}`));
        }, timeout);
        observer.observe(document.documentElement, { childList: true, subtree: true });
      });
    }
    async function enablePlayerSubtitle(item) {
      if (!state2.autoEnablePlayerSubtitle) return;
      if (state2.playerSubtitleOperation) return state2.playerSubtitleOperation;
      state2.playerSubtitleOperation = (async () => {
        const button = await waitForPlayerElement(PLAYER_SUBTITLE_SELECTORS.button, 9e3);
        let panel = document.querySelector(PLAYER_SUBTITLE_SELECTORS.panel);
        if (!panel || panel.offsetParent === null) {
          button.click();
          panel = await waitForPlayerElement(PLAYER_SUBTITLE_SELECTORS.panel, 2500);
          await sleep(100);
        }
        const items = Array.from(panel.querySelectorAll(PLAYER_SUBTITLE_SELECTORS.item));
        const activeLang = items.find((node) => node.classList.contains("bpx-state-active"));
        const closeOn = panel.querySelector(`${PLAYER_SUBTITLE_SELECTORS.close}.bpx-state-active`);
        if (!activeLang || closeOn) {
          if (!items.length) throw new Error("播放器没有可开启字幕");
          const wanted = String(item?.lan || item?.preferred_language || "");
          const target = wanted && items.find((node) => node.dataset.lan === wanted) || items.find((node) => /^(ai-zh|zh-CN|zh-Hans|zh)$/i.test(node.dataset.lan || "")) || items.find((node) => /中文/.test(node.textContent || "")) || items[0];
          target?.click();
          await sleep(140);
        }
        if (panel.offsetParent !== null) button.click();
      })().catch((error) => {
        console.debug("[bili-subbatch] player subtitle not enabled", errorMessage(error));
      }).finally(() => {
        state2.playerSubtitleOperation = null;
      });
      return state2.playerSubtitleOperation;
    }
    function currentTranscriptItem() {
      if (state2.transcriptItemKey) {
        const exact = state2.items.find(
          (item) => routeVideoKey2(item.bvid, item.page || 1) === state2.transcriptItemKey
        );
        if (exact?.subStatus === "ok" && exact.data?.length) {
          state2.transcriptItem = exact;
          return exact;
        }
        if (state2.transcriptItem && routeVideoKey2(state2.transcriptItem.bvid, state2.transcriptItem.page || 1) === state2.transcriptItemKey) {
          return state2.transcriptItem;
        }
        return exact || null;
      }
      const first = state2.items.find((item) => item.subStatus === "ok" && item.data?.length) || null;
      if (first) state2.transcriptItem = first;
      return first;
    }
    function rememberTranscriptItem(item) {
      if (!item) return null;
      state2.transcriptItem = item;
      state2.transcriptItemKey = routeVideoKey2(item.bvid, item.page || 1);
      return item;
    }
    function selectTranscriptItem(item, { focusSearch = false } = {}) {
      if (!item) return;
      rememberTranscriptItem(item);
      state2.transcriptQuery = "";
      state2.transcriptFilteredIndexes = null;
      state2.transcriptActiveCueIndex = -1;
      const root = ensurePanel();
      const input = root.querySelector('[data-role="transcript-search"]');
      if (input) input.value = "";
      renderList();
      bindTranscriptVideoEvents();
      updateTranscriptActiveCue(currentVideoTime(), true);
      if (focusSearch) {
        setWorkspace("subs");
        input?.focus();
      }
    }
    function renderTranscriptPanel() {
      const root = document.getElementById(PANEL_ID);
      if (!root) return;
      const rendered = SubBatch2.SubBatchMonorepo.ui.transcriptController.renderPanel(
        root,
        currentTranscriptItem(),
        state2,
        {
          routeKey: routeVideoKey2,
          preferredTrack: (tracks) => bilibiliCall("subtitle.preferredIndex", tracks.map((track) => ({ ...track }))),
          parseSeconds: (value) => coreCall("parseSeconds", value)
        }
      );
      if (rendered) updateTranscriptActiveCue(currentVideoTime(), true);
    }
    function currentVideoTime() {
      return Number(document.querySelector("video")?.currentTime || 0);
    }
    function updateTranscriptActiveCue(time, force = false) {
      SubBatch2.SubBatchMonorepo.ui.transcriptController.updateActiveCue(
        document.getElementById(PANEL_ID),
        currentTranscriptItem()?.data || [],
        state2,
        time,
        force,
        {
          parseSeconds: (value) => coreCall("parseSeconds", value),
          now: Date.now,
          reducedMotion: () => matchMedia("(prefers-reduced-motion: reduce)").matches
        }
      );
    }
    function bindTranscriptVideoEvents() {
      state2.transcriptVideoAbort?.abort();
      const video2 = document.querySelector("video");
      if (!video2) return;
      const controller = new AbortController();
      state2.transcriptVideoAbort = controller;
      const update = () => updateTranscriptActiveCue(video2.currentTime);
      video2.addEventListener("timeupdate", update, { passive: true, signal: controller.signal });
      video2.addEventListener("seeking", update, { passive: true, signal: controller.signal });
      video2.addEventListener("loadedmetadata", update, { passive: true, signal: controller.signal });
      update();
    }
    function seekTranscriptTime(seconds) {
      const item = currentTranscriptItem();
      if (!item || typeof seconds !== "number" || !Number.isFinite(seconds)) return;
      seekToVideoTimestamp(seconds, item.bvid, item.page || 1);
      updateTranscriptActiveCue(seconds, true);
    }
    async function switchTranscriptTrack(index) {
      const item = currentTranscriptItem();
      const trackIndex = Number(index);
      const track = Number.isInteger(trackIndex) ? item?.tracks?.[trackIndex] : void 0;
      if (!item?.tracks?.length || !track || typeof item.cid !== "string" && typeof item.cid !== "number") return;
      state2.transcriptSwitchAbort?.abort();
      const controller = new AbortController();
      state2.transcriptSwitchAbort = controller;
      setStatus(`正在切换到 ${track.lan_doc || track.lan || "字幕"}…`);
      const base = {
        bvid: item.bvid,
        aid: typeof item.aid === "string" || typeof item.aid === "number" ? item.aid : null,
        cid: item.cid,
        title: item.title,
        author: item.author,
        pages: item.pages || [],
        page: item.page || 1
      };
      const result = await fetchTrackBodyFast(base, item.tracks, trackIndex, controller.signal);
      if (controller.signal.aborted) return;
      Object.assign(item, result, { selected: item.selected !== false });
      rememberTranscriptItem(item);
      lruSet(state2.fastSubtitleCache, `${item.bvid}:${item.cid}`, item);
      persistentCache.write(`subtitle:${item.bvid}:${item.cid}`, item, SUBTITLE_CACHE_TTL_MS).catch(() => {
      });
      state2.transcriptQuery = "";
      const input = ensurePanel().querySelector('[data-role="transcript-search"]');
      if (input) input.value = "";
      renderList();
      setStatus(`已切换 ${item.lan_doc || item.lan} · ${item.cue_count} 条`, "ok");
    }
    async function refreshCurrentTranscript() {
      const item = currentTranscriptItem();
      const ctx = detectContext2(location.href);
      const bvid = item?.bvid || ctx.bvid;
      const page = item?.page || ctx.page || 1;
      if (!bvid) return setStatus("当前页面没有可刷新的视频", "err");
      state2.autoCaptureKey = "";
      state2.autoAnalyzeKey = "";
      state2.autoAnalyzePendingKey = "";
      clearTimeout(state2.autoAnalyzeTimer);
      state2.fastSubtitleCache.delete(`${bvid}:${item?.cid || ""}`);
      await autoCaptureCurrentVideo("manual-refresh", { forceNetwork: true, requestedBvid: bvid, requestedPage: page });
    }
    function escapeHtml(s) {
      return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    function escapeAttr(s) {
      return escapeHtml(s).replace(/'/g, "&#39;");
    }
    function selectedItems() {
      return state2.items.filter((it) => it.selected);
    }
    async function onAction(act) {
      if (act === "cancel" || act === "job-stop") {
        stopLibraryJob();
        return;
      }
      if (act === "job-pause") {
        toggleLibraryJobPause();
        return;
      }
      if (act === "ai-stop") {
        if (state2.studioBusy) {
          abortStudioRequest();
          setStatus("正在停止对话生成…");
          return;
        }
        state2.aiAbort = true;
        abortAllAiRuns();
        setStatus("正在停止 AI Pipeline（预处理 + 后处理）…");
        return;
      }
      if (act === "ai-toggle") {
        toggleAiPanel();
        return;
      }
      if (act === "ai-flow-drawer") {
        setAiDrawer(state2.aiDrawer === "flow" ? "" : "flow");
        return;
      }
      if (act === "ai-input-drawer") {
        setAiDrawer(state2.aiDrawer === "input" ? "" : "input");
        return;
      }
      if (act === "ai-drawer-close") {
        setAiDrawer("");
        return;
      }
      if (act === "ai-copy-input") {
        const text = currentInputPreviewText(state2.aiInputView);
        if (!text) {
          setStatus("当前没有可复制的输入", "err");
          return;
        }
        if (typeof GM_setClipboard === "function") GM_setClipboard(text);
        else await navigator.clipboard.writeText(text);
        setStatus(`已复制${state2.aiInputView === "processed" ? "规范化稿" : "原始字幕"}`, "ok");
        return;
      }
      if (act === "post-task-add") {
        const prompts = state2.promptProfiles?.length ? state2.promptProfiles : loadPromptProfiles().prompts;
        const posts = prompts.filter((p) => p.stage === "postprocess");
        if (!posts.length) {
          setStatus("请先在设置 → Prompt 新建一个后处理 Prompt", "err");
          return;
        }
        const tasks = currentPostTasks().map((t) => ({ ...t, modelIds: [...t.modelIds || []] }));
        const used = new Set(tasks.map((t) => t.promptId));
        const prompt2 = posts.find((p) => !used.has(p.id)) || posts.find((p) => p.id === state2.activePromptId) || posts[0];
        if (!prompt2) return;
        const modelIds = (state2.aiProfiles?.length ? state2.aiProfiles : loadAiProfiles()).filter((p) => p.enabled).map((p) => p.id);
        const task = normalizePostTask({ id: makePostTaskId(), promptId: prompt2.id, modelIds, enabled: true, order: tasks.length }, tasks.length);
        tasks.push(task);
        state2.aiActiveTaskId = task.id;
        savePostTasks(tasks);
        renderAiFlowDrawer();
        setStatus(`已添加产物：${prompt2.name}`, "ok");
        return;
      }
      if (act === "prompt-save") {
        const library2 = savePromptProfilesFromForm({ activeId: ensurePanel().querySelector('[data-role="prompt-select"]')?.value || state2.activePromptId });
        fillPromptConfigForm(ensurePanel());
        const current = library2.prompts.find((p) => p.id === state2.promptEditorId);
        setStatus(`已保存 Prompt：${current?.name || getActivePromptProfile()?.name || "未命名"}`, "ok");
        return;
      }
      if (act === "prompt-add" || act === "prompt-add-pre" || act === "prompt-add-knowledge") {
        const library2 = savePromptProfilesFromForm({ activeId: state2.activePromptId });
        const stage = act === "prompt-add-pre" ? "preprocess" : act === "prompt-add-knowledge" ? "knowledge" : "postprocess";
        const next = coreCall("createPromptProfile", {
          id: coreCall("makePromptProfileId"),
          stage,
          name: stage === "preprocess" ? `字幕预处理 ${library2.prompts.filter((p) => p.stage === "preprocess").length + 1}` : stage === "knowledge" ? `知识追问 ${library2.prompts.filter((p) => p.stage === "knowledge").length + 1}` : `后处理提示词 ${library2.prompts.filter((p) => p.stage === "postprocess").length + 1}`,
          hint: stage === "preprocess" ? "字幕预处理" : stage === "knowledge" ? "局部知识追问" : "后处理提示词",
          systemPrompt: "",
          userPromptTemplate: stage === "knowledge" ? "{{question}}" : "{{subtitle}}"
        }, library2.prompts.length);
        const prompts = [...library2.prompts, next];
        savePromptProfiles(prompts, library2.activeId, library2.activePreprocessId, library2.activeKnowledgeId);
        state2.promptEditorId = next.id;
        state2.promptSearch = "";
        if (state2.ui) state2.ui.promptStage = stage;
        setPromptStageTab(stage, { silent: true, preserveEditor: true });
        fillPromptConfigForm(ensurePanel());
        setStatus(`已新增提示词：${next.name}`, "ok");
        return;
      }
      if (act === "prompt-reset") {
        const library2 = savePromptProfilesFromForm({ activeId: state2.activePromptId });
        const pre = coreCall("createPromptProfile", DEFAULT_PREPROCESS_PROMPT, 0);
        const post = coreCall("createPromptProfile", DEFAULT_MERMAID_PROMPT, 1);
        const html = coreCall("createPromptProfile", DEFAULT_HTML_FOLIO_PROMPT, 2);
        const knowledge2 = coreCall("createPromptProfile", DEFAULT_KNOWLEDGE_PROMPT, 3);
        const prompts = library2.prompts.filter((p) => ![DEFAULT_PREPROCESS_PROMPT_ID, DEFAULT_PROMPT_ID, DEFAULT_HTML_FOLIO_PROMPT_ID, DEFAULT_KNOWLEDGE_PROMPT_ID].includes(p.id));
        prompts.unshift(knowledge2);
        prompts.unshift(html);
        prompts.unshift(post);
        prompts.unshift(pre);
        savePromptProfiles(prompts, post.id, pre.id, knowledge2.id);
        state2.promptEditorId = pre.id;
        state2.promptSearch = "";
        if (state2.ui) state2.ui.promptStage = "preprocess";
        setPromptStageTab("preprocess", { silent: true, preserveEditor: true });
        setStatus("已恢复内置『字幕规范化』『全 Mermaid 学习图谱』『HTML 阅读页』『局部知识追问』；其他自定义提示词保持不变", "ok");
        return;
      }
      if (act === "ai-save") {
        const profiles = saveAiProfilesFromForm();
        fillAiConfigForm(ensurePanel());
        const current = profiles.find((p) => p.id === state2.aiEditorId);
        setStatus(`已保存 LLM：${current?.name || "未命名"} · ${profiles.filter((x) => x.enabled).length}/${profiles.length} 启用`, "ok");
        if (state2.autoAnalyzeEnabled) {
          const item = currentTranscriptItem();
          if (item?.subStatus === "ok" && item.data?.length) {
            state2.autoAnalyzeKey = "";
            scheduleAutoAnalyze(item, routeVideoKey2(item.bvid, item.page || 1), "config-saved", 80);
          }
        }
        return;
      }
      if (act === "ai-reset") {
        const prev = loadAiProfiles();
        const first = prev.find((x) => x.enabled) || prev[0];
        const resetProfile = coreCall("createAiProfile", {
          ...AI_DEFAULTS,
          name: "默认模型",
          apiKey: first?.apiKey || "",
          baseUrl: first?.baseUrl || ""
        }, 0);
        saveAiProfiles([resetProfile]);
        state2.aiEditorId = resetProfile.id;
        state2.aiSearch = "";
        fillAiConfigForm(ensurePanel());
        setStatus("已恢复为单个默认模型配置（保留首个配置的 Base URL 与 API Key）", "ok");
        return;
      }
      if (act === "ai-profile-add") {
        const profiles = saveAiProfilesFromForm();
        const source = profiles.find((p) => p.id === state2.aiEditorId) || profiles[profiles.length - 1] || coreCall("createAiProfile", AI_DEFAULTS, 0);
        const next = coreCall("createAiProfile", {
          ...source,
          id: coreCall("makeAiProfileId"),
          name: `模型 ${profiles.length + 1}`,
          enabled: true
        }, profiles.length);
        profiles.push(next);
        saveAiProfiles(profiles);
        state2.aiEditorId = next.id;
        state2.aiSearch = "";
        fillAiConfigForm(ensurePanel());
        setStatus("已新增 LLM；已沿用当前配置的连接参数，可直接修改", "ok");
        return;
      }
      if (act === "ai-focus") {
        closeMermaidFullscreen();
        state2.aiFocus = !state2.aiFocus;
        if (state2.aiFocus) setWorkspace("ai", { silent: true });
        applyPanelGeometry();
        setStatus(state2.aiFocus ? "已进入专注阅读 · 按 Esc 或点「退出专注」恢复" : "已退出专注阅读", "ok");
        return;
      }
      if (act === "ai-reprocess") {
        if (!state2.preprocessEnabled) {
          setStatus("预处理当前已关闭；开启后才能重跑预处理", "err");
          return;
        }
        if (state2.aiBusy) {
          setStatus("AI Pipeline 正在运行，请先停止当前任务再重跑预处理", "err");
          return;
        }
        state2.forcePreprocessOnce = true;
        try {
          await doAiAnalyze();
        } finally {
          state2.forcePreprocessOnce = false;
        }
        return;
      }
      if (act === "ai-regenerate-current") {
        await regenerateActiveAiRun();
        return;
      }
      if (act === "ai-regenerate-all") {
        await regenerateAllAiRuns();
        return;
      }
      if (act === "ai-send") {
        if (operationBusy()) {
          state2.pendingAiSend = true;
          setStatus("扫描或字幕任务仍在运行 · 已排队，结束后自动送入 AI");
          return;
        }
        if (state2.aiBusy) {
          const restart = typeof pageWindow.confirm === "function" ? pageWindow.confirm("已有 AI 模型仍在生成。是否停止当前批次并用当前勾选内容重新分析？") : false;
          if (!restart) {
            setStatus("当前 AI 批次仍在生成；可先停止，或再次点击并确认重新分析");
            return;
          }
          stopAiBatchForRestart();
        }
        await doAiAnalyze();
        return;
      }
      if (act === "ai-stick") {
        if (state2.aiStickBottom && !state2.aiUserReading) {
          detachAiFollow();
          setStatus("已暂停跟随 · 可自由滚动 · 点「↓ 最新」回到底部");
        } else {
          resumeAiFollow();
          setStatus("跟随最新输出");
        }
        return;
      }
      if (act === "ai-jump") {
        resumeAiFollow();
        setStatus("已跳到最新");
        return;
      }
      if (act === "ai-copy") {
        const text = getActiveAiRun()?.raw || state2.aiRaw || "";
        if (!text.trim()) {
          setStatus("没有可复制的内容", "err");
          return;
        }
        clipboardWrite(text);
        setStatus("已复制 AI 输出", "ok");
        return;
      }
      if (act === "ai-export") {
        const run = getActiveAiRun();
        const text = run?.raw || state2.aiRaw || "";
        if (!text.trim()) return setStatus("没有可导出的笔记", "err");
        const bvid = (run?.sourceBvids || state2.aiSourceBvids)[0] || "bilibili";
        const modelName = run?.config?.name || run?.config?.model || "AI";
        const folio2 = extractHtmlFolioSource(text);
        if (folio2) {
          const title = extractFolioTitle(folio2) || `${modelName} 阅读页`;
          downloadText(
            `${safeFilename(`${bvid}_${modelName}_阅读页`)}.html`,
            buildStandaloneFolioHtml(title, folio2, state2.ui?.ctpFlavor),
            { overwrite: true }
          );
          setStatus(`已导出 ${modelName} 的 HTML 阅读页`, "ok");
          return;
        }
        downloadText(`${safeFilename(`${bvid}_${modelName}_AI笔记`)}.md`, text);
        setStatus(`已导出 ${modelName} 的 Markdown`, "ok");
        return;
      }
      if (act === "ai-font-dec" || act === "ai-font-inc") {
        const delta = act === "ai-font-inc" ? 1 : -1;
        const current = normalizeNoteFont2(state2.ui?.noteFont, NOTE_FONT_DEFAULT);
        const next = Math.max(NOTE_FONT_MIN, Math.min(NOTE_FONT_MAX, current + delta));
        if (state2.ui) state2.ui.noteFont = next;
        ensurePanel().style.setProperty("--bsb-note-font", `${next}px`);
        saveUiGeom();
        setStatus(`正文字号 ${next}px`);
        return;
      }
      if (act === "ai-top") {
        scrollAiToTop();
        setStatus("已回到顶部");
        return;
      }
      if (act === "capture-toggle") {
        state2.captureDrawerOpen = !state2.captureDrawerOpen;
        const drawer = ensurePanel().querySelector('[data-role="capture-drawer"]');
        if (drawer) drawer.hidden = !state2.captureDrawerOpen;
        if (state2.captureDrawerOpen) refreshContextUI();
        return;
      }
      if (act === "open-ai-workspace") {
        setWorkspace("ai");
        refreshAiChips();
        setStatus("已打开 AI 学习图谱工作区 · 使用左侧资源库勾选项作为输入");
        return;
      }
      if (act === "transcript-refresh") {
        await refreshCurrentTranscript();
        return;
      }
      if (act === "clear") {
        state2.items = [];
        state2.meta = {};
        state2.libraryFolderCollapsed = {};
        state2.transcriptItemKey = "";
        state2.transcriptItem = null;
        state2.transcriptQuery = "";
        state2.transcriptActiveCueIndex = -1;
        state2.libraryQuery = "";
        state2.libraryFilter = "all";
        const librarySearch = ensurePanel().querySelector('[data-role="library-search"]');
        if (librarySearch) librarySearch.value = "";
        renderList();
        setStatus("已清空");
        return;
      }
      if (act === "folder-expand-all") {
        state2.libraryFolderCollapsed = {};
        renderList({ renderTranscript: false });
        setStatus("已展开全部文件夹", "ok");
        return;
      }
      if (act === "folder-collapse-all") {
        const collapsed = {};
        state2.items.forEach((item) => {
          const key = resolveLibraryGroupKey2(item);
          if (key && !key.startsWith("single:")) collapsed[key] = true;
        });
        state2.libraryFolderCollapsed = collapsed;
        renderList({ renderTranscript: false });
        setStatus("已收起全部文件夹", "ok");
        return;
      }
      if (act === "sel-all") {
        state2.items.forEach((it) => it.selected = true);
        renderList();
        return;
      }
      if (act === "sel-none") {
        state2.items.forEach((it) => it.selected = false);
        renderList();
        return;
      }
      if (act === "scan") {
        await doScan();
        return;
      }
      if (act === "copy-bvid") {
        const list = selectedItems();
        if (!list.length) {
          setStatus("请先勾选视频", "err");
          return;
        }
        const text = list.map((it) => it.bvid).filter(Boolean).join("\n");
        clipboardWrite(text);
        setStatus(`已复制 ${list.length} 个 BV`, "ok");
        return;
      }
      if (act === "dl-srt" || act === "dl-txt" || act === "copy" || act === "dl-ok-only" || act === "fetch-selected") {
        await doBatch(act);
      }
    }
    function clipboardWrite(text) {
      if (typeof GM_setClipboard === "function") GM_setClipboard(text, "text");
      else if (navigator.clipboard) navigator.clipboard.writeText(text);
    }
    function storageGet(key, fallback) {
      try {
        if (typeof GM_getValue === "function") {
          const v = GM_getValue(key, null);
          if (v != null && v !== "") return v;
        }
      } catch {
      }
      try {
        const legacy = localStorage.getItem(key);
        if (legacy != null) return legacy;
      } catch {
      }
      return fallback;
    }
    function storageSet(key, value) {
      let storedByGm = false;
      try {
        if (typeof GM_setValue === "function") {
          GM_setValue(key, value);
          storedByGm = true;
        }
      } catch {
      }
      if (!storedByGm) {
        try {
          localStorage.setItem(key, String(value));
        } catch {
        }
      } else {
        try {
          localStorage.removeItem(key);
        } catch {
        }
      }
    }
    function shortcutDefaults() {
      return {
        schemaVersion: SHORTCUT_SCHEMA_VERSION,
        enabled: true,
        summonLayout: "remember",
        // remember | floating | right | left
        summonTarget: "remember",
        // remember | processed | postprocess
        preferredDock: "right",
        // right | left
        bindings: Object.fromEntries(SHORTCUT_COMMANDS2.map((command2) => [command2.id, command2.defaultChord]))
      };
    }
    function loadShortcutSettings() {
      const defaults = shortcutDefaults();
      try {
        const raw = storageGet(SHORTCUT_STORE_KEY, "");
        if (!raw) return defaults;
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (!parsed || typeof parsed !== "object") return defaults;
        const parsedSchemaVersion = Number(parsed.schemaVersion) || 1;
        const parsedBindings = { ...parsed.bindings || {} };
        if (parsedSchemaVersion < 2 && parsedBindings["toggle-panel"] === "Ctrl+Alt+KeyB") {
          parsedBindings["toggle-panel"] = "Ctrl+KeyB";
        }
        const bindings2 = { ...defaults.bindings };
        for (const command2 of SHORTCUT_COMMANDS2) {
          if (Object.prototype.hasOwnProperty.call(parsedBindings, command2.id)) {
            bindings2[command2.id] = String(parsedBindings[command2.id] || "");
          }
        }
        return {
          schemaVersion: SHORTCUT_SCHEMA_VERSION,
          enabled: parsed.enabled !== false,
          summonLayout: ["remember", "floating", "right", "left"].includes(parsed.summonLayout) ? parsed.summonLayout : defaults.summonLayout,
          summonTarget: ["remember", "processed", "postprocess"].includes(parsed.summonTarget) ? parsed.summonTarget : defaults.summonTarget,
          preferredDock: parsed.preferredDock === "left" ? "left" : "right",
          bindings: bindings2
        };
      } catch {
        return defaults;
      }
    }
    function saveShortcutSettings(config = state2.shortcutConfig) {
      const defaults = shortcutDefaults();
      const next = config && typeof config === "object" ? config : defaults;
      next.schemaVersion = SHORTCUT_SCHEMA_VERSION;
      next.enabled = next.enabled !== false;
      next.summonLayout = ["remember", "floating", "right", "left"].includes(next.summonLayout) ? next.summonLayout : defaults.summonLayout;
      next.summonTarget = ["remember", "processed", "postprocess"].includes(next.summonTarget) ? next.summonTarget : defaults.summonTarget;
      next.preferredDock = next.preferredDock === "left" ? "left" : "right";
      next.bindings = { ...defaults.bindings, ...next.bindings || {} };
      state2.shortcutConfig = next;
      storageSet(SHORTCUT_STORE_KEY, JSON.stringify(next));
      refreshShortcutHints();
      return next;
    }
    function shortcutKeyLabel(code) {
      const c = String(code || "");
      if (/^Key[A-Z]$/.test(c)) return c.slice(3);
      if (/^Digit[0-9]$/.test(c)) return c.slice(5);
      if (/^Numpad[0-9]$/.test(c)) return `Num ${c.slice(6)}`;
      const labels = {
        Space: "Space",
        Enter: "Enter",
        Tab: "Tab",
        Escape: "Esc",
        Backspace: "Backspace",
        Delete: "Delete",
        ArrowUp: "↑",
        ArrowDown: "↓",
        ArrowLeft: "←",
        ArrowRight: "→",
        Minus: "-",
        Equal: "=",
        BracketLeft: "[",
        BracketRight: "]",
        Semicolon: ";",
        Quote: "'",
        Comma: ",",
        Period: ".",
        Slash: "/",
        Backslash: "\\",
        Backquote: "`",
        Home: "Home",
        End: "End",
        PageUp: "PgUp",
        PageDown: "PgDn",
        Insert: "Insert"
      };
      if (labels[c]) return labels[c];
      if (/^F\d{1,2}$/.test(c)) return c;
      return c.replace(/^(Arrow|Numpad)/, "") || c;
    }
    function shortcutChordFromEvent(event) {
      const code = String(event?.code || "");
      if (!code || /^(Control|Shift|Alt|Meta)(Left|Right)?$/.test(code)) return "";
      const parts = [];
      if (event.ctrlKey) parts.push("Ctrl");
      if (event.altKey) parts.push("Alt");
      if (event.shiftKey) parts.push("Shift");
      if (event.metaKey) parts.push("Meta");
      parts.push(code);
      return parts.join("+");
    }
    function shortcutDisplayChord(chord) {
      const parts = String(chord || "").split("+").filter(Boolean);
      if (!parts.length) return "未绑定";
      return parts.map((part) => ["Ctrl", "Alt", "Shift", "Meta"].includes(part) ? part : shortcutKeyLabel(part)).join(" + ");
    }
    function shortcutHasStrongModifier(chord) {
      const parts = new Set(String(chord || "").split("+"));
      return parts.has("Ctrl") || parts.has("Alt") || parts.has("Meta");
    }
    function shortcutConflictInfo(chord, commandId = "") {
      const value = String(chord || "");
      if (!value) return { level: "off", text: "未绑定" };
      const duplicate = SHORTCUT_COMMANDS2.find((command2) => command2.id !== commandId && state2.shortcutConfig?.bindings?.[command2.id] === value);
      if (duplicate) return { level: "error", text: `与“${duplicate.label}”重复` };
      const chrome = /* @__PURE__ */ new Set([
        "Ctrl+KeyN",
        "Ctrl+Shift+KeyN",
        "Ctrl+KeyT",
        "Ctrl+Shift+KeyT",
        "Ctrl+KeyW",
        "Ctrl+Shift+KeyW",
        "Ctrl+KeyL",
        "Ctrl+KeyK",
        "Ctrl+KeyE",
        "Ctrl+KeyF",
        "Ctrl+KeyG",
        "Ctrl+Shift+KeyG",
        "Ctrl+KeyR",
        "Ctrl+KeyP",
        "Ctrl+KeyS",
        "Ctrl+KeyD",
        "Ctrl+KeyH",
        "Ctrl+KeyJ",
        "Ctrl+KeyU",
        "Ctrl+Shift+KeyJ",
        "Ctrl+Shift+KeyB",
        "Ctrl+Shift+KeyO",
        "Ctrl+Shift+Delete",
        "Ctrl+Tab",
        "Ctrl+Shift+Tab",
        "Alt+KeyD",
        "Alt+ArrowLeft",
        "Alt+ArrowRight",
        "Alt+Home",
        "Shift+Escape",
        "F11",
        "F12",
        "Alt+Shift+KeyI",
        ...Array.from({ length: 9 }, (_, i) => `Ctrl+Digit${i + 1}`)
      ]);
      if (chrome.has(value)) return { level: "warn", text: "Chrome 常用快捷键，页面可能收不到" };
      const parts = new Set(value.split("+"));
      const code = value.split("+").at(-1) || "";
      const biliCodes = /* @__PURE__ */ new Set(["Space", "KeyK", "KeyJ", "KeyL", "KeyW", "KeyT", "KeyF", "KeyP", "KeyI", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyM", "Minus", "Equal", "Digit0", "KeyQ", "KeyE", "KeyD", "KeyC", "KeyG", "KeyH", "KeyB", "Enter"]);
      if (!parts.has("Ctrl") && !parts.has("Alt") && !parts.has("Meta") && (biliCodes.has(code) || value === "Shift+KeyS")) {
        return { level: "warn", text: "Bilibili 播放器常用键，容易冲突" };
      }
      if (!shortcutHasStrongModifier(value)) return { level: "warn", text: "建议至少使用 Ctrl / Alt / Meta 之一" };
      return { level: "ok", text: "推荐组合" };
    }
    function shortcutEditableTarget(target) {
      if (!(target instanceof Element)) return false;
      return !!target.closest('input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]');
    }
    function refreshShortcutHints() {
      const root = document.getElementById(PANEL_ID);
      if (!root) return;
      const toggle = state2.shortcutConfig?.bindings?.["toggle-panel"] || "";
      const label = shortcutDisplayChord(toggle);
      const fab = root.querySelector(".bsb-fab");
      const dockTab = root.querySelector(".bsb-dock-tab");
      if (fab) fab.title = toggle ? `SubBatch 工作台 · ${label}` : "SubBatch 工作台";
      if (dockTab) dockTab.title = toggle ? `展开 SubBatch 工作台 · ${label}` : "展开 SubBatch 工作台";
    }
    function shortcutCommandHtml(command2) {
      const chord = state2.shortcutConfig?.bindings?.[command2.id] || "";
      const conflict = shortcutConflictInfo(chord, command2.id);
      const recording = state2.shortcutRecordingId === command2.id;
      return `<article class="bsb-shortcut-row" data-shortcut-row="${escapeAttr(command2.id)}"><div class="bsb-shortcut-copy"><strong>${escapeHtml(command2.label)}</strong><span>${escapeHtml(command2.hint)}</span></div><div class="bsb-shortcut-control"><button type="button" class="bsb-shortcut-key${recording ? " recording" : ""}" data-shortcut-record="${escapeAttr(command2.id)}" aria-pressed="${recording ? "true" : "false"}">${recording ? "按下组合键…" : escapeHtml(shortcutDisplayChord(chord))}</button><button type="button" class="bsb-shortcut-reset" data-shortcut-reset="${escapeAttr(command2.id)}" title="恢复默认">↺</button><span class="bsb-shortcut-state ${escapeAttr(conflict.level)}">${escapeHtml(conflict.text)}</span></div></article>`;
    }
    function renderShortcutSettings(root = document.getElementById(PANEL_ID)) {
      const host2 = root?.querySelector('[data-role="shortcut-settings"]');
      if (!host2) return;
      const config = state2.shortcutConfig || loadShortcutSettings();
      host2.innerHTML = `<div class="bsb-shortcut-page"><div class="bsb-shortcut-hero"><div><span class="bsb-shortcut-kicker">QUICK SUMMON</span><h3>快捷召唤</h3><p>快捷键只在 Bilibili 页面生效。正在输入文字时默认不触发，避免干扰搜索、弹幕和表单。</p></div><label class="bsb-flow-switch"><input type="checkbox" data-shortcut-pref="enabled" ${config.enabled ? "checked" : ""}><span class="bsb-flow-switch-track" aria-hidden="true"></span><span class="bsb-flow-switch-text">${config.enabled ? "已开启" : "已关闭"}</span></label></div>
      <section class="bsb-shortcut-card"><div class="bsb-shortcut-section-title"><strong>召唤行为</strong><span>主快捷键打开面板时，决定它出现在哪里、先看什么。</span></div><div class="bsb-shortcut-prefs"><label><span>面板布局</span><div class="bsb-flow-select"><select data-shortcut-pref="summonLayout"><option value="remember"${config.summonLayout === "remember" ? " selected" : ""}>记住上次</option><option value="floating"${config.summonLayout === "floating" ? " selected" : ""}>悬浮</option><option value="right"${config.summonLayout === "right" ? " selected" : ""}>右侧靠边</option><option value="left"${config.summonLayout === "left" ? " selected" : ""}>左侧靠边</option></select><span class="bsb-flow-select-icon">⌄</span></div></label><label><span>默认内容</span><div class="bsb-flow-select"><select data-shortcut-pref="summonTarget"><option value="remember"${config.summonTarget === "remember" ? " selected" : ""}>记住上次</option><option value="processed"${config.summonTarget === "processed" ? " selected" : ""}>AI 处理字幕</option><option value="postprocess"${config.summonTarget === "postprocess" ? " selected" : ""}>后处理 · 上次产物/模型</option></select><span class="bsb-flow-select-icon">⌄</span></div></label><label><span>靠边方向</span><div class="bsb-flow-select"><select data-shortcut-pref="preferredDock"><option value="right"${config.preferredDock === "right" ? " selected" : ""}>右侧</option><option value="left"${config.preferredDock === "left" ? " selected" : ""}>左侧</option></select><span class="bsb-flow-select-icon">⌄</span></div></label></div></section>
      <section class="bsb-shortcut-card"><div class="bsb-shortcut-section-title"><strong>命令快捷键</strong><span>点击快捷键框后直接按新的组合；Esc 取消，Backspace / Delete 清除。</span></div><div class="bsb-shortcut-list">${SHORTCUT_COMMANDS2.map(shortcutCommandHtml).join("")}</div><div class="bsb-shortcut-foot"><span>建议使用 Ctrl + Alt + 字母/数字，避开 Chrome 与 B 站播放器常用键。</span><button type="button" class="bsb-btn ghost" data-shortcut-reset-all>恢复默认快捷键</button></div></section></div>`;
    }
    function ensureBuiltinStagePrompts(prompts) {
      const list = [...prompts || []];
      if (!list.some((p) => p.stage === "preprocess")) list.unshift(coreCall("createPromptProfile", DEFAULT_PREPROCESS_PROMPT, 0));
      if (!list.some((p) => p.id === DEFAULT_HTML_FOLIO_PROMPT_ID)) {
        const mermaidAt = list.findIndex((p) => p.id === DEFAULT_PROMPT_ID);
        const html = coreCall("createPromptProfile", DEFAULT_HTML_FOLIO_PROMPT, list.length);
        if (mermaidAt >= 0) list.splice(mermaidAt + 1, 0, html);
        else list.push(html);
      }
      if (!list.some((p) => p.stage === "knowledge")) list.push(coreCall("createPromptProfile", DEFAULT_KNOWLEDGE_PROMPT, list.length));
      return list;
    }
    function migrateBuiltinPromptLanguageRules(prompts, storedVersion) {
      if (Number(storedVersion || 0) >= 3) return { prompts, changed: false };
      let changed = false;
      const next = (prompts || []).map((prompt2) => {
        if (!prompt2 || ![DEFAULT_PREPROCESS_PROMPT_ID, DEFAULT_PROMPT_ID].includes(prompt2.id)) return prompt2;
        if (/简体中文/.test(String(prompt2.systemPrompt || ""))) return prompt2;
        const addition = prompt2.id === DEFAULT_PREPROCESS_PROMPT_ID ? [
          "【输出语言（v5.8.1）】",
          "无论输入字幕是英语、日语、韩语或其他语言，规范化正文必须统一转换为简体中文；完整外语句子应忠实翻译。专有名词、模型名、API、代码、命令、参数和缩写可保留必要原文。"
        ].join("\n") : [
          "【输出语言（v5.8.1）】",
          "所有最终可见标题与 Mermaid 节点文字统一使用简体中文；若输入为其他语言先忠实转换。专有名词、模型名、API、代码、命令、参数和缩写可保留必要原文。"
        ].join("\n");
        changed = true;
        return { ...prompt2, systemPrompt: `${String(prompt2.systemPrompt || "").trim()}

${addition}`.trim() };
      });
      return { prompts: next, changed };
    }
    function migrateBuiltinPreprocessChunkRules(prompts, storedVersion) {
      if (Number(storedVersion || 0) >= 4) return { prompts, changed: false };
      let changed = false;
      const next = (prompts || []).map((prompt2) => {
        if (!prompt2 || prompt2.id !== DEFAULT_PREPROCESS_PROMPT_ID) return prompt2;
        let systemPrompt = String(prompt2.systemPrompt || "");
        let userPromptTemplate = String(prompt2.userPromptTemplate || "");
        if (!/本地拼接器|overlap/i.test(systemPrompt)) {
          systemPrompt = `${systemPrompt.trim()}

【长视频分块（v5.9.0）】
长字幕会按真实时间戳切成多个块；从第二块开始可能携带上一块末尾的少量 overlap 上下文。正常规范化并保留真实时间戳，不要自行删除或改写时间戳；脚本会依据“新内容起点”确定性去除 overlap 重复。`.trim();
          changed = true;
        }
        if (!/\{\{coreStart\}\}/.test(userPromptTemplate)) {
          userPromptTemplate = userPromptTemplate.replace(
            /字幕分块：\{\{chunkIndex\}\} \/ \{\{chunkCount\}\}/,
            "字幕分块：{{chunkIndex}} / {{chunkCount}}\n本块上下文起点：{{chunkStart}}\n本块新内容起点：{{coreStart}}\n本块结束：{{chunkEnd}}"
          );
          changed = true;
        }
        return { ...prompt2, systemPrompt, userPromptTemplate };
      });
      return { prompts: next, changed };
    }
    function migrateBuiltinKnowledgeHighlightRules(prompts, storedVersion) {
      if (Number(storedVersion || 0) >= 6) return { prompts, changed: false };
      let changed = false;
      const next = (prompts || []).map((prompt2) => {
        if (!prompt2 || prompt2.id !== DEFAULT_KNOWLEDGE_PROMPT_ID) return prompt2;
        const systemPrompt = String(prompt2.systemPrompt || "");
        if (/【阅读强调】|==关键短语==/.test(systemPrompt)) return prompt2;
        const addition = [
          "【阅读强调】",
          "9. 可以使用 ==关键短语== 标记真正值得用户记住的内容。系统会把 ==...== 渲染为视觉高亮。",
          "10. 高亮必须克制：每个自然段通常 0—2 处；优先高亮核心概念、关键结论、因果节点、关键数字、重要边界；一处高亮尽量是一个短语，而不是整段文字；禁止连续高亮多个句子；禁止为了视觉效果随意高亮普通描述。",
          "11. **...** 只表示普通加粗；==...== 表示更高一级的『核心记忆点』。",
          "12. 不要在代码、公式、Markdown 标题中使用 ==...==；不要嵌套写成 ==**文字**==。"
        ].join("\n");
        changed = true;
        return { ...prompt2, systemPrompt: `${systemPrompt.trim()}

${addition}`.trim() };
      });
      return { prompts: next, changed };
    }
    function migrateBuiltinHtmlFolioPrompt(prompts, storedVersion) {
      if (Number(storedVersion || 0) >= 9) return { prompts, changed: false };
      let changed = false;
      const next = (prompts || []).map((prompt2) => {
        if (!prompt2 || prompt2.id !== DEFAULT_HTML_FOLIO_PROMPT_ID) return prompt2;
        changed = true;
        return coreCall("createPromptProfile", {
          ...DEFAULT_HTML_FOLIO_PROMPT,
          id: prompt2.id,
          stage: "postprocess"
        }, 0);
      });
      return { prompts: next, changed };
    }
    function loadPromptProfiles() {
      try {
        const raw = storageGet(PROMPT_STORE_KEY, null);
        if (raw != null && raw !== "") {
          const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
          let prompts2 = coreCall("normalizePromptProfiles", Array.isArray(parsed) ? parsed : parsed?.prompts);
          prompts2 = ensureBuiltinStagePrompts(prompts2);
          const storedVersion = Array.isArray(parsed) ? 0 : Number(parsed?.version || 0);
          const migratedLanguage = migrateBuiltinPromptLanguageRules(prompts2, storedVersion);
          prompts2 = migratedLanguage.prompts;
          const migratedChunking = migrateBuiltinPreprocessChunkRules(prompts2, storedVersion);
          prompts2 = migratedChunking.prompts;
          const migratedHighlight = migrateBuiltinKnowledgeHighlightRules(prompts2, storedVersion);
          prompts2 = migratedHighlight.prompts;
          const migratedHtmlFolio = migrateBuiltinHtmlFolioPrompt(prompts2, storedVersion);
          prompts2 = migratedHtmlFolio.prompts;
          const migrated = {
            changed: migratedLanguage.changed || migratedChunking.changed || migratedHighlight.changed || migratedHtmlFolio.changed || storedVersion < PROMPT_SCHEMA_VERSION
          };
          const ids = coreCall(
            "resolvePromptActiveIds",
            prompts2,
            String(Array.isArray(parsed) ? "" : parsed?.activeId || ""),
            String(Array.isArray(parsed) ? "" : parsed?.activePreprocessId || ""),
            String(Array.isArray(parsed) ? "" : parsed?.activeKnowledgeId || "")
          );
          if (migrated.changed) {
            try {
              storageSet(PROMPT_STORE_KEY, JSON.stringify({ version: PROMPT_SCHEMA_VERSION, activeId: ids.activeId, activePreprocessId: ids.activePreprocessId, activeKnowledgeId: ids.activeKnowledgeId, prompts: prompts2 }));
            } catch {
            }
          }
          state2.promptProfiles = prompts2;
          state2.activePromptId = ids.activeId;
          state2.activePrePromptId = ids.activePreprocessId;
          state2.activeKnowledgePromptId = ids.activeKnowledgeId;
          return { prompts: prompts2, ...ids };
        }
      } catch {
      }
      const pre = coreCall("createPromptProfile", DEFAULT_PREPROCESS_PROMPT, 0);
      const post = coreCall("createPromptProfile", DEFAULT_MERMAID_PROMPT, 1);
      const html = coreCall("createPromptProfile", DEFAULT_HTML_FOLIO_PROMPT, 2);
      const knowledge2 = coreCall("createPromptProfile", DEFAULT_KNOWLEDGE_PROMPT, 3);
      const prompts = [pre, post, html, knowledge2];
      state2.promptProfiles = prompts;
      state2.activePromptId = post.id;
      state2.activePrePromptId = pre.id;
      state2.activeKnowledgePromptId = knowledge2.id;
      return { prompts, activeId: post.id, activePreprocessId: pre.id, activeKnowledgeId: knowledge2.id };
    }
    function savePromptProfiles(prompts, activeId, activePreprocessId = state2.activePrePromptId, activeKnowledgeId = state2.activeKnowledgePromptId) {
      const normalized = coreCall("normalizePromptProfiles", prompts);
      const ids = coreCall("resolvePromptActiveIds", normalized, String(activeId || ""), String(activePreprocessId || ""), String(activeKnowledgeId || ""));
      try {
        storageSet(PROMPT_STORE_KEY, JSON.stringify({
          version: PROMPT_SCHEMA_VERSION,
          activeId: ids.activeId,
          activePreprocessId: ids.activePreprocessId,
          activeKnowledgeId: ids.activeKnowledgeId,
          prompts: normalized
        }));
      } catch {
      }
      state2.promptProfiles = normalized;
      state2.activePromptId = ids.activeId;
      state2.activePrePromptId = ids.activePreprocessId;
      state2.activeKnowledgePromptId = ids.activeKnowledgeId;
      refreshPromptSelector(document.getElementById(PANEL_ID));
      if (state2.postTasks?.length) savePostTasks(state2.postTasks);
      else loadPostTasks();
      return { prompts: normalized, ...ids };
    }
    function getActiveKnowledgePromptProfile() {
      const prompts = state2.promptProfiles?.length || state2.activeKnowledgePromptId ? state2.promptProfiles : loadPromptProfiles().prompts;
      return prompts.find((p) => p.id === state2.activeKnowledgePromptId && p.stage === "knowledge") || prompts.find((p) => p.stage === "knowledge") || null;
    }
    function getActivePromptProfile() {
      const prompts = state2.promptProfiles?.length || state2.activePromptId ? state2.promptProfiles : loadPromptProfiles().prompts;
      return prompts.find((p) => p.id === state2.activePromptId && p.stage === "postprocess") || prompts.find((p) => p.stage === "postprocess") || null;
    }
    function getActivePreprocessPromptProfile() {
      const prompts = state2.promptProfiles?.length || state2.activePrePromptId ? state2.promptProfiles : loadPromptProfiles().prompts;
      return prompts.find((p) => p.id === state2.activePrePromptId && p.stage === "preprocess") || prompts.find((p) => p.stage === "preprocess") || null;
    }
    function makeKnowledgeId(prefix = "k") {
      return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    }
    let knowledgeRepository = null;
    function currentKnowledgeRepository() {
      if (!knowledgeRepository) {
        const factory = appFn("knowledge.createRepository");
        if (factory && globalThis.indexedDB) {
          knowledgeRepository = SubBatch2.SubBatchMonorepo.app.knowledge.createRepository(globalThis.indexedDB);
        }
      }
      return knowledgeRepository;
    }
    function knowledgeStoreRequest(storeName, mode, handler) {
      const repository = currentKnowledgeRepository();
      if (!repository) return Promise.reject(new Error("IndexedDB unavailable"));
      return repository.request(storeName, mode, handler);
    }
    async function knowledgeRefreshCache() {
      try {
        const [anchors, nodes] = await Promise.all([
          knowledgeStoreRequest(KNOWLEDGE_ANCHOR_STORE, "readonly", (s) => s.getAll()),
          knowledgeStoreRequest(KNOWLEDGE_NODE_STORE, "readonly", (s) => s.getAll())
        ]);
        state2.knowledgeAnchors = SubBatch2.SubBatchMonorepo.app.knowledge.sortAnchors(anchors);
        const { nodes: reconciledNodes, recovered } = SubBatch2.SubBatchMonorepo.app.knowledge.reconcileNodes(
          nodes,
          state2.knowledgeNodes,
          !!state2.knowledgeBusy,
          knowledgeVisibleAnswer
        );
        state2.knowledgeNodes = reconciledNodes;
        if (recovered.length) Promise.all(recovered.map((node) => knowledgeStoreRequest(KNOWLEDGE_NODE_STORE, "readwrite", (s) => s.put(node)))).catch(() => {
        });
      } catch (error) {
        state2.knowledgeAnchors = state2.knowledgeAnchors || [];
        state2.knowledgeNodes = state2.knowledgeNodes || [];
        throw error;
      }
      return { anchors: state2.knowledgeAnchors, nodes: state2.knowledgeNodes };
    }
    async function knowledgePutAnchor(anchor) {
      return SubBatch2.SubBatchMonorepo.app.knowledge.saveAnchor(
        state2.knowledgeAnchors,
        anchor,
        (value) => knowledgeStoreRequest(KNOWLEDGE_ANCHOR_STORE, "readwrite", (store) => store.put(value))
      );
    }
    async function knowledgePutNode(node) {
      return SubBatch2.SubBatchMonorepo.app.knowledge.saveNode(
        state2.knowledgeNodes,
        node,
        (value) => knowledgeStoreRequest(KNOWLEDGE_NODE_STORE, "readwrite", (store) => store.put(value))
      );
    }
    async function knowledgeDeleteAnchor(anchorId) {
      if (state2.knowledgeRuntime && state2.knowledgeActiveAnchorId === anchorId) abortKnowledgeRequest();
      const repository = currentKnowledgeRepository();
      if (!repository) throw new Error("IndexedDB unavailable");
      const remaining = await SubBatch2.SubBatchMonorepo.app.knowledge.deleteAnchorCommitted(
        state2.knowledgeAnchors,
        state2.knowledgeNodes,
        anchorId,
        (id) => repository.deleteAnchor(id)
      );
      state2.knowledgeAnchors = remaining.anchors;
      state2.knowledgeNodes = remaining.nodes;
      if (state2.knowledgeActiveAnchorId === anchorId) {
        state2.knowledgeActiveAnchorId = "";
        state2.knowledgeActiveNodeId = "";
      }
    }
    function knowledgeSourceKey(bvid, page) {
      return `${String(bvid || "").toUpperCase()}:P${Math.max(1, Number(page) || 1)}`;
    }
    function currentKnowledgeSource() {
      const routeKey = currentRouteVideoKey();
      const current = routeKey ? state2.items.find((it) => routeVideoKey2(it.bvid, Number(it.page) || 1) === routeKey) || (routeVideoKey2(state2.transcriptItem?.bvid, state2.transcriptItem?.page || 1) === routeKey ? state2.transcriptItem : null) : state2.transcriptItem || selectedItems()[0] || null;
      const bvid = current?.bvid || String(state2.aiSessionInput?.vars?.bvid || "").match(/BV[\w]+/i)?.[0] || "";
      const page = Math.max(1, Number(current?.page || 1));
      return {
        sourceKey: knowledgeSourceKey(bvid, page),
        bvid,
        page,
        title: current?.title || String(state2.aiSessionInput?.vars?.title || document.title || bvid),
        author: current?.author || String(state2.aiSessionInput?.vars?.author || "")
      };
    }
    function knowledgeNodesForAnchor(anchorId) {
      return SubBatch2.SubBatchMonorepo.ui.knowledgeNavigation.nodesForAnchor(state2.knowledgeNodes || [], anchorId);
    }
    function knowledgeAnchorById(id) {
      return SubBatch2.SubBatchMonorepo.ui.knowledgeNavigation.anchorById(state2.knowledgeAnchors || [], id);
    }
    function knowledgeNodeById(id) {
      return SubBatch2.SubBatchMonorepo.ui.knowledgeNavigation.nodeById(state2.knowledgeNodes || [], id);
    }
    function parseKnowledgeOutput2(raw) {
      const source = String(raw || "");
      const match = source.match(/<suggestions>([\s\S]*?)(?:<\/suggestions>|$)/i);
      const answer = source.replace(/\n?<suggestions>[\s\S]*$/i, "").trim();
      const suggestions = match ? (match[1] || "").split(/\r?\n/).map((x) => x.replace(/^\s*[-*\d.)]+\s*/, "").trim()).filter(Boolean).slice(0, 4) : [];
      return { answer, suggestions };
    }
    function knowledgeVisibleAnswer(raw) {
      return parseKnowledgeOutput2(raw).answer || String(raw || "").replace(/<suggestions>[\s\S]*$/i, "").trim();
    }
    function decorateMarkdownHighlights(html) {
      if (typeof document === "undefined") return String(html || "");
      const tpl = document.createElement("template");
      tpl.innerHTML = String(html || "");
      const walker = document.createTreeWalker(tpl.content, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) {
        if (walker.currentNode instanceof Text) nodes.push(walker.currentNode);
      }
      for (const node of nodes) {
        const parent = node.parentElement;
        if (!parent) continue;
        if (parent.closest(
          "pre, code, kbd, samp, a, .katex, .katex-html, .katex-mathml, .bsb-katex-display, .bsb-katex-inline, .bsb-math-fallback, .mermaid, .bsb-md-highlight, script, style"
        )) {
          continue;
        }
        const text = node.nodeValue || "";
        if (!text.includes("==")) continue;
        const regex = /==([^=\n]{1,120}?)==/g;
        let match;
        let cursor = 0;
        let changed = false;
        const frag = document.createDocumentFragment();
        while (match = regex.exec(text)) {
          changed = true;
          if (match.index > cursor) {
            frag.appendChild(document.createTextNode(text.slice(cursor, match.index)));
          }
          const value = String(match[1] || "").trim();
          if (!value) {
            frag.appendChild(document.createTextNode(match[0]));
            cursor = regex.lastIndex;
            continue;
          }
          let hash = 0;
          for (let i = 0; i < value.length; i += 1) {
            hash = hash * 31 + value.charCodeAt(i) >>> 0;
          }
          const tone = hash % 4;
          const mark = document.createElement("mark");
          mark.className = `bsb-md-highlight bsb-md-highlight-${tone}`;
          mark.textContent = value;
          frag.appendChild(mark);
          cursor = regex.lastIndex;
        }
        if (!changed) continue;
        if (cursor < text.length) {
          frag.appendChild(document.createTextNode(text.slice(cursor)));
        }
        node.replaceWith(frag);
      }
      return tpl.innerHTML;
    }
    function knowledgeAnswerReadingBlocks(text) {
      const codes = [];
      let source = String(text || "").replace(/\r\n?/g, "\n").trim();
      if (!source) return [];
      source = source.replace(/```[\s\S]*?```/g, (m) => {
        const i = codes.length;
        codes.push(m);
        return `@@BSBSPLITCODE${i}@@`;
      });
      const restore2 = (chunk) => String(chunk || "").replace(/@@BSBSPLITCODE(\d+)@@/g, (_, id) => {
        const i = Number(id);
        return codes[i] != null ? codes[i] : "";
      });
      const blocks = [];
      let paragraph = [];
      let topic = "";
      const flush = () => {
        const value = paragraph.join("\n").trim();
        paragraph = [];
        if (!value) return;
        blocks.push({ type: "paragraph", text: restore2(value), topic });
      };
      for (const rawLine of source.split("\n")) {
        const line = rawLine.trimEnd();
        const trimmed = line.trim();
        if (!trimmed) {
          flush();
          continue;
        }
        if (/^@@BSBMATH\d+@@$/.test(trimmed)) {
          flush();
          blocks.push({ type: "paragraph", text: restore2(trimmed), topic });
          continue;
        }
        const heading = trimmed.match(/^#{1,4}\s+(.+)$/);
        if (heading) {
          flush();
          topic = (heading[1] || "").replace(/[*_`]+/g, "").trim();
          blocks.push({ type: "heading", text: topic });
          continue;
        }
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
          flush();
          continue;
        }
        paragraph.push(line);
      }
      flush();
      return blocks;
    }
    async function ensureKnowledgeRenderLibs(text = "") {
      const source = String(text || "");
      await ensureMarkdownCore();
      if (hasMathSyntax(source)) await ensureKatex();
      if (hasCodeSyntax(source)) {
        try {
          await ensureHighlight();
        } catch {
        }
      }
    }
    function knowledgeChunkToHtml(chunk, maths) {
      let html = "";
      try {
        html = typeof marked !== "undefined" && marked?.parse ? marked.parse(String(chunk || "")) : simpleMarkdownFallback(String(chunk || ""));
      } catch {
        html = simpleMarkdownFallback(String(chunk || ""));
      }
      if (maths?.length) html = replaceMathPlaceholders(html, maths, katexToHtml);
      return decorateMarkdownHighlights(sanitizeRenderedHtml(html));
    }
    function renderKnowledgeAnswerCards(text, { streaming = false } = {}) {
      return SubBatch2.SubBatchMonorepo.ui.knowledgeAnswerView.answerCardsHtml(text, {
        streaming,
        prepare: prepareMarkdownMath,
        blocks: knowledgeAnswerReadingBlocks,
        chunkHtml: knowledgeChunkToHtml,
        escapeHtml
      });
    }
    async function hydrateKnowledgeAnswerDom(scope, epoch = state2.renderEpoch) {
      if (!scope) return;
      scope.querySelectorAll("a[href]").forEach((a) => {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      });
      try {
        await enhanceCodeBlocks(scope, epoch);
      } catch {
      }
    }
    function knowledgeGetModelConfig() {
      const profiles = state2.aiProfiles?.length ? state2.aiProfiles : loadAiProfiles();
      const ready = profiles.filter((p) => p.enabled !== false && p.apiKey && p.baseUrl && p.model);
      let model = ready.find((p) => p.id === state2.knowledgeModelId);
      if (!model) model = ready.find((p) => p.enabled) || ready[0] || null;
      if (model && state2.knowledgeModelId !== model.id) {
        state2.knowledgeModelId = model.id;
        storageSet(KNOWLEDGE_MODEL_STORE_KEY, model.id);
      }
      return model;
    }
    function knowledgeModelOptionsHtml() {
      const profiles = state2.aiProfiles?.length ? state2.aiProfiles : loadAiProfiles();
      const ready = profiles.filter((p) => p.enabled !== false && p.apiKey && p.baseUrl && p.model);
      const selected = knowledgeGetModelConfig();
      if (!ready.length) return '<option value="">没有可用 LLM</option>';
      return ready.map((p) => `<option value="${escapeAttr(p.id)}"${selected?.id === p.id ? " selected" : ""}>${escapeHtml(p.name || p.model)}</option>`).join("");
    }
    function knowledgeContextHtml(anchor) {
      return SubBatch2.SubBatchMonorepo.ui.knowledgeAnswerView.evidenceHtml(
        anchor,
        state2.ui?.knowledgeContextOpen === true,
        escapeHtml
      );
    }
    function knowledgeAnswerBodyHtml(activeNode) {
      return SubBatch2.SubBatchMonorepo.ui.knowledgeAnswerView.answerBodyHtml(activeNode, {
        escapeHtml,
        visibleAnswer: knowledgeVisibleAnswer,
        renderCards: renderKnowledgeAnswerCards,
        suggestionsHtml: (node) => SubBatch2.SubBatchMonorepo.ui.knowledgeTreeRenderer.suggestionsHtml(node, escapeAttr, escapeHtml)
      });
    }
    function knowledgeComposerHtml() {
      return SubBatch2.SubBatchMonorepo.ui.knowledgeAnswerView.composerHtml(
        !!state2.knowledgeBusy,
        knowledgeModelOptionsHtml()
      );
    }
    function knowledgeRailBodyHtml(anchor, activeNode, { showTree = state2.knowledgeTreeOpen } = {}) {
      const treeOpen = !!showTree;
      const treePane = treeOpen ? `<aside class="bsb-knowledge-tree-pane" data-role="knowledge-tree-pane"><div class="bsb-knowledge-pane-head"><span class="bsb-knowledge-kicker">追问树</span><button type="button" class="bsb-icon-btn" data-knowledge-tree-toggle title="收起追问树">‹</button></div><div class="bsb-knowledge-tree">${SubBatch2.SubBatchMonorepo.ui.knowledgeTreeRenderer.treeHtml(anchor.id, activeNode?.id || "", state2.knowledgeNodes || [], escapeHtml, escapeAttr)}</div></aside>` : "";
      return `${knowledgeContextHtml(anchor)}
      <div class="bsb-knowledge-crumbs">${SubBatch2.SubBatchMonorepo.ui.knowledgeTreeRenderer.breadcrumbHtml(activeNode, activeNode ? SubBatch2.SubBatchMonorepo.app.knowledge.ancestorNodes(activeNode, state2.knowledgeNodes || []) : [], escapeHtml, escapeAttr)}${!treeOpen ? `<button type="button" class="bsb-mini" data-knowledge-tree-toggle title="展开追问树" style="margin-left:auto">☷ 追问树</button>` : ""}</div>
      <div class="bsb-knowledge-rail-split${treeOpen ? " with-tree" : ""}">${treePane}<div class="bsb-knowledge-split-main"><div class="bsb-knowledge-panel-main">${knowledgeAnswerBodyHtml(activeNode)}</div>${knowledgeComposerHtml()}</div></div>`;
    }
    function knowledgeAnchorListItemHtml(anchor, activeAnchorId = state2.knowledgeActiveAnchorId) {
      const count = knowledgeNodesForAnchor(anchor.id).length;
      const active = anchor.id === activeAnchorId;
      return `<button type="button" class="bsb-knowledge-list-item${active ? " active" : ""}" data-knowledge-anchor-list="${escapeAttr(anchor.id)}">
      <span class="bsb-knowledge-list-dot"></span>
      <span class="bsb-knowledge-list-main"><strong>${escapeHtml(anchor.selectedText)}</strong><small>${count} 个追问${anchor.timeStart != null ? ` · ${coreCall("formatClock", anchor.timeStart)}` : ""}${anchor.starred ? " · ★" : ""}</small></span>
      ${anchor.starred ? '<span class="bsb-knowledge-star">★</span>' : ""}
    </button>`;
    }
    function knowledgeNavigatorHtml(anchors, activeAnchorId, activeNodeId) {
      if (!anchors.length) {
        return '<div class="bsb-knowledge-library-empty">没有匹配的知识锚点。<br>去 AI → 预处理 → AI 处理字幕中选中概念开始。</div>';
      }
      const groups = SubBatch2.SubBatchMonorepo.ui.knowledgeNavigation.groupAnchors(
        anchors,
        (anchor) => knowledgeSourceKey(anchor.bvid, anchor.page || 1)
      );
      return groups.map((group) => {
        const items = group.anchors.map((anchor) => {
          const count = knowledgeNodesForAnchor(anchor.id).length;
          const active = anchor.id === activeAnchorId;
          const threads = active && count ? `<div class="bsb-knowledge-nav-threads">${SubBatch2.SubBatchMonorepo.ui.knowledgeTreeRenderer.treeHtml(anchor.id, activeNodeId || "", state2.knowledgeNodes || [], escapeHtml, escapeAttr)}</div>` : "";
          return `<div class="bsb-knowledge-nav-anchor">${knowledgeAnchorListItemHtml(anchor, activeAnchorId)}${threads}</div>`;
        }).join("");
        return `<section class="bsb-knowledge-source-group"><div class="bsb-knowledge-source-label" title="${escapeAttr(group.label)}">${escapeHtml(group.label)}</div>${items}</section>`;
      }).join("");
    }
    function knowledgeReaderHtml(anchor, activeNode, { isSmall = false } = {}) {
      return SubBatch2.SubBatchMonorepo.ui.knowledgeReader.readerHtml(anchor, {
        isSmall,
        escapeAttr,
        escapeHtml,
        formatClock: (time) => coreCall("formatClock", time),
        contextHtml: knowledgeContextHtml(anchor),
        breadcrumbHtml: SubBatch2.SubBatchMonorepo.ui.knowledgeTreeRenderer.breadcrumbHtml(
          activeNode,
          activeNode ? SubBatch2.SubBatchMonorepo.app.knowledge.ancestorNodes(activeNode, state2.knowledgeNodes || []) : [],
          escapeHtml,
          escapeAttr
        ),
        answerHtml: knowledgeAnswerBodyHtml(activeNode),
        composerHtml: knowledgeComposerHtml()
      });
    }
    function pinKnowledgeScrollTop(top = 0) {
      const root = document.getElementById(PANEL_ID);
      if (!root) return;
      root.querySelectorAll('.bsb-knowledge-panel-main, [data-role="knowledge-reader-scroll"]').forEach((el) => {
        el.scrollTop = top;
      });
    }
    function scheduleKnowledgeRender() {
      if (state2.knowledgePaintRaf) return;
      state2.knowledgePaintRaf = window.setTimeout(() => {
        state2.knowledgePaintRaf = 0;
        if (state2.ui?.view === "knowledge") renderKnowledgeWorkspace().catch(() => {
        });
        else if (state2.knowledgeRailOpen) renderKnowledgeRail().catch(() => {
        });
      }, 72);
    }
    async function renderKnowledgeRail() {
      const root = document.getElementById(PANEL_ID);
      const rail = root?.querySelector('[data-role="knowledge-rail"]');
      const aiView = root?.querySelector('[data-view-panel="ai"]');
      if (!rail || !aiView) return;
      applyKnowledgeLayoutVars(root);
      const oldPanel = rail.querySelector(".bsb-knowledge-panel-main");
      const oldScroll = state2.knowledgeResetScroll ? 0 : oldPanel?.scrollTop || 0;
      aiView.classList.toggle("knowledge-open", !!state2.knowledgeRailOpen);
      rail.classList.toggle("open", !!state2.knowledgeRailOpen);
      rail.setAttribute("aria-hidden", state2.knowledgeRailOpen ? "false" : "true");
      if (!state2.knowledgeRailOpen) return;
      if (!state2.knowledgeAnchors.length) {
        try {
          await knowledgeRefreshCache();
        } catch {
        }
      }
      const anchor = knowledgeAnchorById(state2.knowledgeActiveAnchorId);
      if (!anchor) {
        rail.innerHTML = '<button type="button" class="bsb-knowledge-rail-resize" data-role="knowledge-rail-resize" title="拖拽调整 Knowledge 宽度" aria-label="调整 Knowledge 宽度"></button><div class="bsb-knowledge-rail-empty"><span>✦</span><strong>Knowledge</strong><p>在 AI 处理字幕中选中文字，创建一个局部知识锚点。</p><button type="button" class="bsb-btn ghost" data-knowledge-close>关闭</button></div>';
        return;
      }
      const nodes = knowledgeNodesForAnchor(anchor.id);
      if (!nodes.some((n) => n.id === state2.knowledgeActiveNodeId)) {
        const latest = [...nodes].sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0];
        state2.knowledgeActiveNodeId = latest?.id || "";
      }
      const activeNode = knowledgeNodeById(state2.knowledgeActiveNodeId);
      const answerText = knowledgeVisibleAnswer(activeNode?.answer || activeNode?.preview || "");
      try {
        await ensureKnowledgeRenderLibs(answerText);
      } catch {
      }
      rail.innerHTML = `<button type="button" class="bsb-knowledge-rail-resize" data-role="knowledge-rail-resize" title="拖拽调整 Knowledge 宽度" aria-label="调整 Knowledge 宽度"></button>
      <div class="bsb-knowledge-rail-head">
        <div class="bsb-knowledge-anchor-title"><span class="bsb-knowledge-kicker">KNOWLEDGE ANCHOR</span><strong>${escapeHtml(anchor.selectedText)}</strong><small>${escapeHtml(anchor.title || anchor.bvid)} · ${anchor.timeStart != null ? coreCall("formatClock", anchor.timeStart) : "局部字幕"}${Number(anchor.timeEnd) > Number(anchor.timeStart) ? `–${coreCall("formatClock", anchor.timeEnd || 0)}` : ""}</small></div>
        <div class="bsb-knowledge-rail-actions">${state2.knowledgeBusy ? '<button type="button" class="bsb-icon-btn" data-knowledge-stop title="停止回答">■</button>' : ""}<button type="button" class="bsb-icon-btn${anchor.starred ? " active" : ""}" data-knowledge-star-anchor title="${anchor.starred ? "取消收藏锚点" : "收藏锚点"}">${anchor.starred ? "★" : "☆"}</button><button type="button" class="bsb-icon-btn" data-knowledge-new-root title="新建独立根问题">＋</button><button type="button" class="bsb-icon-btn${state2.knowledgeTreeOpen ? " active" : ""}" data-knowledge-tree-toggle title="${state2.knowledgeTreeOpen ? "收起追问树" : "展开追问树（并排）"}">☷</button><button type="button" class="bsb-icon-btn" data-knowledge-open-workspace title="在 Knowledge 工作区打开">↗</button><button type="button" class="bsb-icon-btn" data-knowledge-close title="关闭">×</button></div>
      </div>
      <div class="bsb-knowledge-rail-body">${knowledgeRailBodyHtml(anchor, activeNode)}</div>`;
      const nextPanel = rail.querySelector(".bsb-knowledge-panel-main");
      if (nextPanel) nextPanel.scrollTop = oldScroll;
      await hydrateKnowledgeAnswerDom(rail.querySelector(".bsb-knowledge-rail-body") || rail, state2.renderEpoch);
    }
    async function openKnowledgeAnchor(anchorId, { workspace = false } = {}) {
      try {
        await knowledgeRefreshCache();
      } catch (error) {
        setStatus(`知识库读取失败：${errorMessage(error)}`, "err");
      }
      const anchor = knowledgeAnchorById(anchorId);
      if (!anchor) return;
      const selection = appCall("knowledge.selectAnchor", anchor.id, state2.knowledgeNodes);
      state2.knowledgeActiveAnchorId = selection.anchorId;
      state2.knowledgeActiveNodeId = selection.nodeId;
      if (workspace) {
        setWorkspace("knowledge");
        await renderKnowledgeWorkspace();
      } else {
        state2.knowledgeRailOpen = true;
        await renderKnowledgeRail();
      }
    }
    function closeKnowledgeRail() {
      state2.knowledgeRailOpen = false;
      renderKnowledgeRail().catch(() => {
      });
    }
    function bindKnowledgeLayoutInteractions(root) {
      if (!root || root._bsbKnowledgeLayoutBound) return;
      root._bsbKnowledgeLayoutBound = true;
      const startResize = (kind, event) => {
        if (!state2.ui || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const startX = event.clientX;
        const startRail = clampKnowledgeRailW(state2.ui.knowledgeRailW, state2.ui.w);
        const startNav = clampKnowledgeNavW(state2.ui.knowledgeNavW, state2.ui.w);
        const rail = root.querySelector('[data-role="knowledge-rail"]');
        root.classList.add("knowledge-resizing");
        rail?.classList.add("resizing");
        const onMove = (ev) => {
          if (!state2.ui) return;
          if (kind === "rail") {
            state2.ui.knowledgeRailW = clampKnowledgeRailW(startRail + (startX - ev.clientX), state2.ui.w);
          } else if (kind === "nav") {
            state2.ui.knowledgeNavW = clampKnowledgeNavW(startNav + (ev.clientX - startX), state2.ui.w);
          }
          applyKnowledgeLayoutVars(root);
        };
        const onUp = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          root.classList.remove("knowledge-resizing");
          rail?.classList.remove("resizing");
          saveUiGeom();
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
      };
      root.addEventListener("pointerdown", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest('[data-role="knowledge-rail-resize"]')) return startResize("rail", event);
        if (target.closest('[data-role="knowledge-nav-split"]')) return startResize("nav", event);
      });
      root.addEventListener("keydown", (event) => {
        const area = event.target;
        if (!(area instanceof HTMLTextAreaElement)) return;
        if (area.getAttribute("data-role") !== "knowledge-question") return;
        if (event.key !== "Enter" || event.shiftKey) return;
        event.preventDefault();
        if (state2.knowledgeBusy) return;
        const q = String(area.value || "").trim();
        if (!q) return;
        knowledgeAsk(state2.knowledgeActiveAnchorId, state2.knowledgeActiveNodeId || null, q).then(() => {
          area.value = "";
        }).catch((error) => setStatus(`Knowledge 追问失败：${errorMessage(error)}`, "err"));
      });
    }
    function hideKnowledgeSelectionToolbar() {
      const root = document.getElementById(PANEL_ID);
      const toolbar = root?.querySelector('[data-role="knowledge-selection-toolbar"]');
      if (toolbar) toolbar.hidden = true;
    }
    function captureKnowledgeSelection() {
      const root = document.getElementById(PANEL_ID);
      const toolbar = root?.querySelector('[data-role="knowledge-selection-toolbar"]');
      if (!root || !toolbar || currentAiWorkbenchStage() !== "preprocess" || state2.aiInputView !== "processed") return hideKnowledgeSelectionToolbar();
      const sel = window.getSelection?.();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return hideKnowledgeSelectionToolbar();
      const text = sel.toString().trim();
      if (text.length < KNOWLEDGE_SELECTION_MIN || text.length > KNOWLEDGE_SELECTION_MAX) return hideKnowledgeSelectionToolbar();
      const range = sel.getRangeAt(0);
      const node = range.commonAncestorContainer instanceof Element ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
      const body = node?.closest?.(".bsb-preprocess-block-body");
      const article = body?.closest(".bsb-preprocess-block");
      if (!body || !article || !root.contains(body)) return hideKnowledgeSelectionToolbar();
      const source = currentKnowledgeSource();
      const articleSourceKey = article.dataset.knowledgeSourceKey || source.sourceKey;
      const cards = Array.from(article.parentElement?.querySelectorAll(".bsb-preprocess-block") || []).filter((card) => (card.dataset.knowledgeSourceKey || articleSourceKey) === articleSourceKey);
      const idx = cards.indexOf(article);
      const contextCards = cards.slice(Math.max(0, idx - 1), Math.min(cards.length, idx + 2));
      const contextText = contextCards.map((card) => {
        const topic = card.dataset.knowledgeTopic || "";
        const clock = card.dataset.knowledgeClock || "";
        const value = card.querySelector(".bsb-preprocess-block-body")?.textContent?.trim() || "";
        return `${clock ? `[${clock}] ` : ""}${topic ? `${topic}：` : ""}${value}`;
      }).join("\n\n");
      const rect = range.getBoundingClientRect();
      state2.knowledgeSelection = {
        selectedText: text,
        sourceKey: articleSourceKey,
        bvid: article.dataset.knowledgeBvid || source.bvid,
        page: Number(article.dataset.knowledgePage || source.page || 1),
        title: article.dataset.knowledgeTitle || source.title,
        author: article.dataset.knowledgeAuthor || source.author,
        segmentId: article.dataset.knowledgeSegment || "",
        timeStart: Number(article.dataset.knowledgeStart || 0),
        timeEnd: Number(article.dataset.knowledgeEnd || article.dataset.knowledgeStart || 0),
        contextText,
        sourceHash: coreCall("md5", currentInputPreviewText("processed") || "")
      };
      const compactSelection = text.replace(/\s+/g, " ");
      const selectionLabel = toolbar.querySelector('[data-role="knowledge-selection-text"]');
      if (selectionLabel) selectionLabel.textContent = compactSelection.length > 42 ? `${compactSelection.slice(0, 42)}…` : compactSelection;
      const width = 300;
      const left = Math.min(window.innerWidth - width - 10, Math.max(10, rect.left + rect.width / 2 - width / 2));
      const top = Math.max(10, rect.top - 48);
      toolbar.style.left = `${left}px`;
      toolbar.style.top = `${top}px`;
      toolbar.hidden = false;
    }
    async function ensureKnowledgeAnchorFromSelection({ starred = false } = {}) {
      const sel = state2.knowledgeSelection;
      if (!sel?.selectedText) throw new Error("当前没有有效字幕选区");
      if (!state2.knowledgeAnchors.length) await knowledgeRefreshCache();
      let anchor = state2.knowledgeAnchors.find((a) => a.sourceKey === sel.sourceKey && a.selectedText === sel.selectedText && Math.abs(Number(a.timeStart || 0) - Number(sel.timeStart || 0)) <= 5);
      const now = Date.now();
      if (!anchor) {
        anchor = {
          id: makeKnowledgeId("anchor"),
          sourceKey: sel.sourceKey || "",
          bvid: sel.bvid || "",
          page: sel.page || 1,
          title: sel.title || "",
          author: sel.author || "",
          segmentId: sel.segmentId || "",
          selectedText: sel.selectedText,
          timeStart: sel.timeStart || 0,
          timeEnd: sel.timeEnd || 0,
          contextText: sel.contextText || "",
          sourceHash: sel.sourceHash || "",
          starred: !!starred,
          createdAt: now,
          updatedAt: now
        };
      } else {
        anchor = { ...anchor, contextText: sel.contextText || anchor.contextText || "", sourceHash: sel.sourceHash || anchor.sourceHash || "", starred: anchor.starred || !!starred, updatedAt: now };
      }
      await knowledgePutAnchor(anchor);
      state2.knowledgeActiveAnchorId = anchor.id;
      state2.knowledgeActiveNodeId = "";
      state2.knowledgeRailOpen = true;
      hideKnowledgeSelectionToolbar();
      await decorateKnowledgeAnchors();
      await renderKnowledgeRail();
      renderKnowledgeWorkspace().catch(() => {
      });
      return anchor;
    }
    let knowledgeController = null;
    async function knowledgeAsk(anchorId, parentId, question) {
      const q = String(question || "").trim();
      if (!q || state2.knowledgeBusy) return;
      if (!state2.knowledgeAnchors.length) await knowledgeRefreshCache();
      const anchor = knowledgeAnchorById(anchorId);
      if (!anchor) throw new Error("知识锚点不存在");
      const model = knowledgeGetModelConfig();
      if (!model) throw new Error("没有可用的 LLM。请先在设置 → LLM 配置 Base URL / API Key / Model");
      const prompt2 = getActiveKnowledgePromptProfile();
      if (!prompt2 || !prompt2.systemPrompt.trim() && !prompt2.userPromptTemplate.trim()) throw new Error("没有可用的 Knowledge Prompt");
      const parent = parentId ? knowledgeNodeById(parentId) : null;
      const now = Date.now();
      const node = {
        id: makeKnowledgeId("node"),
        anchorId: anchor.id,
        parentId: parent?.id || null,
        question: q,
        answer: "",
        preview: "",
        suggestions: [],
        modelId: model.id,
        starred: false,
        status: "running",
        createdAt: now,
        updatedAt: now
      };
      state2.knowledgeNodes.push(node);
      state2.knowledgeActiveNodeId = node.id;
      state2.knowledgeBusy = true;
      await knowledgePutNode(node);
      state2.knowledgeResetScroll = true;
      await Promise.all([
        renderKnowledgeRail(),
        renderKnowledgeWorkspace().catch(() => {
        })
      ]);
      pinKnowledgeScrollTop(0);
      state2.knowledgeResetScroll = false;
      const vars = {
        title: anchor.title || "",
        bvid: `${anchor.bvid || ""}${(anchor.page || 1) > 1 ? ` P${anchor.page}` : ""}`,
        author: anchor.author || "",
        anchorText: anchor.selectedText || "",
        sourceContext: anchor.contextText || anchor.selectedText || "",
        ancestorPath: appCall("knowledge.branchContext", parent, state2.knowledgeNodes || []),
        question: q
      };
      const messages = [];
      const systemPrompt = renderPromptTemplate2(prompt2.systemPrompt, vars).trim();
      const userPrompt = renderPromptTemplate2(prompt2.userPromptTemplate, vars).trim();
      if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
      if (userPrompt) messages.push({ role: "user", content: userPrompt });
      if (!messages.length) {
        state2.knowledgeBusy = false;
        node.status = "error";
        await knowledgePutNode(node).catch(() => {
        });
        throw new Error("Knowledge Prompt 为空");
      }
      const runtime2 = createAiRuntime(`Knowledge · ${model.name || model.model}`);
      state2.knowledgeRuntime = runtime2;
      knowledgeController ||= appCall("knowledge.createController");
      const request2 = knowledgeController.begin(node.id);
      let latest = "";
      let lastPreviewPersistAt = 0;
      await SubBatch2.SubBatchMonorepo.app.knowledge.runAnswer({
        node,
        generate: () => request2.stage(() => new Promise((resolve2, reject) => {
          requestChatCompletion({
            runtime: runtime2,
            baseUrl: model.baseUrl,
            apiKey: model.apiKey,
            model: model.model,
            temperature: model.temperature,
            maxTokens: model.maxTokens,
            messages,
            stream: model.stream !== false,
            onStatus() {
            },
            onDelta(_delta, full) {
              if (!knowledgeAnchorById(anchor.id)) return;
              const preview = appCall("knowledge.updateStreamPreview", node, full, lastPreviewPersistAt, Date.now());
              latest = preview.latest;
              if (preview.shouldPersist) {
                lastPreviewPersistAt = preview.persistAt;
                knowledgeStoreRequest(KNOWLEDGE_NODE_STORE, "readwrite", (s) => s.put(node)).catch(() => {
                });
              }
              scheduleKnowledgeRender();
            },
            onDone(full) {
              latest = String(full || latest || "");
              resolve2();
            },
            onError(error) {
              reject(error instanceof Error ? error : new Error(String(error || "Knowledge 请求失败")));
            }
          });
        })).then(() => latest),
        parse: parseKnowledgeOutput2,
        visible: knowledgeVisibleAnswer,
        partial: () => latest,
        stopped: () => runtime2.abort || !request2.current(),
        exists: () => !!knowledgeAnchorById(anchor.id),
        persist: (answer) => knowledgePutNode(answer),
        onSuccess: async () => {
          request2.finish(node.status === "stopped" ? "stopped" : node.status === "error" ? "error" : "done");
          anchor.updatedAt = node.updatedAt;
          await knowledgePutAnchor(anchor);
          await ensureKnowledgeRenderLibs(node.answer).catch(() => {
          });
          setStatus(node.status === "stopped" ? "Knowledge 已停止" : `Knowledge · 已回答：${q.slice(0, 28)}${q.length > 28 ? "…" : ""}`, node.status === "stopped" ? "" : "ok");
        },
        onFailure: () => {
          request2.finish(node.status === "stopped" ? "stopped" : node.status === "error" ? "error" : "done");
          setStatus(node.status === "stopped" ? "Knowledge 已停止" : `Knowledge 失败：${node.error}`, node.status === "stopped" ? "" : "err");
        },
        cleanup: async () => {
          if (state2.knowledgeRuntime !== runtime2) return;
          state2.knowledgeBusy = false;
          state2.knowledgeRuntime = null;
          await renderKnowledgeRail();
          await renderKnowledgeWorkspace().catch(() => {
          });
        }
      });
    }
    function abortKnowledgeRequest() {
      knowledgeController?.stop();
      const runtime2 = state2.knowledgeRuntime;
      if (!runtime2) return;
      runtime2.abort = true;
      try {
        runtime2.abortController?.abort();
      } catch {
      }
      try {
        runtime2.xhr?.abort?.();
      } catch {
      }
      setStatus("正在停止 Knowledge 回答…");
    }
    function unwrapKnowledgeAnchorMarks(root) {
      if (!root) return;
      root.querySelectorAll("mark.bsb-knowledge-anchor-mark").forEach((mark) => {
        const parent = mark.parentNode;
        if (!parent) return;
        while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
        parent.removeChild(mark);
      });
    }
    function wrapFirstTextOccurrence(root, needle, createMark) {
      const value = String(needle || "");
      if (!root || !value) return false;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) {
        if (walker.currentNode instanceof Text) nodes.push(walker.currentNode);
      }
      for (const node of nodes) {
        const parent = node.parentElement;
        if (!parent) continue;
        if (parent.closest("pre, code, kbd, samp, a, button, .katex, .bsb-katex-display, .bsb-katex-inline, .bsb-math-fallback, mark.bsb-knowledge-anchor-mark")) {
          continue;
        }
        const text = node.nodeValue || "";
        const idx = text.indexOf(value);
        if (idx < 0) continue;
        const before = text.slice(0, idx);
        const mid = text.slice(idx, idx + value.length);
        const after = text.slice(idx + value.length);
        const frag = document.createDocumentFragment();
        if (before) frag.appendChild(document.createTextNode(before));
        const mark = createMark(mid);
        if (mark) frag.appendChild(mark);
        else frag.appendChild(document.createTextNode(mid));
        if (after) frag.appendChild(document.createTextNode(after));
        node.replaceWith(frag);
        return true;
      }
      return false;
    }
    async function decorateKnowledgeAnchors(host2 = null) {
      const root = document.getElementById(PANEL_ID);
      const scope = host2 || root?.querySelector('[data-role="ai-content"]');
      if (!scope || !scope.querySelector(".bsb-preprocess-reading")) return;
      try {
        await knowledgeRefreshCache();
      } catch {
        return;
      }
      const anchors = state2.knowledgeAnchors;
      const bodies = Array.from(scope.querySelectorAll(".bsb-preprocess-block-body"));
      for (const body of bodies) {
        const article = body.closest(".bsb-preprocess-block");
        const rich = body.classList.contains("bsb-md-rich");
        const original = body.getAttribute("data-knowledge-plain") || body.textContent || "";
        const articleSourceKey = article?.dataset.knowledgeSourceKey || currentKnowledgeSource().sourceKey;
        const relevant = anchors.filter((a) => a.sourceKey === articleSourceKey && !!a.selectedText && original.includes(a.selectedText));
        if (!relevant.length) {
          if (article) article.classList.remove("has-knowledge");
          continue;
        }
        const ranges = relevant.map((a) => ({
          a,
          start: original.indexOf(a.selectedText || ""),
          end: original.indexOf(a.selectedText || "") + (a.selectedText || "").length
        })).filter((x) => x.start >= 0).sort((x, y) => x.start - y.start || y.end - x.end);
        const accepted = [];
        let cursor = -1;
        for (const r of ranges) {
          if (r.start < cursor) continue;
          accepted.push(r);
          cursor = r.end;
        }
        if (rich) {
          unwrapKnowledgeAnchorMarks(body);
          for (const r of accepted) {
            wrapFirstTextOccurrence(body, r.a.selectedText || "", (mid) => {
              const mark = document.createElement("mark");
              mark.className = "bsb-knowledge-anchor-mark";
              mark.dataset.knowledgeAnchorId = r.a.id;
              mark.title = `${knowledgeNodesForAnchor(r.a.id).length} 个追问 · 点击继续`;
              mark.textContent = mid;
              return mark;
            });
          }
        } else {
          let html = "";
          cursor = 0;
          for (const r of accepted) {
            html += escapeHtml(original.slice(cursor, r.start));
            html += `<mark class="bsb-knowledge-anchor-mark" data-knowledge-anchor-id="${escapeAttr(r.a.id)}" title="${knowledgeNodesForAnchor(r.a.id).length} 个追问 · 点击继续">${escapeHtml(original.slice(r.start, r.end))}</mark>`;
            cursor = r.end;
          }
          html += escapeHtml(original.slice(cursor));
          body.innerHTML = html;
        }
        if (article) article.classList.add("has-knowledge");
      }
    }
    async function renderKnowledgeWorkspace() {
      const root = document.getElementById(PANEL_ID);
      const workspace = root?.querySelector('[data-role="knowledge-workspace"]') || root?.querySelector(".bsb-knowledge-workspace");
      const list = root?.querySelector('[data-role="knowledge-list"]');
      const detail = root?.querySelector('[data-role="knowledge-detail"]');
      const count = root?.querySelector('[data-role="knowledge-count"]');
      if (!list || !detail) return;
      applyKnowledgeLayoutVars(root);
      const isSmall = root?.getAttribute("data-panel-size") === "small";
      const oldScrollEl = detail.querySelector('[data-role="knowledge-reader-scroll"]');
      const oldScroll = state2.knowledgeResetScroll ? 0 : oldScrollEl?.scrollTop || 0;
      try {
        if (!state2.knowledgeBusy) await knowledgeRefreshCache();
      } catch (error) {
        detail.innerHTML = `<div class="bsb-empty"><strong>知识库不可用</strong><span>${escapeHtml(errorMessage(error))}</span></div>`;
        return;
      }
      const anchors = SubBatch2.SubBatchMonorepo.ui.knowledgeNavigation.filterAnchors(
        state2.knowledgeAnchors,
        state2.knowledgeNodes,
        state2.knowledgeSearch
      );
      if (count) count.textContent = String(anchors.length);
      const selection = SubBatch2.SubBatchMonorepo.ui.knowledgeNavigation.resolveSelection(
        anchors,
        state2.knowledgeNodes,
        state2.knowledgeActiveAnchorId,
        state2.knowledgeActiveNodeId,
        isSmall
      );
      state2.knowledgeActiveAnchorId = selection.anchorId;
      state2.knowledgeActiveNodeId = selection.nodeId;
      const anchor = knowledgeAnchorById(state2.knowledgeActiveAnchorId);
      const activeNode = knowledgeNodeById(state2.knowledgeActiveNodeId);
      const answerText = knowledgeVisibleAnswer(activeNode?.answer || activeNode?.preview || "");
      try {
        await ensureKnowledgeRenderLibs(answerText);
      } catch {
      }
      list.innerHTML = knowledgeNavigatorHtml(anchors, state2.knowledgeActiveAnchorId, state2.knowledgeActiveNodeId);
      workspace?.classList.toggle("detail-open", !!anchor);
      if (!anchor) {
        detail.innerHTML = '<div class="bsb-empty"><div class="bsb-empty-ico">◇</div><strong>选择一个知识锚点</strong><span>左侧按视频组织锚点；当前锚点的追问树会直接展开在其下方。</span></div>';
        return;
      }
      detail.innerHTML = knowledgeReaderHtml(anchor, activeNode, { isSmall });
      const nextScroll = detail.querySelector('[data-role="knowledge-reader-scroll"]');
      if (nextScroll) nextScroll.scrollTop = oldScroll;
      await hydrateKnowledgeAnswerDom(detail, state2.renderEpoch);
    }
    function makePostTaskId() {
      return `output-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }
    function normalizePostTask(seed, index = 0) {
      const o = seed && typeof seed === "object" && !Array.isArray(seed) ? seed : {};
      return {
        id: String(o.id || makePostTaskId()),
        promptId: String(o.promptId || ""),
        modelIds: Array.from(new Set((Array.isArray(o.modelIds) ? o.modelIds : []).map(String).filter(Boolean))),
        enabled: !(o.enabled === false || o.enabled === "false" || o.enabled === 0),
        order: Number.isFinite(Number(o.order)) ? Number(o.order) : index
      };
    }
    function sanitizePostTasks(tasks, prompts, profiles, { createDefault = true } = {}) {
      const posts = (prompts || []).filter((p) => p.stage === "postprocess");
      const postIds = new Set(posts.map((p) => p.id));
      const profileIds = new Set((profiles || []).map((p) => p.id));
      let out = (Array.isArray(tasks) ? tasks : []).map(normalizePostTask).filter((t) => postIds.has(t.promptId)).map((t, i) => ({ ...t, modelIds: t.modelIds.filter((id) => profileIds.has(id)), order: i }));
      if (!out.length && createDefault && posts.length) {
        const preferred = posts.find((p) => p.id === state2.activePromptId) || posts[0];
        const enabledModels = (profiles || []).filter((p) => p.enabled).map((p) => p.id);
        if (!preferred) return out;
        out = [normalizePostTask({ promptId: preferred.id, modelIds: enabledModels, enabled: true, order: 0 }, 0)];
      }
      return out;
    }
    function loadPostTasks() {
      const prompts = state2.promptProfiles?.length ? state2.promptProfiles : loadPromptProfiles().prompts;
      const profiles = state2.aiProfiles?.length ? state2.aiProfiles : loadAiProfiles();
      let tasks = [];
      let storedTaskVersion = 0;
      try {
        const raw = storageGet(POST_TASKS_STORE_KEY, null);
        if (raw) {
          const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
          tasks = Array.isArray(parsed) ? parsed : parsed?.tasks;
          storedTaskVersion = Array.isArray(parsed) ? 1 : Number(parsed?.version || 1);
        }
      } catch {
      }
      tasks = sanitizePostTasks(tasks, prompts, profiles, { createDefault: true });
      const htmlPrompt = prompts.find((p) => p.id === DEFAULT_HTML_FOLIO_PROMPT_ID && p.stage === "postprocess");
      if (htmlPrompt && storedTaskVersion < 2 && !tasks.some((t) => t.promptId === htmlPrompt.id)) {
        const modelIds = tasks[0]?.modelIds?.length ? [...tasks[0].modelIds] : profiles.filter((p) => p.enabled).map((p) => p.id);
        tasks.push(normalizePostTask({
          promptId: htmlPrompt.id,
          modelIds,
          enabled: true,
          order: tasks.length
        }, tasks.length));
      }
      if (storedTaskVersion < POST_TASKS_SCHEMA_VERSION) {
        try {
          storageSet(POST_TASKS_STORE_KEY, JSON.stringify({ version: POST_TASKS_SCHEMA_VERSION, tasks }));
        } catch {
        }
      }
      state2.postTasks = tasks;
      if (!tasks.some((t) => t.id === state2.aiActiveTaskId)) state2.aiActiveTaskId = tasks[0]?.id || "";
      return tasks;
    }
    function savePostTasks(tasks) {
      const prompts = state2.promptProfiles?.length ? state2.promptProfiles : loadPromptProfiles().prompts;
      const profiles = state2.aiProfiles?.length ? state2.aiProfiles : loadAiProfiles();
      const normalized = sanitizePostTasks(tasks, prompts, profiles, { createDefault: true });
      try {
        storageSet(POST_TASKS_STORE_KEY, JSON.stringify({ version: POST_TASKS_SCHEMA_VERSION, tasks: normalized }));
      } catch {
      }
      state2.postTasks = normalized;
      if (!normalized.some((t) => t.id === state2.aiActiveTaskId)) state2.aiActiveTaskId = normalized[0]?.id || "";
      renderAiFlowDrawer();
      renderAiResultTabs();
      refreshAiChips();
      return normalized;
    }
    function currentPostTasks() {
      return state2.postTasks?.length ? state2.postTasks : loadPostTasks();
    }
    function promptForTask(task) {
      return (state2.promptProfiles || []).find((p) => p.id === task?.promptId && p.stage === "postprocess") || null;
    }
    function promptListItemHtml(prompt2, { draggable = true } = {}) {
      const selected = prompt2.id === state2.promptEditorId;
      const active = prompt2.stage === "preprocess" ? prompt2.id === state2.activePrePromptId : prompt2.stage === "knowledge" ? prompt2.id === state2.activeKnowledgePromptId : prompt2.id === state2.activePromptId;
      const dragAttr = draggable ? 'draggable="true"' : 'draggable="false"';
      const title = draggable ? `${prompt2.name} · 拖拽左侧 ⠿ 调整顺序` : `${prompt2.name} · 清空搜索后可拖拽排序`;
      return `<div class="bsb-config-list-item${selected ? " selected" : ""}" role="button" tabindex="0" ${dragAttr} data-prompt-list-id="${escapeAttr(prompt2.id)}" title="${escapeAttr(title)}">
      <span class="bsb-config-drag" aria-hidden="true" title="拖拽排序">⠿</span>
      <span class="bsb-config-dot${active ? " current" : ""}"></span>
      <span class="bsb-config-item-main">
        <span class="bsb-config-item-name">${escapeHtml(prompt2.name)}</span>
        <span class="bsb-config-item-sub">${escapeHtml(prompt2.hint || "自定义提示词")}</span>
      </span>
      ${active ? `<span class="bsb-config-badge">${prompt2.stage === "preprocess" ? "当前" : prompt2.stage === "knowledge" ? "Knowledge" : "默认"}</span>` : ""}
    </div>`;
    }
    function promptEditorHtml(prompt2, index) {
      if (!prompt2) {
        return '<div class="bsb-config-editor-empty">没有可编辑的 Prompt。<br>请从左侧新建，或恢复内置 Prompt。</div>';
      }
      const active = prompt2.stage === "preprocess" ? prompt2.id === state2.activePrePromptId : prompt2.stage === "knowledge" ? prompt2.id === state2.activeKnowledgePromptId : prompt2.id === state2.activePromptId;
      const stageName = prompt2.stage === "preprocess" ? "预处理" : prompt2.stage === "knowledge" ? "Knowledge" : "后处理";
      const activeMeaning = prompt2.stage === "preprocess" ? "当前输入整理默认" : prompt2.stage === "knowledge" ? "局部追问默认 Prompt" : "新建产物默认 Prompt";
      return `<section data-prompt-id="${escapeAttr(prompt2.id)}" data-prompt-stage="${escapeAttr(prompt2.stage)}">
      <div class="bsb-config-editor-head">
        <div class="bsb-config-editor-title">
          <strong>${escapeHtml(prompt2.name || `提示词 ${index + 1}`)}</strong>
          <span>${stageName} Prompt · ${active ? activeMeaning : "可在处理方案中自由组合"}</span>
        </div>
        <div class="bsb-config-editor-actions">
          <button type="button" class="bsb-btn ${active ? "ghost" : "primary"}" data-prompt-act="use">${active ? "默认" : "设为默认"}</button>
          <button type="button" class="bsb-btn ghost" data-prompt-act="duplicate">复制</button>
          <button type="button" class="bsb-btn danger" data-prompt-act="delete">删除</button>
        </div>
      </div>
      <label>名称
        <input type="text" data-prompt-field="name" value="${escapeAttr(prompt2.name)}" placeholder="提示词名称" autocomplete="off">
      </label>
      <label>简短说明
        <input type="text" data-prompt-field="hint" value="${escapeAttr(prompt2.hint)}" placeholder="说明它在管线中的用途" autocomplete="off">
      </label>
      <label>System Prompt
        <textarea data-prompt-field="systemPrompt" spellcheck="false">${escapeHtml(prompt2.systemPrompt)}</textarea>
      </label>
      <label>User Prompt Template
        <textarea data-prompt-field="userPromptTemplate" spellcheck="false">${escapeHtml(prompt2.userPromptTemplate)}</textarea>
      </label>
      <div class="bsb-prompt-vars">${prompt2.stage === "preprocess" ? "可用变量：<code>{{title}}</code> <code>{{bvid}}</code> <code>{{author}}</code> <code>{{subtitle}}</code> <code>{{chunkIndex}}</code> <code>{{chunkCount}}</code>。" : prompt2.stage === "knowledge" ? "可用变量：<code>{{title}}</code> <code>{{bvid}}</code> <code>{{author}}</code> <code>{{anchorText}}</code> <code>{{sourceContext}}</code> <code>{{ancestorPath}}</code> <code>{{question}}</code>。" : "可用变量：<code>{{title}}</code> <code>{{bvid}}</code> <code>{{author}}</code> <code>{{subtitle}}</code> <code>{{rawSubtitle}}</code> <code>{{processedSubtitle}}</code>。"}脚本只替换变量，不追加隐藏任务指令。</div>
      <div class="bsb-preprocess-note">${prompt2.stage === "preprocess" ? "这是预处理 Prompt：只负责原始字幕的清洗、翻译与规范化，不做摘要、制图或知识重构。输出会成为后处理的输入。" : prompt2.stage === "knowledge" ? "这是 Knowledge Prompt：只处理当前字幕锚点与当前追问分支。字幕局部上下文、祖先路径和当前问题会明确传入，不会隐藏整段视频上下文。" : "这是后处理 Prompt：负责把规范化字幕转换成 Mermaid、笔记、自测等最终产物。<code>{{subtitle}}</code> 在预处理开启时就是规范化稿，关闭时自动退回原始字幕。"}</div>
      <div class="bsb-ai-cfg-actions" style="margin-top:12px">
        <button type="button" class="bsb-btn primary" data-act="prompt-save">保存当前 Prompt</button>
      </div>
    </section>`;
    }
    function readPromptEditor(editor, index) {
      const get = (key) => editor.querySelector(`[data-prompt-field="${key}"]`);
      return coreCall("createPromptProfile", {
        id: editor.dataset.promptId || coreCall("makePromptProfileId"),
        stage: editor.dataset.promptStage === "preprocess" ? "preprocess" : editor.dataset.promptStage === "knowledge" ? "knowledge" : "postprocess",
        name: String(get("name")?.value || `提示词 ${index + 1}`),
        hint: String(get("hint")?.value || "自定义提示词"),
        systemPrompt: String(get("systemPrompt")?.value || ""),
        userPromptTemplate: String(get("userPromptTemplate")?.value || "")
      }, index);
    }
    function savePromptProfilesFromForm({ activeId } = {}) {
      const root = ensurePanel();
      const current = state2.promptProfiles?.length || state2.activePromptId ? [...state2.promptProfiles] : [...loadPromptProfiles().prompts];
      const editor = root.querySelector('[data-role="prompt-editor"] [data-prompt-id]');
      if (editor) {
        const index = current.findIndex((p) => p.id === editor.dataset.promptId);
        if (index >= 0) current[index] = readPromptEditor(editor, index);
      }
      const selected = activeId != null ? String(activeId) : String(root.querySelector('[data-role="prompt-select"]')?.value || state2.activePromptId || "");
      return savePromptProfiles(current, selected, state2.activePrePromptId, state2.activeKnowledgePromptId);
    }
    function refreshPromptSelector(root) {
      if (!root) return;
      const postSelect = root.querySelector('[data-role="prompt-select"]');
      const preSelect = root.querySelector('[data-role="preprocess-prompt-select"]');
      const prompts = state2.promptProfiles || [];
      const posts = prompts.filter((p) => p.stage === "postprocess");
      const pres = prompts.filter((p) => p.stage === "preprocess");
      if (postSelect) {
        postSelect.disabled = !posts.length;
        postSelect.innerHTML = posts.length ? posts.map((p) => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.name)}</option>`).join("") : '<option value="">没有后处理 Prompt</option>';
        const active = posts.some((p) => p.id === state2.activePromptId) ? state2.activePromptId : posts[0]?.id || "";
        state2.activePromptId = active;
        postSelect.value = active;
      }
      if (preSelect) {
        preSelect.disabled = !pres.length || !state2.preprocessEnabled;
        preSelect.innerHTML = pres.length ? pres.map((p) => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.name)}</option>`).join("") : '<option value="">没有预处理 Prompt</option>';
        const active = pres.some((p) => p.id === state2.activePrePromptId) ? state2.activePrePromptId : pres[0]?.id || "";
        state2.activePrePromptId = active;
        preSelect.value = active;
      }
      const toggle = root.querySelector('[data-role="preprocess-enabled"]');
      if (toggle) toggle.checked = !!state2.preprocessEnabled;
      updatePromptUi(root, getActivePromptProfile());
    }
    function commitConfigListReorder(kind, fromId, toId) {
      if (!fromId || !toId || fromId === toId) return false;
      const root = ensurePanel();
      if (kind === "llm") {
        try {
          saveAiProfilesFromForm();
        } catch {
        }
        const profiles = state2.aiProfiles?.length ? state2.aiProfiles.slice() : loadAiProfiles();
        const ids = profiles.map((p) => p.id);
        const nextIds = appCall("ordering.reorderIds", ids, fromId, toId);
        if (nextIds.join("\0") === ids.join("\0")) return false;
        const next = SubBatch2.SubBatchMonorepo.app.ordering.applyConfigIdOrder(profiles, nextIds);
        saveAiProfiles(next);
        state2.aiEditorId = fromId;
        fillAiConfigForm(root);
        const name = next.find((p) => p.id === fromId)?.name || "LLM";
        setStatus(`已调整 LLM 顺序：${name}`, "ok");
        return true;
      }
      if (kind === "prompt") {
        try {
          savePromptProfilesFromForm({ activeId: state2.activePromptId });
        } catch {
        }
        const library2 = state2.promptProfiles?.length ? {
          prompts: state2.promptProfiles.slice(),
          activeId: state2.activePromptId,
          activePreprocessId: state2.activePrePromptId,
          activeKnowledgeId: state2.activeKnowledgePromptId
        } : loadPromptProfiles();
        const stage = state2.ui?.promptStage === "postprocess" ? "postprocess" : state2.ui?.promptStage === "knowledge" ? "knowledge" : "preprocess";
        const stageIds = library2.prompts.filter((p) => p.stage === stage).map((p) => p.id);
        const nextStageIds = appCall("ordering.reorderIds", stageIds, fromId, toId);
        if (nextStageIds.join("\0") === stageIds.join("\0")) return false;
        const prompts = SubBatch2.SubBatchMonorepo.app.ordering.applyPromptStageOrder(library2.prompts, stage, nextStageIds);
        savePromptProfiles(prompts, library2.activeId, library2.activePreprocessId, library2.activeKnowledgeId);
        state2.promptEditorId = fromId;
        fillPromptConfigForm(root);
        const name = prompts.find((p) => p.id === fromId)?.name || "Prompt";
        setStatus(`已调整 Prompt 顺序：${name}`, "ok");
        return true;
      }
      return false;
    }
    function commitFlowModelReorder(taskId, fromId, toId) {
      if (!fromId || !toId || fromId === toId) return;
      const tasks = currentPostTasks().map((task2) => ({
        ...task2,
        modelIds: [...task2.modelIds || []]
      }));
      const task = tasks.find((task2) => task2.id === taskId);
      if (!task) return;
      task.modelIds = appCall("ordering.reorderIds", task.modelIds, fromId, toId);
      savePostTasks(tasks);
    }
    function renderPromptList(root) {
      const host2 = root?.querySelector('[data-role="prompt-list"]');
      if (!host2) return;
      const q = String(state2.promptSearch || "").trim().toLocaleLowerCase();
      const stage = state2.ui?.promptStage === "postprocess" ? "postprocess" : state2.ui?.promptStage === "knowledge" ? "knowledge" : "preprocess";
      const prompts = (state2.promptProfiles || []).filter((p) => p.stage === stage);
      const filtered = q ? prompts.filter((p) => `${p.name}
${p.hint}`.toLocaleLowerCase().includes(q)) : prompts;
      const canReorder = !q && filtered.length > 1;
      host2.dataset.reorderLocked = canReorder ? "0" : "1";
      host2.innerHTML = filtered.length ? filtered.map((p) => promptListItemHtml(p, { draggable: canReorder })).join("") : `<div class="bsb-config-list-empty">${prompts.length ? "没有匹配的 Prompt" : stage === "preprocess" ? "还没有预处理 Prompt" : stage === "knowledge" ? "还没有 Knowledge Prompt" : "还没有后处理 Prompt"}</div>`;
    }
    function fillPromptConfigForm(root) {
      if (!root) return;
      const library2 = loadPromptProfiles();
      const stage = state2.ui?.promptStage === "postprocess" ? "postprocess" : state2.ui?.promptStage === "knowledge" ? "knowledge" : "preprocess";
      if (!library2.prompts.some((p) => p.id === state2.promptEditorId && p.stage === stage)) {
        const preferredId = stage === "preprocess" ? library2.activePreprocessId : stage === "knowledge" ? library2.activeKnowledgeId : library2.activeId;
        state2.promptEditorId = library2.prompts.find((p) => p.id === preferredId && p.stage === stage)?.id || library2.prompts.find((p) => p.stage === stage)?.id || "";
      }
      const search = root.querySelector('[data-role="prompt-search"]');
      if (search && search.value !== state2.promptSearch) search.value = state2.promptSearch;
      renderPromptList(root);
      const editorHost = root.querySelector('[data-role="prompt-editor"]');
      if (editorHost) {
        const index = library2.prompts.findIndex((p) => p.id === state2.promptEditorId);
        editorHost.innerHTML = promptEditorHtml(index >= 0 ? library2.prompts[index] : null, Math.max(0, index));
      }
      refreshPromptSelector(root);
    }
    function handlePromptProfileAction(button) {
      const editor = button.closest("[data-prompt-id]");
      const action = button.dataset.promptAct;
      if (!editor || !action) return;
      const library2 = savePromptProfilesFromForm({ activeId: state2.activePromptId });
      const index = library2.prompts.findIndex((p) => p.id === editor.dataset.promptId);
      if (index < 0) return;
      const current = library2.prompts[index];
      if (!current) return;
      if (action === "use") {
        if (current.stage === "preprocess") savePromptProfiles(library2.prompts, library2.activeId, current.id, library2.activeKnowledgeId);
        else if (current.stage === "knowledge") savePromptProfiles(library2.prompts, library2.activeId, library2.activePreprocessId, current.id);
        else savePromptProfiles(library2.prompts, current.id, library2.activePreprocessId, library2.activeKnowledgeId);
        state2.promptEditorId = current.id;
        fillPromptConfigForm(ensurePanel());
        setStatus(`当前${current.stage === "preprocess" ? "预处理" : current.stage === "knowledge" ? "Knowledge" : "后处理"}提示词：${current.name}`, "ok");
        return;
      }
      if (action === "duplicate") {
        const copy = coreCall("createPromptProfile", { ...current, id: coreCall("makePromptProfileId"), name: `${current.name} 副本` }, index + 1);
        const prompts = [...library2.prompts];
        prompts.splice(index + 1, 0, copy);
        savePromptProfiles(prompts, library2.activeId, library2.activePreprocessId, library2.activeKnowledgeId);
        state2.promptEditorId = copy.id;
        fillPromptConfigForm(ensurePanel());
        setStatus(`已复制提示词：${copy.name}`, "ok");
        return;
      }
      if (action === "delete") {
        const prompts = [...library2.prompts];
        const [removed] = prompts.splice(index, 1);
        if (!removed) return;
        const sameStage = prompts.filter((p) => p.stage === removed.stage);
        let nextActiveId = library2.activeId;
        let nextPreId = library2.activePreprocessId;
        let nextKnowledgeId = library2.activeKnowledgeId;
        if (removed.stage === "preprocess" && removed.id === library2.activePreprocessId) nextPreId = sameStage[0]?.id || "";
        if (removed.stage === "postprocess" && removed.id === library2.activeId) nextActiveId = sameStage[0]?.id || "";
        if (removed.stage === "knowledge" && removed.id === library2.activeKnowledgeId) nextKnowledgeId = sameStage[0]?.id || "";
        savePromptProfiles(prompts, nextActiveId, nextPreId, nextKnowledgeId);
        state2.promptEditorId = sameStage[0]?.id || "";
        fillPromptConfigForm(ensurePanel());
        setStatus(`已删除提示词：${removed.name}${sameStage.length ? "" : ` · 当前没有${removed.stage === "preprocess" ? "预处理" : removed.stage === "knowledge" ? "Knowledge" : "后处理"} Prompt`}`, sameStage.length ? "ok" : "err");
      }
    }
    function updatePromptUi(root, prompt2) {
      const hint = root?.querySelector('[data-role="prompt-hint"]');
      if (hint) hint.textContent = prompt2?.hint || "请在设置中新增或恢复提示词";
    }
    function renderPromptTemplate2(template, vars) {
      try {
        const api = typeof SubBatch2 !== "undefined" ? SubBatch2?.SubBatchMonorepo : null;
        const pure = api?.core?.renderPromptTemplate;
        if (typeof pure === "function") return pure(template, vars);
      } catch {
      }
      const values = {
        title: String(vars?.title || ""),
        bvid: String(vars?.bvid || ""),
        author: String(vars?.author || ""),
        subtitle: String(vars?.subtitle || ""),
        rawSubtitle: String(vars?.rawSubtitle || ""),
        processedSubtitle: String(vars?.processedSubtitle || ""),
        chunkIndex: String(vars?.chunkIndex || ""),
        chunkCount: String(vars?.chunkCount || ""),
        chunkStart: String(vars?.chunkStart || ""),
        coreStart: String(vars?.coreStart || ""),
        chunkEnd: String(vars?.chunkEnd || ""),
        anchorText: String(vars?.anchorText || ""),
        sourceContext: String(vars?.sourceContext || ""),
        ancestorPath: String(vars?.ancestorPath || ""),
        question: String(vars?.question || "")
      };
      return String(template || "").replace(/\{\{\s*(title|bvid|author|subtitle|rawSubtitle|processedSubtitle|chunkIndex|chunkCount|chunkStart|coreStart|chunkEnd|anchorText|sourceContext|ancestorPath|question)\s*\}\}/g, (_, key) => values[key] ?? "");
    }
    function loadAiProfiles() {
      try {
        const raw = storageGet(AI_PROFILES_STORE_KEY, null);
        if (raw) {
          const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
          const list = Array.isArray(parsed) ? parsed : parsed?.profiles;
          if (Array.isArray(list) && list.length) {
            const storedVersion = Array.isArray(parsed) ? 1 : Number(parsed?.version || 1);
            const seeds = storedVersion < AI_PROFILES_SCHEMA_VERSION ? list.map((profile2) => ({
              ...profile2,
              // v2 以前的默认值 4096 自动升级；用户自定义的其它值保持不变。
              maxTokens: Number(profile2?.maxTokens) === 4096 ? AI_DEFAULTS.maxTokens : profile2?.maxTokens
              // v4 起模型配置只保留 API 与采样参数；提示词迁移到独立模板库。
            })) : list;
            const normalized = coreCall("normalizeAiProfiles", seeds);
            if (storedVersion < AI_PROFILES_SCHEMA_VERSION) {
              storageSet(AI_PROFILES_STORE_KEY, JSON.stringify({
                version: AI_PROFILES_SCHEMA_VERSION,
                profiles: normalized
              }));
            }
            return normalized;
          }
        }
      } catch {
      }
      try {
        const raw = storageGet(AI_STORE_KEY, null);
        if (raw) {
          const legacy = typeof raw === "string" ? JSON.parse(raw) : raw;
          if (legacy && typeof legacy === "object") {
            const migrated = [coreCall("createAiProfile", { ...legacy, name: legacy.name || legacy.model || "默认模型" }, 0)];
            storageSet(AI_PROFILES_STORE_KEY, JSON.stringify({ version: AI_PROFILES_SCHEMA_VERSION, profiles: migrated }));
            return migrated;
          }
        }
      } catch {
      }
      return [coreCall("createAiProfile", { ...AI_DEFAULTS, name: "默认模型" }, 0)];
    }
    function saveAiProfiles(profiles) {
      const normalized = coreCall("normalizeAiProfiles", profiles);
      try {
        storageSet(AI_PROFILES_STORE_KEY, JSON.stringify({ version: AI_PROFILES_SCHEMA_VERSION, profiles: normalized }));
      } catch {
      }
      state2.aiProfiles = normalized;
      state2.ai = normalized.find((x) => x.enabled) || normalized[0] || null;
      refreshPreprocessModelSelector(document.getElementById(PANEL_ID));
      if (state2.postTasks?.length) savePostTasks(state2.postTasks);
      else loadPostTasks();
      refreshAiChips();
      renderAiResultTabs();
      return normalized;
    }
    function enabledAiProfiles({ requireReady = false } = {}) {
      const profiles = state2.aiProfiles?.length ? state2.aiProfiles : loadAiProfiles();
      return profiles.filter((p) => p.enabled && (!requireReady || p.apiKey && p.baseUrl && p.model));
    }
    function refreshPreprocessModelSelector(root) {
      root = root || document.getElementById(PANEL_ID);
      const select = root?.querySelector('[data-role="preprocess-model-select"]');
      if (!select) return;
      const profiles = state2.aiProfiles?.length ? state2.aiProfiles : loadAiProfiles();
      const ready = profiles.filter((p) => p.apiKey && p.baseUrl && p.model);
      const fallback = ready.find((p) => p.enabled) || ready[0] || null;
      if (!ready.length) {
        select.innerHTML = '<option value="">没有可用 LLM</option>';
        select.value = "";
        select.disabled = true;
        state2.preprocessModelId = "";
        return;
      }
      select.disabled = !state2.preprocessEnabled;
      select.innerHTML = ready.map((p) => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.name || p.model)}</option>`).join("");
      if (!ready.some((p) => p.id === state2.preprocessModelId)) {
        state2.preprocessModelId = fallback?.id || "";
        storageSet(PREPROCESS_MODEL_STORE_KEY, state2.preprocessModelId);
      }
      select.value = state2.preprocessModelId;
    }
    function getPreprocessModelConfig(profiles) {
      const all = Array.isArray(profiles) && profiles.length ? profiles : state2.aiProfiles?.length ? state2.aiProfiles : loadAiProfiles();
      const ready = all.filter((p) => p.apiKey && p.baseUrl && p.model);
      const selected = ready.find((p) => p.id === state2.preprocessModelId);
      return selected || ready.find((p) => p.enabled) || ready[0] || null;
    }
    function getStudioModelConfig(profiles) {
      const all = Array.isArray(profiles) && profiles.length ? profiles : state2.aiProfiles?.length ? state2.aiProfiles : loadAiProfiles();
      const ready = all.filter((p) => p.apiKey && p.baseUrl && p.model);
      const selected = ready.find((p) => p.id === state2.studioModelId);
      const fallback = selected || getPreprocessModelConfig(all) || knowledgeGetModelConfig() || ready.find((p) => p.enabled) || ready[0] || null;
      if (fallback && state2.studioModelId !== fallback.id) {
        state2.studioModelId = fallback.id;
        storageSet(STUDIO_MODEL_STORE_KEY, fallback.id);
      }
      return fallback;
    }
    function aiListItemHtml(profile2, { draggable = true } = {}) {
      const selected = profile2.id === state2.aiEditorId;
      const name = profile2.name || profile2.model || "未命名模型";
      const dragAttr = draggable ? 'draggable="true"' : 'draggable="false"';
      const title = draggable ? `${name} · 拖拽左侧 ⠿ 调整顺序` : `${name} · 清空搜索后可拖拽排序`;
      return `<div class="bsb-config-list-item${selected ? " selected" : ""}" role="button" tabindex="0" ${dragAttr} data-ai-list-id="${escapeAttr(profile2.id)}" title="${escapeAttr(title)}">
      <span class="bsb-config-drag" aria-hidden="true" title="拖拽排序">⠿</span>
      <span class="bsb-config-dot${profile2.enabled ? " enabled" : ""}"></span>
      <span class="bsb-config-item-main">
        <span class="bsb-config-item-name">${escapeHtml(name)}</span>
        <span class="bsb-config-item-sub">${escapeHtml(profile2.model || "未填写 model")}</span>
      </span>
      ${profile2.enabled ? '<span class="bsb-config-badge">启用</span>' : ""}
    </div>`;
    }
    function aiEditorHtml(profile2, index) {
      if (!profile2) return '<div class="bsb-config-editor-empty">没有可编辑的 LLM 配置。</div>';
      const summary = [profile2.baseUrl || "未填写 Base URL", profile2.model || "未填写 model"].join(" · ");
      return `<section data-ai-profile-id="${escapeAttr(profile2.id)}">
      <div class="bsb-config-editor-head">
        <div class="bsb-config-editor-title">
          <strong>${escapeHtml(profile2.name || `模型 ${index + 1}`)}</strong>
          <span>${escapeHtml(summary)}</span>
        </div>
        <div class="bsb-config-editor-actions">
          <button type="button" class="bsb-btn ghost" data-ai-profile-act="duplicate">复制</button>
          <button type="button" class="bsb-btn danger" data-ai-profile-act="delete">删除</button>
        </div>
      </div>
      <label style="flex-direction:row;align-items:center;gap:8px;margin-bottom:10px">
        <input type="checkbox" data-ai-field="enabled" style="width:auto" ${profile2.enabled ? "checked" : ""}>
        启用此模型（启用后参与并发分析）
      </label>
      <label>配置名称
        <input type="text" data-ai-field="name" value="${escapeAttr(profile2.name || `模型 ${index + 1}`)}" placeholder="例如：NVIDIA - GPT OSS 120B" autocomplete="off">
      </label>
      <label>Base URL（含 /v1）
        <input type="text" data-ai-field="baseUrl" value="${escapeAttr(profile2.baseUrl)}" placeholder="https://api.example.com/v1" autocomplete="off">
      </label>
      <label>API Key
        <input type="password" data-ai-field="apiKey" value="${escapeAttr(profile2.apiKey)}" placeholder="sk-..." autocomplete="off">
      </label>
      <label>Model
        <input type="text" data-ai-field="model" value="${escapeAttr(profile2.model)}" placeholder="gpt-4o-mini" autocomplete="off">
      </label>
      <div class="row2">
        <label>Temperature
          <input type="number" data-ai-field="temperature" min="0" max="2" step="0.1" value="${escapeAttr(profile2.temperature)}">
        </label>
        <label>Max tokens
          <input type="number" data-ai-field="maxTokens" min="256" max="128000" step="256" value="${escapeAttr(profile2.maxTokens)}">
        </label>
      </div>
      <label style="flex-direction:row;align-items:center;gap:8px;margin-bottom:10px">
        <input type="checkbox" data-ai-field="stream" style="width:auto" ${profile2.stream ? "checked" : ""}>
        流式输出（建议开启）
      </label>
      <div class="bsb-ai-cfg-actions">
        <button type="button" class="bsb-btn primary" data-act="ai-save">保存当前 LLM</button>
      </div>
    </section>`;
    }
    function renderAiList(root) {
      const host2 = root?.querySelector('[data-role="ai-list"]');
      if (!host2) return;
      const q = String(state2.aiSearch || "").trim().toLocaleLowerCase();
      const profiles = state2.aiProfiles || [];
      const filtered = q ? profiles.filter((p) => `${p.name}
${p.model}
${p.baseUrl}`.toLocaleLowerCase().includes(q)) : profiles;
      const canReorder = !q && filtered.length > 1;
      host2.dataset.reorderLocked = canReorder ? "0" : "1";
      host2.innerHTML = filtered.length ? filtered.map((p) => aiListItemHtml(p, { draggable: canReorder })).join("") : `<div class="bsb-config-list-empty">${profiles.length ? "没有匹配的 LLM" : "还没有 LLM 配置"}</div>`;
    }
    function fillAiConfigForm(root) {
      if (!root) return;
      state2.aiProfiles = loadAiProfiles();
      state2.ai = state2.aiProfiles.find((x) => x.enabled) || state2.aiProfiles[0] || null;
      if (!state2.aiProfiles.some((p) => p.id === state2.aiEditorId)) {
        state2.aiEditorId = state2.aiProfiles.find((p) => p.enabled)?.id || state2.aiProfiles[0]?.id || "";
      }
      const search = root.querySelector('[data-role="ai-search"]');
      if (search && search.value !== state2.aiSearch) search.value = state2.aiSearch;
      renderAiList(root);
      const host2 = root.querySelector('[data-role="ai-editor"]');
      if (!host2) return;
      const index = state2.aiProfiles.findIndex((p) => p.id === state2.aiEditorId);
      host2.innerHTML = aiEditorHtml(index >= 0 ? state2.aiProfiles[index] : null, Math.max(0, index));
    }
    function readAiProfileCard(card, index) {
      const get = (key) => card.querySelector(`[data-ai-field="${key}"]`);
      return coreCall("createAiProfile", {
        id: card.dataset.aiProfileId || coreCall("makeAiProfileId"),
        enabled: !!card.querySelector('[data-ai-field="enabled"]')?.checked,
        name: String(get("name")?.value || `模型 ${index + 1}`),
        baseUrl: String(get("baseUrl")?.value || "").trim().replace(/\/+$/, ""),
        apiKey: String(get("apiKey")?.value || "").trim(),
        model: String(get("model")?.value || AI_DEFAULTS.model).trim(),
        temperature: Number(get("temperature")?.value),
        maxTokens: Number(get("maxTokens")?.value) || AI_DEFAULTS.maxTokens,
        stream: !!card.querySelector('[data-ai-field="stream"]')?.checked
      }, index);
    }
    function saveAiProfilesFromForm() {
      const root = ensurePanel();
      const profiles = state2.aiProfiles?.length ? [...state2.aiProfiles] : [...loadAiProfiles()];
      const editor = root.querySelector('[data-role="ai-editor"] [data-ai-profile-id]');
      if (editor) {
        const index = profiles.findIndex((x) => x.id === editor.dataset.aiProfileId);
        if (index >= 0) profiles[index] = readAiProfileCard(editor, index);
      }
      return saveAiProfiles(profiles);
    }
    function handleAiProfileAction(button) {
      const editor = button.closest("[data-ai-profile-id]");
      const action = button.dataset.aiProfileAct;
      if (!editor || !action) return;
      const profiles = saveAiProfilesFromForm();
      const index = profiles.findIndex((x) => x.id === editor.dataset.aiProfileId);
      if (index < 0) return;
      const current = profiles[index];
      if (!current) return;
      if (action === "duplicate") {
        const copy = coreCall("createAiProfile", { ...current, id: coreCall("makeAiProfileId"), name: `${current.name} 副本` }, index + 1);
        profiles.splice(index + 1, 0, copy);
        saveAiProfiles(profiles);
        state2.aiEditorId = copy.id;
        fillAiConfigForm(ensurePanel());
        setStatus(`已复制配置：${copy.name}`, "ok");
      } else if (action === "delete") {
        if (profiles.length <= 1) {
          setStatus("至少保留一个模型配置", "err");
          return;
        }
        const [removed] = profiles.splice(index, 1);
        if (!removed) return;
        const next = profiles[Math.min(index, profiles.length - 1)] || profiles[0];
        saveAiProfiles(profiles);
        state2.aiEditorId = next?.id || "";
        fillAiConfigForm(ensurePanel());
        setStatus(`已删除配置：${removed.name}`, "ok");
      }
    }
    function toggleAiPanel(forceShow) {
      ensurePanel();
      if (forceShow === false) {
        setWorkspace("subs");
        return;
      }
      setWorkspace("ai");
      if (state2.ui && state2.ui.h < 640) {
        state2.ui.h = Math.min(860, Math.max(640, state2.ui.h));
        state2.ui.w = Math.max(state2.ui.w, 480);
        clampUiToViewport(state2.ui);
        applyPanelGeometry();
        saveUiGeom();
      }
      refreshAiChips();
    }
    function createAiRuntime(label = "AI") {
      return {
        label,
        abort: false,
        xhr: null,
        abortController: null
      };
    }
    function createAiRun(profile2, sessionId, task = null, promptProfile = null) {
      const taskId = String(task?.id || "legacy-output");
      const prompt2 = promptProfile ? coreCall("createPromptProfile", promptProfile, 0) : null;
      return {
        ...createAiRuntime(profile2.name || profile2.model),
        id: `${sessionId}:${taskId}:${profile2.id}`,
        profileId: profile2.id,
        taskId,
        taskSnapshot: task ? { ...task, modelIds: [...task.modelIds || []] } : null,
        promptId: prompt2?.id || String(task?.promptId || ""),
        promptName: prompt2?.name || "后处理",
        promptProfile: prompt2 ? { ...prompt2 } : null,
        config: { ...profile2 },
        raw: "",
        status: "queued",
        statusText: "等待发送",
        busy: false,
        error: "",
        sourceBvids: [],
        startedAt: 0,
        finishedAt: 0,
        scrollTop: 0,
        stickBottom: true,
        userReading: false,
        mermaidRepairing: false
      };
    }
    function getActiveAiRun() {
      return state2.aiActiveRunId ? state2.aiRuns.get(state2.aiActiveRunId) || null : null;
    }
    function anyAiRunBusy() {
      return state2.aiRunOrder.some((id) => state2.aiRuns.get(id)?.busy);
    }
    function activeAiRunBusy() {
      return !!getActiveAiRun()?.busy;
    }
    function aggregateRunStatus(runs) {
      if (runs.some((r) => r.busy || r.status === "running")) return "running";
      if (runs.some((r) => r.status === "error")) return "error";
      if (runs.length && runs.every((r) => r.status === "done")) return "done";
      if (runs.some((r) => r.status === "stopped")) return "stopped";
      return "queued";
    }
    function taskDisplayName(task) {
      const run = state2.aiRunOrder.map((id) => state2.aiRuns.get(id)).find((r) => r?.taskId === task?.id);
      return run?.promptName || promptForTask(task)?.name || "未命名产物";
    }
    function loadStudioChatStore() {
      const parseStore2 = appFn("studio.parseStore");
      if (parseStore2) {
        try {
          return parseStore2(storageGet(STUDIO_CHAT_STORE_KEY, null));
        } catch {
          return {};
        }
      }
      try {
        const raw = storageGet(STUDIO_CHAT_STORE_KEY, null);
        if (!raw) return {};
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch {
        return {};
      }
    }
    function persistStudioChat(routeKey = currentRouteVideoKey()) {
      const key = String(routeKey || "").trim();
      if (!key) return;
      const persist2 = appFn("studio.persist");
      if (persist2) {
        const store2 = persist2(loadStudioChatStore(), key, state2, Date.now());
        try {
          storageSet(STUDIO_CHAT_STORE_KEY, JSON.stringify(store2));
        } catch {
        }
        return;
      }
      const store = loadStudioChatStore();
      store[key] = {
        messages: (state2.studioMessages || []).slice(-40),
        memory: String(state2.studioMemory || ""),
        memoryUntilId: String(state2.studioMemoryUntilId || ""),
        memoryTurns: Number(state2.studioMemoryTurns) || 0,
        contextPref: state2.studioContextPref || "auto",
        updatedAt: Date.now()
      };
      const keys = Object.keys(store).sort((a, b) => (store[b].updatedAt || 0) - (store[a].updatedAt || 0));
      for (const extra of keys.slice(24)) delete store[extra];
      try {
        storageSet(STUDIO_CHAT_STORE_KEY, JSON.stringify(store));
      } catch {
      }
    }
    function loadStudioChat(routeKey = currentRouteVideoKey()) {
      const key = String(routeKey || "").trim();
      const restore2 = appFn("studio.restore");
      if (restore2) {
        Object.assign(state2, restore2(loadStudioChatStore(), key));
        return;
      }
      const entry = key ? loadStudioChatStore()[key] : null;
      state2.studioMessages = Array.isArray(entry?.messages) ? entry.messages : [];
      state2.studioMemory = String(entry?.memory || "");
      state2.studioMemoryUntilId = String(entry?.memoryUntilId || "");
      state2.studioMemoryTurns = Number(entry?.memoryTurns) || 0;
      state2.studioLastContextMeta = null;
      state2.studioContextPref = ["raw", "processed"].includes(entry?.contextPref) ? entry.contextPref : "auto";
    }
    function studioTranscriptContext() {
      return appCall(
        "studio.transcriptContext",
        currentInputPreviewText("raw"),
        currentInputPreviewText("processed"),
        state2.studioContextPref
      );
    }
    function refreshStudioMemory() {
      return appCall("studio.refreshMemory", state2, STUDIO_CHAT_KEEP_RECENT, STUDIO_CHAT_MEMORY_CHARS);
    }
    function matchStudioSlash(query) {
      const q = String(query || "").replace(/^\//, "").trim().toLowerCase();
      return STUDIO_SLASH_COMMANDS.filter((cmd) => !q || cmd.aliases.some((a) => a.startsWith(q) || a.includes(q)));
    }
    function parseStudioSlashInput(text) {
      const hit = String(text || "").trim().match(/^\/([^\s]+)(?:\s+([\s\S]*))?$/);
      if (!hit) return null;
      const token = String(hit[1] || "").toLowerCase();
      const cmd = STUDIO_SLASH_COMMANDS.find((c) => c.aliases.includes(token));
      return cmd ? { cmd, rest: String(hit[2] || "").trim() } : null;
    }
    function renderStudioSlashMenu() {
      const root = document.getElementById(PANEL_ID);
      const menu = root?.querySelector('[data-role="studio-slash"]');
      const input = root?.querySelector('[data-role="studio-input"]');
      if (!menu || !input) return;
      const value = String(input.value || "");
      const typingCommand = /^\/[^\s]*$/.test(value);
      if (!typingCommand) {
        menu.hidden = true;
        return;
      }
      const items = matchStudioSlash(value);
      if (!items.length) {
        menu.hidden = true;
        return;
      }
      if (state2.studioSlashIndex >= items.length) state2.studioSlashIndex = 0;
      menu.hidden = false;
      menu.innerHTML = items.map((cmd, i) => `<button type="button" class="${i === state2.studioSlashIndex ? "active" : ""}" data-studio-slash="${escapeAttr(cmd.id)}"><code>/${escapeHtml(cmd.aliases[0])}</code><span>${escapeHtml(cmd.hint)}</span></button>`).join("");
    }
    function hideStudioSlashMenu() {
      const menu = document.getElementById(PANEL_ID)?.querySelector('[data-role="studio-slash"]');
      if (menu) menu.hidden = true;
    }
    function studioMessageHtml(msg) {
      const role = msg.role === "user" ? "user" : msg.role === "system" ? "system" : "assistant";
      if (role === "system") {
        return `<div class="bsb-studio-msg system">${escapeHtml(msg.content || "")}</div>`;
      }
      if (role === "user") {
        return `<div class="bsb-studio-msg user"><span class="bsb-studio-role">你</span><div class="bsb-studio-bubble">${escapeHtml(msg.content || "")}</div></div>`;
      }
      const streaming = msg.status === "running";
      const body = msg.content ? renderKnowledgeAnswerCards(msg.content, { streaming }) : streaming ? '<div class="bsb-knowledge-thinking">正在组织回答…</div>' : "<p></p>";
      return `<div class="bsb-studio-msg assistant" data-studio-msg="${escapeAttr(msg.id || "")}"><span class="bsb-studio-role">研读</span><div class="bsb-studio-answer" data-role="studio-answer">${body}</div></div>`;
    }
    function paintStudioAnswer(msgId, text, streaming) {
      const cards = document.querySelector(`#${PANEL_ID} [data-studio-msg="${msgId}"] [data-role="studio-answer"]`);
      if (!cards) return false;
      cards.innerHTML = String(text || "").trim() ? renderKnowledgeAnswerCards(text, { streaming: true }) : '<div class="bsb-knowledge-thinking">正在组织回答…</div>';
      return true;
    }
    async function renderStudioCanvas() {
      const root = ensurePanel();
      if (state2.ui) state2.ui.aiStage = "chat";
      applyAiWorkbenchStageUi();
      const host2 = root.querySelector('[data-role="ai-content"]');
      const meta = root.querySelector('[data-role="ai-canvas-meta"]');
      const ctx = studioTranscriptContext();
      const route2 = currentRouteVideoRef();
      const pack = state2.studioLastContextMeta;
      const bits = [ctx.source];
      if (route2?.bvid) bits.push(route2.bvid);
      if (pack?.compressed) bits.push(`字幕 ${Math.round(Number(pack.original) / 100) / 10}k→${Math.round(Number(pack.kept) / 100) / 10}k`);
      if (state2.studioMemoryTurns) bits.push(`记忆 ${state2.studioMemoryTurns} 轮`);
      if (meta) meta.textContent = bits.join(" · ");
      if (!host2) return;
      if (!(state2.studioMessages || []).length) {
        host2.innerHTML = `<div class="bsb-empty"><div class="bsb-empty-ico">◎</div><strong>对着这一期提问</strong><span>像聊天一样追问字幕。超长字幕会按问题压缩，旧对话会折进记忆。输入 <code>/</code> 可压缩、看记忆或清空。</span></div>`;
        return;
      }
      const joined = (state2.studioMessages || []).map((m) => m.content || "").join("\n");
      try {
        await ensureKnowledgeRenderLibs(joined);
      } catch {
      }
      if (currentAiWorkbenchStage() !== "chat") return;
      const box = root.querySelector('[data-role="ai-md"]');
      const prevTop = box?.scrollTop || 0;
      host2.innerHTML = `<div class="bsb-studio-thread">${state2.studioMessages.map(studioMessageHtml).join("")}</div>`;
      try {
        linkifyTimestamps(host2);
      } catch {
      }
      await hydrateKnowledgeAnswerDom(host2, state2.renderEpoch);
      if (box) {
        state2.aiProgScroll = true;
        box.scrollTop = prevTop;
        requestAnimationFrame(() => {
          state2.aiProgScroll = false;
        });
      }
    }
    function refreshStudioStopUi() {
      const root = document.getElementById(PANEL_ID);
      if (!root) return;
      const show = !!(state2.aiBusy || state2.studioBusy);
      root.querySelectorAll('[data-act="ai-stop"]').forEach((b) => {
        b.style.display = show ? "" : "none";
      });
      const stream = root.querySelector('[data-role="ai-stream"]');
      if (stream) stream.classList.toggle("streaming", !!(state2.studioBusy || typeof activeAiRunBusy === "function" && activeAiRunBusy()));
    }
    function abortStudioRequest() {
      const runtime2 = state2.studioRuntime;
      if (!runtime2) return;
      runtime2.abort = true;
      try {
        runtime2.abortController?.abort();
      } catch {
      }
      try {
        runtime2.xhr?.abort?.();
      } catch {
      }
    }
    function studioClearChat() {
      abortStudioRequest();
      state2.studioBusy = false;
      state2.studioRuntime = null;
      appCall("studio.clearTurnHistory", state2);
      persistStudioChat();
      renderStudioCanvas();
      refreshStudioStopUi();
      setStatus("已清空当前对话", "ok");
    }
    function studioCopyLast() {
      const text = appCall("studio.lastAssistantText", state2.studioMessages || []);
      if (!text) return setStatus("还没有可复制的回答", "err");
      clipboardWrite(text);
      setStatus("已复制上一条回答", "ok");
    }
    function studioExportChat() {
      const msgs = (state2.studioMessages || []).filter((m) => m.role !== "system");
      if (!msgs.length) return setStatus("当前没有可导出的对话", "err");
      const route2 = currentRouteVideoRef();
      const memory = String(state2.studioMemory || "").trim();
      const text = [
        memory ? `## 压缩记忆

${memory}` : "",
        ...msgs.map((m) => `## ${m.role === "user" ? "你" : "研读"}

${m.content || ""}`)
      ].filter(Boolean).join("\n\n");
      downloadText(`${safeFilename(`${route2?.bvid || "video"}_对话`)}.md`, text);
      setStatus("已导出对话 Markdown", "ok");
    }
    function studioShowMemory() {
      refreshStudioMemory();
      const memory = String(state2.studioMemory || "").trim();
      if (!memory) {
        setStatus("还没有压缩记忆。多聊几轮后旧对话会自动折进记忆。", "ok");
        return;
      }
      state2.studioMessages = [
        ...state2.studioMessages || [],
        {
          id: `sys-${Date.now()}`,
          role: "system",
          content: `已压缩 ${state2.studioMemoryTurns || 0} 轮旧对话：
${memory}`
        }
      ];
      persistStudioChat();
      renderStudioCanvas();
    }
    async function studioCompressNow() {
      const folded = refreshStudioMemory();
      persistStudioChat();
      renderStudioCanvas();
      if (!folded && !state2.studioMemory) {
        setStatus("对话还不够长，无需压缩记忆", "ok");
        return;
      }
      const model = getStudioModelConfig();
      const memory = String(state2.studioMemory || "").trim();
      if (!model || !memory || memory.length < 400) {
        setStatus(`已抽取压缩记忆 ${state2.studioMemoryTurns || 0} 轮 · ${memory.length} 字`, "ok");
        return;
      }
      if (state2.studioBusy) {
        setStatus(`已抽取压缩记忆 ${state2.studioMemoryTurns || 0} 轮。生成中时不另调模型精炼。`, "ok");
        return;
      }
      const runtime2 = createAiRuntime("对话记忆压缩");
      state2.studioRuntime = runtime2;
      state2.studioBusy = true;
      refreshStudioStopUi();
      setStatus("正在精炼压缩记忆…");
      let latest = "";
      try {
        await new Promise((resolve2, reject) => {
          requestChatCompletion({
            runtime: runtime2,
            baseUrl: model.baseUrl,
            apiKey: model.apiKey,
            model: model.model,
            temperature: 0.2,
            maxTokens: 800,
            stream: false,
            messages: [
              {
                role: "system",
                content: "把旧对话记忆压成更短的要点清单。只保留问题、结论、步骤、边界和未决问题。简体中文。不要引言。每条一行，以 '- ' 开头，最多 12 条。"
              },
              { role: "user", content: memory }
            ],
            onStatus() {
            },
            onDelta(_delta, full) {
              latest = String(full || "");
            },
            onDone(full) {
              latest = String(full || latest || "");
              resolve2();
            },
            onError(error) {
              reject(error instanceof Error ? error : new Error(String(error || "压缩失败")));
            }
          });
        });
        if (state2.studioRuntime !== runtime2 || runtime2.abort) return;
        const next = appCall("studio.compactMemoryText", latest.trim(), STUDIO_CHAT_MEMORY_CHARS);
        if (next) state2.studioMemory = next;
        persistStudioChat();
        renderStudioCanvas();
        setStatus(`记忆已精炼 · ${state2.studioMemory.length} 字`, "ok");
      } catch (error) {
        if (state2.studioRuntime !== runtime2) return;
        if (runtime2.abort) setStatus("已停止记忆压缩");
        else setStatus(`记忆精炼失败，仍保留抽取稿：${errorMessage(error)}`, "err");
      } finally {
        if (state2.studioRuntime === runtime2) {
          state2.studioBusy = false;
          state2.studioRuntime = null;
          refreshStudioStopUi();
        }
      }
    }
    function runStudioSlash(commandId) {
      if (commandId === "clear") return studioClearChat();
      if (commandId === "stop") {
        abortStudioRequest();
        setStatus("正在停止对话生成…");
        return;
      }
      if (commandId === "copy") return studioCopyLast();
      if (commandId === "export") return studioExportChat();
      if (commandId === "compress") return studioCompressNow();
      if (commandId === "memory") return studioShowMemory();
      if (commandId === "raw") {
        state2.studioContextPref = "raw";
        persistStudioChat();
        renderStudioCanvas();
        setStatus("对话上下文改为原始字幕", "ok");
        return;
      }
      if (commandId === "norm") {
        state2.studioContextPref = "processed";
        persistStudioChat();
        renderStudioCanvas();
        setStatus("对话上下文改为规范化稿（没有则回退原文）", "ok");
        return;
      }
      if (commandId === "help") {
        state2.studioMessages = [
          ...state2.studioMessages || [],
          {
            id: `sys-${Date.now()}`,
            role: "system",
            content: STUDIO_SLASH_COMMANDS.map((c) => `/${c.aliases[0]}  ${c.hint}`).join("\n")
          }
        ];
        persistStudioChat();
        renderStudioCanvas();
      }
    }
    async function sendStudioChat(rawText) {
      const text = String(rawText || "").trim();
      if (!text || state2.studioBusy) return;
      const slash = parseStudioSlashInput(text);
      if (slash) {
        runStudioSlash(slash.cmd.id);
        return;
      }
      const model = getStudioModelConfig();
      if (!model) {
        setStatus("没有可用 LLM。请先在设置 → LLM 填写 Base URL / API Key / Model", "err");
        return;
      }
      const ctx = studioTranscriptContext();
      if (!ctx.text) {
        setStatus("当前视频还没有字幕，先抓取后再提问", "err");
        return;
      }
      const route2 = currentRouteVideoRef();
      const { user: userMsg, assistant: botMsg } = appCall("studio.beginTurn", state2, text);
      persistStudioChat();
      renderStudioCanvas();
      refreshStudioMemory();
      const packed = appCall(
        "studio.compressTranscript",
        ctx.text,
        [text, ...(state2.studioMessages || []).filter((m) => m.role === "user").slice(-3).map((m) => m.content)].join(" ")
      );
      state2.studioLastContextMeta = packed;
      const memory = String(state2.studioMemory || "").trim();
      const system = [
        "你在帮用户研读当前这条视频字幕。只根据提供的字幕与压缩记忆回答，不编造字幕没有的事实。",
        "简体中文。术语、命令、代码可留原文。不确定就明说。",
        "像对话一样直接答，先给结论，再补必要步骤或边界。不要复述整段字幕。",
        "",
        `<video>${route2?.bvid || ""} P${route2?.page || 1}</video>`,
        `<context_source>${ctx.source}${packed.compressed ? " · compressed" : ""}</context_source>`,
        memory ? `<conversation_memory>
${memory}
</conversation_memory>` : "",
        "<transcript>",
        packed.text,
        "</transcript>"
      ].filter(Boolean).join("\n");
      const messages = appCall(
        "studio.buildChatMessages",
        system,
        state2.studioMessages,
        userMsg.id || "",
        text,
        STUDIO_CHAT_KEEP_RECENT
      );
      const runtime2 = createAiRuntime(`对话 · ${model.name || model.model}`);
      state2.studioRuntime = runtime2;
      state2.studioBusy = true;
      refreshStudioStopUi();
      let latest = "";
      try {
        await new Promise((resolve2, reject) => {
          requestChatCompletion({
            runtime: runtime2,
            baseUrl: model.baseUrl,
            apiKey: model.apiKey,
            model: model.model,
            temperature: model.temperature,
            maxTokens: model.maxTokens,
            stream: model.stream !== false,
            messages,
            onStatus() {
            },
            onDelta(_delta, full) {
              if (state2.studioRuntime !== runtime2) return;
              latest = appCall("studio.updateTurn", botMsg, full);
              if (!paintStudioAnswer(botMsg.id, latest, true)) renderStudioCanvas();
            },
            onDone(full) {
              if (state2.studioRuntime === runtime2) latest = String(full || latest || "");
              resolve2();
            },
            onError(error) {
              reject(error instanceof Error ? error : new Error(String(error || "对话失败")));
            }
          });
        });
        if (state2.studioRuntime !== runtime2) return;
        appCall("studio.finishTurn", botMsg, latest, !!runtime2.abort);
        setStatus(runtime2.abort ? "对话已停止" : "对话已回复", runtime2.abort ? "" : "ok");
      } catch (error) {
        if (state2.studioRuntime !== runtime2) return;
        const stopped = !!runtime2.abort;
        appCall("studio.failTurn", botMsg, latest, error, stopped);
        setStatus(stopped ? "对话已停止" : `对话失败：${errorMessage(error)}`, stopped ? "" : "err");
      } finally {
        if (state2.studioRuntime === runtime2) {
          state2.studioBusy = false;
          state2.studioRuntime = null;
          persistStudioChat();
          renderStudioCanvas();
          refreshStudioStopUi();
        }
      }
    }
    function currentAiWorkbenchStage() {
      const stage = state2.ui?.aiStage;
      if (stage === "postprocess" || stage === "chat") return stage;
      return "preprocess";
    }
    function applyAiWorkbenchStageUi() {
      const root = document.getElementById(PANEL_ID);
      if (!root) return;
      const stage = currentAiWorkbenchStage();
      const apply = typeof SubBatch2 !== "undefined" ? SubBatch2?.SubBatchMonorepo?.ui?.studioController?.applyWorkbenchStageUi : null;
      if (typeof apply === "function") {
        apply(root, stage, state2.aiInputView);
        refreshStudioStopUi();
        return;
      }
      root.querySelectorAll("[data-ai-stage]").forEach((button) => {
        const active = button.dataset.aiStage === stage;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", active ? "true" : "false");
      });
      const preNav = root.querySelector('[data-role="ai-preprocess-nav"]');
      const postNav = root.querySelector('[data-role="ai-postprocess-nav"]');
      const dock = root.querySelector('[data-role="studio-dock"]');
      const wrap = root.querySelector(".bsb-ai-canvas-wrap");
      if (preNav) preNav.hidden = stage !== "preprocess";
      if (postNav) postNav.hidden = stage !== "postprocess";
      if (dock) dock.hidden = stage !== "chat";
      wrap?.classList.toggle("is-studio", stage === "chat");
      root.querySelectorAll("[data-preprocess-action]").forEach((el) => {
        el.hidden = stage !== "preprocess";
      });
      root.querySelectorAll("[data-postprocess-action]").forEach((el) => {
        el.hidden = stage !== "postprocess";
      });
      root.querySelectorAll("[data-studio-action]").forEach((el) => {
        el.hidden = stage !== "chat";
      });
      root.querySelectorAll("[data-pipeline-action]").forEach((el) => {
        el.hidden = stage === "chat";
      });
      const label = root.querySelector('[data-role="ai-canvas-stage-label"]');
      if (label) label.textContent = stage === "preprocess" ? "预处理" : stage === "chat" ? "对话" : "后处理";
      root.querySelectorAll("[data-ai-preprocess-view]").forEach((button) => {
        const active = button.dataset.aiPreprocessView === state2.aiInputView;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", active ? "true" : "false");
      });
      refreshStudioStopUi();
    }
    function renderProcessedTranscriptBodyHtml(plain) {
      const source = String(plain || "").trim();
      if (!source) return "";
      const { md, maths } = prepareMarkdownMath(source);
      return knowledgeChunkToHtml(md, maths);
    }
    function renderProcessedTranscriptCards(text) {
      const blocks = appCall("preprocess.readingBlocks", text);
      if (!blocks.length) return `<pre class="bsb-main-input-preview">${escapeHtml(text)}</pre>`;
      let paragraphIndex = 0;
      let sourceCount = 0;
      let readingSource = currentKnowledgeSource();
      const timestampRe = /\[(BV[\w]+)\s+P(\d+)\s+(\d{1,2}:\d{2}(?::\d{2})?)\]/gi;
      const html = blocks.map((block) => {
        if (block.type === "source") {
          sourceCount += 1;
          const match = block.text.match(/^(BV[\w]+)(?:\s+P(\d+))?\s*(.*)$/i);
          const id = match?.[1] || "字幕";
          const page = Number(match?.[2]) || 1;
          const title = (match?.[3] || block.text).trim() || id;
          readingSource = { ...readingSource, bvid: id, page, sourceKey: knowledgeSourceKey(id, page), title };
          return `<div class="bsb-preprocess-source"><span class="bsb-preprocess-source-mark">${sourceCount}</span><span class="bsb-preprocess-source-text"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(id)}${page > 1 ? ` · P${page}` : ""} · AI 规范化稿</span></span></div>`;
        }
        if (block.type === "heading") {
          return `<div class="bsb-preprocess-section-title">${escapeHtml(block.text)}</div>`;
        }
        paragraphIndex += 1;
        const timestamps = [];
        let m;
        timestampRe.lastIndex = 0;
        while (m = timestampRe.exec(block.text)) {
          const parsed = appCall("preprocess.parseTimestamp", m[0]);
          if (parsed) timestamps.push(parsed);
        }
        const clean = block.text.replace(timestampRe, "").replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").trim();
        const first = timestamps[0] || null;
        const last = timestamps[timestamps.length - 1] || first;
        const timeHtml = first ? `<span class="bsb-preprocess-block-time"><button type="button" class="bsb-time-link" data-seconds="${first.seconds}" data-bvid="${escapeAttr(first.bvid)}" data-page="${first.page}" title="跳到这段字幕">${escapeHtml(first.clock)}</button>${last && last.clock !== first.clock ? `<span class="bsb-preprocess-time-end">→ ${escapeHtml(last.clock)}</span>` : ""}</span>` : "";
        const warning = /识别存疑/.test(clean) ? `<span class="bsb-preprocess-warning">△ 识别存疑</span>` : "";
        const fallbackSource = readingSource || currentKnowledgeSource();
        const kbvid = first?.bvid || fallbackSource.bvid || "";
        const kpage = first?.page || fallbackSource.page || 1;
        const kstart = first?.seconds ?? 0;
        const kend = last?.seconds ?? kstart;
        const segmentId = `seg-${kbvid || "local"}-p${kpage}-${Math.round(kstart * 10)}-${coreCall("md5", clean || block.text).slice(0, 7)}`;
        const sourceKey = knowledgeSourceKey(kbvid, kpage);
        const bodyHtml = renderProcessedTranscriptBodyHtml(clean || block.text);
        const topic = "topic" in block ? block.topic : "";
        return `<article class="bsb-preprocess-block" data-preprocess-block="${paragraphIndex}" data-knowledge-segment="${escapeAttr(segmentId)}" data-knowledge-source-key="${escapeAttr(sourceKey)}" data-knowledge-bvid="${escapeAttr(kbvid)}" data-knowledge-page="${kpage}" data-knowledge-start="${kstart}" data-knowledge-end="${kend}" data-knowledge-clock="${escapeAttr(first?.clock || "")}" data-knowledge-topic="${escapeAttr(topic || "")}" data-knowledge-title="${escapeAttr(fallbackSource.title || "")}" data-knowledge-author="${escapeAttr(fallbackSource.author || "")}"><div class="bsb-preprocess-block-head"><span class="bsb-preprocess-block-index">${String(paragraphIndex).padStart(2, "0")}</span>${topic ? `<span class="bsb-preprocess-block-topic">${escapeHtml(topic)}</span>` : ""}${warning}${timeHtml}</div><div class="bsb-preprocess-block-body bsb-md-rich" data-knowledge-plain="${escapeAttr(clean || block.text)}">${bodyHtml}</div></article>`;
      }).join("");
      return `<div class="bsb-preprocess-reading">${html}</div>`;
    }
    async function renderPreprocessCanvas() {
      const root = ensurePanel();
      if (state2.ui) state2.ui.aiStage = "preprocess";
      const processed = currentInputPreviewText("processed");
      const raw = currentInputPreviewText("raw");
      if (state2.aiInputView === "processed" && !processed && raw) {
        state2.aiInputView = "raw";
      }
      applyAiWorkbenchStageUi();
      const kind = state2.aiInputView === "processed" ? "processed" : "raw";
      const text = kind === "processed" ? processed : raw;
      const status2 = root.querySelector('[data-role="ai-preprocess-status"]');
      if (status2) {
        if (!raw) status2.textContent = "当前视频暂无字幕";
        else if (!state2.preprocessEnabled) status2.textContent = "预处理已关闭";
        else if (state2.preprocessRun?.busy) status2.textContent = state2.preprocessRun.statusText || "AI 正在处理字幕…";
        else if (processed) status2.textContent = state2.preprocessRun?.statusText || "AI 字幕已就绪";
        else status2.textContent = "原始字幕已就绪 · 尚未生成 AI 字幕";
      }
      const meta = root.querySelector('[data-role="ai-canvas-meta"]');
      if (meta) meta.textContent = kind === "processed" ? "AI 处理字幕" : "原始字幕";
      state2.renderEpoch += 1;
      state2.aiViewingPreprocess = kind === "processed";
      const content2 = root.querySelector('[data-role="ai-content"]');
      if (!content2) return;
      if (kind === "processed" && state2.preprocessRun?.busy) {
        content2.innerHTML = `<div class="bsb-empty"><div class="bsb-empty-ico">◌</div><strong>AI 正在处理字幕…</strong><span>${escapeHtml(state2.preprocessRun.statusText || "正在规范化、翻译并整理字幕")}</span></div>`;
      } else if (text) {
        if (kind === "processed") {
          try {
            await ensureKnowledgeRenderLibs(text);
          } catch {
          }
          content2.innerHTML = renderProcessedTranscriptCards(text);
          await decorateKnowledgeAnchors(content2);
          await hydrateKnowledgeAnswerDom(content2, state2.renderEpoch);
        } else {
          content2.innerHTML = `<pre class="bsb-main-input-preview">${escapeHtml(text)}</pre>`;
        }
      } else {
        const title = kind === "processed" ? "还没有 AI 处理字幕" : "还没有原始字幕";
        const detail = kind === "processed" ? state2.preprocessEnabled ? "运行处理方案后，这里会显示规范化后的简体中文字幕。" : "当前预处理已关闭，可在“处理方案”中开启。" : "先在字幕库抓取当前视频字幕。";
        content2.innerHTML = `<div class="bsb-empty"><div class="bsb-empty-ico">◇</div><strong>${title}</strong><span>${detail}</span></div>`;
      }
      refreshAiChips();
      saveUiGeom();
    }
    async function renderPostprocessCanvas() {
      const root = ensurePanel();
      if (state2.ui) state2.ui.aiStage = "postprocess";
      applyAiWorkbenchStageUi();
      renderAiResultTabs();
      const meta = root.querySelector('[data-role="ai-canvas-meta"]');
      const activeRun = getActiveAiRun();
      if (activeRun) {
        if (meta) meta.textContent = `${activeRun.promptName || "产物"} · ${activeRun.config.name || activeRun.config.model}`;
        await selectAiRun(activeRun.id);
        return;
      }
      const tasks = currentPostTasks().filter((t) => t.enabled !== false);
      const task = tasks.find((t) => t.id === state2.aiActiveTaskId) || tasks[0];
      if (task) {
        if (meta) meta.textContent = taskDisplayName(task);
        await selectAiOutputTask(task.id);
        return;
      }
      const content2 = root.querySelector('[data-role="ai-content"]');
      if (meta) meta.textContent = "暂无后处理产物";
      if (content2) content2.innerHTML = '<div class="bsb-empty"><div class="bsb-empty-ico">◇</div><strong>还没有后处理产物</strong><span>打开“处理方案”添加全 Mermaid 学习图谱或其他 POST Prompt。</span></div>';
      saveUiGeom();
    }
    async function setAiWorkbenchStage(stage, opts = {}) {
      const next = stage === "postprocess" ? "postprocess" : stage === "chat" ? "chat" : "preprocess";
      if (state2.ui) state2.ui.aiStage = next;
      applyAiWorkbenchStageUi();
      if (!opts.silent) saveUiGeom();
      if (opts.render === false) return;
      if (next === "preprocess") await renderPreprocessCanvas();
      else if (next === "chat") {
        loadStudioChat();
        renderStudioCanvas();
      } else await renderPostprocessCanvas();
    }
    function renderAiResultTabs() {
      const root = document.getElementById(PANEL_ID);
      const outputHost = root?.querySelector('[data-role="ai-result-tabs"]');
      const modelHost = root?.querySelector('[data-role="ai-model-tabs"]');
      if (!outputHost || !modelHost) return;
      const tasks = currentPostTasks().filter((t) => t.enabled !== false);
      if (!tasks.some((t) => t.id === state2.aiActiveTaskId)) state2.aiActiveTaskId = tasks[0]?.id || "";
      if (!tasks.length) {
        outputHost.innerHTML = '<span class="bsb-ai-result-empty">还没有输出产物 · 打开“处理方案”添加</span>';
        modelHost.innerHTML = "";
        return;
      }
      outputHost.innerHTML = tasks.map((task) => {
        const runs2 = state2.aiRunOrder.map((id) => state2.aiRuns.get(id)).filter((r) => !!r && r.taskId === task.id);
        const status2 = aggregateRunStatus(runs2);
        const active = task.id === state2.aiActiveTaskId ? " active" : "";
        const configuredModels = task.modelIds?.length || 0;
        return `<button type="button" class="bsb-output-tab ${escapeAttr(status2)}${active}" data-ai-output-task="${escapeAttr(task.id)}" title="${escapeAttr(taskDisplayName(task))}"><span class="dot"></span><span class="name">${escapeHtml(taskDisplayName(task))}</span><span class="count">${runs2.length || configuredModels}</span></button>`;
      }).join("");
      const activeTask = tasks.find((t) => t.id === state2.aiActiveTaskId) || tasks[0];
      if (!activeTask) return;
      const runs = state2.aiRunOrder.map((id) => state2.aiRuns.get(id)).filter((r) => !!r && r.taskId === activeTask.id);
      if (runs.length) {
        const firstRun = runs[0];
        if (firstRun && !runs.some((r) => r.id === state2.aiActiveRunId)) {
          state2.aiActiveRunId = firstRun.id;
          syncActiveRunBridge(firstRun);
        }
        modelHost.innerHTML = runs.map((run) => {
          const active = run.id === state2.aiActiveRunId ? " active" : "";
          const status2 = run.status || (run.busy ? "running" : "queued");
          const name = run.config.name || run.config.model;
          return `<button type="button" class="bsb-model-tab ${escapeAttr(status2)}${active}" data-ai-result-id="${escapeAttr(run.id)}" title="${escapeAttr(`${run.promptName} · ${name} · ${run.statusText || status2}`)}"><span class="dot"></span><span>${escapeHtml(name)}</span></button>`;
        }).join("");
      } else {
        const profiles = state2.aiProfiles?.length ? state2.aiProfiles : loadAiProfiles();
        const modelNames = (activeTask.modelIds || []).map((id) => profiles.find((p) => p.id === id)).filter((p) => !!p);
        modelHost.innerHTML = modelNames.length ? modelNames.map((p) => `<span class="bsb-model-tab queued"><span class="dot"></span><span>${escapeHtml(p.name || p.model)}</span></span>`).join("") : '<span class="bsb-ai-result-empty">这个产物还没有选择 LLM</span>';
      }
    }
    function flowSelectHtml(dataAttr, optionsHtml, disabled = false) {
      return `<div class="bsb-flow-select"><select ${dataAttr} ${disabled ? "disabled" : ""}>${optionsHtml}</select><span class="bsb-flow-select-icon" aria-hidden="true">⌄</span></div>`;
    }
    function flowStepperHtml(dataAttr, value, min, max, step, unit = "", disabled = false) {
      const off = disabled ? "disabled" : "";
      return `<div class="bsb-flow-stepper ${disabled ? "disabled" : ""}"><button type="button" data-flow-step="-1" ${off} aria-label="减少">−</button><div class="bsb-flow-stepper-value"><input type="number" min="${min}" max="${max}" step="${step}" value="${escapeAttr(value)}" ${dataAttr} ${off}>${unit ? `<span class="bsb-flow-stepper-unit">${escapeHtml(unit)}</span>` : ""}</div><button type="button" data-flow-step="1" ${off} aria-label="增加">＋</button></div>`;
    }
    function flowTaskModelsHtml(task, profiles) {
      const list = Array.isArray(profiles) ? profiles : [];
      const selectedIds = (task.modelIds || []).filter((id) => list.some((p) => p.id === id));
      const ranked = selectedIds.map((id, i) => {
        const profile2 = list.find((p) => p.id === id);
        const name = profile2?.name || profile2?.model || id;
        const off = profile2 && profile2.enabled === false ? " · 停用" : "";
        return `<div class="bsb-model-rank" draggable="true" data-flow-model-id="${escapeAttr(id)}" title="拖动调整运行顺序">
        <span class="bsb-model-rank-handle" aria-hidden="true">⠿</span>
        <span class="bsb-model-rank-n">${String(i + 1).padStart(2, "0")}</span>
        <span class="bsb-model-rank-name">${escapeHtml(name)}${off}</span>
        <button type="button" class="bsb-model-rank-remove" data-flow-task-model-remove="${escapeAttr(id)}" title="移出运行队列" aria-label="移出 ${escapeAttr(name)}">×</button>
      </div>`;
      }).join("");
      const available = list.filter((p) => !selectedIds.includes(p.id)).map((p) => `<button type="button" class="bsb-model-add" data-flow-task-model-add="${escapeAttr(p.id)}" title="追加到队列末尾">＋ ${escapeHtml(p.name || p.model)}${p.enabled === false ? " · 停用" : ""}</button>`).join("");
      return `<div class="bsb-model-order">
      <div class="bsb-model-rank-list">${ranked || '<span class="bsb-ai-result-empty">还没有模型。从下方添加到运行队列，上到下即 1 → 2 → 3。</span>'}</div>
      ${list.length ? `<div class="bsb-model-add-list">${available || '<span class="bsb-ai-result-empty">全部模型已在队列中</span>'}</div>` : '<span class="bsb-ai-result-empty">请先在设置 → LLM 新建模型</span>'}
    </div>`;
    }
    function flowTaskCardHtml(task, index, prompts, profiles) {
      const posts = prompts.filter((p) => p.stage === "postprocess");
      const prompt2 = posts.find((p) => p.id === task.promptId) || posts[0] || null;
      const promptOptions = posts.map((p) => `<option value="${escapeAttr(p.id)}"${p.id === task.promptId ? " selected" : ""}>${escapeHtml(p.name)}</option>`).join("");
      return `<article class="bsb-output-task-card" data-flow-task-id="${escapeAttr(task.id)}">
      <div class="bsb-output-task-head"><span class="bsb-output-task-index">${String(index + 1).padStart(2, "0")}</span><span class="bsb-output-task-name">${escapeHtml(prompt2?.name || "未命名产物")}</span><button type="button" class="bsb-mini" data-flow-task-remove="${escapeAttr(task.id)}" title="移除这个产物">移除</button></div>
      <div class="bsb-flow-field"><span class="bsb-flow-label">产物 Prompt</span>${flowSelectHtml("data-flow-task-prompt", promptOptions || '<option value="">没有 POST Prompt</option>')}</div>
      <div class="bsb-flow-field" style="margin-top:9px"><span class="bsb-flow-label">LLM 运行顺序</span>${flowTaskModelsHtml(task, profiles)}</div>
    </article>`;
    }
    function renderAiFlowDrawer() {
      const root = document.getElementById(PANEL_ID);
      const host2 = root?.querySelector('[data-role="ai-flow-drawer"]');
      if (!host2) return;
      const prompts = state2.promptProfiles?.length ? state2.promptProfiles : loadPromptProfiles().prompts;
      const profiles = state2.aiProfiles?.length ? state2.aiProfiles : loadAiProfiles();
      const tasks = state2.postTasks?.length ? state2.postTasks : loadPostTasks();
      const pres = prompts.filter((p) => p.stage === "preprocess");
      const preOptions = pres.map((p) => `<option value="${escapeAttr(p.id)}"${p.id === state2.activePrePromptId ? " selected" : ""}>${escapeHtml(p.name)}</option>`).join("");
      const readyProfiles = profiles.filter((p) => p.apiKey && p.baseUrl && p.model);
      const preModelOptions = readyProfiles.map((p) => `<option value="${escapeAttr(p.id)}"${p.id === state2.preprocessModelId ? " selected" : ""}>${escapeHtml(p.name || p.model)}</option>`).join("");
      const studioModel = getStudioModelConfig();
      const studioModelOptions = readyProfiles.map((p) => `<option value="${escapeAttr(p.id)}"${studioModel?.id === p.id ? " selected" : ""}>${escapeHtml(p.name || p.model)}</option>`).join("");
      const ctxPref = state2.studioContextPref === "raw" || state2.studioContextPref === "processed" ? state2.studioContextPref : "auto";
      const ctxOptions = [
        `<option value="auto"${ctxPref === "auto" ? " selected" : ""}>自动（规范化稿优先）</option>`,
        `<option value="processed"${ctxPref === "processed" ? " selected" : ""}>规范化稿</option>`,
        `<option value="raw"${ctxPref === "raw" ? " selected" : ""}>原始字幕</option>`
      ].join("");
      host2.innerHTML = `<div class="bsb-drawer-head"><div class="bsb-drawer-title"><strong>处理方案</strong><span>配置预处理、对话与后处理。这里只定义流程，不展示结果。</span></div><button type="button" class="bsb-icon-btn" data-act="ai-drawer-close" aria-label="关闭">×</button></div>
      <div class="bsb-drawer-body">
        <section class="bsb-flow-section">
          <div class="bsb-flow-section-head"><div><strong>预处理</strong><span>一次规范化，供对话与后处理复用</span></div><label class="bsb-flow-switch"><input type="checkbox" data-flow-preprocess-enabled ${state2.preprocessEnabled ? "checked" : ""}><span class="bsb-flow-switch-track" aria-hidden="true"></span><span class="bsb-flow-switch-text">${state2.preprocessEnabled ? "已开启" : "已关闭"}</span></label></div>
          <div class="bsb-flow-grid">
            <div class="bsb-flow-field"><span class="bsb-flow-label">Prompt</span>${flowSelectHtml("data-flow-preprompt", preOptions || '<option value="">没有预处理 Prompt</option>', !state2.preprocessEnabled)}</div>
            <div class="bsb-flow-field"><span class="bsb-flow-label">LLM</span>${flowSelectHtml("data-flow-premodel", preModelOptions || '<option value="">没有可用 LLM</option>', !state2.preprocessEnabled)}</div>
            <div class="bsb-flow-field"><span class="bsb-flow-label">全局并发</span>${flowStepperHtml("data-flow-preconcurrency", state2.preprocessConcurrency, 1, 8, 1, "", !state2.preprocessEnabled)}</div>
            <div class="bsb-flow-field"><span class="bsb-flow-label">目标块时长</span>${flowStepperHtml("data-flow-pretarget-minutes", state2.preprocessTargetMinutes, 2, 30, 1, "分钟", !state2.preprocessEnabled)}</div>
          </div>
          <details class="bsb-flow-advanced">
            <summary>高级切块设置</summary>
            <div class="bsb-flow-grid">
              <div class="bsb-flow-field"><span class="bsb-flow-label">上下文重叠</span>${flowStepperHtml("data-flow-preoverlap-seconds", state2.preprocessOverlapSeconds, 0, 120, 5, "秒", !state2.preprocessEnabled)}</div>
              <div class="bsb-flow-field"><span class="bsb-flow-label">单块字符硬上限</span>${flowStepperHtml("data-flow-premax-chars", state2.preprocessMaxChars, 8e3, 6e4, 1e3, "字符", !state2.preprocessEnabled)}</div>
              <div class="bsb-flow-field"><span class="bsb-flow-label">失败重试</span>${flowStepperHtml("data-flow-preretries", state2.preprocessRetries, 0, 4, 1, "次", !state2.preprocessEnabled)}</div>
            </div>
          </details>
          <div class="bsb-preprocess-note">关闭后，对话与后处理直接读取原始字幕。长视频按真实时间戳优先切块；单块超过字符硬上限会提前截断。Overlap 只用于跨块上下文，最终按真实时间戳确定性去重。并发是全局 Worker 数，不会乘以视频数量。</div>
        </section>
        <section class="bsb-flow-section">
          <div class="bsb-flow-section-head"><div><strong>对话</strong><span>对着当前字幕多轮提问，不走「运行」流水线</span></div></div>
          <div class="bsb-flow-grid">
            <div class="bsb-flow-field"><span class="bsb-flow-label">LLM</span>${flowSelectHtml("data-flow-studiomodel", studioModelOptions || '<option value="">没有可用 LLM</option>')}</div>
            <div class="bsb-flow-field"><span class="bsb-flow-label">字幕上下文</span>${flowSelectHtml("data-flow-studiocontext", ctxOptions)}</div>
          </div>
          <div class="bsb-preprocess-note">在 AI 工作台的「对话」页提问。输入 / 可清空、压缩记忆、切换原文或规范化稿。超长字幕会按问题压缩，旧轮次会折进记忆。</div>
        </section>
        <section class="bsb-flow-section">
          <div class="bsb-flow-section-head"><div><strong>后处理</strong><span>${tasks.length} 个 · 每个产物独立选择 Prompt 与 LLM</span></div><button type="button" class="bsb-btn ghost" data-act="post-task-add">＋ 添加产物</button></div>
          <div data-role="flow-task-list">${tasks.map((t, i) => flowTaskCardHtml(t, i, prompts, profiles)).join("") || '<div class="bsb-input-empty">还没有后处理产物。</div>'}</div>
        </section>
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><span class="bsb-ai-result-empty">Prompt 与 LLM 的具体内容仍在“设置”中维护。</span><button type="button" class="bsb-btn" data-act="ai-reprocess" ${state2.preprocessEnabled ? "" : "disabled"}>重做预处理</button></div>
      </div>`;
    }
    function currentInputPreviewText(kind) {
      const input = state2.aiSessionInput;
      if (kind === "processed") return String(input?.vars?.processedSubtitle || state2.preprocessRun?.text || "");
      if (input?.vars?.rawSubtitle) return String(input.vars.rawSubtitle);
      const routeKey = currentRouteVideoKey();
      const current = routeKey ? state2.items.find((it) => routeVideoKey2(it.bvid, Number(it.page) || 1) === routeKey) || (routeVideoKey2(state2.transcriptItem?.bvid, state2.transcriptItem?.page || 1) === routeKey ? state2.transcriptItem : null) : null;
      if (current?.subStatus === "ok" && current.data?.length) return buildSubtitlePayload([current]);
      const ready = selectedItems().filter((it) => it.subStatus === "ok" && it.data?.length);
      return ready.length ? buildSubtitlePayload(ready) : "";
    }
    function renderAiInputDrawer() {
      const root = document.getElementById(PANEL_ID);
      const host2 = root?.querySelector('[data-role="ai-input-drawer"]');
      if (!host2) return;
      const raw = currentInputPreviewText("raw");
      const processed = currentInputPreviewText("processed");
      if (state2.aiInputView === "processed" && !processed && raw) state2.aiInputView = "raw";
      const text = state2.aiInputView === "processed" ? processed : raw;
      const preLabel = state2.preprocessEnabled ? processed ? "已规范化" : "等待规范化" : "预处理关闭";
      host2.innerHTML = `<div class="bsb-drawer-head"><div class="bsb-drawer-title"><strong>输入</strong><span>${escapeHtml(preLabel)} · 这里用于核查 AI 真正读取的材料</span></div><button type="button" class="bsb-icon-btn" data-act="ai-drawer-close" aria-label="关闭">×</button></div>
      <div class="bsb-drawer-body">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><div class="bsb-input-tabs"><button type="button" data-input-view="raw" class="${state2.aiInputView === "raw" ? "active" : ""}">原始字幕</button><button type="button" data-input-view="processed" class="${state2.aiInputView === "processed" ? "active" : ""}" ${processed ? "" : "disabled"}>规范化稿</button></div><button type="button" class="bsb-mini" data-act="ai-copy-input">复制当前输入</button></div>
        ${text ? `<pre class="bsb-input-preview">${escapeHtml(text)}</pre>` : '<div class="bsb-input-empty">当前没有可查看的输入。先在字幕库选择有字幕的视频，或运行一次处理方案。</div>'}
      </div>`;
    }
    function setAiDrawer(kind = "") {
      const root = document.getElementById(PANEL_ID);
      if (!root) return;
      state2.aiDrawer = ["flow", "input"].includes(kind) ? kind : "";
      const flow = root.querySelector('[data-role="ai-flow-drawer"]');
      const input = root.querySelector('[data-role="ai-input-drawer"]');
      const backdrop = root.querySelector('[data-role="ai-drawer-backdrop"]');
      if (state2.aiDrawer === "flow") renderAiFlowDrawer();
      if (state2.aiDrawer === "input") renderAiInputDrawer();
      flow?.classList.toggle("open", state2.aiDrawer === "flow");
      input?.classList.toggle("open", state2.aiDrawer === "input");
      flow?.setAttribute("aria-hidden", state2.aiDrawer === "flow" ? "false" : "true");
      input?.setAttribute("aria-hidden", state2.aiDrawer === "input" ? "false" : "true");
      if (backdrop) backdrop.hidden = !state2.aiDrawer;
    }
    async function selectAiOutputTask(taskId) {
      if (state2.ui) state2.ui.aiStage = "postprocess";
      applyAiWorkbenchStageUi();
      const task = currentPostTasks().find((t) => t.id === String(taskId || ""));
      if (!task) return;
      state2.aiActiveTaskId = task.id;
      const runs = state2.aiRunOrder.map((id) => state2.aiRuns.get(id)).filter((r) => !!r && r.taskId === task.id);
      renderAiResultTabs();
      if (runs[0]) await selectAiRun(runs[0].id);
      else {
        const root = ensurePanel();
        const content2 = root.querySelector('[data-role="ai-content"]');
        if (content2) content2.innerHTML = `<div class="bsb-empty"><div class="bsb-empty-ico">◇</div><strong>${escapeHtml(taskDisplayName(task))}</strong><span>这个产物还没有运行结果。点击“运行全部”按照当前处理方案生成。</span></div>`;
      }
    }
    function syncActiveRunBridge(run) {
      state2.aiRaw = run?.raw || "";
      state2.aiSourceBvids = run?.sourceBvids || [];
      state2.ai = run?.config || state2.ai;
    }
    async function selectAiRun(runId) {
      if (state2.ui) state2.ui.aiStage = "postprocess";
      applyAiWorkbenchStageUi();
      const run = state2.aiRuns.get(String(runId || ""));
      if (!run) return;
      state2.aiViewingPreprocess = false;
      if (run.taskId) state2.aiActiveTaskId = run.taskId;
      const root = ensurePanel();
      const box = root.querySelector('[data-role="ai-md"]');
      const previous = getActiveAiRun();
      if (previous && box) {
        previous.scrollTop = box.scrollTop;
        previous.stickBottom = state2.aiStickBottom;
        previous.userReading = state2.aiUserReading;
      }
      state2.aiActiveRunId = run.id;
      state2.renderEpoch += 1;
      syncActiveRunBridge(run);
      state2.aiRenderedText = "";
      state2.aiPendingText = run.raw || "";
      state2.aiStreamTextNode = null;
      state2.aiStickBottom = run.busy ? run.stickBottom !== false : false;
      state2.aiUserReading = run.busy ? !!run.userReading : true;
      renderAiResultTabs();
      refreshAiChips();
      setAiBusy(anyAiRunBusy());
      const content2 = root.querySelector('[data-role="ai-content"]');
      if (run.busy) {
        if (content2 && !run.raw) {
          content2.innerHTML = `<div class="bsb-empty"><div class="bsb-empty-ico">◌</div><strong>${escapeHtml(run.config.name || run.config.model)} 正在生成…</strong><span>${escapeHtml(run.statusText || "正在连接模型")}</span></div>`;
        }
        paintAiStreamText(run.raw || "正在等待模型返回…");
        requestAnimationFrame(() => scrollAiToBottom());
      } else if (run.raw) {
        await renderAiMarkdown(run.raw, { streaming: false });
        if (box) box.scrollTop = Math.max(0, Number(run.scrollTop) || 0);
      } else if (content2) {
        content2.innerHTML = `<div class="bsb-empty"><div class="bsb-empty-ico">${run.status === "error" ? "!" : "◌"}</div><strong>${escapeHtml(run.config.name || run.config.model)}</strong><span>${escapeHtml(run.error || run.statusText || "暂无输出")}</span></div>`;
      }
      setStatus(`${run.promptName || "产物"} · ${run.config.name || run.config.model} · ${run.statusText || run.status}`, run.status === "error" ? "err" : run.status === "done" ? "ok" : void 0);
    }
    function abortAiRun(run) {
      if (!run) return;
      run.abort = true;
      try {
        run.abortController?.abort();
      } catch {
      }
      try {
        if (run.xhr && typeof run.xhr.abort === "function") run.xhr.abort();
      } catch {
      }
    }
    function abortAllAiRuns() {
      aiBatchCoordinator?.stop();
      state2.aiRunOrder.forEach((id) => abortAiRun(state2.aiRuns.get(id)));
      if (state2.preprocessRun?.runtime) {
        state2.preprocessRun.runtime.abort = true;
        try {
          state2.preprocessRun.runtime.abortController?.abort();
        } catch {
        }
        try {
          state2.preprocessRun.runtime.xhr?.abort?.();
        } catch {
        }
        for (const child of state2.preprocessRun.childRuntimes || []) abortPreprocessChildRuntime(child);
      }
    }
    function latestAiConfigForRun(run) {
      let profiles = [];
      try {
        profiles = saveAiProfilesFromForm();
      } catch {
        profiles = loadAiProfiles();
      }
      const latest = profiles.find((profile2) => profile2.id === run?.profileId);
      return coreCall("createAiProfile", latest || run?.config || AI_DEFAULTS, 0);
    }
    function validateAiRunConfigs(configs) {
      const invalid = (configs || []).filter((cfg) => !cfg?.apiKey || !cfg?.baseUrl || !cfg?.model);
      if (!invalid.length) return true;
      setStatus(`以下模型配置不完整：${invalid.map((cfg) => cfg?.name || cfg?.model || "未命名模型").join("、")}`, "err");
      return false;
    }
    function summarizeAiRuns(prefix = "全部产物生成结束") {
      setAiBusy(anyAiRunBusy());
      if (anyAiRunBusy()) return;
      const runs = state2.aiRunOrder.map((id) => state2.aiRuns.get(id)).filter((run) => !!run);
      if (!runs.length) return;
      const summary = appCall("ai.summarizeRuns", runs);
      if (!summary) return;
      const { done, failed, stopped } = summary;
      persistAiSessionCache().catch(() => {
      });
      setStatus(`${prefix} · 成功 ${done} · 失败 ${failed} · 停止 ${stopped}`, failed ? "err" : "ok");
    }
    async function regenerateActiveAiRun() {
      const oldRun = getActiveAiRun();
      const input = appCall("ai.cloneSessionInput", state2.aiSessionInput);
      if (!oldRun || !input) {
        setStatus("当前没有可重新生成的模型结果，请先完成一次分析", "err");
        return;
      }
      if (oldRun.busy) {
        const restart = typeof pageWindow.confirm === "function" ? pageWindow.confirm(`“${oldRun.config.name || oldRun.config.model}”仍在生成。是否只停止该模型并重新生成？`) : false;
        if (!restart) return;
      }
      const config = latestAiConfigForRun(oldRun);
      if (!validateAiRunConfigs([config])) return;
      const runId = oldRun.id;
      abortAiRun(oldRun);
      const replacement = createAiRun(config, input.sessionId, oldRun.taskSnapshot, oldRun.promptProfile);
      replacement.id = runId;
      replacement.profileId = oldRun.profileId;
      replacement.sourceBvids = [...input.commonMeta.sourceBvids || []];
      state2.aiRuns.set(runId, replacement);
      state2.aiActiveRunId = runId;
      syncActiveRunBridge(replacement);
      renderAiResultTabs();
      await selectAiRun(runId || "");
      setStatus(`${replacement.promptName} · ${config.name || config.model} · 仅重新生成当前版本 · 复用现有${input.preprocessEnabled ? "规范化稿" : "原始字幕"}`);
      await runAiProfile(replacement, input.vars, replacement.promptProfile, input.commonMeta);
      summarizeAiRuns("当前模型重新生成结束");
    }
    async function regenerateAllAiRuns() {
      const input = appCall("ai.cloneSessionInput", state2.aiSessionInput);
      const oldRuns = state2.aiRunOrder.map((id) => state2.aiRuns.get(id)).filter((run) => !!run);
      if (!input || !oldRuns.length) {
        setStatus("当前没有可重新生成的批次，请先完成一次分析", "err");
        return;
      }
      if (anyAiRunBusy()) {
        const restart = typeof pageWindow.confirm === "function" ? pageWindow.confirm("仍有模型正在生成。是否停止所有当前请求并重新生成全部模型？") : false;
        if (!restart) return;
      }
      const runSpecs = oldRuns.map((run) => ({ old: run, config: latestAiConfigForRun(run) }));
      if (!validateAiRunConfigs(runSpecs.map((x) => x.config))) return;
      const activeOld = getActiveAiRun();
      state2.aiAbort = true;
      abortAllAiRuns();
      const sessionId = ++state2.aiSessionSeq;
      state2.aiAbort = false;
      state2.aiRuns = /* @__PURE__ */ new Map();
      state2.aiRunOrder = [];
      for (const spec of runSpecs) {
        const run = createAiRun(spec.config, sessionId, spec.old.taskSnapshot, spec.old.promptProfile);
        state2.aiRuns.set(run.id, run);
        state2.aiRunOrder.push(run.id);
      }
      state2.aiActiveRunId = state2.aiRunOrder.find((id) => {
        const run = state2.aiRuns.get(id);
        return run?.profileId === activeOld?.profileId && run?.taskId === activeOld?.taskId;
      }) || state2.aiRunOrder[0] || "";
      state2.aiActiveTaskId = getActiveAiRun()?.taskId || state2.aiActiveTaskId;
      state2.aiSessionInput = appCall("ai.cloneSessionInput", input, sessionId);
      syncActiveRunBridge(getActiveAiRun());
      renderAiResultTabs();
      setAiBusy(true);
      if (state2.aiActiveRunId) await selectAiRun(state2.aiActiveRunId);
      setStatus(`正在重新生成全部 ${state2.aiRunOrder.length} 个产物版本 · 不重复运行输入整理…`);
      await Promise.allSettled(state2.aiRunOrder.map((id) => {
        const run = state2.aiRuns.get(id);
        if (!run) return;
        return runAiProfile(run, input.vars, run.promptProfile, input.commonMeta);
      }));
      if (sessionId === state2.aiSessionSeq) summarizeAiRuns("全部模型重新生成结束");
    }
    function setAiBusy(busy) {
      const anyBusy = busy == null ? anyAiRunBusy() : !!busy;
      state2.aiBusy = anyBusy;
      const root = ensurePanel();
      root.classList.toggle("ai-busy", anyBusy);
      refreshActionDisabledState();
      refreshStudioStopUi();
      renderAiResultTabs();
    }
    function updateJumpLatestBtn() {
      const root = document.getElementById(PANEL_ID);
      if (!root) return;
      const jump = root.querySelector('[data-act="ai-jump"]');
      const stickBtn = root.querySelector('[data-act="ai-stick"]');
      if (stickBtn) {
        stickBtn.classList.toggle(
          "on",
          !!state2.aiStickBottom && !state2.aiUserReading
        );
      }
      if (!jump) return;
      const show = (!state2.aiStickBottom || state2.aiUserReading) && !!(state2.aiRaw || activeAiRunBusy());
      jump.classList.toggle("show", show);
    }
    function applyAiScrollResolved(r) {
      state2.aiStickBottom = r.stick;
      state2.aiUserReading = r.userReading;
      updateJumpLatestBtn();
    }
    function detachAiFollow() {
      applyAiScrollResolved(
        resolveAiScrollState(
          {
            stick: state2.aiStickBottom,
            userReading: state2.aiUserReading,
            progScroll: state2.aiProgScroll
          },
          { type: "detach" }
        )
      );
    }
    function resumeAiFollow() {
      applyAiScrollResolved(
        resolveAiScrollState(
          {
            stick: state2.aiStickBottom,
            userReading: state2.aiUserReading,
            progScroll: false
          },
          { type: "resume" }
        )
      );
      scrollAiToBottom();
    }
    function bindAiScrollBehavior(root) {
      const box = root.querySelector('[data-role="ai-md"]');
      if (!box || box.dataset.bsbScrollBound === "1") return;
      box.dataset.bsbScrollBound = "1";
      const onLeaveBottom = () => {
        if (state2.aiUserReading && !state2.aiStickBottom) {
          updateJumpLatestBtn();
          return;
        }
        detachAiFollow();
      };
      box.addEventListener(
        "wheel",
        (e) => {
          if (e.deltaY < 0) onLeaveBottom();
        },
        { passive: true, capture: true }
      );
      let touchY = null;
      let pointerY = null;
      box.addEventListener(
        "touchstart",
        (e) => {
          const t = e.touches && e.touches[0];
          touchY = t ? t.clientY : null;
        },
        { passive: true, capture: true }
      );
      box.addEventListener(
        "touchmove",
        (e) => {
          const t = e.touches && e.touches[0];
          if (!t || touchY == null) return;
          if (t.clientY - touchY > 8) onLeaveBottom();
          touchY = t.clientY;
        },
        { passive: true, capture: true }
      );
      box.addEventListener(
        "pointerdown",
        () => {
          pointerY = null;
        },
        { passive: true }
      );
      box.addEventListener(
        "pointermove",
        (e) => {
          if (e.buttons === 0 && e.pointerType === "mouse") return;
          if (pointerY != null && e.clientY - pointerY > 8) {
            onLeaveBottom();
          }
          pointerY = e.clientY;
        },
        { passive: true }
      );
      box.addEventListener(
        "keydown",
        (e) => {
          if (e.key === "ArrowUp" || e.key === "PageUp" || e.key === "Home") {
            onLeaveBottom();
          }
        },
        true
      );
      box.addEventListener(
        "scroll",
        () => {
          const gap = box.scrollHeight - box.scrollTop - box.clientHeight;
          const r = resolveAiScrollState(
            {
              stick: state2.aiStickBottom,
              userReading: state2.aiUserReading,
              progScroll: state2.aiProgScroll
            },
            { type: "scroll", gap }
          );
          applyAiScrollResolved(r);
        },
        { passive: true }
      );
    }
    function scrollAiToBottom(force) {
      const box = document.querySelector(`#${PANEL_ID} [data-role="ai-md"]`);
      if (!box) return;
      state2.aiProgScroll = true;
      box.scrollTop = box.scrollHeight;
      requestAnimationFrame(() => {
        box.scrollTop = box.scrollHeight;
        requestAnimationFrame(() => {
          state2.aiProgScroll = false;
          updateJumpLatestBtn();
        });
      });
    }
    function scrollAiToTop() {
      const box = document.querySelector(`#${PANEL_ID} [data-role="ai-md"]`);
      if (box) {
        state2.aiProgScroll = true;
        box.scrollTop = 0;
        requestAnimationFrame(() => {
          state2.aiProgScroll = false;
        });
      }
      detachAiFollow();
    }
    function paintAiStreamText(full) {
      state2.aiPendingText = String(full || "");
      if (state2.aiPaintRaf || state2.aiPaintTimer) return;
      const run = () => {
        state2.aiPaintTimer = 0;
        state2.aiPaintRaf = requestAnimationFrame(() => {
          state2.aiPaintRaf = 0;
          const root = ensurePanel();
          const box = root.querySelector('[data-role="ai-md"]');
          const content2 = root.querySelector('[data-role="ai-content"]') || box;
          if (!box || !content2) return;
          const text = state2.aiPendingText || "…";
          let pre = content2.querySelector(".bsb-ai-stream-body");
          let caret = content2.querySelector(".bsb-ai-caret");
          if (!pre) {
            content2.replaceChildren();
            pre = document.createElement("pre");
            pre.className = "bsb-ai-stream-body";
            state2.aiStreamTextNode = document.createTextNode("");
            pre.appendChild(state2.aiStreamTextNode);
            content2.appendChild(pre);
            state2.aiRenderedText = "";
          }
          if (!state2.aiStreamTextNode || state2.aiStreamTextNode.parentNode !== pre) {
            state2.aiStreamTextNode = pre.firstChild instanceof Text ? pre.firstChild : pre.appendChild(document.createTextNode(""));
            state2.aiRenderedText = state2.aiStreamTextNode.data || "";
          }
          if (activeAiRunBusy() && !caret) {
            caret = document.createElement("span");
            caret.className = "bsb-ai-caret";
            caret.setAttribute("aria-hidden", "true");
            content2.appendChild(caret);
          } else if (!activeAiRunBusy() && caret) caret.remove();
          const follow = resolveAiScrollState(
            { stick: state2.aiStickBottom, userReading: state2.aiUserReading, progScroll: false },
            { type: "paint" }
          ).allowPaintScroll;
          const freezeTop = box.scrollTop;
          if (text.startsWith(state2.aiRenderedText)) {
            state2.aiStreamTextNode.appendData(text.slice(state2.aiRenderedText.length));
          } else {
            state2.aiStreamTextNode.data = text;
          }
          state2.aiRenderedText = text;
          if (follow) {
            state2.aiProgScroll = true;
            box.scrollTop = box.scrollHeight;
            requestAnimationFrame(() => {
              state2.aiProgScroll = false;
            });
          } else if (box.scrollTop !== freezeTop && freezeTop > 0) {
            state2.aiProgScroll = true;
            box.scrollTop = freezeTop;
            requestAnimationFrame(() => {
              state2.aiProgScroll = false;
            });
          }
          updateJumpLatestBtn();
        });
      };
      state2.aiPaintTimer = window.setTimeout(run, STREAM_PAINT_INTERVAL_MS);
    }
    function buildSubtitlePayload(items) {
      return items.map((it) => {
        const head = `=== ${it.bvid}${(it.page || 1) > 1 ? " P" + it.page : ""} ${it.title || ""} ===`;
        return `${head}
${coreCall("cuesToAiText", it.data || [], it.bvid, it.page || 1)}`;
      }).join("\n\n");
    }
    function loadScriptOnce(src, globalCheck) {
      return new Promise((resolve2, reject) => {
        if (!src) return reject(new Error("Missing script URL"));
        if (globalCheck && globalCheck()) return resolve2();
        const existed = document.querySelector(`script[data-bsb-src="${src}"]`);
        if (existed) {
          if (globalCheck && globalCheck()) return resolve2();
          existed.addEventListener("load", () => resolve2(), { once: true });
          existed.addEventListener("error", () => reject(new Error("load " + src)), { once: true });
          return;
        }
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.dataset.bsbSrc = src;
        s.onload = () => resolve2();
        s.onerror = () => reject(new Error("failed to load " + src));
        (document.head || document.documentElement).appendChild(s);
      });
    }
    function loadCssOnce(href) {
      if (!href) return;
      if (document.querySelector(`link[data-bsb-href="${href}"]`)) return;
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = href;
      l.dataset.bsbHref = href;
      (document.head || document.documentElement).appendChild(l);
    }
    async function ensureMarkdownCore() {
      if (state2.renderLibs.core) return;
      await Promise.all([
        loadScriptOnce("https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js", () => typeof marked !== "undefined"),
        loadScriptOnce("https://cdn.jsdelivr.net/npm/dompurify@3.4.12/dist/purify.min.js", () => typeof DOMPurify !== "undefined")
      ]);
      if (typeof marked !== "undefined") {
        marked.setOptions({ gfm: true, breaks: true, mangle: false, headerIds: false });
      }
      state2.renderLibs.core = true;
    }
    async function ensureHighlight() {
      if (state2.renderLibs.highlight) return;
      loadCssOnce("https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/atom-one-dark.min.css");
      await loadScriptOnce("https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js", () => typeof hljs !== "undefined");
      state2.renderLibs.highlight = true;
    }
    async function ensureKatex() {
      if (state2.renderLibs.katex) return;
      loadCssOnce("https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css");
      await loadScriptOnce("https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js", () => typeof katex !== "undefined");
      state2.renderLibs.katex = true;
    }
    async function ensureMermaid() {
      if (state2.renderLibs.mermaid) return;
      await loadScriptOnce("https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js", () => typeof mermaid !== "undefined");
      if (typeof mermaid !== "undefined") {
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          securityLevel: "strict",
          fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
          suppressErrorRendering: true,
          deterministicIds: false,
          themeVariables: mermaidThemeVariablesForFlavor(),
          themeCSS: mermaidThemeCssForFlavor(),
          flowchart: {
            htmlLabels: false,
            useMaxWidth: false,
            curve: "basis",
            nodeSpacing: 48,
            rankSpacing: 64,
            padding: 16
          },
          sequence: {
            useMaxWidth: false,
            wrap: true,
            diagramMarginX: 32,
            diagramMarginY: 24,
            actorMargin: 72,
            width: 180,
            height: 72,
            boxMargin: 12,
            messageMargin: 42
          }
        });
      }
      state2.renderLibs.mermaid = true;
    }
    function hasMathSyntax(md) {
      return /```(?:math|latex|tex)|\$\$[\s\S]+?\$\$|\\\[|\\\(|\$[^\n$]+\$/.test(md);
    }
    function hasCodeSyntax(md) {
      return /```(?!mermaid|math|latex|tex)[^\n]*\n/i.test(md);
    }
    function hasMermaidSyntax(md) {
      return /```mermaid\s*\n/i.test(md);
    }
    async function yieldToMain() {
      const scheduler = Reflect.get(globalThis, "scheduler");
      if (scheduler && typeof scheduler === "object" && "yield" in scheduler && typeof scheduler.yield === "function") {
        await scheduler.yield();
      } else {
        await new Promise((resolve2) => setTimeout(resolve2, 0));
      }
    }
    function katexToHtml(tex, display2) {
      if (typeof katex === "undefined" || !katex.renderToString) return null;
      try {
        const html = katex.renderToString(String(tex || ""), {
          displayMode: !!display2,
          throwOnError: false,
          strict: "ignore",
          trust: false,
          output: "html"
        });
        return display2 ? `<div class="bsb-katex-display">${html}</div>` : `<span class="bsb-katex-inline">${html}</span>`;
      } catch {
        return null;
      }
    }
    function simpleMarkdownFallback(md) {
      let html = escapeHtml(md);
      html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => `<pre><span class="bsb-code-lang">${escapeHtml(lang || "text")}</span><code>${escapeHtml(code)}</code></pre>`);
      html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
      html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
      html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
      html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
      html = html.replace(/\n\n/g, "</p><p>");
      return `<p>${html}</p>`;
    }
    function sanitizeRenderedHtml(html) {
      if (typeof DOMPurify === "undefined") return simpleMarkdownFallback(stripHtml(html));
      return DOMPurify.sanitize(html, {
        USE_PROFILES: { html: true },
        SANITIZE_NAMED_PROPS: true,
        FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
        // mark: ==highlight== ; math/annotation: KaTeX/MathML leftovers
        ADD_TAGS: [
          "mark",
          "math",
          "semantics",
          "annotation",
          "mrow",
          "mi",
          "mo",
          "mn",
          "msup",
          "msub",
          "mfrac",
          "msqrt",
          "mtext",
          "mtable",
          "mtr",
          "mtd"
        ],
        // KaTeX relies on inline style for glyph positioning.
        ADD_ATTR: ["target", "rel", "aria-label", "data-bsb-m", "class", "style", "xmlns", "encoding"]
      });
    }
    async function replaceHostInBatches(host2, html, epoch) {
      const tpl = document.createElement("template");
      tpl.innerHTML = html;
      const nodes = Array.from(tpl.content.childNodes);
      host2.replaceChildren();
      for (let i = 0; i < nodes.length; i += RENDER_BATCH_SIZE) {
        if (epoch !== state2.renderEpoch) return false;
        const frag = document.createDocumentFragment();
        nodes.slice(i, i + RENDER_BATCH_SIZE).forEach((node) => frag.appendChild(node));
        host2.appendChild(frag);
        if (i + RENDER_BATCH_SIZE < nodes.length) await yieldToMain();
      }
      return true;
    }
    function linkifyTimestamps(host2) {
      const walker = document.createTreeWalker(host2, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) {
        if (!(walker.currentNode instanceof Text)) continue;
        const p = walker.currentNode.parentElement;
        if (!p || p.closest("pre,code,a,button,.katex,.mermaid,.bsb-toc")) continue;
        if (/\[(?:BV[\w]+\s+)?(?:P\d+\s+)?(?:\d{1,2}:)?\d{1,2}:\d{2}\]/i.test(walker.currentNode.data)) nodes.push(walker.currentNode);
      }
      const re = /\[((BV[\w]+)\s+)?(?:P(\d+)\s+)?((?:\d{1,2}:)?\d{1,2}:\d{2})\]/gi;
      for (const node of nodes) {
        const text = node.data;
        let last = 0;
        let m;
        const frag = document.createDocumentFragment();
        while (m = re.exec(text)) {
          if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
          const sec = (m[4] || "").split(":").map(Number).reduce((seconds, part) => seconds * 60 + part, 0);
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "bsb-time-link";
          btn.dataset.seconds = String(sec);
          btn.dataset.bvid = m[2] || "";
          btn.dataset.page = m[3] || "1";
          btn.textContent = m[0];
          btn.title = "跳到视频对应时间";
          frag.appendChild(btn);
          last = m.index + m[0].length;
        }
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        node.replaceWith(frag);
      }
    }
    function seekToVideoTimestamp(seconds, bvid, page) {
      if (typeof seconds !== "number" || !Number.isFinite(seconds)) return;
      const currentBvid = extractBvid2(location.href);
      let currentPage = 1;
      try {
        currentPage = Math.max(1, Number(new URL(location.href).searchParams.get("p")) || 1);
      } catch {
      }
      const targetPage = Math.max(1, Number(page) || 1);
      const sameVideo = !bvid || !currentBvid || bvid.toLowerCase() === currentBvid.toLowerCase();
      const video2 = document.querySelector("video");
      if (video2 && sameVideo && currentPage === targetPage) {
        video2.currentTime = Math.max(0, seconds);
        if (video2.paused) video2.play().catch(() => {
        });
        video2.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (bvid) {
        const u = new URL(`https://www.bilibili.com/video/${bvid}`);
        u.searchParams.set("p", String(targetPage));
        u.searchParams.set("t", String(Math.floor(seconds)));
        window.open(u.toString(), "_blank", "noopener");
      }
    }
    function buildToc(host2) {
      const headings = Array.from(host2.querySelectorAll("h1,h2,h3")).filter((h) => !h.closest(".bsb-toc"));
      if (headings.length < 2) return;
      const details = document.createElement("details");
      details.className = "bsb-toc";
      details.open = true;
      const summary = document.createElement("summary");
      summary.textContent = `本页目录 · ${headings.length}`;
      const nav = document.createElement("nav");
      headings.forEach((h, i) => {
        h.id = `bsb-note-h-${state2.renderEpoch}-${i}`;
        const b = document.createElement("button");
        b.type = "button";
        b.dataset.level = h.tagName.slice(1);
        b.textContent = h.textContent.trim() || `章节 ${i + 1}`;
        b.addEventListener("click", () => h.scrollIntoView({ behavior: "smooth", block: "start" }));
        nav.appendChild(b);
      });
      details.append(summary, nav);
      host2.prepend(details);
    }
    async function enhanceCodeBlocks(host2, epoch) {
      const blocks = Array.from(host2.querySelectorAll("pre code"));
      if (!blocks.length) return;
      try {
        await ensureHighlight();
      } catch (e) {
        console.warn("[bili-subbatch] highlight load", e);
        return;
      }
      for (let i = 0; i < blocks.length; i++) {
        if (epoch !== state2.renderEpoch) return;
        const block = blocks[i];
        if (!block) continue;
        const pre = block.parentElement;
        const m = (block.className || "").match(/language-([\w#+-]+)/i);
        if (m && pre && !pre.querySelector(".bsb-code-lang")) {
          const tag = document.createElement("span");
          tag.className = "bsb-code-lang";
          tag.textContent = m[1] || "";
          pre.insertBefore(tag, block);
        }
        try {
          if (typeof hljs !== "undefined") hljs.highlightElement(block);
        } catch {
        }
        if (i % 5 === 4) await yieldToMain();
      }
    }
    function stripMermaidTimestampCitations2(code) {
      return String(code || "").replace(
        /[ \t]*\[\s*(?:BV(?:号|[A-Za-z0-9]+)?\s+)?P(?:号|\d+)\s+(?:mm:ss|\d{1,2}:\d{2}(?::\d{2})?)\s*\]/gi,
        ""
      ).replace(
        /[ \t]*\[\s*BV(?:号|[A-Za-z0-9]+)?\s+(?:mm:ss|\d{1,2}:\d{2}(?::\d{2})?)\s*\]/gi,
        ""
      ).replace(/[ \t]+(?=\r?\n|$)/g, "").trim();
    }
    function sanitizeMermaidTimestampCitationsInMarkdown2(markdown) {
      return String(markdown || "").replace(
        /```mermaid\s*\r?\n([\s\S]*?)```/gi,
        (_, code) => `\`\`\`mermaid
${stripMermaidTimestampCitations2(code)}
\`\`\``
      );
    }
    function extractMermaidCode(text) {
      let source = String(text || "").trim();
      const fenced = source.match(/```(?:mermaid)?[ \t]*\r?\n([\s\S]*?)```/i);
      if (fenced) source = fenced[1] || "";
      source = source.replace(/^\s*```(?:mermaid)?\s*/i, "").replace(/```\s*$/i, "").replace(/^\s*mermaid\s*\r?\n/i, "").trim();
      return stripMermaidTimestampCitations2(source);
    }
    function replaceMermaidBlockAt2(markdown, targetIdx, nextCode) {
      const fn = coreFn("replaceMermaidBlockAt");
      if (fn) return fn(markdown, targetIdx, nextCode);
      let current = -1;
      let replaced = false;
      const value = String(markdown || "").replace(
        /```mermaid\s*\r?\n([\s\S]*?)```/gi,
        (full) => {
          current += 1;
          if (current !== Number(targetIdx)) return full;
          replaced = true;
          return `\`\`\`mermaid
${stripMermaidTimestampCitations2(nextCode)}
\`\`\``;
        }
      );
      return { value, replaced };
    }
    async function persistAiSessionCache(routeKey = state2.aiSessionRouteKey || currentRouteVideoKey()) {
      const keyFn = coreFn("aiSessionCacheKey");
      const buildFn = coreFn("buildAiSessionCachePayload");
      const usableFn = coreFn("isUsableAiSessionCache");
      const ttlFn = coreFn("aiSessionCacheTtlMs");
      if (!keyFn || !buildFn || !usableFn) return false;
      const key = keyFn(routeKey);
      if (!key) return false;
      const payload = buildFn({
        routeKey,
        sessionInput: appCall("ai.cloneSessionInput", state2.aiSessionInput, state2.aiSessionInput?.sessionId),
        preprocessRun: state2.preprocessRun ? { ...state2.preprocessRun, settings: { ...state2.preprocessRun.settings } } : null,
        runs: state2.aiRunOrder.flatMap((id) => {
          const run = state2.aiRuns.get(id);
          return run ? [{ ...run, config: { ...run.config } }] : [];
        }),
        activeRunId: state2.aiActiveRunId,
        activeTaskId: state2.aiActiveTaskId
      });
      if (!usableFn(payload)) return false;
      await persistentCache.write(key, payload, ttlFn ? ttlFn() : 30 * 24 * 60 * 6e4);
      return true;
    }
    async function hydrateAiSessionFromCache(payload, routeKey) {
      if (currentRouteVideoKey() && currentRouteVideoKey() !== routeKey) return false;
      const sessionId = ++state2.aiSessionSeq;
      state2.aiAbort = false;
      state2.aiRuns = /* @__PURE__ */ new Map();
      state2.aiRunOrder = [];
      const savedRuns = Array.isArray(payload?.runs) ? payload.runs : [];
      for (const saved of savedRuns) {
        const draft = coreCall("draftHydratedAiRun", saved);
        if (!draft) continue;
        const run = createAiRun(
          latestAiConfigForRun({ profileId: draft.profileId, config: draft.config }),
          sessionId,
          draft.taskSnapshot ? normalizePostTask(draft.taskSnapshot) : null,
          draft.promptProfile ? coreCall("createPromptProfile", draft.promptProfile, 0) : null
        );
        applyRestoredRunOutput(run, draft);
        state2.aiRuns.set(run.id, run);
        state2.aiRunOrder.push(run.id);
      }
      if (!state2.aiRunOrder.length) return false;
      const savedActive = savedRuns.find((item) => item && item.id === payload.activeRunId) || null;
      state2.aiActiveTaskId = payload.activeTaskId || savedActive?.taskId || "";
      state2.aiActiveRunId = coreCall(
        "resolveRestoredActiveRunId",
        state2.aiRunOrder.map((id) => state2.aiRuns.get(id)),
        savedActive,
        state2.aiActiveTaskId
      );
      state2.aiSessionInput = appCall("ai.cloneSessionInput", normalizeCachedSessionInput(payload.sessionInput), sessionId);
      if (state2.aiSessionInput) state2.aiSessionInput.routeKey = routeKey;
      const preprocess2 = coreCall("draftHydratedPreprocessRun", payload.preprocessRun);
      state2.preprocessRun = preprocess2 ? restorePreprocessRun(preprocess2, createAiRuntime("缓存预处理")) : null;
      state2.aiSessionRouteKey = routeKey;
      state2.autoAnalyzeKey = routeKey;
      state2.aiViewingPreprocess = false;
      syncActiveRunBridge(getActiveAiRun());
      renderAiResultTabs();
      renderAiInputDrawer();
      refreshAiChips();
      setAiBusy(false);
      if (currentAiWorkbenchStage() === "postprocess" && state2.aiActiveRunId) {
        await selectAiRun(state2.aiActiveRunId);
      } else if (currentAiWorkbenchStage() === "preprocess") {
        await renderPreprocessCanvas();
      }
      return true;
    }
    async function restoreAiSessionForRoute(routeKey) {
      const key = String(routeKey || "").trim();
      if (!key || state2.aiBusy) return false;
      if (state2.aiSessionRouteKey === key && state2.aiRunOrder.some((id) => String(state2.aiRuns.get(id)?.raw || "").trim())) {
        state2.autoAnalyzeKey = key;
        return true;
      }
      if (state2.aiSessionRestoreKey === key && state2.aiSessionRestorePromise) {
        return state2.aiSessionRestorePromise;
      }
      state2.aiSessionRestoreKey = key;
      state2.aiSessionRestorePromise = (async () => {
        try {
          const cacheKey = coreCall("aiSessionCacheKey", key);
          if (!cacheKey) return false;
          const cached = await persistentCache.read(cacheKey);
          if (currentRouteVideoKey() && currentRouteVideoKey() !== key) return false;
          if (!cached || !coreCall("isUsableAiSessionCache", cached.value)) return false;
          return await hydrateAiSessionFromCache(cached.value, key);
        } catch (error) {
          console.warn("[bili-subbatch] restore ai session", error);
          return false;
        } finally {
          if (state2.aiSessionRestoreKey === key) {
            state2.aiSessionRestorePromise = null;
            state2.aiSessionRestoreKey = "";
          }
        }
      })();
      return state2.aiSessionRestorePromise;
    }
    function persistRepairedMermaid(targetRun, idx, nextCode) {
      const run = targetRun || getActiveAiRun();
      const source = run?.raw ?? state2.aiRaw;
      const result = replaceMermaidBlockAt2(source, idx, nextCode);
      if (!result.replaced) return false;
      if (run) {
        run.raw = result.value;
        if (run.id === state2.aiActiveRunId) {
          syncActiveRunBridge(run);
          state2.aiRenderedText = run.raw;
          state2.aiPendingText = run.raw;
        }
      } else {
        state2.aiRaw = result.value;
        state2.aiRenderedText = state2.aiRaw;
        state2.aiPendingText = state2.aiRaw;
      }
      persistAiSessionCache().catch(() => {
      });
      return true;
    }
    function currentMermaidRepairResolution(targetRun, preferredProfileId = "") {
      const run = targetRun || getActiveAiRun();
      const profiles = state2.aiProfiles?.length ? state2.aiProfiles : loadAiProfiles();
      const fn = coreFn("resolveMermaidRepairConfig");
      if (typeof fn === "function") {
        return fn({
          runConfig: run?.config || null,
          profileId: run?.profileId || run?.config?.id || "",
          profiles,
          preferredProfileId: preferredProfileId || ""
        });
      }
      const ready = profiles.filter((p) => p?.apiKey && p?.baseUrl && p?.model);
      return {
        config: ready[0] || null,
        source: ready[0] ? "fallback" : "none",
        missing: ready[0] ? [] : ["apiKey", "baseUrl", "model"],
        readyProfiles: ready
      };
    }
    function mermaidSetupError(resolution) {
      const hintFn = coreFn("mermaidRepairSetupHint");
      const message = typeof hintFn === "function" ? hintFn(resolution.missing.filter((key) => key === "apiKey" || key === "baseUrl" || key === "model")) : "还没有可用的 LLM。打开 设置 → LLM 填写 API Key。";
      const err = Object.assign(new Error(message), { mermaidSetup: true, missing: resolution?.missing || [] });
      return err;
    }
    function openSettingsLlm(profileId) {
      const root = ensurePanel();
      if (profileId) state2.aiEditorId = profileId;
      toggleAiPanel(true);
      setWorkspace("settings");
      setSettingsTab("llm");
      fillAiConfigForm(root);
      requestAnimationFrame(() => {
        const field = root.querySelector('[data-ai-field="apiKey"]');
        const label = field?.closest("label");
        root.querySelectorAll(".bsb-llm-field-focus").forEach((el) => el.classList.remove("bsb-llm-field-focus"));
        if (label) label.classList.add("bsb-llm-field-focus");
        field?.focus();
        field?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
      setStatus("API Key 在「设置 → LLM」这一栏。填好后点保存，再回到笔记重绘。", "ok");
    }
    function saveInlineMermaidProfile(card) {
      const get = (name) => card.querySelector(`[data-mermaid-field="${name}"]`);
      const baseUrl = String(get("baseUrl")?.value || "").trim().replace(/\/+$/, "");
      const apiKey = String(get("apiKey")?.value || "").trim();
      const model = String(get("model")?.value || "").trim();
      if (!baseUrl || !apiKey || !model) {
        setStatus("Base URL、API Key、Model 都要填", "err");
        return "";
      }
      const profiles = [...state2.aiProfiles?.length ? state2.aiProfiles : loadAiProfiles()];
      const same = profiles.find((p) => String(p.baseUrl || "") === baseUrl && String(p.model || "") === model);
      if (same) {
        same.apiKey = apiKey;
        same.baseUrl = baseUrl;
        same.model = model;
        same.enabled = true;
        saveAiProfiles(profiles);
        return same.id;
      }
      const created = coreCall("createAiProfile", {
        name: "Mermaid 修复",
        baseUrl,
        apiKey,
        model,
        enabled: true
      }, profiles.length);
      profiles.push(created);
      saveAiProfiles(profiles);
      return created.id;
    }
    function requestMermaidCodeRepair(code, error, idx, targetRun, preferredProfileId) {
      const resolved = currentMermaidRepairResolution(targetRun, preferredProfileId);
      const cfg = resolved.config;
      if (!cfg || resolved.source === "none" || !cfg.apiKey || !cfg.baseUrl || !cfg.model) {
        throw mermaidSetupError(resolved);
      }
      const runtime2 = createAiRuntime(`Mermaid 修复 · ${cfg.name || cfg.model || "AI"}`);
      const parseError = String(errorMessage(error) || "未知渲染错误").slice(0, 4e3);
      const originalCode = String(code || "").slice(0, 3e4);
      const messages = [
        {
          role: "system",
          content: [
            "你是 Mermaid 10.9.1 的确定性语法修复器，只处理用户给出的单个 flowchart。",
            "修复目标仅限语法和兼容性：引号、括号、节点 ID、标签、换行、箭头和不受支持的指令。",
            "必须保留原图的节点含义、关系方向、顺序和信息量；移除 Mermaid 节点、边和子图标题中的所有 BV/P/时间戳引用；不得补充字幕外事实，也不要把图改写成新的总结。",
            "输出只允许一个完整的 ```mermaid``` 代码块。使用 flowchart TD 或 flowchart LR；节点 ID 仅用 ASCII 字母数字；标签使用双引号。",
            "禁止 click、classDef、style、init、实验语法和除 <br/> 外的复杂 HTML。不要输出解释、前言或修改说明。"
          ].join("\n")
        },
        {
          role: "user",
          content: `请修复第 ${Number(idx) + 1} 张 Mermaid 图。

【渲染错误】
${parseError}

【原始 Mermaid】
\`\`\`mermaid
${originalCode}
\`\`\``
        }
      ];
      return new Promise((resolve2, reject) => {
        let latest = "";
        requestChatCompletion({
          runtime: runtime2,
          baseUrl: cfg.baseUrl || "",
          apiKey: cfg.apiKey || "",
          model: cfg.model || "",
          temperature: 0.1,
          maxTokens: 32768,
          messages,
          stream: cfg.stream !== false,
          onStatus(msg) {
            setStatus(`Mermaid AI 修复 · ${msg}`);
          },
          onDelta(_delta, full, parts) {
            latest = String(parts?.content || full || latest);
          },
          onDone(full, parts) {
            const repaired = extractMermaidCode(parts?.content || full || latest);
            if (!repaired) {
              reject(new Error("AI 没有返回可用的 Mermaid 代码"));
              return;
            }
            resolve2(repaired);
          },
          onError(err) {
            reject(err instanceof Error ? err : new Error(String(err || "AI 修复失败")));
          }
        });
      });
    }
    async function handleMermaidTool(button) {
      const action = button?.dataset?.mmdAct;
      const card = button?.closest(".bsb-mermaid-card, .bsb-mermaid-error");
      if (action === "open-llm") {
        const host2 = button.closest(".mermaid[data-bsb-m]");
        const resolved = currentMermaidRepairResolution(getActiveAiRun(), host2?._bsbMermaidJob?.preferredProfileId);
        openSettingsLlm(resolved.config?.id || resolved.readyProfiles?.[0]?.id || state2.aiEditorId);
        return;
      }
      if (action === "retry" || action === "retry-with" || action === "save-inline") {
        const host2 = button.closest(".mermaid[data-bsb-m]") || card?._bsbMermaidHost;
        const job = host2?._bsbMermaidJob || card?._bsbMermaidJob;
        if (!host2 || !job) {
          setStatus("重绘失败：没有找到该图对应的 Mermaid 源码", "err");
          return;
        }
        const box = host2.querySelector(".bsb-mermaid-error") || card;
        if (action === "save-inline") {
          const savedId = saveInlineMermaidProfile(box || host2);
          if (!savedId) return;
          job.preferredProfileId = savedId;
        } else {
          const picked = box?.querySelector('[data-role="mermaid-repair-model"]')?.value || "";
          if (picked) job.preferredProfileId = picked;
        }
        const targetRun = getActiveAiRun();
        const targetName = targetRun?.config?.name || targetRun?.config?.model || "当前模型";
        if (targetRun ? targetRun.busy : state2.aiBusy) {
          setStatus(`${targetName} 的 AI 笔记仍在生成，请完成或停止后再修复 Mermaid`, "err");
          return;
        }
        if (targetRun ? targetRun.mermaidRepairing : state2.mermaidRepairing) {
          setStatus(`${targetName} 已有 Mermaid 图正在重绘`, "err");
          return;
        }
        if (card?.closest(".bsb-mermaid-modal")) closeMermaidFullscreen();
        if (targetRun) targetRun.mermaidRepairing = true;
        else state2.mermaidRepairing = true;
        button.disabled = true;
        button.textContent = "重试中…";
        const originalCode = String(job.code || "");
        let activeCode = originalCode;
        try {
          setStatus(`Mermaid 图 ${job.idx + 1} · 正在用原代码重试…`);
          const local = await renderMermaidNode(host2, originalCode, job.idx, job.epoch, {
            force: true,
            maxAttempts: 1,
            showError: false,
            repaired: !!job.repaired,
            originalCode: job.originalCode || originalCode
          });
          if (local.ok) {
            setStatus(`Mermaid 图 ${job.idx + 1} 已重新渲染；代码未改变`, "ok");
            return;
          }
          button.textContent = "AI 修复中…";
          setStatus(`Mermaid 图 ${job.idx + 1} 本地重试失败，正在修复代码…`);
          activeCode = await requestMermaidCodeRepair(originalCode, local.error, job.idx, targetRun, job.preferredProfileId);
          if (activeCode.trim() === originalCode.trim()) {
            throw new Error("AI 返回的 Mermaid 代码与原代码相同，未完成修复");
          }
          button.textContent = "验证中…";
          const repairedResult = await renderMermaidNode(host2, activeCode, job.idx, job.epoch, {
            force: true,
            maxAttempts: 2,
            showError: false,
            repaired: true,
            originalCode
          });
          if (!repairedResult.ok) throw repairedResult.error || new Error("修复后的代码仍无法渲染");
          const persisted = persistRepairedMermaid(targetRun, job.idx, activeCode);
          if (persisted) {
            try {
              await persistAiSessionCache();
            } catch {
            }
          }
          const currentJob = host2._bsbMermaidJob;
          if (currentJob) {
            currentJob.code = activeCode;
            currentJob.repaired = true;
            currentJob.originalCode = originalCode;
            currentJob.persisted = persisted;
          }
          setStatus(
            `Mermaid 图 ${job.idx + 1} 修复成功：代码已替换并重新渲染${persisted ? "，已写回笔记源码与缓存" : ""}`,
            "ok"
          );
        } catch (err) {
          console.error("[bili-subbatch] mermaid repair", err);
          host2.dataset.bsbState = "error";
          host2._bsbMermaidJob = {
            code: originalCode,
            idx: job.idx,
            epoch: job.epoch,
            originalCode: job.originalCode || originalCode,
            repaired: false,
            preferredProfileId: job.preferredProfileId || ""
          };
          renderMermaidError(host2, originalCode, err, job.idx);
          setStatus(
            isMermaidSetupError(err) ? errorMessage(err) || "请在这张图里填写 API Key" : `Mermaid 图 ${job.idx + 1} 重绘失败：${errorMessage(err)}`,
            isMermaidSetupError(err) ? "" : "err"
          );
        } finally {
          if (targetRun) targetRun.mermaidRepairing = false;
          else state2.mermaidRepairing = false;
          if (button.isConnected) {
            button.disabled = false;
            button.textContent = "重绘";
          }
        }
        return;
      }
      if (!card) return;
      const viewport = card.querySelector(".bsb-mermaid-viewport");
      if (action === "fit") fitMermaidToViewport(card);
      else if (action === "actual") setMermaidScale(card, 1, "actual");
      else if (action === "zoom-in") setMermaidScale(card, getMermaidScale(card) + 0.15);
      else if (action === "zoom-out") setMermaidScale(card, getMermaidScale(card) - 0.15);
      else if (action === "fullscreen") {
        if (card.closest(".bsb-mermaid-modal")) closeMermaidFullscreen();
        else openMermaidFullscreen(card);
      }
      if (viewport && action === "actual") {
        viewport.scrollLeft = 0;
        viewport.scrollTop = 0;
      }
    }
    function enqueueMermaidRender(task) {
      const run = state2.mermaidQueue.catch(() => void 0).then(task);
      state2.mermaidQueue = run.then(() => void 0, () => void 0);
      return run;
    }
    function renderMermaidError(node, code, err, idx) {
      const message = err ? errorMessage(err) : "未知错误";
      const resolved = currentMermaidRepairResolution(getActiveAiRun(), node?._bsbMermaidJob?.preferredProfileId);
      const needsSetup = !!(isMermaidSetupError(err) || resolved.source === "none");
      node.replaceChildren();
      const box = document.createElement("section");
      box.className = needsSetup ? "bsb-mermaid-error is-setup" : "bsb-mermaid-error";
      const head = document.createElement("div");
      head.className = "bsb-mermaid-error-head";
      const title = document.createElement("strong");
      title.textContent = needsSetup ? `架构图 ${idx + 1} 还差一步：用 LLM 自动修好` : `架构流程图 ${idx + 1} 渲染失败`;
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "bsb-mermaid-tool";
      retry.dataset.mmdAct = "retry";
      retry.textContent = needsSetup ? "配好后再试" : "重绘";
      retry.title = needsSetup ? "先在这张卡片里选模型或填写 API Key" : "先用原代码重试；仍失败则用设置里的 LLM 修复此图";
      head.append(title, retry);
      const setup = document.createElement("div");
      setup.className = "bsb-mermaid-setup";
      const copy = document.createElement("p");
      copy.className = "bsb-mermaid-setup-copy";
      const readyName = String(resolved.config?.name || resolved.config?.model || resolved.readyProfiles[0]?.name || "");
      copy.textContent = needsSetup ? resolved.readyProfiles.length ? `笔记缓存不会保存 API Key。选一个已配置的模型（当前：${readyName || "未命名"}），点「用这个模型重绘」。` : "API Key 在「设置 → LLM」，不在这张图的源码里。也可以直接在下面填，不用去翻菜单。" : readyName ? `点「重绘」会先本地重试，不行就用「${readyName}」自动修语法。` : "点「重绘」会先本地重试，不行再用 LLM 修语法。";
      setup.appendChild(copy);
      if (needsSetup || !resolved.readyProfiles.length) {
        const path = document.createElement("div");
        path.className = "bsb-mermaid-setup-path";
        path.innerHTML = "<span>入口</span><b>设置</b><span>→</span><b>LLM</b><span>→</span><b>API Key</b>";
        setup.appendChild(path);
      }
      if (needsSetup && resolved.readyProfiles.length) {
        const row2 = document.createElement("div");
        row2.className = "bsb-mermaid-setup-row";
        const label = document.createElement("label");
        label.textContent = "用这个模型修";
        const select = document.createElement("select");
        select.dataset.role = "mermaid-repair-model";
        select.innerHTML = resolved.readyProfiles.map((p) => {
          const id = String(p.id || "");
          const name = String(p.name || p.model || "未命名");
          const selected = id && id === (resolved.config?.id || "");
          return `<option value="${escapeAttr(id)}"${selected ? " selected" : ""}>${escapeHtml(name)}</option>`;
        }).join("");
        label.appendChild(select);
        const useBtn = document.createElement("button");
        useBtn.type = "button";
        useBtn.className = "bsb-btn accent";
        useBtn.dataset.mmdAct = "retry-with";
        useBtn.textContent = "用这个模型重绘";
        row2.append(label, useBtn);
        setup.appendChild(row2);
      }
      if (!resolved.readyProfiles.length) {
        const grid = document.createElement("div");
        grid.className = "bsb-mermaid-setup-grid";
        grid.innerHTML = `
        <label>Base URL（含 /v1）<input type="text" data-mermaid-field="baseUrl" value="${escapeAttr(resolved.config?.baseUrl || "")}" placeholder="https://api.example.com/v1" autocomplete="off"></label>
        <label>API Key<input type="password" data-mermaid-field="apiKey" value="" placeholder="就填在这里，不用去翻设置" autocomplete="off"></label>
        <label>Model<input type="text" data-mermaid-field="model" value="${escapeAttr(resolved.config?.model || "")}" placeholder="gpt-4o-mini" autocomplete="off"></label>
      `;
        setup.appendChild(grid);
      }
      const actions = document.createElement("div");
      actions.className = "bsb-mermaid-setup-actions";
      if (!resolved.readyProfiles.length) {
        const saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.className = "bsb-btn primary";
        saveBtn.dataset.mmdAct = "save-inline";
        saveBtn.textContent = "保存到 LLM 并重绘";
        actions.appendChild(saveBtn);
      }
      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "bsb-btn ghost";
      openBtn.dataset.mmdAct = "open-llm";
      openBtn.textContent = "打开 设置 → LLM";
      actions.appendChild(openBtn);
      setup.appendChild(actions);
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = "查看 Mermaid 源码与错误";
      const pre = document.createElement("pre");
      const codeNode = document.createElement("code");
      codeNode.textContent = `${code}

${message}`;
      pre.appendChild(codeNode);
      details.append(summary, pre);
      box.append(head, setup, details);
      node.appendChild(box);
    }
    async function renderMermaidNode(node, code, idx, epoch, { force = false, maxAttempts, showError = true, repaired = false, originalCode = "" } = {}) {
      if (!node || epoch !== state2.renderEpoch) return { ok: false, aborted: true };
      if (!force && node.dataset.bsbState === "done") return { ok: true, skipped: true };
      if (node.dataset.bsbState === "rendering") return { ok: false, busy: true };
      const previousState = node.dataset.bsbState || "pending";
      const previousJob = node._bsbMermaidJob || null;
      const job = {
        code: stripMermaidTimestampCitations2(code),
        idx,
        epoch,
        repaired: !!repaired,
        originalCode: stripMermaidTimestampCitations2(originalCode || previousJob?.originalCode || code)
      };
      node._bsbMermaidJob = job;
      node.dataset.bsbState = "rendering";
      const attempts = Math.max(1, Number(maxAttempts) || (force ? 2 : 3));
      let lastError = null;
      for (let attempt = 0; attempt < attempts; attempt++) {
        try {
          const rendered = await enqueueMermaidRender(async () => {
            await ensureMermaid();
            if (attempt > 0 && typeof mermaid !== "undefined") {
              state2.renderLibs.mermaid = false;
              await ensureMermaid();
            }
            if (epoch !== state2.renderEpoch) return null;
            const id = `bsb-mmd-${Date.now()}-${idx}-${++state2.mermaidRenderSeq}`;
            return mermaid.render(id, job.code);
          });
          if (!rendered || epoch !== state2.renderEpoch) return { ok: false, aborted: true };
          const { svg } = rendered;
          const safeSvg = typeof DOMPurify !== "undefined" ? DOMPurify.sanitize(svg, {
            USE_PROFILES: { svg: true, svgFilters: true },
            ADD_ATTR: ["class", "style", "viewBox", "preserveAspectRatio", "role", "aria-label"]
          }) : svg;
          const tpl = document.createElement("template");
          tpl.innerHTML = safeSvg;
          const svgNode = tpl.content.querySelector("svg");
          if (!svgNode) throw new Error("Mermaid 未返回有效 SVG");
          node.replaceChildren(buildMermaidCard(svgNode, idx, node));
          node.dataset.bsbState = "done";
          return { ok: true, code: job.code, repaired: job.repaired };
        } catch (err) {
          lastError = err;
          if (epoch !== state2.renderEpoch) return { ok: false, aborted: true, error: err };
          if (attempt + 1 < attempts) await sleep(180 * (attempt + 1));
        }
      }
      if (showError) {
        node.dataset.bsbState = "error";
        renderMermaidError(node, job.code, lastError, idx);
      } else {
        node.dataset.bsbState = previousState;
        node._bsbMermaidJob = previousJob || job;
      }
      return { ok: false, error: lastError, code: job.code };
    }
    function scheduleMermaid(host2, blocks, epoch, scrollRoot) {
      const nodes = Array.from(host2.querySelectorAll(".mermaid[data-bsb-m]"));
      if (!nodes.length) return;
      if (state2.mermaidObserver) state2.mermaidObserver.disconnect();
      if ("IntersectionObserver" in window) {
        state2.mermaidObserver = new IntersectionObserver((entries, observer) => {
          for (const entry of entries) if (entry.isIntersecting) {
            observer.unobserve(entry.target);
            if (!(entry.target instanceof HTMLElement)) continue;
            const node = entry.target;
            const idx = Number(node.dataset.bsbM);
            renderMermaidNode(node, blocks[idx] || "", idx, epoch);
          }
        }, { root: scrollRoot || null, rootMargin: "320px 0px", threshold: 0.01 });
        nodes.forEach((node) => {
          node.dataset.bsbState = "pending";
          state2.mermaidObserver?.observe(node);
        });
      } else {
        nodes.forEach((node, idx) => renderMermaidNode(node, blocks[idx] || "", idx, epoch));
      }
    }
    const FOLIO_CLASS_ALLOW = /* @__PURE__ */ new Set([
      "bsb-folio",
      "kicker",
      "lede",
      "callout",
      "steps",
      "quote",
      "meta"
    ]);
    function extractHtmlFolioSource(text) {
      const raw = String(text || "");
      const fence = raw.match(/```html\s*\n([\s\S]*?)```/i);
      if (fence?.[1]) return String(fence[1]).trim();
      const article = raw.match(/<article\b[\s\S]*<\/article>/i);
      return article ? article[0].trim() : "";
    }
    function isHtmlFolioSource(text) {
      return !!extractHtmlFolioSource(text);
    }
    function extractFolioTitle(html) {
      const hit = String(html || "").match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
      if (!hit) return "";
      return stripHtml(hit[1]).replace(/\s+/g, " ").trim();
    }
    function sanitizeFolioHtml(html) {
      if (typeof DOMPurify === "undefined") return `<article class="bsb-folio"><p>${escapeHtml(stripHtml(html))}</p></article>`;
      return DOMPurify.sanitize(html, {
        USE_PROFILES: { html: true },
        SANITIZE_NAMED_PROPS: true,
        FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "link", "meta", "svg", "img", "video", "audio", "base"],
        ADD_TAGS: ["article", "header", "footer", "section", "aside", "figure", "figcaption", "mark", "nav"],
        ADD_ATTR: ["class", "id", "data-kind", "aria-label", "role"]
      });
    }
    function pruneFolioClasses(root) {
      root.querySelectorAll("[class]").forEach((el) => {
        const next = Array.from(el.classList).filter((name) => FOLIO_CLASS_ALLOW.has(name));
        if (next.length) el.className = next.join(" ");
        else el.removeAttribute("class");
      });
    }
    function slugFolioHeading2(text, index) {
      const fn = coreFn("slugFolioHeading");
      if (fn) return fn(text, index);
      const base = String(text || "").toLowerCase().replace(/[^\u4e00-\u9fff\w]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
      return `folio-${base || "s"}-${index + 1}`;
    }
    function collectFolioHeadings(article) {
      return Array.from(article.querySelectorAll("h2, h3")).map((el, index) => ({
        el,
        id: el.id || slugFolioHeading2(el.textContent, index),
        level: el.tagName === "H3" ? 3 : 2,
        text: String(el.textContent || "").replace(/\s+/g, " ").trim() || "未命名"
      }));
    }
    function decorateFolioArticle(article) {
      if (!article.classList.contains("bsb-folio")) article.classList.add("bsb-folio");
      const headings = collectFolioHeadings(article);
      headings.forEach((item) => {
        if (!item.el.id) item.el.id = item.id;
        item.id = item.el.id;
      });
      article.querySelectorAll("aside").forEach((aside) => {
        const kind = String(aside.getAttribute("data-kind") || "").toLowerCase();
        if (kind && !["key", "note", "warn"].includes(kind)) aside.removeAttribute("data-kind");
        aside.classList.add("callout");
      });
      return headings;
    }
    function folioOutlineFromHeadings(headings) {
      return coreCall("buildFolioOutline", headings.map((item) => ({
        id: item.id,
        level: item.level === 3 ? 3 : 2,
        text: item.text
      })));
    }
    function makeFolioTocLink(node, kind, index) {
      const link = document.createElement("button");
      link.type = "button";
      link.className = `bsb-folio-toc-link is-h${node.level}`;
      link.dataset.folioJump = node.id;
      if (kind === "h2") {
        const num2 = document.createElement("span");
        num2.className = "bsb-folio-toc-index";
        num2.textContent = coreFn("formatFolioChapterIndex") ? coreCall("formatFolioChapterIndex", index || 0) : String(index).padStart(2, "0");
        link.appendChild(num2);
      } else {
        const dot = document.createElement("span");
        dot.className = "bsb-folio-toc-dot";
        link.appendChild(dot);
      }
      const label = document.createElement("span");
      label.className = "bsb-folio-toc-label";
      label.textContent = node.text;
      link.appendChild(label);
      return link;
    }
    function buildFolioToc(headings) {
      const outline = folioOutlineFromHeadings(headings);
      const stats = coreCall("countFolioOutline", outline);
      const summary = coreCall("folioOutlineSummary", stats);
      const aside = document.createElement("aside");
      aside.className = "bsb-folio-toc";
      aside.setAttribute("aria-label", "阅读大纲");
      const head = document.createElement("header");
      head.className = "bsb-folio-toc-head";
      head.innerHTML = `<span class="bsb-folio-toc-kicker">目录</span><strong class="bsb-folio-toc-title">阅读大纲</strong><em class="bsb-folio-toc-meta">${escapeHtml(summary)}</em><span class="bsb-folio-toc-progress" aria-hidden="true"><i data-role="folio-progress"></i></span>`;
      const nav = document.createElement("nav");
      nav.className = "bsb-folio-toc-nav";
      outline.forEach((chapter, index) => {
        const item = document.createElement("div");
        item.className = `bsb-folio-toc-item${chapter.children.length ? " has-kids is-open" : ""}`;
        item.dataset.folioId = chapter.id;
        const row2 = document.createElement("div");
        row2.className = "bsb-folio-toc-row";
        const twist = document.createElement("button");
        twist.type = "button";
        twist.className = "bsb-folio-toc-twist";
        twist.dataset.folioTwist = "1";
        twist.setAttribute("aria-label", "展开或收起小节");
        twist.setAttribute("aria-expanded", chapter.children.length ? "true" : "false");
        row2.append(twist, makeFolioTocLink(chapter, "h2", index + 1));
        item.appendChild(row2);
        if (chapter.children.length) {
          const kids = document.createElement("div");
          kids.className = "bsb-folio-toc-kids";
          chapter.children.forEach((child) => kids.appendChild(makeFolioTocLink(child, "h3")));
          item.appendChild(kids);
        }
        nav.appendChild(item);
      });
      aside.append(head, nav);
      return aside;
    }
    function setFolioTocCurrent(shell, id) {
      const links = shell.querySelectorAll(".bsb-folio-toc-link");
      links.forEach((link) => {
        const on = link.dataset.folioJump === id;
        link.classList.toggle("is-current", on);
        if (on) {
          const item = link.closest(".bsb-folio-toc-item");
          if (item?.classList.contains("has-kids")) {
            item.classList.add("is-open");
            item.querySelector(".bsb-folio-toc-twist")?.setAttribute("aria-expanded", "true");
          }
          scrollFolioTocLinkIntoNav(link);
        }
      });
    }
    function scrollFolioTocLinkIntoNav(link) {
      const nav = link?.closest?.(".bsb-folio-toc-nav");
      if (!nav || !link) return;
      const navRect = nav.getBoundingClientRect();
      const linkRect = link.getBoundingClientRect();
      if (linkRect.top < navRect.top) nav.scrollTop -= navRect.top - linkRect.top + 10;
      else if (linkRect.bottom > navRect.bottom) nav.scrollTop += linkRect.bottom - navRect.bottom + 10;
    }
    function syncFolioTocViewport(shell, box) {
      const toc = shell?.querySelector(".bsb-folio-toc");
      if (!toc || !box) return;
      toc.style.setProperty("--folio-toc-h", `${Math.max(180, Math.round(box.clientHeight))}px`);
    }
    function updateFolioProgress(shell, box) {
      const bar = shell.querySelector("[data-role='folio-progress']");
      if (!bar || !box) return;
      const max = Math.max(1, box.scrollHeight - box.clientHeight);
      bar.style.width = `${Math.max(0, Math.min(100, box.scrollTop / max * 100))}%`;
    }
    function bindFolioToc(shell, scrollRoot) {
      const box = scrollRoot || shell.closest("[data-role='ai-md']");
      syncFolioTocViewport(shell, box);
      shell.addEventListener("click", (e) => {
        if (!(e.target instanceof Element)) return;
        if (e.target.closest?.("[data-folio-twist]")) {
          const item = e.target.closest(".bsb-folio-toc-item");
          if (!item?.classList.contains("has-kids")) return;
          const open = !item.classList.contains("is-open");
          item.classList.toggle("is-open", open);
          e.target.closest("[data-folio-twist]")?.setAttribute("aria-expanded", open ? "true" : "false");
          return;
        }
        if (e.target.closest?.("[data-folio-toc-fab]")) {
          shell.classList.toggle("is-toc-open");
          return;
        }
        if (e.target.closest?.("[data-folio-toc-scrim]")) {
          shell.classList.remove("is-toc-open");
          return;
        }
        const link = e.target.closest("[data-folio-jump]");
        if (!link) return;
        e.preventDefault();
        const target = shell.querySelector(`#${CSS.escape(link.dataset.folioJump || "")}`);
        if (!target) return;
        if (box) {
          const top = target.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 16;
          box.scrollTo({ top, behavior: "smooth" });
        } else {
          target.scrollIntoView({ block: "start", behavior: "smooth" });
        }
        target.classList.remove("folio-flash");
        void target.offsetWidth;
        target.classList.add("folio-flash");
        setFolioTocCurrent(shell, link.dataset.folioJump || "");
        shell.classList.remove("is-toc-open");
      });
      if (box) {
        const onScroll = () => {
          updateFolioProgress(shell, box);
          const headings = Array.from(shell.querySelectorAll(".bsb-folio h2, .bsb-folio h3"));
          if (!headings.length) return;
          const top = box.getBoundingClientRect().top + 28;
          let current = headings[0];
          for (const heading of headings) {
            if (heading.getBoundingClientRect().top - top <= 0) current = heading;
          }
          if (current?.id) setFolioTocCurrent(shell, current.id);
        };
        box.addEventListener("scroll", onScroll, { passive: true });
        const onResize = () => {
          syncFolioTocViewport(shell, box);
          updateFolioProgress(shell, box);
        };
        window.addEventListener("resize", onResize);
        if (typeof ResizeObserver === "function") {
          const ro = new ResizeObserver(onResize);
          ro.observe(box);
        }
        onResize();
        onScroll();
      }
    }
    function mountHtmlFolio(host2, sourceHtml, scrollRoot) {
      const raw = extractHtmlFolioSource(sourceHtml) || String(sourceHtml || "");
      const safe = sanitizeFolioHtml(raw);
      const tpl = document.createElement("template");
      tpl.innerHTML = safe;
      let article = tpl.content.querySelector("article");
      if (!article) {
        article = document.createElement("article");
        article.className = "bsb-folio";
        article.append(...tpl.content.childNodes);
      }
      pruneFolioClasses(article);
      const headings = decorateFolioArticle(article);
      const shell = document.createElement("div");
      shell.className = "bsb-folio-shell";
      shell.dataset.role = "html-folio";
      if (headings.length) {
        const fab = document.createElement("button");
        fab.type = "button";
        fab.className = "bsb-folio-toc-fab";
        fab.dataset.folioTocFab = "1";
        fab.textContent = "目录";
        const scrim = document.createElement("div");
        scrim.className = "bsb-folio-toc-scrim";
        scrim.dataset.folioTocScrim = "1";
        shell.append(fab, scrim, buildFolioToc(headings));
      }
      const frame = document.createElement("div");
      frame.className = "bsb-folio-frame";
      frame.appendChild(article);
      shell.appendChild(frame);
      host2.replaceChildren(shell);
      bindFolioToc(shell, scrollRoot);
      if (headings[0]) setFolioTocCurrent(shell, headings[0].id);
      requestAnimationFrame(() => syncFolioTocViewport(shell, scrollRoot || shell.closest("[data-role='ai-md']")));
      return shell;
    }
    function folioExportTokenCss(flavor) {
      const palette = getCtpPalette(flavor);
      return Object.entries(palette).map(([key, hex]) => `--ctp-${key}:${hex};`).join("");
    }
    function buildStandaloneFolioHtml(title, sourceHtml, flavor) {
      const raw = extractHtmlFolioSource(sourceHtml) || String(sourceHtml || "");
      const safe = sanitizeFolioHtml(raw);
      const tokens = folioExportTokenCss(flavor);
      const pageTitle = escapeHtml(title || "阅读页");
      return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${pageTitle}</title>
<style>
:root{${tokens}}
*{box-sizing:border-box}
html,body{margin:0;background:var(--ctp-base);color:var(--ctp-text)}
body{padding:48px 20px 80px}
.bsb-folio{max-width:40rem;margin:0 auto;font-family:"Iowan Old Style","Palatino Linotype",Palatino,"Songti SC","Source Han Serif SC","Noto Serif SC",Georgia,serif;font-size:18px;line-height:1.72}
.bsb-folio .kicker{margin:0 0 .7em;font-family:Inter,ui-sans-serif,system-ui,sans-serif;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ctp-overlay0)}
.bsb-folio h1{margin:0 0 .55em;font-size:1.8em;font-weight:650;line-height:1.22;letter-spacing:-.02em}
.bsb-folio .lede{margin:0 0 1.8em;color:var(--ctp-subtext0)}
.bsb-folio section{margin:0 0 2em}
.bsb-folio h2{margin:0 0 .7em;font-size:1.2em}
.bsb-folio p{margin:0 0 .9em}
.bsb-folio aside{margin:1.1em 0;padding:.75em 1em;border-left:2px solid var(--ctp-lavender);background:color-mix(in srgb,var(--ctp-surface0) 42%,transparent);border-radius:0 10px 10px 0}
.bsb-folio aside[data-kind="key"]{border-left-color:var(--ctp-yellow)}
.bsb-folio aside[data-kind="warn"]{border-left-color:var(--ctp-peach)}
.bsb-folio aside[data-kind="note"]{border-left-color:var(--ctp-sapphire)}
.bsb-folio blockquote,.bsb-folio figure.quote{margin:1.15em 0;padding:0 0 0 1em;border-left:2px solid var(--ctp-overlay0);color:var(--ctp-subtext1);font-style:italic}
.bsb-folio mark{background:color-mix(in srgb,var(--ctp-yellow) 38%,transparent)}
.bsb-folio table{width:100%;border-collapse:collapse;font-size:.92em}
.bsb-folio th,.bsb-folio td{text-align:left;padding:.45em .55em;border-bottom:1px solid var(--ctp-surface1)}
.bsb-folio pre{padding:12px 14px;border-radius:10px;overflow:auto;background:var(--ctp-crust)}
.bsb-folio :not(pre)>code{background:var(--ctp-surface0);padding:.08em .35em;border-radius:5px}
</style>
</head>
<body>${safe}</body>
</html>
`;
    }
    async function renderAiMarkdown(md, { streaming = false } = {}) {
      const root = ensurePanel();
      const box = root.querySelector('[data-role="ai-md"]');
      const host2 = root.querySelector('[data-role="ai-content"]') || box;
      if (!host2) return;
      if (streaming) return paintAiStreamText(md);
      closeMermaidFullscreen();
      if (state2.aiPaintTimer) {
        clearTimeout(state2.aiPaintTimer);
        state2.aiPaintTimer = 0;
      }
      if (state2.aiPaintRaf) {
        cancelAnimationFrame(state2.aiPaintRaf);
        state2.aiPaintRaf = 0;
      }
      const epoch = ++state2.renderEpoch;
      const originalSource = String(md || "");
      const source = sanitizeMermaidTimestampCitationsInMarkdown2(originalSource);
      if (source !== originalSource) {
        const activeRun = getActiveAiRun();
        if (activeRun && String(activeRun.raw || "") === originalSource) {
          activeRun.raw = source;
          syncActiveRunBridge(activeRun);
        } else if (String(state2.aiRaw || "") === originalSource) {
          state2.aiRaw = source;
        }
      }
      if (isHtmlFolioSource(source)) {
        try {
          await ensureMarkdownCore();
        } catch {
        }
        if (epoch !== state2.renderEpoch) return;
        mountHtmlFolio(host2, source, box);
        if (box && !box.querySelector('[data-role="ai-anchor"]')) {
          const a = document.createElement("div");
          a.className = "bsb-ai-anchor";
          a.dataset.role = "ai-anchor";
          box.appendChild(a);
        }
        if (box) {
          state2.aiProgScroll = true;
          box.scrollTop = 0;
          requestAnimationFrame(() => {
            state2.aiProgScroll = false;
          });
        }
        state2.aiStickBottom = false;
        state2.aiUserReading = true;
        updateJumpLatestBtn();
        return;
      }
      const needsMath = hasMathSyntax(source);
      const needsCode = hasCodeSyntax(source);
      const needsMermaid = hasMermaidSyntax(source);
      try {
        await ensureMarkdownCore();
        if (needsMath) await ensureKatex();
      } catch {
        host2.innerHTML = simpleMarkdownFallback(source) + `<p style="color:var(--ctp-peach)">增强渲染库加载失败，已使用安全简易渲染。</p>`;
        if (box) box.scrollTop = 0;
        return;
      }
      if (epoch !== state2.renderEpoch) return;
      const { md: mdMath, maths } = prepareMarkdownMath(source);
      const mermaidBlocks = [];
      const md2 = mdMath.replace(/```mermaid\s*\n([\s\S]*?)```/gi, (_, code) => {
        const i = mermaidBlocks.length;
        mermaidBlocks.push(code.trim());
        return `

<div class="mermaid" data-bsb-m="${i}">${escapeHtml(code.trim())}</div>

`;
      });
      let html;
      try {
        html = marked.parse(md2);
      } catch {
        html = simpleMarkdownFallback(md2);
      }
      if (maths.length) html = replaceMathPlaceholders(html, maths, katexToHtml);
      html = sanitizeRenderedHtml(html);
      if (!await replaceHostInBatches(host2, html, epoch)) return;
      host2.querySelectorAll("a[href]").forEach((a) => {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      });
      linkifyTimestamps(host2);
      buildToc(host2);
      if (needsMermaid) scheduleMermaid(host2, mermaidBlocks, epoch, box);
      if (needsCode) await enhanceCodeBlocks(host2, epoch);
      if (box && !box.querySelector('[data-role="ai-anchor"]')) {
        const a = document.createElement("div");
        a.className = "bsb-ai-anchor";
        a.dataset.role = "ai-anchor";
        box.appendChild(a);
      }
      if (box) {
        state2.aiProgScroll = true;
        box.scrollTop = 0;
        requestAnimationFrame(() => {
          state2.aiProgScroll = false;
        });
      }
      state2.aiStickBottom = false;
      state2.aiUserReading = true;
      updateJumpLatestBtn();
    }
    function requestChatCompletion(opts) {
      const runtime2 = opts.runtime || createAiRuntime(opts.model || "AI");
      return appCall("ai.request", {
        ...opts,
        runtime: runtime2,
        network: runtimeNetwork(),
        pageHref: location.href
      });
    }
    function abortPreprocessChildRuntime(runtime2) {
      if (!runtime2) return;
      runtime2.abort = true;
      try {
        runtime2.abortController?.abort();
      } catch {
      }
      try {
        runtime2.xhr?.abort?.();
      } catch {
      }
    }
    async function requestPreprocessChunk(runtime2, cfg, prompt2, vars, statusPrefix) {
      const messages = buildAiMessagesForProfile(cfg, vars, prompt2);
      if (!messages.length) throw new Error("预处理 Prompt 为空");
      let latest = "";
      return await new Promise((resolve2, reject) => {
        requestChatCompletion({
          runtime: runtime2,
          baseUrl: cfg.baseUrl || "",
          apiKey: cfg.apiKey || "",
          model: cfg.model || "",
          ...cfg.temperature === void 0 ? {} : { temperature: cfg.temperature },
          ...cfg.maxTokens === void 0 ? {} : { maxTokens: cfg.maxTokens },
          messages,
          stream: cfg.stream !== false,
          onStatus(msg) {
            if (runtime2.abort || state2.aiAbort) return;
            if (state2.preprocessRun) state2.preprocessRun.statusText = `${statusPrefix} · ${msg}`;
            renderAiResultTabs();
            setStatus(`预处理 · ${statusPrefix} · ${msg}`);
          },
          onDelta(_delta, full) {
            latest = String(full || "");
            if (state2.aiViewingPreprocess && state2.preprocessRun) {
              state2.preprocessRun.preview = `### ${statusPrefix}

${latest}`;
              paintAiStreamText(state2.preprocessRun.preview || "正在规范化字幕…");
            }
          },
          onDone(full) {
            resolve2(String(full || latest || "").trim());
          },
          onError(err) {
            reject(err instanceof Error ? err : new Error(String(err || "预处理失败")));
          }
        });
      });
    }
    async function preprocessItemsForAi(items, prompt2, cfg) {
      const settings2 = appCall("preprocess.settings", state2);
      const modelName = cfg.name || cfg.model;
      return SubBatch2.SubBatchMonorepo.app.preprocess.runPipeline(items, prompt2.name, modelName, settings2, {
        createRuntime: () => createAiRuntime("字幕预处理 · " + modelName),
        onStart: (run) => {
          state2.preprocessRun = run;
          state2.aiViewingPreprocess = true;
          renderAiResultTabs();
          setAiBusy(true);
        },
        onUpdate: () => renderAiResultTabs(),
        onComplete: () => {
          if (currentAiWorkbenchStage() === "preprocess" && state2.aiInputView === "processed") {
            renderPreprocessCanvas().catch(() => {
            });
          }
        },
        isCancelled: (run) => !!state2.aiAbort || !!run.runtime.abort,
        abortChild: (child) => abortPreprocessChildRuntime(child),
        getRaw: (item) => coreCall("cuesToAiText", item.data || [], item.bvid, item.page || 1),
        cacheKey: (item, raw) => coreCall("preprocessCacheKey", item, raw, prompt2, cfg, settings2),
        readCache: (key) => persistentCache.read(key),
        split: (item) => coreCall("splitCuesForPreprocess", { ...item, data: item.data || [] }, settings2),
        forceRefresh: state2.forcePreprocessOnce,
        cacheModel: cfg.model,
        runPool: (jobs, concurrency, handler, cancelled) => SubBatch2.SubBatchMonorepo.app.ai.runPool(jobs, concurrency, handler, cancelled),
        runChunk: (job, workerId, run) => SubBatch2.SubBatchMonorepo.app.preprocess.runChunkWithRetry(job, settings2.retries, workerId, {
          isCancelled: () => !!state2.aiAbort || !!run.runtime.abort,
          createRuntime: (label) => createAiRuntime(label),
          register: (child) => run.childRuntimes.add(child),
          unregister: (child) => run.childRuntimes.delete(child),
          abort: (child) => abortPreprocessChildRuntime(child),
          formatClock: (seconds) => coreCall("formatClock", seconds),
          execute: (child, vars, label) => requestPreprocessChunk(child, cfg, prompt2, vars, label),
          onRetry: (label) => {
            run.statusText = label + " · 失败，准备重试";
          },
          sleep
        }),
        stitch: (chunks, outputs) => coreCall("stitchPreprocessChunks", chunks, outputs),
        writeCache: (key, value) => persistentCache.write(key, value, PREPROCESS_CACHE_TTL_MS)
      });
    }
    async function selectPreprocessResult() {
      const run = state2.preprocessRun;
      if (!run) return;
      if (state2.ui) state2.ui.aiStage = "preprocess";
      state2.aiInputView = "processed";
      applyAiWorkbenchStageUi();
      state2.aiViewingPreprocess = true;
      state2.renderEpoch += 1;
      state2.aiStickBottom = !!run.busy;
      state2.aiUserReading = !run.busy;
      renderAiResultTabs();
      const text = run.raw || run.preview || "";
      if (run.busy) paintAiStreamText(text || "正在规范化字幕…");
      else if (text) await renderAiMarkdown(text, { streaming: false });
      else {
        const content2 = ensurePanel().querySelector('[data-role="ai-content"]');
        if (content2) content2.innerHTML = `<div class="bsb-empty"><div class="bsb-empty-ico">◌</div><strong>预处理稿</strong><span>${escapeHtml(run.statusText || "暂无内容")}</span></div>`;
      }
      setStatus(`预处理 · ${run.promptName || "字幕规范化"} · ${run.statusText || run.status}`, run.status === "error" ? "err" : run.status === "done" ? "ok" : void 0);
    }
    function buildAiMessagesForProfile(_cfg, vars, promptProfile) {
      const prompt2 = promptProfile ? coreCall("createPromptProfile", promptProfile, 0) : null;
      if (!prompt2) return [];
      const system = renderPromptTemplate2(prompt2.systemPrompt, vars).trim();
      const user = renderPromptTemplate2(prompt2.userPromptTemplate, vars).trim();
      return [
        system ? { role: "system", content: system } : null,
        user ? { role: "user", content: user } : null
      ].filter((message) => message !== null);
    }
    function isCurrentAiRun(run) {
      return !!run && state2.aiRuns.get(run.id) === run;
    }
    function updateAiRun(run, patch) {
      Object.assign(run, patch || {});
      if (!isCurrentAiRun(run)) return;
      if (run.id === state2.aiActiveRunId) syncActiveRunBridge(run);
      renderAiResultTabs();
      setAiBusy(anyAiRunBusy());
    }
    async function runAiProfile(run, vars, promptProfile, commonMeta) {
      if (!isCurrentAiRun(run)) return run;
      const cfg = run.config;
      run.abort = false;
      updateAiRun(run, {
        busy: true,
        status: "running",
        statusText: `正在连接 · max_tokens=${cfg.maxTokens}`,
        startedAt: Date.now(),
        sourceBvids: [...commonMeta.sourceBvids || []]
      });
      const messages = buildAiMessagesForProfile(cfg, vars, promptProfile);
      if (!messages.length) {
        updateAiRun(run, { busy: false, status: "error", statusText: "提示词为空", error: "当前提示词没有可发送内容" });
        return run;
      }
      const useStream = cfg.stream !== false;
      try {
        await new Promise((resolve2, reject) => {
          requestChatCompletion({
            runtime: run,
            baseUrl: cfg.baseUrl || "",
            apiKey: cfg.apiKey || "",
            model: cfg.model || "",
            ...cfg.temperature === void 0 ? {} : { temperature: cfg.temperature },
            ...cfg.maxTokens === void 0 ? {} : { maxTokens: cfg.maxTokens },
            messages,
            stream: useStream,
            onStatus(msg) {
              if (!isCurrentAiRun(run)) return;
              run.statusText = msg;
              if (run.id === state2.aiActiveRunId) setStatus(`${run.promptName || "产物"} · ${cfg.name || cfg.model} · ${msg}`);
              renderAiResultTabs();
            },
            onDelta(_delta, full) {
              if (!isCurrentAiRun(run)) return;
              run.raw = sanitizeMermaidTimestampCitationsInMarkdown2(full);
              if (run.id === state2.aiActiveRunId) {
                syncActiveRunBridge(run);
                if (currentAiWorkbenchStage() === "postprocess") paintAiStreamText(run.raw);
              }
            },
            onDone(full) {
              if (isCurrentAiRun(run)) {
                run.raw = sanitizeMermaidTimestampCitationsInMarkdown2(full || run.raw || "");
              }
              resolve2();
            },
            onError(err) {
              reject(err instanceof Error ? err : new Error(String(err || "AI 请求失败")));
            }
          });
        });
        if (!isCurrentAiRun(run)) return run;
        if (run.abort || state2.aiAbort) {
          if (run.raw && !/\*\(已停止\)\*\s*$/.test(run.raw)) run.raw += "\n\n*(已停止)*";
          updateAiRun(run, { busy: false, status: "stopped", statusText: "已停止", finishedAt: Date.now() });
        } else {
          updateAiRun(run, {
            busy: false,
            status: "done",
            statusText: `完成 · ${run.raw.length} 字符`,
            finishedAt: Date.now()
          });
        }
      } catch (error) {
        if (!isCurrentAiRun(run)) return run;
        const message = String(errorMessage(error) || "未知错误");
        if (run.abort || state2.aiAbort || /用户停止|abort/i.test(message)) {
          if (run.raw && !/\*\(已停止\)\*\s*$/.test(run.raw)) run.raw += "\n\n*(已停止)*";
          updateAiRun(run, { busy: false, status: "stopped", statusText: "已停止", finishedAt: Date.now() });
        } else {
          run.error = message;
          if (run.raw) run.raw += `

> 错误：${message}`;
          updateAiRun(run, { busy: false, status: "error", statusText: `失败 · ${message.slice(0, 80)}`, finishedAt: Date.now() });
          console.error(`[bili-subbatch] ai ${cfg.name || cfg.model}`, error);
        }
      }
      if (isCurrentAiRun(run) && run.id === state2.aiActiveRunId) {
        syncActiveRunBridge(run);
        if (currentAiWorkbenchStage() === "postprocess") {
          if (run.raw) await renderAiMarkdown(run.raw, { streaming: false });
          else await selectAiRun(run.id);
        }
      }
      if (isCurrentAiRun(run)) persistAiSessionCache().catch(() => {
      });
      return run;
    }
    let aiBatchCoordinator = null;
    async function doAiAnalyze(options = {}) {
      const automatic = !!options.automatic;
      if (state2.aiBusy) {
        if (!automatic) setStatus("已有 AI 批次仍在生成；再次点击“送去 AI”可选择停止并重新分析", "err");
        return;
      }
      if (operationBusy()) {
        state2.pendingAiSend = true;
        setStatus("扫描或字幕任务仍在运行 · 已排队，结束后自动送入 AI");
        return;
      }
      const forceAll = !!state2.forcePreprocessOnce || !!options.forceAll;
      const routeKeyForCache = options.expectedRouteKey || currentRouteVideoKey();
      let cachedPayload = null;
      if (!forceAll && routeKeyForCache && coreFn("aiSessionCacheKey") && coreFn("isUsableAiSessionCache")) {
        try {
          const rec = await persistentCache.read(coreCall("aiSessionCacheKey", routeKeyForCache));
          if (rec && coreCall("isUsableAiSessionCache", rec.value)) cachedPayload = rec.value;
        } catch {
        }
      }
      const root = ensurePanel();
      let profiles;
      let promptLibrary;
      if (automatic) {
        profiles = state2.aiProfiles?.length ? state2.aiProfiles : loadAiProfiles();
        state2.aiProfiles = profiles;
        promptLibrary = loadPromptProfiles();
      } else {
        try {
          profiles = saveAiProfilesFromForm();
        } catch {
          profiles = loadAiProfiles();
          state2.aiProfiles = profiles;
        }
        try {
          promptLibrary = savePromptProfilesFromForm({ activeId: state2.activePromptId });
        } catch {
          promptLibrary = loadPromptProfiles();
        }
      }
      const preprocessPrompt = promptLibrary.prompts.find((p) => p.id === state2.activePrePromptId && p.stage === "preprocess") || null;
      if (state2.preprocessEnabled && (!preprocessPrompt || !preprocessPrompt.systemPrompt.trim() && !preprocessPrompt.userPromptTemplate.trim())) {
        setStatus("输入整理已开启，但没有可用的 PRE Prompt", "err");
        if (!automatic) setWorkspace("settings");
        return;
      }
      if (!automatic) toggleAiPanel(true);
      const configuredTasks = (automatic ? currentPostTasks() : savePostTasks(currentPostTasks())).filter((t) => t.enabled !== false);
      const planned = SubBatch2.SubBatchMonorepo.app.ai.planTasks(configuredTasks, promptLibrary.prompts, profiles);
      const taskPlans = planned.plans;
      if (!taskPlans.length) {
        setStatus("当前处理方案没有可运行的产物：请为至少一个 POST Prompt 选择已启用的 LLM", "err");
        if (!automatic) setAiDrawer("flow");
        return;
      }
      const plannedRuns = planned.runs;
      const partitionFn = SubBatch2.SubBatchMonorepo.app.ai.partitionRuns;
      const skipPrepareFn = coreFn("shouldSkipPrepareForCachedSession");
      if (!forceAll && cachedPayload && typeof partitionFn === "function") {
        const preview = partitionFn(plannedRuns, cachedPayload.runs, "");
        const skipPrepare = typeof skipPrepareFn === "function" ? skipPrepareFn(plannedRuns.length, preview.generate.length, preview.reuse.length, { automatic, force: forceAll }) : automatic && preview.generate.length === 0 && preview.reuse.length === plannedRuns.length;
        if (skipPrepare) {
          try {
            const restored = await restoreAiSessionForRoute(routeKeyForCache);
            if (restored) {
              setStatus(`已从缓存恢复 ${preview.reuse.length} 个模型版本 · 改模型后点“运行”只会重跑变化项`, "ok");
              return;
            }
          } catch {
          }
        }
      }
      const invalid = planned.invalid;
      if (invalid.length) {
        setStatus(`以下产物引用的 LLM 配置不完整：${invalid.map((x) => x.name || x.model).join("、")}`, "err");
        if (!automatic) {
          setWorkspace("settings");
          setSettingsTab("llm");
        }
        return;
      }
      const preprocessConfig = state2.preprocessEnabled ? getPreprocessModelConfig(profiles) : null;
      if (state2.preprocessEnabled && !preprocessConfig) {
        setStatus("预处理已开启，但没有可用的 LLM 配置", "err");
        if (!automatic) setWorkspace("settings");
        return;
      }
      const explicitTargets = Array.isArray(options.targets) ? options.targets.filter(Boolean) : null;
      let targets = explicitTargets ? [...explicitTargets] : selectedItems();
      if (!targets.length && !explicitTargets) {
        if (!state2.items.length) {
          try {
            await doScan();
          } catch {
          }
        }
        targets = selectedItems();
      }
      if (options.expectedRouteKey && currentRouteVideoKey() !== options.expectedRouteKey) return;
      if (!targets.length) {
        setStatus("请先扫描并勾选要分析的视频", "err");
        return;
      }
      state2.aiAbort = false;
      state2.aiRuns = /* @__PURE__ */ new Map();
      state2.aiRunOrder = [];
      state2.aiActiveRunId = "";
      state2.preprocessRun = null;
      state2.aiViewingPreprocess = false;
      const sessionId = ++state2.aiSessionSeq;
      aiBatchCoordinator ||= appCall("ai.createCoordinator");
      const batch = aiBatchCoordinator.begin(String(sessionId));
      for (const plan of taskPlans) {
        for (const profile2 of plan.models) {
          const run = createAiRun(profile2, sessionId, plan.task, plan.prompt);
          state2.aiRuns.set(run.id, run);
          state2.aiRunOrder.push(run.id);
        }
      }
      state2.aiActiveTaskId = taskPlans[0]?.task?.id || "";
      state2.aiActiveRunId = state2.aiRunOrder.find((id) => state2.aiRuns.get(id)?.taskId === state2.aiActiveTaskId) || state2.aiRunOrder[0] || "";
      syncActiveRunBridge(getActiveAiRun());
      renderAiResultTabs();
      setAiBusy(true);
      setStatus(`准备输入 · ${taskPlans.length} 个产物 · ${state2.aiRunOrder.length} 个模型版本…`);
      const contentHost = root.querySelector('[data-role="ai-content"]');
      if (contentHost && currentAiWorkbenchStage() === "postprocess") {
        contentHost.innerHTML = `<div class="bsb-empty"><div class="bsb-empty-ico">◌</div><strong>正在准备后处理输入…</strong><span>${state2.preprocessEnabled ? "字幕只规范化一次，然后共享给" : "原始字幕将直接发送给"} ${taskPlans.length} 个后处理产物</span></div>`;
      } else if (currentAiWorkbenchStage() === "preprocess") {
        await renderPreprocessCanvas();
      }
      try {
        const ready = await batch.stage(() => SubBatch2.SubBatchMonorepo.app.ai.ensureSubtitles(targets, state2.delayMs, {
          cancelled: () => !!state2.aiAbort,
          onFetching: (item, index, total) => setStatus("AI 准备字幕 " + (index + 1) + "/" + total + " · " + item.bvid + "…"),
          fetchSubtitle: (bvid, page) => fetchSubtitle(bvid, page),
          onUpdated: () => renderList(),
          sleep
        }));
        if (options.expectedRouteKey && currentRouteVideoKey() !== options.expectedRouteKey) throw new Error("页面已切换到其他视频");
        if (!ready.length) {
          batch.finish("error");
          state2.aiRunOrder.forEach((id) => {
            const run = state2.aiRuns.get(id);
            if (run) updateAiRun(run, { busy: false, status: "error", statusText: "无可用字幕", error: "勾选项均无字幕" });
          });
          setStatus("勾选项均无字幕，无法发送 AI", "err");
          return;
        }
        if (state2.aiAbort) throw new Error("用户停止");
        const rawBuilt = buildSubtitlePayload(ready);
        let stageInput = rawBuilt;
        if (state2.preprocessEnabled && preprocessPrompt && preprocessConfig) {
          setStatus(`阶段 1/2 · 字幕预处理 · ${preprocessPrompt.name} · ${preprocessConfig.name || preprocessConfig.model}`);
          stageInput = await batch.stage(() => preprocessItemsForAi(ready, preprocessPrompt, preprocessConfig));
          if (state2.aiAbort) throw new Error("用户停止");
        }
        const { cut, vars, commonMeta, sourceBvids } = appCall(
          "ai.prepareBatchInput",
          ready,
          rawBuilt,
          stageInput,
          !!state2.preprocessEnabled,
          (text) => coreCall("truncateForAi", text, MAX_SUBTITLE_CHARS),
          preprocessPrompt?.name || "",
          preprocessConfig?.name || preprocessConfig?.model || ""
        );
        const sessionRouteKey = options.expectedRouteKey || currentRouteVideoKey();
        state2.aiSessionRouteKey = sessionRouteKey;
        state2.aiSessionInput = appCall("ai.cloneSessionInput", {
          sessionId,
          routeKey: sessionRouteKey,
          vars,
          taskSnapshots: taskPlans.map((plan) => ({ task: { ...plan.task, modelIds: [...plan.task.modelIds || []] }, prompt: { ...plan.prompt } })),
          preprocessPrompt: preprocessPrompt ? { ...preprocessPrompt } : null,
          preprocessConfig: preprocessConfig ? { ...preprocessConfig } : null,
          preprocessEnabled: !!state2.preprocessEnabled,
          commonMeta
        }, sessionId);
        state2.aiRunOrder.forEach((id) => {
          const run = state2.aiRuns.get(id);
          if (run) run.sourceBvids = [...sourceBvids];
        });
        state2.aiViewingPreprocess = false;
        renderAiResultTabs();
        renderAiInputDrawer();
        refreshAiChips();
        if (currentAiWorkbenchStage() === "preprocess") await renderPreprocessCanvas();
        const inputHash = coreCall("aiSessionInputHash", vars);
        const split = !forceAll && cachedPayload && typeof partitionFn === "function" ? partitionFn(plannedRuns, cachedPayload.runs, inputHash) : { reuse: [], generate: plannedRuns };
        const { reused, generateIds } = SubBatch2.SubBatchMonorepo.app.ai.hydratePlannedRuns(
          state2.aiRunOrder.map((id) => state2.aiRuns.get(id)).filter((run) => !!run),
          split,
          sourceBvids,
          (cached) => coreCall("draftHydratedAiRun", cached)
        );
        renderAiResultTabs();
        if (state2.aiActiveRunId) {
          const active = state2.aiRuns.get(state2.aiActiveRunId);
          if (active?.raw && !active.busy) syncActiveRunBridge(active);
        }
        if (!generateIds.length) {
          batch.finish();
          setStatus(`已复用缓存 · ${reused} 个模型版本 · 未调用模型`, "ok");
          if (state2.aiActiveRunId) await selectAiRun(state2.aiActiveRunId);
          persistAiSessionCache().catch(() => {
          });
          return;
        }
        setStatus(`复用缓存 ${reused} · 新生成 ${generateIds.length} · ${ready.length} 条字幕${cut.truncated ? " · 输入已截断" : ""}`);
        const outcome = await batch.stage(() => appCall("ai.executeTasks", generateIds.map((id) => async () => {
          const run = state2.aiRuns.get(id);
          if (!run) throw new Error("AI run was replaced");
          return runAiProfile(run, vars, run.promptProfile, commonMeta);
        })));
        batch.finish(state2.aiAbort ? "stopped" : outcome.status);
        if (sessionId === state2.aiSessionSeq) summarizeAiRuns(reused ? "部分模型复用缓存后生成结束" : "全部产物生成结束");
      } catch (error) {
        const message = String(errorMessage(error));
        batch.finish(state2.aiAbort ? "stopped" : "error");
        if (sessionId === state2.aiSessionSeq) {
          if (!state2.aiAbort) setStatus(`AI 准备失败: ${message}`, "err");
          abortAllAiRuns();
          state2.aiRunOrder.forEach((id) => {
            const run = state2.aiRuns.get(id);
            if (!run || ["done", "error", "stopped"].includes(run.status)) return;
            updateAiRun(run, {
              busy: false,
              status: state2.aiAbort ? "stopped" : "error",
              statusText: state2.aiAbort ? "已停止" : `准备失败 · ${message.slice(0, 80)}`,
              error: state2.aiAbort ? "" : message
            });
          });
        }
      } finally {
        if (sessionId === state2.aiSessionSeq) {
          setAiBusy(anyAiRunBusy());
          if (!anyAiRunBusy()) state2.aiAbort = false;
          if (state2.aiPaintRaf) {
            cancelAnimationFrame(state2.aiPaintRaf);
            state2.aiPaintRaf = 0;
          }
          if (state2.aiPaintTimer) {
            clearTimeout(state2.aiPaintTimer);
            state2.aiPaintTimer = 0;
          }
          persistAiSessionCache().catch(() => {
          });
        }
      }
    }
    async function ensureCollectionContext(ctx) {
      if (!ctx || ctx.type !== "collection") return ctx;
      if (ctx.mid && ctx.season_id) return ctx;
      const bvid = ctx.bvid || extractBvid2(location.href);
      if (!bvid) return ctx;
      try {
        const detail = await appCall("acquisition.fetchVideoDetail", runtimeNetwork(), bvid);
        const view2 = detail && detail.data && detail.data.View || {};
        const season = view2.ugc_season || {};
        const mid = season.mid || view2.owner?.mid || ctx.mid;
        const seasonId = season.id || ctx.season_id;
        if (mid) ctx.mid = String(mid);
        if (seasonId) ctx.season_id = String(seasonId);
        if (season.title && !ctx.collectionTitleHint) ctx.collectionTitleHint = String(season.title);
        if (view2.owner?.name && !ctx.authorHint) ctx.authorHint = String(view2.owner.name);
      } catch (error) {
        console.warn("[bili-subbatch] ensureCollectionContext", errorMessage(error));
      }
      return ctx;
    }
    async function stampUgcSeasonGroupMeta(items, bvid) {
      const list = items || [];
      if (!list.length) return list;
      const id = bvid || list[0]?.bvid;
      if (!id) return list;
      try {
        const detail = await appCall("acquisition.fetchVideoDetail", runtimeNetwork(), id);
        const view2 = detail && detail.data && detail.data.View || {};
        if (!view2.ugc_season?.id) return list;
        return applyUgcSeasonToItems2(list, view2);
      } catch (error) {
        console.warn("[bili-subbatch] stampUgcSeasonGroupMeta", errorMessage(error));
        return list;
      }
    }
    async function doScan() {
      if (state2.scanBusy) {
        state2.cancelScan = true;
        state2.pendingRescan = true;
        setStatus("当前扫描仍在运行 · 正在停止，随后自动重新扫描");
        return;
      }
      if (state2.batchBusy) {
        state2.cancel = true;
        state2.cancelBatch = true;
        state2.pendingRescan = true;
        setStatus("字幕任务仍在运行 · 正在停止，随后自动扫描当前页");
        return;
      }
      const scanId = ++state2.scanSeq;
      refreshContextUI();
      let ctx = resolveContext();
      state2.ctx = ctx;
      state2.cancel = false;
      state2.cancelScan = false;
      state2.scanPaused = false;
      setScanBusy(true);
      setLibraryJob({ kind: "scan", index: 0, total: 0, label: "识别页面" });
      setStatus("扫描中…");
      try {
        const root = ensurePanel();
        state2.maxPages = Math.max(
          1,
          Math.min(100, Number(root.querySelector('[data-role="max-pages"]')?.value) || DEFAULT_MAX_PAGES)
        );
        state2.delayMs = Math.max(
          0,
          Math.min(5e3, Number(root.querySelector('[data-role="delay"]')?.value) || DEFAULT_DELAY_MS)
        );
        if (ctx.type === "collection") {
          setStatus("解析合集信息…");
          ctx = await ensureCollectionContext(ctx);
          state2.ctx = ctx;
        }
        if (ctx.type === "video" && state2.mode !== "video" && state2.mode !== "selection") {
          setStatus("检测合集信息…");
          const promoted = await ensureCollectionContext({ ...ctx, type: "collection" });
          if (promoted.mid && promoted.season_id) {
            ctx = { ...promoted, type: "collection", note: "auto_promoted_ugc_season" };
            state2.ctx = ctx;
            setStatus(`识别到合集 · 将加载全列表并建立文件夹…`);
          }
        }
        appCall("scan.validateContext", ctx);
        let items = [];
        let meta = {};
        if (ctx.type === "video" || ctx.type === "selection") {
          const bvid = ctx.bvid || extractBvid2(location.href);
          if (!bvid) throw new Error("未识别 BV 号");
          const expandParts = ctx.type === "selection";
          setStatus(
            expandParts ? `读取选集 ${bvid}（全部分P）…` : `读取单个视频 ${bvid}${(ctx.page || 1) > 1 ? " P" + ctx.page : ""}…`
          );
          const loaded = await loadVideoAsItems(bvid, expandParts);
          if (!expandParts) {
            const page = ctx.page || 1;
            if (loaded.pages && loaded.pages.length && page > 1) {
              const part = loaded.pages[page - 1];
              items = [
                {
                  bvid,
                  aid: loaded.items[0]?.aid ?? null,
                  title: part ? `${loaded.meta?.title || bvid} - P${page}【${part.part || ""}】` : loaded.meta?.title || bvid,
                  author: loaded.meta?.author || "",
                  page,
                  part: part?.part || ""
                }
              ];
            } else {
              items = loaded.items.map((it) => ({ ...it, page: page || 1 }));
            }
            items = await stampUgcSeasonGroupMeta(items, bvid);
          } else {
            items = attachSelectionGroupMeta2(loaded.items, loaded.meta || {});
          }
          meta = loaded.meta || {};
          if (meta.multip && ctx.type === "video") {
            meta.hint = "多分P视频：可切换模式「视频选集」拉全部分P";
          }
        } else if (ctx.type === "user" || ctx.type === "favorite" || ctx.type === "collection" || ctx.type === "search") {
          const pageSize = appCall("scan.pageSizeFor", ctx.type);
          const res = await loadAllListItems(ctx, {
            maxPages: state2.maxPages,
            pageSize,
            delayMs: Math.min(state2.delayMs, 400),
            onProgress: (t) => setStatus(t),
            shouldCancel: () => state2.cancelScan || scanId !== state2.scanSeq
          });
          items = res.items;
          meta = res.meta || {};
          if (res.truncated) meta.truncated = true;
          if (ctx.type === "user") {
            const author = String(meta.author || "").trim() || String(items.find((it) => String(it?.author || "").trim())?.author || "").trim() || "";
            items = attachUserSpaceGroupMeta2(items, { author, mid: ctx.mid || "" });
            if (author) meta.author = author;
            try {
              setStatus("拉取合集列表（名称+地址）…");
              const seasons = await loadUserSpaceSeasons(ctx.mid, {
                maxPages: Math.max(5, Math.min(Number(state2.maxPages) || 20, 40)),
                pageSize: 20,
                delayMs: Math.min(state2.delayMs, 400),
                onProgress: (t) => setStatus(t),
                shouldCancel: () => state2.cancelScan || scanId !== state2.scanSeq
              });
              if (state2.cancelScan || scanId !== state2.scanSeq) {
                const error = new Error("扫描已取消");
                error.name = "AbortError";
                throw error;
              }
              if (seasons.length) {
                const descriptors = seasons.map((s) => ({
                  mid: s.mid,
                  season_id: s.season_id,
                  name: s.name,
                  author,
                  bvids: s.bvids
                }));
                const stats = countSpaceCollectionMatches2(items, descriptors);
                items = applySpaceCollectionMembership2(items, descriptors);
                meta.collections = seasons.map((s) => ({
                  name: s.name,
                  season_id: s.season_id,
                  shortUrl: s.shortUrl || buildCollectionShortUrl2(s.mid, s.season_id),
                  memberCount: (s.bvids || []).length
                }));
                meta.collectionMatched = stats.matched;
                meta.collectionCount = stats.collectionCount;
                if (stats.matched > 0) {
                  meta.hint = `已归入 ${stats.matched} 条到 ${stats.collectionCount} 个合集`;
                } else if (stats.collectionCount > 0) {
                  meta.hint = `发现 ${stats.collectionCount} 个合集（当前页视频未命中成员，可调大「最多页」）`;
                }
              }
            } catch (err) {
              if (isAbortError2(err)) throw err;
              console.warn("[bili-subbatch] loadUserSpaceSeasons", errorMessage(err));
              meta.collectionError = String(errorMessage(err) || "合集列表失败");
            }
            items = attachSpaceLooseVideosMeta2(items);
          }
          if (ctx.type === "collection") {
            if (!meta.author && ctx.authorHint) meta.author = ctx.authorHint;
            if (!meta.name && ctx.collectionTitleHint) meta.name = ctx.collectionTitleHint;
            const archiveCount = items.length;
            setStatus(`展开合集内多分P单元（${archiveCount} 个稿件）…`);
            items = await expandCollectionArchivesWithParts(items.map((item) => ({ ...item, aid: Number(item.aid) || 0, pages: item.pages || [] })), {
              delayMs: Math.min(state2.delayMs, 280),
              onProgress: (t) => setStatus(t),
              shouldCancel: () => state2.cancelScan || scanId !== state2.scanSeq
            });
            if (items.length > archiveCount) {
              meta.expandedParts = items.length - archiveCount;
              meta.hint = [
                meta.hint,
                `已展开单元内分P ${archiveCount} → ${items.length} 条`
              ].filter(Boolean).join(" · ");
            }
            items = attachCollectionGroupMeta2(items, meta, { mid: ctx.mid || "", season_id: ctx.season_id || "", collectionTitleHint: ctx.collectionTitleHint || "", authorHint: ctx.authorHint || "", parentFolder: "" });
          }
        } else {
          const fromDom = harvestBvidsFromDom();
          if (fromDom.length) {
            items = fromDom.map((b) => ({
              bvid: b,
              title: b,
              author: "",
              page: 1
            }));
            meta = { fromDom: true };
          } else {
            throw new Error(
              "当前页未识别。请手动选择模式，或确认 URL 含 BV/mid/fid/keyword"
            );
          }
        }
        if (state2.cancelScan || scanId !== state2.scanSeq) {
          const error = new Error("扫描已取消");
          error.name = "AbortError";
          throw error;
        }
        const modeTag = ctx.source === "manual" ? `手动·${TYPE_LABEL[ctx.type]}` : `自动·${TYPE_LABEL[ctx.type]}`;
        const sourceLabel = String(meta.name || meta.title || meta.keyword || modeTag);
        const { added, existed } = appCall(
          "libraryScan.mergeItems",
          state2.items,
          items,
          sourceLabel,
          (item) => routeVideoKey2(item.bvid, item.page || 1)
        );
        state2.meta = meta;
        state2.captureDrawerOpen = false;
        const drawer = ensurePanel().querySelector('[data-role="capture-drawer"]');
        if (drawer) drawer.hidden = true;
        renderList();
        refreshContextUI();
        const trunc = meta.truncated ? "（已达页数上限，可调大「最多页」）" : "";
        let msg = `[${modeTag}] 扫描 ${items.length} 条 · 新增 ${added} · 已存在 ${existed}${trunc}`;
        if (meta.hint) msg += ` · ${meta.hint}`;
        setStatus(msg, "ok");
        if (meta.name || meta.title || meta.keyword) {
          const label = meta.name || meta.title || meta.keyword;
          const ctxEl = ensurePanel().querySelector('[data-role="ctx"]');
          if (ctxEl && !ctxEl.textContent.includes(String(label))) {
            ctxEl.textContent += ` · ${label}`;
          }
        }
      } catch (e) {
        if (isAbortError2(e) || state2.cancelScan) {
          setStatus(state2.pendingRescan ? "旧扫描已停止 · 准备重新扫描…" : "扫描已停止");
        } else {
          console.error("[bili-subbatch] scan", e);
          setStatus(`扫描失败: ${errorMessage(e)}`, "err");
        }
      } finally {
        if (scanId === state2.scanSeq) {
          state2.cancelScan = false;
          state2.scanPaused = false;
          setScanBusy(false);
          clearLibraryJob();
          flushPendingMainAction();
        }
      }
    }
    function harvestBvidsFromDom() {
      const seen = /* @__PURE__ */ new Set();
      const out = [];
      document.querySelectorAll('a[href*="/video/BV"]').forEach((a) => {
        const b = extractBvid2(a.getAttribute("href") || a.href || "");
        if (b && !seen.has(b)) {
          seen.add(b);
          out.push(b);
        }
      });
      return out;
    }
    async function doBatch(act) {
      if (state2.batchBusy) {
        setStatus("已有字幕任务正在运行；可点击“停止”后重试", "err");
        return;
      }
      if (state2.scanBusy) {
        setStatus("当前页仍在扫描；扫描完成后再执行字幕下载/复制", "err");
        return;
      }
      const batchId = ++state2.batchSeq;
      const targets = act === "dl-ok-only" ? state2.items.filter((it) => it.selected && it.subStatus === "ok" && it.data) : selectedItems();
      if (!targets.length) {
        setStatus(act === "dl-ok-only" ? "没有已成功的勾选项" : "请先勾选视频", "err");
        return;
      }
      state2.cancel = false;
      state2.cancelBatch = false;
      state2.batchPaused = false;
      setBatchBusy(true);
      if (act === "fetch-selected") {
        try {
          setWorkspace("subs", { silent: true });
        } catch {
        }
      }
      setLibraryJob({
        kind: "fetch",
        index: 0,
        total: targets.length,
        label: act === "fetch-selected" ? "准备抓取" : "准备导出"
      });
      const needData = act !== "copy-bvid";
      let ok = 0, empty = 0, err = 0;
      const delay = state2.delayMs;
      let stoppedAt = -1;
      try {
        for (let i = 0; i < targets.length; i++) {
          await waitIfJobPaused();
          if (state2.cancelBatch || state2.cancel) {
            stoppedAt = i;
            setStatus(`已停止 · 完成 ${i}/${targets.length}`, "err");
            break;
          }
          const it = targets[i];
          if (!it) continue;
          const itemLabel = `${it.bvid}${(it.page || 1) > 1 ? " P" + it.page : ""}`;
          setLibraryJob({
            kind: "fetch",
            index: i + 1,
            total: targets.length,
            label: itemLabel
          });
          setStatus(`${state2.batchPaused ? "已暂停" : "字幕"} ${i + 1}/${targets.length} · ${itemLabel}…`);
          if (needData && (!it.data || it.subStatus !== "ok")) {
            try {
              const r = await fetchSubtitle(it.bvid, it.page || 1);
              it.subStatus = r.status;
              it.cue_count = r.cue_count || 0;
              it.data = r.data || null;
              it.error = r.error || "";
              it.lan = r.lan || "";
              if (!it.title && r.title) it.title = r.title;
              if (!it.author && r.author) it.author = r.author;
              if (r.status === "ok") ok++;
              else if (r.status === "empty") empty++;
              else err++;
            } catch (e) {
              it.subStatus = "error";
              it.error = errorMessage(e);
              err++;
            }
            renderList();
            if (i < targets.length - 1 && !state2.cancelBatch && !state2.cancel) {
              await sleep(delay);
              await waitIfJobPaused();
            }
          } else if (it.subStatus === "ok") {
            ok++;
          }
        }
        const ready = targets.filter((it) => it.subStatus === "ok" && it.data?.length);
        if (act === "fetch-selected") {
          if (stoppedAt >= 0) {
            setStatus(`已停止抓取 · 完成 ${stoppedAt}/${targets.length} · ok=${ok} empty=${empty} err=${err}`, "ok");
          } else {
            setStatus(`字幕抓取完成 · ok=${ok} empty=${empty} err=${err}`, err && !ok ? "err" : "ok");
          }
          return;
        }
        if (act === "copy") {
          if (!ready.length) {
            setStatus(`无可用字幕 · ok=${ok} empty=${empty} err=${err}`, "err");
            return;
          }
          const text = ready.map((it) => {
            const head = ready.length > 1 ? `=== ${it.bvid}${(it.page || 1) > 1 ? " P" + it.page : ""} ${it.title || ""} ===
` : "";
            return head + coreCall("cuesToTxt", it.data || []);
          }).join("\n\n");
          clipboardWrite(text);
          setStatus(`已复制 ${ready.length} 条字幕全文`, "ok");
          return;
        }
        if (act === "dl-srt" || act === "dl-txt" || act === "dl-ok-only") {
          const ext = act === "dl-txt" ? "txt" : "srt";
          const convert = (cues) => coreCall(ext === "txt" ? "cuesToTxt" : "cuesToSrt", cues);
          const pool = act === "dl-ok-only" ? state2.items.filter((it) => it.selected && it.subStatus === "ok" && it.data) : ready;
          if (!pool.length) {
            setStatus(`无可用字幕 · ok=${ok} empty=${empty} err=${err}`, "err");
            return;
          }
          const exported = await downloadSubtitleExportBatch(pool, ext, convert);
          setStatus(
            `已下载 ${exported.count} 个 ${ext.toUpperCase()} → ${SUBTITLE_EXPORT_ROOT2}/ · index ${exported.indexEntries} 条 · 抓取 ok=${ok} empty=${empty} err=${err}`,
            "ok"
          );
        }
      } catch (e) {
        console.error("[bili-subbatch] batch", e);
        setStatus(`失败: ${errorMessage(e)}`, "err");
      } finally {
        if (batchId === state2.batchSeq) {
          state2.cancelBatch = false;
          state2.cancel = false;
          state2.batchPaused = false;
          setBatchBusy(false);
          clearLibraryJob();
          renderList();
          flushPendingMainAction();
        }
      }
    }
    function scheduleAutoAnalyze(item, captureKey, reason = "capture", delay = AUTO_ANALYZE_DELAY_MS) {
      if (!state2.autoAnalyzeEnabled || !item || item.subStatus !== "ok" || !item.data?.length) return;
      const key = captureKey || routeVideoKey2(item.bvid, item.page || 1);
      if (!key || state2.autoAnalyzeKey === key || state2.autoAnalyzePendingKey === key) return;
      const readyProfiles = enabledAiProfiles({ requireReady: true });
      if (!readyProfiles.length) {
        setStatus(`已抓取 ${item.cue_count || item.data.length} 条字幕 · 保存并启用至少一个完整 AI 配置后将自动分析`, "ok");
        return;
      }
      clearTimeout(state2.autoAnalyzeTimer);
      state2.autoAnalyzePendingKey = key;
      state2.autoAnalyzeTimer = window.setTimeout(async () => {
        state2.autoAnalyzePendingKey = "";
        if (!state2.autoAnalyzeEnabled || state2.autoAnalyzeKey === key) return;
        if (currentRouteVideoKey() !== key) return;
        const target = state2.items.find((x) => routeVideoKey2(x.bvid, x.page || 1) === key) || (routeVideoKey2(state2.transcriptItem?.bvid, state2.transcriptItem?.page || 1) === key ? state2.transcriptItem : null);
        if (!target || target.subStatus !== "ok" || !target.data?.length) return;
        if (state2.aiBusy) {
          scheduleAutoAnalyze(target, key, reason, 500);
          return;
        }
        state2.autoAnalyzeKey = key;
        setStatus(`字幕已就绪 · 正在自动开始分析（${reason}）…`);
        try {
          await doAiAnalyze({ targets: [target], expectedRouteKey: key, automatic: true });
        } catch (error) {
          console.warn("[bili-subbatch] auto analyze", error);
        }
      }, Math.max(0, Number(delay) || 0));
    }
    function abortAiForAutoNavigation(nextRouteKey = "") {
      state2.aiSessionSeq += 1;
      if (state2.aiBusy) {
        state2.aiAbort = true;
        abortAllAiRuns();
      }
      state2.aiSessionInput = null;
      state2.preprocessRun = null;
      state2.aiSessionRouteKey = "";
      state2.aiInputView = "raw";
      state2.aiViewingPreprocess = false;
      state2.aiRuns = /* @__PURE__ */ new Map();
      state2.aiRunOrder = [];
      state2.aiActiveRunId = "";
      state2.aiActiveTaskId = "";
      state2.aiRaw = "";
      state2.aiRenderedText = "";
      state2.aiPendingText = "";
      state2.knowledgeRailOpen = false;
      hideKnowledgeSelectionToolbar();
      renderKnowledgeRail().catch(() => {
      });
      setAiBusy(false);
      renderAiResultTabs();
      renderAiInputDrawer();
      refreshAiChips();
      abortStudioRequest();
      state2.studioBusy = false;
      state2.studioRuntime = null;
      loadStudioChat(nextRouteKey);
      if (currentAiWorkbenchStage() === "preprocess") renderPreprocessCanvas().catch(() => {
      });
      else if (currentAiWorkbenchStage() === "chat") renderStudioCanvas();
      const root = document.getElementById(PANEL_ID);
      const content2 = root?.querySelector('[data-role="ai-content"]');
      if (content2 && currentAiWorkbenchStage() === "postprocess") {
        content2.innerHTML = `<div class="bsb-empty"><div class="bsb-empty-ico">◌</div><strong>当前视频已切换</strong><span>${nextRouteKey ? escapeHtml(nextRouteKey) + " · " : ""}正在读取当前字幕，旧视频 AI 结果已解除绑定</span></div>`;
      }
    }
    function scheduleAutoCapture(reason, delay = AUTO_CAPTURE_DELAY_MS) {
      clearTimeout(state2.autoCaptureTimer);
      if (!state2.autoCaptureEnabled) return;
      state2.autoCaptureTimer = window.setTimeout(() => {
        autoCaptureCurrentVideo(reason).catch((error) => {
          if (!isAbortError2(error)) {
            console.warn("[bili-subbatch] auto capture", error);
          }
        });
      }, Math.max(0, Number(delay) || 0));
    }
    async function autoCaptureCurrentVideo(reason = "route", options = {}) {
      if (!state2.autoCaptureEnabled && !options.forceNetwork) return;
      if (state2.autoEnablePlayerSubtitle) {
        enablePlayerSubtitle(null).catch(() => {
        });
      }
      const ctx = detectContext2(location.href);
      const routeRef = options.requestedBvid ? null : currentRouteVideoRef();
      const bvid = options.requestedBvid || routeRef?.bvid || ctx.bvid;
      if (!bvid) return;
      const page = Math.max(1, Number(options.requestedPage || routeRef?.page || ctx.page || currentPageNumber()) || 1);
      const captureKey = routeVideoKey2(bvid, page);
      const existing = state2.items.find(
        (item2) => routeVideoKey2(item2.bvid, item2.page || 1) === captureKey
      ) || (state2.transcriptItem && routeVideoKey2(state2.transcriptItem.bvid, state2.transcriptItem.page || 1) === captureKey ? state2.transcriptItem : null);
      if (!options.forceNetwork && state2.autoCaptureKey === captureKey && ["ok", "empty"].includes(existing?.subStatus || "")) {
        if (existing?.subStatus === "ok") selectTranscriptItem(existing);
        return;
      }
      const epoch = ++state2.autoCaptureEpoch;
      state2.autoCaptureAbortController?.abort();
      const controller = new AbortController();
      state2.autoCaptureAbortController = controller;
      state2.autoCaptureKey = captureKey;
      const placeholder = options.silent && existing ? { ...existing } : {
        bvid,
        title: document.title.replace(/_哔哩哔哩_bilibili$/i, "") || bvid,
        author: "",
        page,
        selected: true,
        subStatus: "wait",
        cue_count: 0,
        data: null,
        error: "",
        autoCaptured: true
      };
      if (!options.silent) {
        rememberTranscriptItem(placeholder);
        const placeholderIndex = state2.items.findIndex(
          (entry) => routeVideoKey2(entry.bvid, entry.page || 1) === captureKey
        );
        const existingItem = state2.items[placeholderIndex];
        if (existingItem) {
          Object.assign(existingItem, {
            title: placeholder.title || existingItem.title,
            author: placeholder.author || existingItem.author,
            autoCaptured: true
          });
          rememberTranscriptItem(existingItem);
        } else {
          placeholder.sources = ["打开视频"];
          state2.items.push(placeholder);
        }
        state2.meta = { autoCaptured: true, reason };
        renderList();
        refreshContextUI();
        setStatus(`自动读取 ${bvid}${page > 1 ? " P" + page : ""} 字幕…`);
      }
      let result = null;
      let fastError = null;
      try {
        result = await fetchCurrentSubtitleFast(bvid, page, controller.signal, { forceNetwork: !!options.forceNetwork });
      } catch (error) {
        if (isAbortError2(error)) throw error;
        fastError = error;
      }
      if (!result || result.status !== "ok") {
        if (controller.signal.aborted) throw new DOMException("操作已取消", "AbortError");
        try {
          result = await fetchSubtitle(bvid, page);
          if (result && result.status === "ok") result.source = "robust_fallback";
        } catch (error) {
          if (!result) result = { bvid, page, status: "error", error: errorMessage(error) };
        }
      }
      if (epoch !== state2.autoCaptureEpoch || controller.signal.aborted) return;
      if (currentRouteVideoKey() !== captureKey) return;
      let item = {
        ...placeholder,
        bvid: result?.bvid || bvid,
        aid: result?.aid || null,
        cid: result?.cid || null,
        title: result?.title || placeholder.title || "",
        author: result?.author || "",
        page: result?.page || page,
        pages: result?.pages || [],
        selected: true,
        subStatus: result?.status || "error",
        cue_count: result?.cue_count || 0,
        data: result?.data || null,
        error: result?.error || (fastError ? errorMessage(fastError) : ""),
        lan: result?.lan || "",
        lan_doc: result?.lan_doc || "",
        tracks: result?.tracks || placeholder.tracks || [],
        activeTrackIndex: typeof result?.activeTrackIndex === "number" && Number.isInteger(result.activeTrackIndex) ? result.activeTrackIndex : placeholder.activeTrackIndex ?? -1,
        cachePath: result?.cachePath || "",
        cacheLevel: result?.cacheLevel || "",
        cacheStale: !!result?.cacheStale,
        source: result?.source || (fastError ? "fast_failed" : "fast"),
        autoCaptured: true
      };
      try {
        const stamped = await stampUgcSeasonGroupMeta([item], item.bvid);
        if (stamped[0]) item = stamped[0];
      } catch {
      }
      rememberTranscriptItem(item);
      const sameIndex = state2.items.findIndex(
        (entry) => routeVideoKey2(entry.bvid, entry.page || 1) === captureKey
      );
      const existingTarget = state2.items[sameIndex];
      if (existingTarget) {
        let target = existingTarget;
        target.title = item.title || target.title || "";
        target.author = item.author || target.author || "";
        target.aid = item.aid ?? target.aid ?? null;
        target.cid = item.cid ?? target.cid ?? null;
        target.pages = item.pages || target.pages || [];
        target = mergeGroupFields2(target, item);
        Object.assign(existingTarget, target);
        target = existingTarget;
        target.sources = Array.from(new Set([...target.sources || [], "打开视频"].filter(Boolean)));
        SubBatch2.SubBatchMonorepo.ui.transcriptController.copySubtitleState(target, item);
        state2.transcriptItem = target;
        state2.transcriptItemKey = captureKey;
      } else {
        item.sources = Array.from(/* @__PURE__ */ new Set([...item.sources || [], "打开视频"]));
        state2.items.push(item);
        rememberTranscriptItem(item);
      }
      state2.meta = {
        autoCaptured: true,
        title: item.title,
        author: item.author,
        source: item.source
      };
      const liveItem = state2.items.find((x) => routeVideoKey2(x.bvid, x.page || 1) === captureKey) || item;
      const modeSwitched = syncCaptureModeFromItem(liveItem, { silent: true });
      renderList();
      bindTranscriptVideoEvents();
      if (currentAiWorkbenchStage() === "preprocess") await renderPreprocessCanvas();
      if (item.subStatus === "ok") {
        if (state2.autoEnablePlayerSubtitle) {
          window.setTimeout(() => enablePlayerSubtitle(item).catch(() => {
          }), 280);
        }
        const modeHint = modeSwitched === "selection" ? " · 模式→视频选集" : modeSwitched === "collection" ? " · 模式→合集" : "";
        setStatus(
          `已自动抓取 ${item.cue_count} 条字幕 · ${item.cachePath || item.cacheLevel || item.source}${modeHint}`,
          "ok"
        );
        if (!options.silent && reason !== "stale-revalidate") {
          scheduleAutoAnalyze(item, captureKey, reason);
        }
        if (item.cacheStale && !options.forceNetwork) {
          window.setTimeout(() => {
            if (currentRouteVideoKey() === captureKey) {
              autoCaptureCurrentVideo("stale-revalidate", { forceNetwork: true, silent: true, requestedBvid: item.bvid, requestedPage: item.page || 1 }).catch(() => {
              });
            }
          }, 80);
        }
      } else if (item.subStatus === "empty") {
        setStatus("当前视频没有可读取字幕", "err");
      } else {
        setStatus(`自动抓取失败: ${item.error || "未知错误"}`, "err");
      }
    }
    let lastHref = location.href;
    let lastRouteVideoKey = currentRouteVideoKey();
    let lastPlayingRef = currentRouteVideoRef();
    function onMaybeNavigate() {
      const href = location.href;
      const nextRef = currentRouteVideoRef();
      const nextVideoKey = nextRef?.key || "";
      const hrefChanged = href !== lastHref;
      const changedFn = bilibiliFn("playingVideoChanged");
      const videoChanged = typeof changedFn === "function" ? changedFn(lastPlayingRef, nextRef) : nextVideoKey !== lastRouteVideoKey;
      if (!hrefChanged && !videoChanged) return;
      lastHref = href;
      lastPlayingRef = nextRef;
      if (videoChanged) {
        persistStudioChat(lastRouteVideoKey);
        lastRouteVideoKey = nextVideoKey;
        state2.autoCaptureAbortController?.abort();
        clearTimeout(state2.autoAnalyzeTimer);
        state2.autoAnalyzePendingKey = "";
        state2.autoAnalyzeKey = "";
        abortAiForAutoNavigation(nextVideoKey);
        state2.transcriptVideoAbort?.abort();
        state2.transcriptSwitchAbort?.abort();
        state2.transcriptActiveCueIndex = -1;
        state2.transcriptQuery = "";
        state2.transcriptFilteredIndexes = null;
        state2.transcriptItemKey = nextVideoKey;
        state2.transcriptItem = null;
        const transcriptSearch = document.getElementById(PANEL_ID)?.querySelector('[data-role="transcript-search"]');
        if (transcriptSearch) transcriptSearch.value = "";
        refreshContextUI();
        renderTranscriptPanel();
        if (nextVideoKey) {
          restoreAiSessionForRoute(nextVideoKey).catch(() => {
          });
          scheduleAutoCapture("route-change");
        }
        return;
      }
      refreshContextUI();
    }
    let booted = false;
    function boot() {
      if (booted) return;
      booted = true;
      persistentCache.initChannel();
      ensurePanel();
      bindGlobalShortcuts();
      refreshContextUI();
      bindTranscriptVideoEvents();
      appCall("navigation.observe", {
        pageWindow,
        eventWindow: window,
        document,
        onNavigate: onMaybeNavigate,
        onPageShow: () => scheduleAutoCapture("pageshow", 120),
        onVisible: () => scheduleAutoCapture("visible", 120),
        pollMs: 800
      });
      const routeKey = currentRouteVideoKey();
      if (routeKey) restoreAiSessionForRoute(routeKey).catch(() => {
      });
      if (state2.autoEnablePlayerSubtitle) {
        enablePlayerSubtitle(null).catch(() => {
        });
      }
      scheduleAutoCapture("initial", 180);
    }
    function startUserscript() {
      appCall("activation.start", {
        pageWindow,
        eventWindow: window,
        document,
        href: () => location.href,
        boot
      });
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", startUserscript, { once: true });
    } else {
      startUserscript();
    }
  }
  function isWorkbenchHost(hostname) {
    return /(^|\.)bilibili\.com$/i.test(hostname);
  }
  const host = createUserscriptHost();
  const runtime = userscript.create(host);
  const SubBatchMonorepo = {
    version: "6.10.4",
    runtime,
    core,
    bilibili,
    youtube,
    app,
    ui
  };
  if (typeof location !== "undefined" && isWorkbenchHost(location.hostname)) {
    mountWorkbench({ SubBatchMonorepo });
  }
  exports.SubBatchMonorepo = SubBatchMonorepo;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  return exports;
})({});
