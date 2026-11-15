import ts from "typescript";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const legacyPath = fileURLToPath(
  new URL("../../legacy/Bili-SubBatch-v6.0.2.user.js", import.meta.url),
);

export const legacySource = readFileSync(legacyPath, "utf8");

const parsedSources = new Map<string, ts.SourceFile>();

export function extractFunctionSource(source: string, name: string): string {
  let file = parsedSources.get(source);
  if (!file) {
    file = ts.createSourceFile("golden-workbench.ts", source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
    parsedSources.set(source, file);
  }
  let found: ts.FunctionDeclaration | null = null;
  function visit(node: ts.Node): void {
    if (found) return;
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  if (!found) throw new Error("Function not found: " + name);
  return (found as ts.FunctionDeclaration).getText(file);
}

export function extractLegacyFunctionSource(name: string): string {
  return extractFunctionSource(legacySource, name);
}

export function sourceFunction<
  TFunction extends (...args: never[]) => unknown,
>(
  source: string,
  name: string,
  scope: Record<string, unknown> = {},
): TFunction {
  const names = Object.keys(scope);
  const values = Object.values(scope);
  // Maintained workbench is strict TypeScript. Transpile the isolated function
  // before evaluating it; legacy untyped JavaScript remains source-compatible.
  const typed = "const extracted = (" + extractFunctionSource(source, name) + ");";
  const compiled = ts.transpileModule(typed, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const factory = new Function(...names, '"use strict"; ' + compiled + ' return extracted;');
  return factory(...values) as TFunction;
}

export function legacyFunction<TFunction extends (...args: never[]) => unknown>(
  name: string,
  scope: Record<string, unknown> = {},
): TFunction {
  return sourceFunction<TFunction>(legacySource, name, scope);
}
