# Architecture

## What ig-fresh is (and isn't)

ig-fresh is a **post-processor for the HL7 FHIR IG Publisher**, not a replacement for it.
The IG Publisher stays the authoritative engine — it compiles FSH, computes StructureDefinition
snapshots, expands value sets, validates every resource, and produces the QA report and the
canonical `.json`/`.xml`/`.ttl` artifacts. ig-fresh reads that finished build and re-renders
**only the presentation layer** into a modern, searchable static site.

Because it trusts the Publisher's output as ground truth, ig-fresh never reimplements
snapshot generation, terminology expansion, or validation — the parts most likely to be
subtly wrong.

```
FSH source
   │  SUSHI                FSH → FHIR JSON
   ▼
   │  IG Publisher         snapshots · expansions · validation · QA ·
   ▼                        canonical artifacts · standard HTML
ig/output/   ◄──────────── the authoritative build (source of truth)
   │  ig-fresh             reads output/, re-renders the presentation
   ▼
site/        ◄──────────── modern site: same filenames, new look
```

## The compatibility contract

ig-fresh consumes a standard IG Publisher `output/` directory and depends only on these
Publisher-produced files:

| Input | Used for |
| --- | --- |
| `ImplementationGuide-*.json` | metadata, page tree, menu, the list of every artifact |
| `<ResourceType>-<id>.json` | each artifact — profiles arrive **with the Publisher-computed snapshot**, so element trees are correct by construction |
| `expansions.json` | ValueSet expansions rendered as filterable concept tables |
| generated narrative HTML (`index.html`, authored pages) | authored content is extracted (cheerio) and re-hosted in the new shell |

It requires nothing IG-specific and works with any FHIR version the Publisher emits. As long
as this output shape holds, ig-fresh works — that is the stability promise consumers couple to.

## Fidelity — why links keep working

ig-fresh writes pages with the **exact same filenames** the Publisher uses
(`StructureDefinition-icr-campaign.html`, `artifacts.html`, …), so every internal and inbound
link resolves unchanged. Anything ig-fresh does not re-render — `qa.html`, the raw
`.json`/`.xml`/`.ttl` renditions, `package.tgz`, images — is **copied straight through**. The
result is a drop-in replacement for `output/`: same URLs, same downloads, same artifact set,
with a modern UI on top.

## Pipeline (code map)

| Stage | Location |
| --- | --- |
| Load IG resource (metadata, pages, artifact refs) | `src/load/ig.ts` |
| Scan + classify artifacts by kind | `src/load/artifacts.ts` |
| Load ValueSet expansions | `src/load/expansions.ts` |
| Extract authored narrative from Publisher HTML | `src/load/narrative.ts` |
| Build element tree from snapshot/differential | `src/model/element-tree.ts` |
| Resolve canonical URLs / references to hrefs | `src/render/links.ts` |
| Page shell (topbar, sidebar, banner, theme) | `src/render/shell.tsx` |
| Orchestration + copy-through + search index | `src/build/site.ts` |
| CLI | `src/cli.ts` |

Pages are rendered at build time with Preact SSR (`preact-render-to-string`) — there is **no
client-side framework runtime**. Interactivity (tabs, tree collapse, filters, ⌘K palette,
theme) is small hand-written vanilla JS in `src/ui/`. Search is a fuse.js command palette plus
a Pagefind full-text index; both are fully static.

## Extension point: renderers

Each artifact is dispatched to a renderer by `resourceType` in `src/build/site.ts`:

```ts
const body =
  a.resourceType === "StructureDefinition" ? renderStructureDefinition(a, ctx)
  : a.resourceType === "CodeSystem"        ? renderCodeSystem(a, ctx)
  : a.resourceType === "ValueSet"          ? renderValueSet(a, ctx)
  : a.resourceType === "Questionnaire"     ? renderQuestionnaire(a, ctx)
  : renderInstance(a, ctx); // generic fallback: metadata + JSON
```

Any resource type without a dedicated renderer still gets a valid page via `renderInstance`
(metadata + syntax-highlighted JSON), so the build never fails on an unknown type — it just
isn't specialized yet.

**To add a renderer** (e.g. StructureMap, CapabilityStatement):

1. Create `src/render/<type>.tsx` exporting `render<Type>(a: Artifact, ctx: RenderCtx): VNode`.
2. Add a branch to the dispatch above.
3. If the type needs its own sidebar group, add a kind in `src/model/types.ts`
   (`ArtifactKind`, `KIND_INFO`, `KIND_ORDER`) and classify it in `src/load/artifacts.ts`.
4. Add a render test under `test/`.

Because ig-fresh is consumed by reference (see below), a renderer added once reaches every
IG that upgrades — improvements flow to all consumers.

## Distribution & downstream improvements

ig-fresh is meant to be **consumed by reference, never forked**. Each IG references a
published, versioned build; patch/minor improvements then reach every consumer on its next
build with no action on their part.

- **GitHub Action (primary):** `uses: recodelabs/ig-fresh@v1`. The composite action builds
  ig-fresh from its pinned ref and renders the caller's `output/`. The `v1` moving tag carries
  non-breaking improvements automatically.
- **npm CLI (optional, when published):** `npx ig-fresh@^1 build -i output -o site`. The
  published package ships a prebuilt `dist/` (including the questionnaire-preview bundle), so
  the React/Mantine/formbox toolchain lives in `devDependencies` and is **not** installed by
  consumers.

Breaking changes land only in a new major (`v2`), which consumers opt into deliberately.
