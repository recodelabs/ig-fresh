#!/usr/bin/env node
// Bundle the formbox questionnaire-preview island into dist/ui/formbox.{js,css}.
// IG-agnostic: the questionnaire JSON is fetched at runtime, so one bundle
// serves every questionnaire page. Kept out of the critical path — pages load
// it lazily only when a user opens the interactive preview.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));

await build({
  entryPoints: [path.join(root, "src/ui/formbox-entry.jsx")],
  bundle: true,
  format: "iife",
  outfile: path.join(root, "dist/ui/formbox.js"),
  loader: { ".js": "jsx" },
  jsx: "automatic",
  minify: true,
  sourcemap: false,
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "info",
  legalComments: "none",
});

console.log("✓ built dist/ui/formbox.js + formbox.css");
