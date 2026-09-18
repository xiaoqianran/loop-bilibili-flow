/**
 * Monorepo userscript composition root (P4.5 Real Takeover).
 *
 * Production path is owned by apps/userscript + packages/*.
 * Full Studio UI still lives only in the compat build (maintained body);
 * pure build must never append the frozen v6.0.2 body.
 *
 * Vite IIFE global: `SubBatch` with named exports
 * (`SubBatch.SubBatchMonorepo`, `SubBatch.runtime`, `SubBatch.host`).
 * The maintained body bridges pure cores via `SubBatch.SubBatchMonorepo.core`.
 */
import * as bilibili from "@subbatch/bilibili";
import * as core from "@subbatch/core";
import { userscript as runtimeUserscript } from "@subbatch/runtime";
import * as schemas from "@subbatch/schemas";

import * as app from "./app";
import { createUserscriptHost } from "./userscript-host";

const host = createUserscriptHost();
const runtime = runtimeUserscript.create(host);

/**
 * Public monorepo API surface.
 *
 * Canonical calls use grouped namespaces: core.*, bilibili.route.*, app.*.
 * The flattened compatibility surface is generated automatically instead of
 * hand-maintaining dozens of duplicated long names.
 */
const compat = { ...core, ...bilibili };

const SubBatchMonorepo = {
  version: "6.9.16",
  runtime,
  host,
  core,
  bilibili,
  schemas,
  app,
  compat,
  ...compat,
  detectContext(href?: string, hints?: bilibili.BilibiliPageHints) {
    return bilibili.route.detect(href ?? runtime.page.href(), hints);
  },
};

export { runtime, host, SubBatchMonorepo };
