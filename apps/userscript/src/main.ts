/// <reference types="vite/client" />
/**
 * Main userscript composition root.
 * Full workbench is included as an application module.
 * Pure laboratory mode exports only the API composition surface.
 */
import { SubBatchMonorepo } from "./composition";
import { mountWorkbench } from "./workbench/runtime";
import { isWorkbenchHost } from "./workbench/host";

if (import.meta.env.MODE !== "pure" && typeof location !== "undefined"
  && isWorkbenchHost(location.hostname)) {
  mountWorkbench({ SubBatchMonorepo });
}

export { SubBatchMonorepo };
