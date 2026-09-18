/**
 * Monorepo userscript composition root (P4.5 Real Takeover).
 *
 * Production path is owned by apps/userscript + packages/*.
 * Full Studio UI still lives only in the compat build (maintained body);
 * pure build must never append the frozen v6.0.2 body.
 *
 * Vite IIFE global exposes one composition entry: `SubBatch.SubBatchMonorepo`.
 * The maintained body bridges pure cores via `SubBatch.SubBatchMonorepo.core`.
 */
import * as bilibili from "@subbatch/bilibili";
import * as core from "@subbatch/core";
import { userscript as runtimeUserscript } from "@subbatch/runtime";

import * as app from "./app";
import { createUserscriptHost } from "./userscript-host";

const host = createUserscriptHost();
const runtime = runtimeUserscript.create(host);

/**
 * Public composition surface.
 *
 * Keep this intentionally small: modules own their APIs; the composition root
 * only wires modules together.
 */
const SubBatchMonorepo = {
  version: "6.9.16",
  runtime,
  core,
  bilibili,
  app,
};

export { SubBatchMonorepo };
