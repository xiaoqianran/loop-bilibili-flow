import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { Script } from "node:vm";

import {
  COMPAT_BODY_MARKER,
  stripUserscriptMetadata,
} from "./userscript-build-utils";

const projectRoot = process.cwd();
const outputPath = resolve(
  projectRoot,
  "dist/userscript/loop-bilibili-flow.user.js",
);
const maintainedSourcePath = resolve(
  projectRoot,
  "compat/maintained-runtime.js",
);

const requiredMetadata = [
  "// @version      6.9.16",
  "// @run-at       document-idle",
  "// @match        *://www.bilibili.com/video/*",
  "// @match        *://www.bilibili.com/festival/*",
  "// @match        *://www.bilibili.com/blackboard/*",
  "// @match        *://www.bilibili.com/list/*",
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
  "bili-subbatch-knowledge-v1",
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

  const [output, maintainedSource, outputStats] = await Promise.all([
    readFile(outputPath, "utf8"),
    readFile(maintainedSourcePath, "utf8"),
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
  if (/^\s*(?:import|export)\s/m.test(output) || /\brequire\s*\(/.test(output)) {
    throw new Error("Output contains a runtime module dependency");
  }
  new Script(output, { filename: "loop-bilibili-flow.user.js" });

  const marker = `${COMPAT_BODY_MARKER}\n`;
  const markerIndex = output.indexOf(marker);
  if (markerIndex < 0) throw new Error("Temporary maintained runtime marker not found");
  const outputBehaviorBody = output.slice(markerIndex + marker.length);
  const expectedBehaviorBody = stripUserscriptMetadata(maintainedSource);
  if (outputBehaviorBody !== expectedBehaviorBody) {
    throw new Error(
      `Maintained behavior body mismatch: expected ${hash(expectedBehaviorBody)}, received ${hash(outputBehaviorBody)}`,
    );
  }
  for (const capability of requiredCapabilities) {
    if (!outputBehaviorBody.includes(capability)) {
      throw new Error(`Production userscript lost capability marker: ${capability}`);
    }
  }
  for (const capability of requiredCanonicalCapabilities) {
    if (!output.includes(capability)) {
      throw new Error(
        `Production userscript lost canonical capability marker: ${capability}`,
      );
    }
  }
  if (outputStats.size <= Buffer.byteLength(maintainedSource)) {
    throw new Error("Production output is unexpectedly smaller than its maintained source");
  }

  console.log(
    `Verified ${outputPath}: single official userscript with full current behavior (sha256 ${hash(output)})`,
  );
}

void verify();
