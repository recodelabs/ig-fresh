#!/usr/bin/env node
import { parseArgs, USAGE } from "./cli-args.js";
import { buildSite } from "./build/site.js";

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e: any) {
    console.error(e.message);
    process.exit(2);
  }
  if (args.cmd === "help") {
    console.log(USAGE);
    return;
  }
  const started = Date.now();
  const stats = await buildSite(args.input!, args.out!, { verbose: args.verbose });
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `\nig-fresh: ${stats.pages} pages (${stats.artifacts} artifacts) in ${secs}s` +
      (stats.warnings.length ? ` — ${stats.warnings.length} warning(s)` : ""),
  );
}

main().catch((e) => {
  console.error(`ig-fresh: build failed — ${e?.stack ?? e}`);
  process.exit(1);
});
