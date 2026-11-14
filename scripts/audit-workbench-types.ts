/** Audit the legacy workbench as though @ts-nocheck did not exist, without mutating files. */
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const legacy = resolve(root, "apps/userscript/src/workbench/runtime.ts").toLowerCase();
const tsconfig = resolve(root, "tsconfig.typecheck.json");
const config = ts.readConfigFile(tsconfig, ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
if (parsed.errors.length) throw new Error(parsed.errors.map(
  error => ts.flattenDiagnosticMessageText(error.messageText, "\n")).join("\n"));
const host = ts.createCompilerHost(parsed.options);
const originalRead = host.readFile.bind(host);
host.readFile = fileName => {
  const text = originalRead(fileName);
  if (!text || resolve(fileName).toLowerCase() !== legacy) return text;
  return text.replace(/^\/\/\s*@ts-nocheck\s*$/m, "// type-debt audit: suppression removed in memory");
};
const program = ts.createProgram(parsed.fileNames, parsed.options, host);
const diagnostics = ts.getPreEmitDiagnostics(program).filter(
  diagnostic => diagnostic.file && resolve(diagnostic.file.fileName).toLowerCase() === legacy);
const counts = new Map<number, number>();
for (const diag of diagnostics) counts.set(diag.code, (counts.get(diag.code) || 0) + 1);
const summary = [...counts.entries()].sort((a, b) => b[1] - a[1])
  .slice(0, 8).map(([code, count]) => "TS" + code + "=" + count).join(", ");
const maxAllowed = 1525;
console.log("Workbench legacy strict diagnostic audit: " + diagnostics.length + " / " + maxAllowed
  + " max (" + summary + ")");
if (diagnostics.length > maxAllowed) {
  throw new Error("Workbench strict diagnostic count increased; investigate new unchecked type debt");
}
