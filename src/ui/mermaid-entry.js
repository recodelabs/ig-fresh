// Standalone, lazily-loaded island that renders authored Mermaid diagrams in a
// FHIR IG's narrative pages. IG Publisher turns a ```mermaid fence into
// `<pre class="language-mermaid"><code…>SOURCE</code></pre>`; topcoat's
// extractNarrative (src/load/narrative.ts) rewrites those into
// `<pre class="mermaid" data-mermaid-src="SOURCE">SOURCE</pre>`. This module —
// bundled once into igf/mermaid.js and loaded only on pages that contain such a
// block — turns them into themed SVGs, and can re-render on the light/dark toggle.
//
// Not React/preact: the bundle is mermaid only (no framework). esbuild inlines
// the mermaid library at build time.
import mermaid from "mermaid";

/**
 * Render (or re-render) every `[data-mermaid-src]` block on the page.
 * @param {boolean} dark  render with mermaid's dark theme when true.
 */
async function render(dark) {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: dark ? "dark" : "default",
    themeVariables: {
      fontFamily: '"Plus Jakarta Sans Variable", system-ui, sans-serif',
    },
  });

  var blocks = document.querySelectorAll("[data-mermaid-src]");
  // Reset each block to its stored source and clear the marker mermaid stamps on
  // rendered nodes, so a re-invocation (theme toggle) re-renders from scratch.
  blocks.forEach(function (el) {
    var src = el.getAttribute("data-mermaid-src");
    if (src != null) el.textContent = src;
    el.removeAttribute("data-processed");
    el.classList.remove("mermaid-error");
  });

  // Render block-by-block so one malformed diagram cannot abort the batch.
  for (var i = 0; i < blocks.length; i++) {
    var el = blocks[i];
    try {
      // mermaid.run keys off the element's own id; give it a stable per-block id.
      if (!el.id) el.id = "igf-mermaid-" + i;
      // eslint-disable-next-line no-await-in-loop
      await mermaid.run({ nodes: [el] });
    } catch (e) {
      // Leave the source visible and flag the failure; never throw out of the loop.
      var srcText = el.getAttribute("data-mermaid-src");
      if (srcText != null) el.textContent = srcText;
      el.removeAttribute("data-processed");
      el.classList.add("mermaid-error");
      if (!el.querySelector(".mermaid-error-note")) {
        var note = document.createElement("div");
        note.className = "mermaid-error-note";
        note.textContent = "Diagram could not be rendered.";
        el.appendChild(note);
      }
    }
  }
}

window.igfRenderMermaid = render;
