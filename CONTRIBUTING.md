# Contributing

## Development

```sh
npm install
npm run build          # tsc + tailwind + formbox bundle + copy UI assets
npm test               # vitest unit + render tests

# render a real IG to preview your change
node dist/cli.js build -i path/to/ig/output -o /tmp/site
node scripts/check-links.mjs /tmp/site --only-fresh
cd /tmp/site && npx serve
```

The project is TypeScript + Preact SSR (no client framework runtime). See
[`ARCHITECTURE.md`](./ARCHITECTURE.md) for the pipeline and code map.

## Adding a renderer for a new resource type

This is the highest-leverage contribution: a renderer added once reaches every IG that
upgrades. Steps (see the "Extension point: renderers" section of `ARCHITECTURE.md`):

1. Create `src/render/<type>.tsx` exporting `render<Type>(a: Artifact, ctx: RenderCtx): VNode`.
2. Add a dispatch branch in `src/build/site.ts`.
3. If it needs its own sidebar group, add an `ArtifactKind` in `src/model/types.ts` and
   classify it in `src/load/artifacts.ts`.
4. Add a render test under `test/`.

Keep the build resilient: never throw on unexpected input — fall back gracefully so one bad
artifact can't fail a whole IG build.

## Releasing

Consumers pin `@v1`, so semantic versioning matters:

- **patch/minor** — bug fixes and additive features (new renderers, UI improvements).
- **major** — anything that changes output filenames, the CLI contract, or breaks consumers.

To cut a release:

1. Update `CHANGELOG.md`, bump `version` in `package.json`.
2. Tag `vX.Y.Z` and push — the release workflow builds, tests, and (if `NPM_TOKEN` is set)
   publishes to npm.
3. Advance the moving major tag so `@v1` consumers get it:
   ```sh
   git tag -f v1 vX.Y.Z && git push -f origin v1
   ```
