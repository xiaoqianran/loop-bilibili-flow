import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const packages = ["schemas", "core", "bilibili", "runtime"] as const;

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

  if (violations.length) {
    throw new Error(
      `Architecture boundary violations:\n${violations.join("\n")}`,
    );
  }

  console.log(
    "Architecture boundaries verified: schemas/core/bilibili/runtime are isolated; core/schemas are platform-free",
  );
}

void main();
