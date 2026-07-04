# ig-fresh

**A modern, searchable static site generator for HL7 FHIR IG Publisher output.**

The HL7 IG Publisher produces authoritative but dated HTML. `ig-fresh` post-processes a
built publisher `output/` directory into a redesigned static site — same page filenames
(every link keeps working), same artifact set and canonical URLs, completely rethought
presentation:

- **⌘K command palette** — fuzzy quick-switcher over every artifact and page, grouped and
  color-coded by kind (fuse.js, client-side)
- **Full-text search** — Pagefind index over the whole site, zero server required
- **Interactive profile pages** — collapsible element tree with differential/snapshot
  views, must-support accent rails, flag badges, type/binding links, a "key elements"
  summary, and a syntax-highlighted JSON tab (shiki, light+dark)
- **Filterable terminology pages** — instant client-side concept filtering; ValueSet
  expansions pulled from `expansions.json`
- **Interactive questionnaire preview** — Questionnaire pages get a live form rendered by
  [`@formbox/renderer`](https://www.npmjs.com/package/@formbox/renderer) (the renderer
  Cinder exposes), plus a static item-structure tree and JSON. The ~0.7 MB renderer bundle
  is built once as a shared asset and lazy-loaded only when a user opens the preview
- **A designed reading experience** — Plus Jakarta Sans + JetBrains Mono over a UNICEF-cyan
  light/dark theme (self-hosted fonts, works offline), color-coded artifact taxonomy,
  responsive layout with a mobile drawer
- **Faithful to the IG** — draft/status banner, canonical URLs with copy buttons,
  publisher QA report and raw JSON/XML/Turtle renditions linked; everything ig-fresh
  doesn't re-render is copied through untouched

The publisher toolchain stays the source of truth: validation, snapshot computation,
terminology expansion, and QA all still come from `sushi` + IG Publisher. ig-fresh only
re-renders the site. It works on **any** IG Publisher output — see
[`ARCHITECTURE.md`](./ARCHITECTURE.md) for the compatibility contract.

## Usage

### In CI (recommended) — GitHub Action

Consume ig-fresh by pinned version so you inherit improvements automatically. After your IG
Publisher build has produced `output/`:

```yaml
- name: Render modern site
  uses: recodelabs/ig-fresh@v1
  with:
    input: output      # IG Publisher output directory
    output: _site      # where to write the rendered site
```

Pinning `@v1` gives you every non-breaking improvement on your next build; breaking changes
land only in a new major (`@v2`).

### Locally

```sh
npm install && npm run build
node dist/cli.js build -i path/to/ig/output -o path/to/site
```

Serve the result over HTTP (search needs it): `cd path/to/site && npx serve`.

## Pipeline

```
ig/output/  ──►  load: ImplementationGuide-*.json (pages, resources)
                       <Type>-<id>.json artifacts (publisher-computed snapshots)
                       expansions.json, narrative HTML (cheerio extraction)
            ──►  model: typed artifacts by kind + element trees
            ──►  render: Preact SSR → static HTML (no client framework)
            ──►  index: palette-index.json + Pagefind
            ──►  copy-through: everything else (qa.html, renditions, package.tgz…)
```

## Extending & contributing

ig-fresh is designed to be consumed by reference, so a renderer added once reaches every IG
that upgrades. Adding support for a new resource type (StructureMap, CapabilityStatement, …)
is the highest-leverage contribution — see [`CONTRIBUTING.md`](./CONTRIBUTING.md) and the
"Extension point: renderers" section of [`ARCHITECTURE.md`](./ARCHITECTURE.md).

Fails soft: a malformed or unrecognized artifact gets a generic fallback page and a warning,
never a broken build.

## License

Apache-2.0
