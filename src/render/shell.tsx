import type { ComponentChildren, VNode } from "preact";
import { render } from "preact-render-to-string";
import type { Artifact, ArtifactKind, IgModel } from "../model/types.js";
import { KIND_INFO, KIND_ORDER } from "../model/types.js";

export interface Crumb {
  label: string;
  href?: string;
}

export interface PageOpts {
  filename: string;
  title: string;
  breadcrumbs: Crumb[];
  body: VNode;
  /** kind of the artifact this page renders, for sidebar highlighting */
  activeKind?: ArtifactKind;
}

function groupArtifacts(artifacts: Artifact[]): Map<ArtifactKind, Artifact[]> {
  const groups = new Map<ArtifactKind, Artifact[]>();
  for (const kind of KIND_ORDER) groups.set(kind, []);
  for (const a of artifacts) groups.get(a.kind)!.push(a);
  for (const [k, list] of groups) if (!list.length) groups.delete(k);
  return groups;
}

function Sidebar({ model, current, activeKind }: { model: IgModel; current: string; activeKind?: ArtifactKind }) {
  const groups = groupArtifacts(model.artifacts);
  return (
    <nav id="sidebar" class="sidebar" aria-label="Implementation guide navigation">
      <div class="sidebar-section">
        <div class="sidebar-heading">Guide</div>
        <ul>
          {model.pages.map((p) => (
            <li>
              <a href={p.source} class={`side-link ${current === p.source ? "is-active" : ""}`} aria-current={current === p.source ? "page" : undefined}>
                {p.title}
              </a>
              {p.children.length ? (
                <ul class="side-sub">
                  {p.children.map((c) => (
                    <li>
                      <a href={c.source} class={`side-link ${current === c.source ? "is-active" : ""}`}>
                        {c.title}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
          <li>
            <a href="artifacts.html" class={`side-link ${current === "artifacts.html" ? "is-active" : ""}`}>
              Artifacts
            </a>
          </li>
        </ul>
      </div>
      {[...groups.entries()].map(([kind, list]) => {
        const open = activeKind === kind || list.some((a) => a.filename === current);
        return (
          <div class="sidebar-section">
            <button
              type="button"
              class={`sidebar-group kind-${kind}`}
              data-collapse={`group-${kind}`}
              aria-expanded={open ? "true" : "false"}
            >
              <span class="kind-dot" aria-hidden="true" />
              <span class="sidebar-group-label">{KIND_INFO[kind].plural}</span>
              <span class="sidebar-count">{list.length}</span>
              <svg class="chev" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
            <ul id={`group-${kind}`} hidden={!open}>
              {list.map((a) => (
                <li>
                  <a
                    href={a.filename}
                    class={`side-link side-artifact ${current === a.filename ? "is-active" : ""}`}
                    aria-current={current === a.filename ? "page" : undefined}
                  >
                    {a.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function Topbar({ model }: { model: IgModel }) {
  return (
    <header class="topbar">
      <button type="button" class="menu-btn" data-drawer aria-label="Open navigation">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>
      <a class="brand" href="index.html">
        <span class="brand-mark" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 3a14.4 14.4 0 0 0 0 18M12 3a14.4 14.4 0 0 1 0 18M3.5 9h17M3.5 15h17" />
          </svg>
        </span>
        <span class="brand-text">
          <span class="brand-title">{model.meta.title}</span>
          <span class="brand-sub font-mono">
            {model.meta.id} · v{model.meta.version} · FHIR {model.meta.fhirVersion}
          </span>
        </span>
      </a>
      <div class="topbar-actions">
        <button type="button" class="search-btn" data-palette-open>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <span>Search…</span>
          <kbd class="font-mono">⌘K</kbd>
        </button>
        <a class="icon-btn" href="ig-search.html" title="Full-text search" aria-label="Full-text search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6M9.5 15.5 11 17l3.5-3.5" />
          </svg>
        </a>
        <button type="button" class="icon-btn" data-theme-toggle title="Toggle theme" aria-label="Toggle dark mode">
          <svg class="icon-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
          <svg class="icon-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </svg>
        </button>
      </div>
    </header>
  );
}

function StatusBanner({ model }: { model: IgModel }) {
  if (model.meta.status === "active" || model.meta.status === "retired") return null;
  return (
    <div class="status-banner" role="note">
      <strong>{model.meta.status === "draft" ? "Draft" : model.meta.status}</strong> — this
      implementation guide is a working snapshot (v{model.meta.version}) and its content may
      change without notice.
    </div>
  );
}

export function renderPage(model: IgModel, opts: PageOpts): string {
  const crumbs = opts.breadcrumbs;
  const doc = (
    <html lang="en" data-ig={model.meta.id}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`${opts.title} — ${model.meta.title}`}</title>
        <meta name="generator" content="ig-fresh" />
        <link rel="stylesheet" href="igf/site.css" />
        <script
          // set theme before first paint to avoid flash
          dangerouslySetInnerHTML={{
            __html:
              `(function(){try{var t=localStorage.getItem("igf-theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <a class="skip-link" href="#content">Skip to content</a>
        <Topbar model={model} />
        <StatusBanner model={model} />
        <div class="frame">
          <Sidebar model={model} current={opts.filename} activeKind={opts.activeKind} />
          <div class="backdrop" data-backdrop hidden />
          <main id="content" class="content" data-pagefind-body>
            {crumbs.length > 1 ? (
              <nav class="crumbs" aria-label="Breadcrumb">
                {crumbs.map((c, i) => (
                  <span class="crumb">
                    {c.href && i < crumbs.length - 1 ? <a href={c.href}>{c.label}</a> : <span aria-current="page">{c.label}</span>}
                    {i < crumbs.length - 1 ? <span class="crumb-sep" aria-hidden="true">/</span> : null}
                  </span>
                ))}
              </nav>
            ) : null}
            {opts.body}
            <footer class="site-footer">
              <span>
                {model.meta.title} v{model.meta.version} · {model.meta.publisher ?? ""}
              </span>
              <span>
                Built from IG Publisher output by <a href="https://github.com/onaio/ig-fresh">ig-fresh</a> ·{" "}
                <a href="qa.html">QA report</a>
              </span>
            </footer>
          </main>
        </div>
        <div class="palette" data-palette hidden>
          <div class="palette-panel" role="dialog" aria-modal="true" aria-label="Search this guide">
            <input
              class="palette-input font-mono"
              type="text"
              placeholder="Search profiles, extensions, terminology, pages…"
              data-palette-input
              autocomplete="off"
              spellcheck={false}
            />
            <div class="palette-results" data-palette-results role="listbox" aria-label="Results" />
            <div class="palette-foot">
              <span><kbd>↑↓</kbd> navigate</span>
              <span><kbd>↵</kbd> open</span>
              <span><kbd>esc</kbd> close</span>
              <a href="ig-search.html">Full-text search →</a>
            </div>
          </div>
        </div>
        <script src="igf/site.js" defer />
        <script src="igf/palette.js" defer />
      </body>
    </html>
  );
  return "<!DOCTYPE html>\n" + render(doc);
}
