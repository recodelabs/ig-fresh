# Mermaid diagram support in ig-topcoat narrative pages

**Date:** 2026-07-05 · **Status:** Approved (Matt) · **Repo:** recodelabs/ig-topcoat

## Goal

Render Mermaid diagrams authored as ` ```mermaid ` fenced blocks in a FHIR IG's
narrative/guide pages (`pagecontent/*.md` → background, index, and similar), inside
the topcoat-rendered site — themed to the light/dark toggle, client-side, and
lazy-loaded **only** on pages that actually contain a diagram. Example/artifact pages
are out of scope: they are rendered from FHIR JSON by topcoat's own renderers and
carry no authored mermaid prose.

## Background — how mermaid reaches topcoat

IG Publisher turns a ` ```mermaid ` fence into
`<pre class="language-mermaid"><code class="language-mermaid">…source…</code></pre>`
and renders it **client-side** with its own 3.3 MB `mermaid.js` + a
`mermaid-init.js` (selector `pre.language-mermaid code.language-mermaid` → replace with
`<div class="mermaid">` → `mermaid.initialize`). Topcoat's `extractNarrative`
(`src/load/narrative.ts`, cheerio) lifts the authored content region and **strips
`<script>`**, so today the diagram source survives but nothing renders it. Topcoat's
shiki highlighting only touches artifact JSON, never narrative code — so mermaid
blocks arrive untouched. The theme toggle is `.dark` on `<html>` + `localStorage`
key `igf-theme` (`src/ui/site.js`).

## Decision (with Matt)

**Client-side, lazy-loaded.** Bundle mermaid as a topcoat runtime asset, fingerprinted
and handed off exactly like the formbox island; load it only on pages that contain a
diagram. Rejected: build-time SVG (needs puppeteer in the pinned-action CI — fragile,
and dark-mode means two SVGs); reusing IGP's assets (sandboxed iframes, no theming,
version coupling).

## Components

### 1. Build-time normalization — `src/load/narrative.ts`

In `extractNarrative`, after the existing cleanup, find IGP's mermaid blocks and
rewrite them for topcoat's renderer:

- Selector: a `code.language-mermaid` (covers both `pre.language-mermaid > code…`
  and a bare `pre > code.language-mermaid`).
- For each, take the code element's **text** (`$(el).text()` — strips any prism
  `<span>` markup, yields clean, whitespace-exact diagram source) and replace the
  enclosing `<pre>` with `<pre class="mermaid" data-mermaid-src="…">SOURCE</pre>`.
  The source is stored both as the element's text (visible pre-render fallback) and
  in `data-mermaid-src` (preserved so the block can re-render on theme toggle, since
  `mermaid.run` overwrites the element with SVG).
- Return an added boolean `hasMermaid` from `extractNarrative` (true when ≥1 block
  rewritten). Its return type becomes `{ title?, bodyHtml, hasMermaid }`.
- Pages with no mermaid: byte-identical output to today.

Whitespace: preserve the source exactly (mermaid is indentation-sensitive) — do not
trim or re-indent; only strip a single leading/trailing newline artifact if present.

### 2. Runtime bundle — `src/ui/mermaid-entry.js` + `scripts/build-mermaid.mjs`

`mermaid-entry.js` (mirrors `formbox-entry.jsx` shape):
- `import mermaid from "mermaid"` (esbuild bundles it).
- Expose `window.igfRenderMermaid(dark)`:
  - `mermaid.initialize({ startOnLoad:false, securityLevel:'strict',
    theme: dark ? 'dark' : 'default',
    themeVariables:{ fontFamily:'"Plus Jakarta Sans Variable", system-ui, sans-serif' } })`
  - For each `[data-mermaid-src]`: reset its content to the stored source and remove
    any `data-processed` marker (so re-invocation re-renders), then
    `await mermaid.run({ querySelector:'[data-mermaid-src]' })`.
  - Per-block try/catch: on error leave the source visible and add a small
    `.mermaid-error` note; never throw out of the whole batch.
- Not React/preact — plain module, so the bundle is mermaid only (no framework).

`scripts/build-mermaid.mjs`: copy of `build-mermaid` from `build-formbox.mjs` —
esbuild, `format:"iife"`, `outfile: dist/ui/mermaid.js`, minify, no sourcemap.
Wire it into the `"build"` script in `package.json` alongside `build-formbox`.

### 3. Asset registration + handoff

- `src/build/site.ts` `copyAssets`: add `["mermaid.js", dist/ui/mermaid.js]` to the
  copied list (auto-fingerprinted via the existing `contentHash`/`fingerprintName`
  path → `igf/mermaid.<hash>.js`).
- `src/render/shell.tsx`: emit `data-mermaid-js={asset(model, "mermaid.js")}` on the
  existing `site.js` `<script>` tag (beside `data-formbox-js`), so `site.js` stays
  content-stable and gets the hashed URL at runtime.
- The page model needs `hasMermaid` threaded from `extractNarrative` → the narrative
  page build path → available where the page is rendered (so `site.js` can also gate
  purely on DOM presence — see below — belt and suspenders).

### 4. Loader + theme re-render — `src/ui/site.js`

- On load: if `document.querySelector('[data-mermaid-src]')` exists, read
  `data-mermaid-js` off the `site.js` script tag, inject `<script src=…>`, and on
  load call `window.igfRenderMermaid(document.documentElement.classList.contains('dark'))`.
  Gate strictly on DOM presence so diagram-free pages fetch nothing.
- In the existing theme-toggle handler: after toggling `.dark`, if mermaid was loaded
  (`window.igfRenderMermaid`), call it again with the new dark state to re-theme.

### 5. Styling — `src/ui/site.css`

`.mermaid` (and `.prose .mermaid`): block, centered, `max-width:100%`,
`overflow-x:auto` for wide diagrams, vertical rhythm matching other prose blocks. A
pre-render state (the raw source shown in a muted monospace box until JS runs — so a
JS-less viewer still sees *something* meaningful). `.mermaid-error` small muted note.
Ensure the rendered SVG is legible on both surfaces (mermaid's own theme handles most;
add container background only if needed).

## Error handling / graceful degradation

- No diagram on a page → no `data-mermaid-src` → no bundle fetched, zero added weight.
- Malformed diagram → per-block catch, source + "diagram could not be rendered" note,
  page intact.
- Bundle fails to load → source stays visible (progressive enhancement).

## Testing

- **Unit (narrative):** `pre.language-mermaid` → `pre.mermaid[data-mermaid-src]` with
  clean text; whitespace/indentation preserved; `hasMermaid` true/false; multiple
  blocks on one page; a page with no mermaid is unchanged; a diagram whose source
  contains HTML-ish characters (`A --> B & C`) round-trips (escaping).
- **Unit (loader):** DOM-stub test (like `formbox-loader.test.ts`) — the shipped
  `site.js` injects the mermaid bundle **only** when `[data-mermaid-src]` present, and
  reads the hashed URL from `data-mermaid-js`.
- **Real-data / browser:** build the ICR IG output (`/Users/claudius/github/icr/ig/output`)
  to a scratch dir; inject a `pre.language-mermaid` block into one built narrative page
  (e.g. `background.html`) OR add a mermaid fence to a scratch pagecontent and rebuild;
  serve over HTTP; verify the diagram renders, re-renders correctly on the light/dark
  toggle, and that a diagram-free page loads no `igf/mermaid.*.js`. Screenshot both
  themes.

## Cost

Mermaid is ~1 MB gzipped. Lazy (diagram pages only), fingerprinted, cached. Documented,
contained tradeoff.

## Out of scope

- Example/artifact pages (no authored mermaid there).
- Build-time SVG pre-render (rejected above).
- A dedicated mermaid theme mirroring every topcoat CSS var (YAGNI — built-in
  default/dark + topcoat font is enough).

## Follow-on (separate, optional)

The ICR IG currently authors **no** mermaid. To show the feature live, a later change
can add an architecture diagram (the doc's three-layer model / Task→event chain are
natural candidates) to `icr/ig/input/pagecontent/`. Not part of this topcoat change.
