# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project aims to follow
[Semantic Versioning](https://semver.org/): consumers pin a major version (`@v1`) and
receive minor/patch improvements automatically; breaking changes land only in a new major.

## [Unreleased]

### Added

- **Canonical-URL redirects (Cloudflare Pages `_redirects`)** — the build now emits a
  `_redirects` file at the site root with one exact-match 301 per artifact,
  `/{ResourceType}/{id}` → `/{ResourceType}-{id}.html` (e.g.
  `/CodeSystem/icr-mda-medicine-package-cs` → `/CodeSystem-icr-mda-medicine-package-cs.html`).
  FHIR resources link to a resource's **canonical** (`{base}/{ResourceType}/{id}`), which is
  its identity — not a page. IG Publisher writes the human page at a flat
  `{ResourceType}-{id}.html`, so a reader who follows a canonical on an IG served at its
  canonical base hit a non-existent path; Pages then served the `index.html` fallback, and
  because the shell's asset links are relative that fallback also rendered unstyled (looked
  like "broken CSS"). Rules are exact-match only (no wildcards, so none can target a missing
  file), cover examples and literal `Type/id` references too, and are sorted for a
  byte-deterministic file across rebuilds. New pure helper `buildRedirects` in
  `src/build/redirects.ts`.

- **Mermaid diagram rendering in narrative pages (client-side, lazy, themed)** — a
  ` ```mermaid ` fence authored in an IG's `pagecontent/*.md` (which IG Publisher emits as
  `<pre class="language-mermaid"><code…>SOURCE</code></pre>` and topcoat previously left
  un-rendered, having stripped IGP's own client script) now renders as an SVG diagram.
  `extractNarrative` rewrites each such block into
  `<pre class="mermaid" data-mermaid-src="SOURCE">SOURCE</pre>` (the source kept both as
  visible text — a JS-less/pre-render fallback — and in `data-mermaid-src` so the block can
  re-render on theme toggle), preserving the diagram source whitespace-exactly. A new runtime
  island (`src/ui/mermaid-entry.js` → `dist/ui/mermaid.js`, bundled by `scripts/build-mermaid.mjs`,
  content-fingerprinted like the other assets) is loaded by `site.js` **only** on pages that
  actually contain a diagram (gated on `[data-mermaid-src]` DOM presence), so diagram-free
  pages fetch nothing. The diagram is themed to the light/dark toggle and re-renders when the
  toggle flips; a malformed diagram degrades per-block (source stays visible with a small
  "could not be rendered" note) and never aborts the page. The mermaid bundle is ~1 MB gzipped
  — a documented, lazy, cached, diagram-only cost. Example/artifact pages are out of scope
  (no authored mermaid prose there).

- **Content-hash fingerprints for runtime assets (instant cache busting)** — the JS/CSS
  bundles (`site.js`, `palette.js`, `formbox.js`, `site.css`, `formbox.css`) are now emitted
  at content-fingerprinted paths (`igf/<name>.<hash>.<ext>`, first 8 hex of SHA-256) instead
  of stable ones, and every reference is rewritten accordingly: the `<script>`/`<link>` tags
  in each page, and the lazy `formbox` loader inside `site.js` (which reads the hashed URLs
  from `data-formbox-js`/`data-formbox-css` on its own script tag, so `site.js` stays
  byte-stable across deploys). Because the hosting serves `igf/*` with a long `max-age`, a
  fresh deploy could previously be masked for hours by a browser or edge cache still holding
  the old bundle behind new HTML (HTML is `max-age=0`); a changed asset is now a brand-new
  URL no cache has seen, so deploys are visible immediately and unchanged assets stay fully
  cacheable. Nothing is emitted at the old un-hashed paths. Fonts, the vendored `fuse.min.mjs`,
  and `palette-index.json` are intentionally left un-fingerprinted (change rarely / regenerated
  by name / resolved by relative `url()` from the same directory). Deterministic and fully
  generic — no IG-specific behavior.

- **Project-tag filter for the artifacts gallery** — artifacts' FHIR `meta.tag` codings
  (display, falling back to code) are read as project tags. The artifacts index gains an
  "All" + per-tag chip row with counts (shown only when at least one artifact is tagged)
  that filters entries client-side and composes with the existing kind chips and text
  filter. Tagged entries show a tag badge in the listing and on the artifact page header.
  Fully generic — no tag or IG is hard-coded; untagged IGs render unchanged.

## [1.0.0] — 2026-07-04

Initial release of **IG Topcoat**, a reusable companion tool for the HL7 FHIR IG Publisher.

### Features

- **Post-processes IG Publisher output** into a modern static site with the same page
  filenames, so all internal and inbound links keep working.
- **Interactive profile pages** — collapsible element tree with differential/snapshot views,
  must-support accents, flag badges, type/binding links, key-elements summary, and a
  syntax-highlighted JSON tab.
- **Filterable terminology pages** for CodeSystems and ValueSets, with expansions from
  `expansions.json`.
- **Interactive questionnaire preview** via `@formbox/renderer` (the renderer Cinder exposes),
  auto-rendered on the page, plus a static item-structure tree and JSON. The preview bundle is
  a prebuilt static asset — the React/Mantine toolchain is a dev dependency only.
- **Search** — ⌘K command palette (fuse.js) and full-text search (Pagefind), both fully static.
- **Design** — Plus Jakarta Sans + JetBrains Mono over a UNICEF-cyan light/dark theme,
  self-hosted fonts (offline-capable), color-coded artifact taxonomy, responsive layout.
- **Copy-through** of everything not re-rendered (`qa.html`, raw renditions, `package.tgz`,
  images), so the output is a drop-in replacement for the Publisher's `output/`.

### Distribution

- **GitHub Action** — the primary way to consume IG Topcoat by pinned version:
  `uses: recodelabs/ig-topcoat@v1`.
- **npm package** — ships a prebuilt `dist/`; the `npx` path installs only runtime
  dependencies. npm publish is wired (release workflow) and activates once an `NPM_TOKEN`
  secret is set.
