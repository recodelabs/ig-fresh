#!/usr/bin/env node
// Bundle the mermaid diagram-rendering island into dist/ui/mermaid.js.
// IG-agnostic: the diagram source lives in the page's [data-mermaid-src] blocks,
// so one bundle serves every narrative page that authors a mermaid diagram. Kept
// out of the critical path — pages load it lazily only when a diagram is present.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));

await build({
  entryPoints: [path.join(root, "src/ui/mermaid-entry.js")],
  bundle: true,
  format: "iife",
  outfile: path.join(root, "dist/ui/mermaid.js"),
  minify: true,
  sourcemap: false,
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "info",
  legalComments: "none",
});

console.log("✓ built dist/ui/mermaid.js");
