import * as coreRegistry from "../packages/core/src/index";
import * as applicationRegistry from "../apps/userscript/src/app";
import { resolveAppMethod } from "../apps/userscript/src/runtime/app-bridge";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const packages = ["schemas", "core", "bilibili", "youtube", "runtime"] as const;

const forbiddenPlatform = [
  { name: "Userscript global", pattern: /\bGM_[A-Za-z0-9_]+/ },
  { name: "Chrome extension global", pattern: /\bchrome\s*\./ },
  { name: "Browser extension global", pattern: /\bbrowser\s*\./ },
];

const pureOnly = new Set(["schemas", "core"]);
const forbiddenPure = [
  { name: "window", pattern: /\bwindow\b/ },
  { name: "document", pattern: /\bdocument\b/ },
  { name: "DOM Element", pattern: /\b(?:Element|HTMLElement|EventTarget|KeyboardEvent)\b/ },
  { name: "browser storage", pattern: /\b(?:localStorage|sessionStorage|indexedDB)\b/ },
];

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory()
        ? sourceFiles(path)
        : Promise.resolve(extname(entry.name) === ".ts" ? [path] : []);
    }),
  );
  return nested.flat();
}

async function main(): Promise<void> {
  const violations: string[] = [];

  for (const packageName of packages) {
    const packageRoot = join(root, "packages", packageName);
    const packageJson = JSON.parse(
      await readFile(join(packageRoot, "package.json"), "utf8"),
    ) as { dependencies?: Record<string, string> };

    for (const dependency of Object.keys(packageJson.dependencies ?? {})) {
      if (dependency.startsWith("@subbatch/")) {
        violations.push(
          `packages/${packageName}/package.json: cross-package dependency ${dependency}`,
        );
      }
    }

    for (const file of await sourceFiles(join(packageRoot, "src"))) {
      const source = await readFile(file, "utf8");
      const name = relative(root, file);

      if (/from\s+["']@subbatch\//.test(source)) {
        violations.push(`${name}: shared package import`);
      }
      if (/compat[\\/]maintained-runtime/.test(source)) {
        violations.push(`${name}: compatibility runtime dependency`);
      }
      for (const rule of forbiddenPlatform) {
        if (rule.pattern.test(source)) {
          violations.push(`${name}: ${rule.name}`);
        }
      }
      if (pureOnly.has(packageName)) {
        for (const rule of forbiddenPure) {
          if (rule.pattern.test(source)) {
            violations.push(`${name}: pure package uses ${rule.name}`);
          }
        }
      }
    }
  }

  for (const file of await sourceFiles(join(root, "apps", "userscript", "src", "app"))) {
    const source = await readFile(file, "utf8");
    if (/api\.bilibili\.com/.test(source)) {
      violations.push(
        `${relative(root, file)}: Bilibili endpoint literal belongs in packages/bilibili`,
      );
    }
    if (/from\s+["']@subbatch\/(?:bilibili|youtube)["']/.test(source)) {
      violations.push(
        `${relative(root, file)}: app layer imports a platform package directly instead of a provider adapter`,
      );
    }
  }

  // Typed workspaces and Application modules must never grow new unchecked islands.
  // The legacy workbench/runtime.ts is the sole grandfathered exception.
  for (const layer of ["app", "ui"]) {
    for (const file of await sourceFiles(join(root, "apps", "userscript", "src", layer))) {
      const source = await readFile(file, "utf8");
      if (source.split("\n").some(line => line.trim().startsWith("// @ts-nocheck"))) {
        violations.push(relative(root, file) + ": disabling TypeScript is forbidden outside workbench/runtime.ts");
      }
    }
  }

  // Fail fast when any workbench Application capability has been renamed or deleted.
  const workbenchSource = await readFile(join(root, "apps", "userscript", "src", "workbench", "runtime.ts"), "utf8");
  const literalAppMethods = [...workbenchSource.matchAll(/\b(?:appCall|appFn)\(\s*["']([^"']+)["']/g)]
    .map(match => match[1])
    .filter((path): path is string => Boolean(path));
  for (const path of new Set(literalAppMethods)) {
    if (!resolveAppMethod(applicationRegistry, path)) {
      violations.push("workbench Application API path does not exist: " + path);
    }
  }

  // Product workbench core rules must exist in the canonical, bundled core.
  // Silent local stand-ins used to hide broken resource grouping and export logic.
  const literalCoreMethods = [...workbenchSource.matchAll(/\bcoreCall\(\s*["']([^"']+)["']/g)]
    .map(match => match[1])
    .filter((name): name is string => Boolean(name));
  for (const name of new Set(literalCoreMethods)) {
    const method: unknown = Object.hasOwn(coreRegistry, name) ? Reflect.get(coreRegistry, name) : undefined;
    if (typeof method !== "function") {
      violations.push("workbench canonical core API missing: " + name);
    }
  }

  const neutralProviderFiles = [
    join(root, "apps", "userscript", "src", "providers", "types.ts"),
    join(root, "apps", "userscript", "src", "providers", "registry.ts"),
    join(root, "apps", "userscript", "src", "providers", "transcript.ts"),
    join(root, "apps", "userscript", "src", "app", "current-content.ts"),
    join(root, "apps", "userscript", "src", "app", "current-transcript.ts"),
  ];
  for (const file of neutralProviderFiles) {
    const source = await readFile(file, "utf8");
    if (/from\s+["']@subbatch\/(?:bilibili|youtube)["']/.test(source)) {
      violations.push(
        `${relative(root, file)}: provider-neutral boundary imports a platform package directly`,
      );
    }
  }

  if (violations.length) {
    throw new Error(
      `Architecture boundary violations:\n${violations.join("\n")}`,
    );
  }

  console.log(
    "Architecture boundaries verified: packages are isolated; core/schemas are platform-free; provider-neutral resolver is platform-free; app has no direct platform imports",
  );
}

void main();
