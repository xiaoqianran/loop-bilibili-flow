/// <reference types="vite/client" />
/**
 * Main userscript composition root.
 * Full workbench is included as an application module.
 * Pure laboratory mode exports only the API composition surface.
 */
import * as bilibili from "@subbatch/bilibili";
import * as core from "@subbatch/core";
import { userscript as runtimeUserscript } from "@subbatch/runtime";
import * as youtube from "@subbatch/youtube";

import * as app from "./app";
import * as ui from "./ui";
import { createUserscriptHost } from "./userscript-host";
import { mountWorkbench } from "./workbench/runtime";
import { isWorkbenchHost } from "./workbench/host";

const host = createUserscriptHost();
const runtime = runtimeUserscript.create(host);

/**
 * Public composition surface.
 *
 * Keep this intentionally small: modules own their APIs; the composition root
 * only wires modules together.
 */
const SubBatchMonorepo = {
  version: "6.10.6",
  runtime,
  core,
  bilibili,
  youtube,
  app,
  ui,
};

if (import.meta.env.MODE !== "pure" && typeof location !== "undefined"
  && isWorkbenchHost(location.hostname)) {
  mountWorkbench({ SubBatchMonorepo });
}

export { SubBatchMonorepo };
