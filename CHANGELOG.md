# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project aims to follow
[Semantic Versioning](https://semver.org/): consumers pin a major version (`@v1`) and
receive minor/patch improvements automatically; breaking changes land only in a new major.

## [Unreleased]

## [1.0.0] — pending

Initial release as a reusable companion tool for the HL7 FHIR IG Publisher.

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

- **GitHub Action** (`action.yml`) — the primary way to consume ig-fresh by pinned version.
- **npm package** — ships prebuilt `dist/`; the eventual `npx` path installs only runtime
  dependencies.

### Notes

- Package/repo name is being finalized; references will be updated before the first tagged
  release and npm publish.
