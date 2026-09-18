import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { build } from "vite";

import {
  renderUserscriptMetadata,
  userscriptMetadata,
} from "../apps/userscript/metadata";
import {
  COMPAT_BODY_MARKER,
  stripUserscriptMetadata,
} from "./userscript-build-utils";

export type UserscriptBuildMode = "pure" | "full";

const projectRoot = process.cwd();
const legacyPath = resolve(projectRoot, "legacy/Bili-SubBatch-v6.0.2.user.js");
const maintainedSourcePath = resolve(projectRoot, "compat/maintained-runtime.js");
const outputDirectory = resolve(projectRoot, "dist/userscript");
const buildDirectory = resolve(outputDirectory, ".build");
const bundlePath = resolve(buildDirectory, "subbatch.bundle.js");
const productionOutputPath = resolve(
  outputDirectory,
  "loop-bilibili-flow.user.js",
);
const pureOutputPath = resolve(projectRoot, "dist/lab/subbatch.pure.user.js");
const expectedLegacyHash =
  "370FE4B3D3A02D8091CFA40C4298BA3CC2A5F08794D0F4E010DCC0DED0806762";

function sha256(source: string): string {
  return createHash("sha256").update(source).digest("hex").toUpperCase();
}

function parseMode(argv: string[]): UserscriptBuildMode {
  const modeArg = argv.find((arg) => arg.startsWith("--mode="));
  if (!modeArg) return "full";
  const value = modeArg.slice("--mode=".length);
  if (value === "pure" || value === "full") return value;
  throw new Error(`Unknown build mode: ${value}`);
}

async function assertLegacyHash(): Promise<void> {
  const legacyBytes = await readFile(legacyPath);
  const legacyHash = createHash("sha256")
    .update(legacyBytes)
    .digest("hex")
    .toUpperCase();
  if (legacyHash !== expectedLegacyHash) {
    throw new Error(
      `Legacy Golden Reference changed: expected ${expectedLegacyHash}, received ${legacyHash}`,
    );
  }
}

async function buildBundle(): Promise<string> {
  await rm(buildDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });
  await build({
    configFile: resolve(projectRoot, "apps/userscript/vite.config.ts"),
    root: projectRoot,
    logLevel: "warn",
  });
  return readFile(bundlePath, "utf8");
}

async function buildPureUserscript(): Promise<void> {
  const bootstrap = await buildBundle();
  if (bootstrap.includes(COMPAT_BODY_MARKER)) {
    throw new Error("Pure bundle must not embed the maintained compatibility body");
  }

  const output = [
    renderUserscriptMetadata(userscriptMetadata),
    "",
    `// SubBatch pure runtime (${userscriptMetadata.version})`,
    bootstrap.trim(),
    "",
  ].join("\n");

  await mkdir(resolve(projectRoot, "dist/lab"), { recursive: true });
  await writeFile(pureOutputPath, output, "utf8");
  await rm(buildDirectory, { recursive: true, force: true });
  console.log(
    `Built pure ${pureOutputPath} (${Buffer.byteLength(output)} bytes, sha256 ${sha256(output)})`,
  );
}

async function cleanOfficialOutput(): Promise<void> {
  await mkdir(outputDirectory, { recursive: true });
  const entries = await readdir(outputDirectory, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".user.js"))
      .map((entry) => rm(resolve(outputDirectory, entry.name), { force: true })),
  );
}

async function buildFullUserscript(): Promise<void> {
  await assertLegacyHash();
  await cleanOfficialOutput();
  const [bootstrap, maintainedSource] = await Promise.all([
    buildBundle(),
    readFile(maintainedSourcePath, "utf8"),
  ]);
  const maintainedBody = stripUserscriptMetadata(maintainedSource);
  const output = [
    renderUserscriptMetadata(userscriptMetadata),
    "",
    `// SubBatch runtime (${userscriptMetadata.version})`,
    bootstrap.trim(),
    "",
    COMPAT_BODY_MARKER,
    maintainedBody,
  ].join("\n");

  await writeFile(productionOutputPath, output, "utf8");
  await rm(buildDirectory, { recursive: true, force: true });
  console.log(
    `Built ${productionOutputPath} (${Buffer.byteLength(output)} bytes, sha256 ${sha256(output)})`,
  );
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));
  if (mode === "pure") await buildPureUserscript();
  else await buildFullUserscript();
}

void main();
