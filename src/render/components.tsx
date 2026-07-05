import type { ComponentChildren, VNode } from "preact";
import type { ArtifactKind } from "../model/types.js";
import { KIND_INFO } from "../model/types.js";

/**
 * The color-coded artifact taxonomy. Each kind gets a hue used consistently
 * in badges, sidebar markers, index cards, and the command palette.
 * Values are CSS custom-property suffixes defined in site.css.
 */
export const KIND_COLOR: Record<ArtifactKind, string> = {
  profile: "profile",
  extension: "extension",
  logical: "logical",
  codesystem: "codesystem",
  valueset: "valueset",
  conceptmap: "conceptmap",
  capability: "capability",
  operation: "operation",
  questionnaire: "questionnaire",
  measure: "measure",
  example: "example",
  other: "other",
};

export function KindBadge({ kind, compact }: { kind: ArtifactKind; compact?: boolean }) {
  return (
    <span class={`kind-badge kind-${KIND_COLOR[kind]}`} data-kind={kind}>
      <span class="kind-dot" aria-hidden="true" />
      {compact ? KIND_INFO[kind].label : KIND_INFO[kind].label}
    </span>
  );
}

export function StatusPill({ status, version }: { status?: string; version?: string }) {
  if (!status && !version) return null;
  return (
    <span class="status-pill">
      {version ? <span class="font-mono">v{version}</span> : null}
      {version && status ? <span class="opacity-40">·</span> : null}
      {status ? <span>{status}</span> : null}
    </span>
  );
}

/** A small project-tag pill (from `meta.tag`), used in listings and artifact headers. */
export function TagBadge({ label }: { label: string }) {
  return (
    <span class="tag-badge" title={`Project tag: ${label}`}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
        <circle cx="7.5" cy="7.5" r="0.5" fill="currentColor" />
      </svg>
      {label}
    </span>
  );
}

/** Render a run of project-tag pills for an artifact's tags (nothing when empty). */
export function TagBadges({ tags }: { tags: { label: string }[] }) {
  return (
    <>
      {tags.map((t) => (
        <TagBadge label={t.label} />
      ))}
    </>
  );
}

export function FlagBadge({ flag, title }: { flag: string; title: string }) {
  return (
    <span class={`flag-badge flag-${flag}`} title={title} aria-label={title}>
      {flag === "ms" ? "S" : flag === "mod" ? "?!" : flag === "sum" ? "Σ" : flag}
    </span>
  );
}

export function Card({
  title,
  children,
  class: cls,
}: {
  title?: ComponentChildren;
  children: ComponentChildren;
  class?: string;
}) {
  return (
    <section class={`card ${cls ?? ""}`}>
      {title ? <h2 class="card-title">{title}</h2> : null}
      {children}
    </section>
  );
}

export interface TabSpec {
  id: string;
  label: ComponentChildren;
  content: VNode;
}

/** Accessible, JS-enhanced tabs. Without JS all panels render stacked. */
export function Tabs({ id, tabs, initial }: { id: string; tabs: TabSpec[]; initial?: string }) {
  const active = initial ?? tabs[0]?.id;
  return (
    <div class="tabs" data-tabs={id}>
      <div class="tab-list" role="tablist">
        {tabs.map((t) => (
          <button
            type="button"
            role="tab"
            id={`tab-${id}-${t.id}`}
            aria-controls={`panel-${id}-${t.id}`}
            aria-selected={t.id === active ? "true" : "false"}
            data-tab={t.id}
            class="tab-btn"
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div
          role="tabpanel"
          id={`panel-${id}-${t.id}`}
          aria-labelledby={`tab-${id}-${t.id}`}
          data-panel={t.id}
          class="tab-panel"
          hidden={t.id !== active}
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  return (
    <button type="button" class="copy-btn" data-copy={text} title={label} aria-label={label}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      <span class="copy-done" aria-hidden="true">✓</span>
    </button>
  );
}

/** Definition-list style metadata grid used in artifact headers. */
export function MetaGrid({ rows }: { rows: { label: string; value: ComponentChildren }[] }) {
  return (
    <dl class="meta-grid">
      {rows
        .filter((r) => r.value !== undefined && r.value !== null && r.value !== "")
        .map((r) => (
          <div class="meta-row">
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
    </dl>
  );
}
