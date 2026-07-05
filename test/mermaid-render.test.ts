// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub the mermaid library so we exercise mermaid-entry.js's own render() logic —
// the per-block error handling and reset-before-render guarantees — without the
// real ~3 MB renderer. `vi.hoisted` lets the mock factory reference these spies.
const { initialize, run } = vi.hoisted(() => ({ initialize: vi.fn(), run: vi.fn() }));
vi.mock("mermaid", () => ({ default: { initialize, run } }));

// Importing the module runs its side effect: window.igfRenderMermaid = render.
import "../src/ui/mermaid-entry.js";

const SOURCE = "graph TD; A[Campaign]-->B[Task];";

function render(dark = false): Promise<void> {
  return (window as any).igfRenderMermaid(dark);
}

beforeEach(() => {
  initialize.mockReset();
  run.mockReset();
  document.body.innerHTML = `<pre class="mermaid" data-mermaid-src="${SOURCE}">${SOURCE}</pre>`;
});

describe("mermaid-entry render()", () => {
  it("catches a malformed diagram per-block: source stays visible, error note added, nothing thrown", async () => {
    run.mockRejectedValue(new Error("Parse error on line 1"));

    // Must not reject even though the only block fails to render.
    await expect(render(false)).resolves.toBeUndefined();

    const el = document.querySelector("[data-mermaid-src]")!;
    expect(el.classList.contains("mermaid-error")).toBe(true);
    // Raw diagram source is still visible to the reader (progressive degradation).
    expect(el.textContent).toContain(SOURCE);
    const notes = el.querySelectorAll(".mermaid-error-note");
    expect(notes.length).toBe(1);
    expect(notes[0].textContent).toMatch(/could not be rendered/i);
    // No leftover render marker on a failed block.
    expect(el.hasAttribute("data-processed")).toBe(false);
  });

  it("does not accumulate duplicate error notes across repeated (theme) re-renders", async () => {
    run.mockRejectedValue(new Error("boom"));

    await render(false);
    await render(true); // e.g. a light→dark toggle re-render
    await render(false);

    const el = document.querySelector("[data-mermaid-src]")!;
    // reset-to-source at the top of render() wipes the prior note before re-adding one.
    expect(el.querySelectorAll(".mermaid-error-note").length).toBe(1);
    expect(el.textContent).toContain(SOURCE);
  });

  it("re-rendering a healthy diagram does not stack duplicate SVGs (resets to data-mermaid-src each run)", async () => {
    // Simulate mermaid: mark processed and inject an <svg> into each node.
    run.mockImplementation(async ({ nodes }: any) => {
      for (const n of nodes) {
        n.setAttribute("data-processed", "true");
        n.innerHTML = "<svg data-diagram><g></g></svg>";
      }
    });

    await render(false);
    await render(true); // theme toggle re-render

    const el = document.querySelector("[data-mermaid-src]")!;
    expect(el.querySelectorAll("svg").length).toBe(1);
    expect(el.classList.contains("mermaid-error")).toBe(false);
    expect(el.querySelectorAll(".mermaid-error-note").length).toBe(0);
    // The theme is applied by re-initializing before each run.
    expect(initialize).toHaveBeenCalledTimes(2);
    expect(initialize.mock.calls[0][0]).toMatchObject({ theme: "default", securityLevel: "strict" });
    expect(initialize.mock.calls[1][0]).toMatchObject({ theme: "dark" });
  });
});
