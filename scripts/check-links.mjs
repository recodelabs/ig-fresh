#!/usr/bin/env node
// Assert every internal href/src in generated pages resolves to a file on disk.
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: check-links.mjs <site-dir> [--only-fresh]");
  process.exit(2);
}
// --only-fresh: check only pages ig-fresh generated (meta generator), not copied-through publisher pages
const onlyFresh = process.argv.includes("--only-fresh");

let pages = 0;
let links = 0;
const broken = [];

for (const file of fs.readdirSync(dir)) {
  if (!file.endsWith(".html")) continue;
  const html = fs.readFileSync(path.join(dir, file), "utf8");
  if (onlyFresh && !html.includes('name="generator" content="ig-fresh"')) continue;
  pages++;
  const $ = cheerio.load(html);
  const targets = [];
  $("a[href]").each((_, el) => targets.push($(el).attr("href")));
  $("link[href]").each((_, el) => targets.push($(el).attr("href")));
  $("script[src], img[src]").each((_, el) => targets.push($(el).attr("src")));
  for (const t of targets) {
    if (!t || /^(https?:|mailto:|#|data:|javascript:)/.test(t)) continue;
    links++;
    const clean = decodeURIComponent(t.split("#")[0].split("?")[0]);
    if (!clean) continue;
    if (!fs.existsSync(path.join(dir, clean))) {
      broken.push(`${file} → ${t}`);
    }
  }
}

console.log(`checked ${pages} pages, ${links} internal links`);
if (broken.length) {
  console.error(`✗ ${broken.length} broken links:`);
  const counts = new Map();
  for (const b of broken) {
    const target = b.split(" → ")[1];
    counts.set(target, (counts.get(target) ?? 0) + 1);
  }
  for (const [target, n] of [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)) {
    console.error(`  ${String(n).padStart(4)}× ${target}`);
  }
  process.exit(1);
}
console.log("✓ no broken internal links");
