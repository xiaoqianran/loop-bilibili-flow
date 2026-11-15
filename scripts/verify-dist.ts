import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { Script } from "node:vm";

import {
  COMPAT_BODY_MARKER,
} from "./userscript-build-utils";

const projectRoot = process.cwd();
const outputPath = resolve(
  projectRoot,
  "dist/userscript/loop-bilibili-flow.user.js",
);
const workbenchSourcePath = resolve(
  projectRoot,
  "apps/userscript/src/workbench/runtime.ts",
);

const requiredMetadata = [
  "// @version      6.10.8",
  "// @run-at       document-idle",
  "// @match        *://www.bilibili.com/video/*",
  "// @match        *://www.bilibili.com/festival/*",
  "// @match        *://www.bilibili.com/blackboard/*",
  "// @match        *://www.bilibili.com/list/*",
  "// @match        *://www.youtube.com/*",
  "// @grant        GM_xmlhttpRequest",
  "// @grant        GM_setClipboard",
  "// @grant        GM_addStyle",
  "// @grant        GM_info",
  "// @grant        GM_setValue",
  "// @grant        GM_getValue",
  "// @grant        GM_deleteValue",
  "// @grant        GM_download",
  "// @grant        unsafeWindow",
];

const requiredCapabilities = [
  "function boot()",
  "function detectContext(",
  "function loadAllListItems(",
  "function fetchSubtitle(",
  "function requestChatCompletion(",
  "function renderAiResultTabs(",
  "function parseKnowledgeOutput(",
  "function bindGlobalShortcuts(",
  "function downloadSubtitleExportBatch(",
  "loop-bilibili-subbatch",
] as const;

const requiredCanonicalCapabilities = [
  "function splitCuesForPreprocess(",
  "function stitchPreprocessChunks(",
  "function preprocessCacheKey(",
] as const;

function hash(source: string): string {
  return createHash("sha256").update(source).digest("hex");
}

async function verify(): Promise<void> {
  const officialEntries = await readdir(resolve(projectRoot, "dist/userscript"), {
    withFileTypes: true,
  });
  const userscripts = officialEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".user.js"))
    .map((entry) => entry.name)
    .sort();
  if (
    userscripts.length !== 1 ||
    userscripts[0] !== "loop-bilibili-flow.user.js"
  ) {
    throw new Error(
      `Official userscript directory must contain exactly loop-bilibili-flow.user.js; found: ${userscripts.join(", ") || "(none)"}`,
    );
  }

  const [output, workbenchSource, outputStats] = await Promise.all([
    readFile(outputPath, "utf8"),
    readFile(workbenchSourcePath, "utf8"),
    stat(outputPath),
  ]);

  if (!output.startsWith("// ==UserScript==\n")) {
    throw new Error("Userscript metadata must be the first output bytes");
  }
  if ((output.match(/\/\/ ==UserScript==/g) ?? []).length !== 1) {
    throw new Error("Output must contain exactly one metadata header");
  }
  for (const row of requiredMetadata) {
    if (!output.includes(row)) throw new Error(`Missing metadata row: ${row}`);
  }
  // Bundled libraries may contain guarded module.require probes for Node-only
  // optimizations. Reject unbound require() calls, not those inactive probes.
  if (/^\s*(?:import|export)\s/m.test(output) || /(?<![\w$.])require\s*\(/.test(output)) {
    throw new Error("Output contains a runtime module dependency");
  }
  new Script(output, { filename: "loop-bilibili-flow.user.js" });
  if (/https:\/\/cdn\.jsdelivr\.net\/(?:npm\/(?:marked|dompurify|katex|mermaid)@|gh\/highlightjs\/)/.test(workbenchSource)) {
    throw new Error("Workbench rendering must use bundled libraries instead of runtime CDN loading");
  }
  if (/url\([^)]*https:\/\/[^)]*\.(?:woff2?|ttf)/i.test(output)) {
    throw new Error("Rendering fonts must be embedded instead of fetched remotely");
  }

  if (output.includes(COMPAT_BODY_MARKER)) {
    throw new Error("Production userscript must not embed compatibility body marker");
  }
  if (!output.includes("mountWorkbench({ SubBatchMonorepo })")) {
    throw new Error("Bundled workbench was not mounted by the composition root");
  }
  for (const capability of requiredCapabilities) {
    if (!workbenchSource.includes(capability) || !output.includes(capability)) {
      throw new Error("Production userscript lost workbench capability: " + capability);
    }
  }
  // Knowledge DB identity now belongs to the schema/repository, not the workbench.
  const schemaSource = await readFile(resolve(projectRoot, "packages/schemas/src/persistence.ts"), "utf8");
  const knowledgeDbName = "bili-subbatch-knowledge-v1";
  if (!schemaSource.includes(knowledgeDbName) || !output.includes(knowledgeDbName)) {
    throw new Error("Knowledge database identity must remain in schema and bundled output");
  }
  for (const capability of requiredCanonicalCapabilities) {
    if (!output.includes(capability)) {
      throw new Error(
        `Production userscript lost canonical capability marker: ${capability}`,
      );
    }
  }
  if (outputStats.size < 500_000) {
    throw new Error("Production workbench bundle is unexpectedly small (" + outputStats.size + " bytes)");
  }

  console.log(
    `Verified ${outputPath}: single bundled userscript with workbench capabilities and no compatibility append (sha256 ${hash(output)})`,
  );
}

void verify();
