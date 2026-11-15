import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(process.cwd(), "apps/userscript/src");

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const name = path.join(dir, entry.name);
    return entry.isDirectory() ? sources(name) : name.endsWith(".ts") ? [name] : [];
  });
}

describe("userscript Trusted Types DOM sinks", () => {
  it("routes all innerHTML assignments through the scoped TrustedHTML adapter", () => {
    const unsafe: string[] = [];
    let covered = 0;
    for (const file of sources(ROOT)) {
      const src = readFileSync(file, "utf8");
      const ast = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
      function visit(node: ts.Node): void {
        if (ts.isBinaryExpression(node) &&
          ts.isPropertyAccessExpression(node.left) &&
          node.left.name.text === "innerHTML") {
          const assigned = node.operatorToken.kind === ts.SyntaxKind.EqualsToken;
          if (assigned && ts.isCallExpression(node.right) &&
            ts.isIdentifier(node.right.expression) &&
            node.right.expression.text === "toTrustedHTML") {
            covered++;
          } else {
            unsafe.push(path.relative(ROOT, file) + ":" +
              ast.getLineAndCharacterOfPosition(node.getStart(ast)).line);
          }
        }
        if (ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === "insertAdjacentHTML") {
          unsafe.push(path.relative(ROOT, file) + ":insertAdjacentHTML");
        }
        ts.forEachChild(node, visit);
      }
      visit(ast);
    }
    expect(covered).toBeGreaterThanOrEqual(56);
    expect(unsafe).toEqual([]);
  });
});
