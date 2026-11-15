import ts from "typescript";
import { resolve } from "node:path";
import type { Plugin } from "vite";

/** Adapt the pinned diagram libraries' HTML sinks without patching page DOM APIs
 * or installing a global default Trusted Types policy. Mermaid's strict input
 * sanitization and the workbench's final SVG sanitization remain in place. */
export function renderingTrustedTypesPlugin(): Plugin {
  return {
    name: "subbatch-diagram-trusted-types",
    enforce: "pre",
    transform(code, id) {
      const path = id.replace(/\\/g, "/");
      if (!/\/node_modules\/(?:mermaid|d3-selection)\//.test(path) || !code.includes("innerHTML")) return;
      const source = ts.createSourceFile(id, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
      let changed = false;
      const result = ts.transform(source, [context => root => {
        const visit: ts.Visitor = node => {
          if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
            && ts.isPropertyAccessExpression(node.left) && node.left.name.text === "innerHTML") {
            changed = true;
            return context.factory.updateBinaryExpression(node, node.left, node.operatorToken,
              context.factory.createCallExpression(context.factory.createIdentifier("__bsbTrustedHTML"), undefined, [node.right]));
          }
          return ts.visitEachChild(node, visit, context);
        };
        return ts.visitNode(root, visit) as ts.SourceFile;
      }]);
      try {
        if (!changed) return;
        const adapter = resolve("apps/userscript/src/runtime/trusted-html.ts").replace(/\\/g, "/");
        return {
          code: `import { toTrustedHTML as __bsbTrustedHTML } from ${JSON.stringify(adapter)};\n`
            + ts.createPrinter().printFile(result.transformed[0]!),
          map: null,
        };
      } finally {
        result.dispose();
      }
    },
  };
}
