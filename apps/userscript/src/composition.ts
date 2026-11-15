/**
 * Shared userscript API composition. The pure entry intentionally never imports
 * the workbench or its bundled rendering libraries.
 */
import * as bilibili from "@subbatch/bilibili";
import * as core from "@subbatch/core";
import { userscript as runtimeUserscript } from "@subbatch/runtime";
import * as youtube from "@subbatch/youtube";

import * as app from "./app";
import * as ui from "./ui";
import { createUserscriptHost } from "./userscript-host";

const host = createUserscriptHost();
const runtime = runtimeUserscript.create(host);

export const SubBatchMonorepo = {
  version: "6.10.9",
  runtime,
  core,
  bilibili,
  youtube,
  app,
  ui,
};
