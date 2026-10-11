import { describe, expect, it } from "vitest";

import {
  renderUserscriptMetadata,
  userscriptMetadata,
} from "../../apps/userscript/metadata";

describe("Userscript metadata", () => {
  it("保留 v6.0.2 安装身份并升级至 v6.10.1", () => {
    const header = renderUserscriptMetadata();
    expect(userscriptMetadata.version).toBe("6.10.1");
    expect(header).toContain("// @name         Bili SubBatch (loop-bilibili)");
    expect(header).toContain(
      "// @namespace    https://github.com/loop-bilibili/bili-subbatch",
    );
    expect(header).toContain("// @match        *://www.bilibili.com/video/*");
    expect(header).toContain("// @match        *://www.bilibili.com/festival/*");
    expect(header).toContain("// @match        *://www.bilibili.com/blackboard/*");
    expect(header).toContain("// @match        *://www.youtube.com/*");
    expect(header).toContain("// @match        *://youtu.be/*");
    expect(header).toContain("// @grant        GM_xmlhttpRequest");
    expect(header).toContain("// @grant        GM_download");
    expect(header).toContain("// @run-at       document-idle");
  });
});
