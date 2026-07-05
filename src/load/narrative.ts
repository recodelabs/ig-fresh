import * as cheerio from "cheerio";

/**
 * Extract the authored content region from a publisher-generated HTML page,
 * dropping the publisher chrome (header, navbar, publish-box, breadcrumbs, footer, scripts).
 */
export function extractNarrative(html: string): {
  title?: string;
  bodyHtml: string;
  hasMermaid: boolean;
} {
  const $ = cheerio.load(html);
  const title = $("head > title").text() || undefined;

  let region = $("#segment-content .col-12").first();
  if (!region.length) region = $("#segment-content").first();
  if (!region.length) region = $("main").first();
  if (!region.length) region = $("body").first();

  region.find("script, style").remove();
  region.find(".publish-box, #publish-box").remove();
  region.find("#segment-breadcrumb, .breadcrumb").remove();
  region.find("#markdown-toc").closest("div").addClass("ig-toc");

  const hasMermaid = rewriteMermaid($, region);

  return { title, bodyHtml: region.html() ?? "", hasMermaid };
}

/**
 * Rewrite IG Publisher's mermaid blocks into topcoat's runtime-island shape.
 *
 * IG Publisher renders a ```mermaid fence as
 * `<pre class="language-mermaid"><code class="language-mermaid">SOURCE</code></pre>`
 * (sometimes with prism `<span>` markup inside the code) and ships its own
 * client-side renderer — which extractNarrative strips along with every other
 * `<script>`. We replace each such `<pre>` with
 * `<pre class="mermaid" data-mermaid-src="SOURCE">SOURCE</pre>` so topcoat's own
 * lazy mermaid island (src/ui/mermaid-entry.js) can render it, themed to the
 * light/dark toggle. The source is stored both as the element's visible text
 * (a pre-render / JS-less fallback) and in `data-mermaid-src` (preserved so the
 * block can be re-rendered on theme toggle, since mermaid.run overwrites the
 * element with SVG).
 *
 * `$(code).text()` yields clean, whitespace-exact diagram source (strips any
 * prism span markup and HTML-decodes entities). Cheerio re-encodes it on output,
 * so HTML-ish source like `A --> B & C` round-trips safely.
 *
 * @returns true when ≥1 block was rewritten.
 */
function rewriteMermaid($: cheerio.CheerioAPI, region: cheerio.Cheerio<any>): boolean {
  // Covers both `pre.language-mermaid > code…` and a bare `pre > code.language-mermaid`.
  const codes = region.find("code.language-mermaid");
  if (!codes.length) return false;

  codes.each((_, codeEl) => {
    const $code = $(codeEl);
    const $pre = $code.closest("pre");
    const target = $pre.length ? $pre : $code;
    // Preserve indentation exactly (mermaid is whitespace-sensitive); only trim a
    // single leading/trailing newline artifact from the fence.
    const source = $code.text().replace(/^\n/, "").replace(/\n$/, "");
    const $out = $("<pre>").addClass("mermaid").attr("data-mermaid-src", source).text(source);
    target.replaceWith($out);
  });

  return true;
}
