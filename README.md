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
- **A designed reading experience** — warm-paper light theme and deep-ink dark theme,
  Fraunces + IBM Plex type (self-hosted, works offline), color-coded artifact taxonomy,
  responsive layout with a mobile drawer
- **Faithful to the IG** — draft/status banner, canonical URLs with copy buttons,
  publisher QA report and raw JSON/XML/Turtle renditions linked; everything ig-fresh
  doesn't re-render is copied through untouched

The publisher toolchain stays the source of truth: validation, snapshot computation,
terminology expansion, and QA all still come from `sushi` + IG Publisher. ig-fresh only
re-renders the site.

## Usage

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

## Development

- `npm test` — vitest unit + render tests
- `node scripts/check-links.mjs <site-dir> --only-fresh` — assert no broken internal links

Fails soft: a malformed artifact gets a generic fallback page and a warning, never a
broken build.

## License

Apache-2.0
