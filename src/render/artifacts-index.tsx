import type { VNode } from "preact";
import type { Artifact, ArtifactKind, IgModel } from "../model/types.js";
import { KIND_INFO, KIND_ORDER } from "../model/types.js";
import { KindBadge } from "./components.js";

export function renderArtifactsIndex(model: IgModel): VNode {
  const counts = new Map<ArtifactKind, number>();
  for (const a of model.artifacts) counts.set(a.kind, (counts.get(a.kind) ?? 0) + 1);
  const kinds = KIND_ORDER.filter((k) => counts.get(k));
  const ordered = KIND_ORDER.flatMap((k) => model.artifacts.filter((a) => a.kind === k));

  return (
    <article data-pagefind-ignore>
      <h1>Artifacts</h1>
      <p class="page-lede">
        Every conformance resource and example this implementation guide defines —{" "}
        {model.artifacts.length} artifacts. Filter by kind, or type to search names and
        descriptions.
      </p>
      <div class="index-controls">
        <input
          class="filter-input font-mono"
          type="search"
          placeholder="Filter artifacts…"
          data-filter="artifact-list"
          aria-label="Filter artifacts"
          style="margin-bottom:0"
        />
        <span style="font-size:12px;color:var(--ink-faint)">
          <span data-filter-count="artifact-list">{model.artifacts.length}</span> shown
        </span>
      </div>
      <div class="index-controls" role="group" aria-label="Filter by artifact kind">
        {kinds.map((k) => (
          <button type="button" class={`kind-filter kind-${k}`} data-kind-chip={k} aria-pressed="false">
            {KIND_INFO[k].plural} <span style="opacity:.55">{counts.get(k)}</span>
          </button>
        ))}
      </div>
      <div class="artifact-list" id="artifact-list">
        {ordered.map((a) => (
          <a
            class={`artifact-item kind-${a.kind}`}
            href={a.filename}
            data-kind={a.kind}
            data-filter-text={`${a.name} ${a.title} ${a.id} ${a.description ?? ""}`.toLowerCase()}
          >
            <h3>{a.title}</h3>
            <KindBadge kind={a.kind} />
            {a.description ? <p>{a.description}</p> : null}
          </a>
        ))}
      </div>
    </article>
  );
}
