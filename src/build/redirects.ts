import type { Artifact } from "../model/types.js";

/**
 * Build the body of a Cloudflare Pages `_redirects` file that resolves FHIR
 * **canonical URLs** to the flat page filenames IG Publisher emits.
 *
 * A conformance/terminology resource's canonical is `{base}/{ResourceType}/{id}`
 * (e.g. `https://example.org/CodeSystem/my-codes`), and that canonical is what
 * *other* FHIR resources link to — it is the resource's identity, not a
 * guaranteed web page. IG Publisher, however, writes the human page at a flat
 * `{ResourceType}-{id}.html`; there is no `/{ResourceType}/{id}` file. When the
 * IG is served at its canonical base — the common Cloudflare Pages setup — a
 * reader who follows a canonical lands on a path that does not exist. Hosts that
 * fall back to `index.html` for misses then serve the wrong page, and because
 * the shell's asset links are relative (`igf/site.<hash>.css`) they resolve
 * against the nested URL and 404 too, so the page also loses all styling.
 *
 * Emitting one exact-match 301 per artifact — `/{ResourceType}/{id}` →
 * `/{ResourceType}-{id}.html` — makes every canonical (and every literal
 * `Type/id` reference, including examples that carry no `url`) resolve to its
 * real page. Exact matches only, no wildcards, so a rule can never point at a
 * missing file; `_redirects` rules are evaluated ahead of the static-asset
 * fallback, so this wins over any `index.html` catch-all.
 *
 * The output is deterministic (rules sorted by source path) so an unchanged IG
 * produces a byte-identical file across rebuilds.
 */
export function buildRedirects(artifacts: Artifact[]): string {
  const bySource = new Map<string, string>();
  for (const a of artifacts) {
    const from = `/${a.resourceType}/${a.id}`;
    // First artifact wins on the (rare) collision; every rule still targets a
    // real emitted page.
    if (!bySource.has(from)) bySource.set(from, `/${a.filename}`);
  }
  const lines = [...bySource.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([from, to]) => `${from}  ${to}  301`);
  return lines.length ? lines.join("\n") + "\n" : "";
}
