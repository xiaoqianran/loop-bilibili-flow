/// <reference types="vite/client" />
/**
 * Full userscript entry. The experimental API-only entry is main-pure.ts.
 * Composition contracts live in composition.ts; this entry only mounts the workbench.
 */
import { SubBatchMonorepo } from "./composition";
import { mountWorkbench } from "./workbench/runtime";
import { isWorkbenchHost } from "./workbench/host";

if (typeof location !== "undefined"
  && isWorkbenchHost(location.hostname)) {
  mountWorkbench({ SubBatchMonorepo });
}

export { SubBatchMonorepo };
