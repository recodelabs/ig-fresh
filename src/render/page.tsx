import type { VNode } from "preact";

/** A narrative page: publisher-authored content re-hosted inside the new shell. */
export function renderNarrative(bodyHtml: string): VNode {
  return <article class="prose" dangerouslySetInnerHTML={{ __html: bodyHtml }} />;
}

/** Full-text search results page backed by Pagefind. */
export function renderSearchPage(): VNode {
  return (
    <article>
      <h1>Search</h1>
      <p class="page-lede">
        Full-text search across every page and artifact in this guide. For quick artifact
        lookup, press <kbd>⌘K</kbd> anywhere.
      </p>
      <link href="pagefind/pagefind-ui.css" rel="stylesheet" />
      <div id="pagefind-search" style="margin-top:20px" />
      <script src="pagefind/pagefind-ui.js" />
      <script
        dangerouslySetInnerHTML={{
          __html: `window.addEventListener("DOMContentLoaded", function () {
            if (window.PagefindUI) new PagefindUI({ element: "#pagefind-search", showSubResults: true, pageSize: 8 });
            else document.getElementById("pagefind-search").innerHTML = "<p style='color:var(--ink-muted)'>Search index not available. Build with Pagefind enabled and serve over HTTP.</p>";
          });`,
        }}
      />
    </article>
  );
}
