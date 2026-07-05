import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// The shipped, un-bundled client script that carries the lazy mermaid loader.
const SITE_JS = fs.readFileSync(fileURLToPath(new URL("../src/ui/site.js", import.meta.url)), "utf8");

/**
 * Run site.js against a minimal DOM stub. When `hasBlock` is true the document
 * contains one [data-mermaid-src] block; `mermaidJs` is the URL advertised on the
 * site.js <script> tag (or null to omit the attribute). Returns the <script>
 * element the loader appended to <body>, so we can assert whether — and from what
 * URL — the mermaid bundle was fetched.
 */
function runLoader(hasBlock: boolean, mermaidJs: string | null) {
  const appended: any[] = [];

  const scriptTag = {
    getAttribute: (n: string) => (n === "data-mermaid-js" ? mermaidJs : null),
  };

  const documentStub = {
    querySelectorAll: () => [],
    querySelector: (sel: string) => {
      if (sel === "[data-mermaid-src]") return hasBlock ? {} : null;
      if (sel === "script[data-mermaid-js]") return mermaidJs != null ? scriptTag : null;
      return null;
    },
    getElementById: () => null,
    createElement: (tag: string) => ({ tagName: tag }),
    documentElement: { classList: { toggle: () => false, add: () => {}, contains: () => false } },
    head: { appendChild: () => {} },
    body: { appendChild: (el: any) => appended.push(el) },
  };

  const windowStub: any = {};
  const fetchStub = () => Promise.resolve({ json: () => Promise.resolve({}) });
  const localStorageStub = { getItem: () => null, setItem: () => {} };

  // eslint-disable-next-line no-new-func
  const fn = new Function(
    "document", "window", "localStorage", "setInterval", "clearInterval", "fetch",
    SITE_JS,
  );
  fn(documentStub, windowStub, localStorageStub, setInterval, clearInterval, fetchStub);

  const script = appended.find((e) => e.tagName === "script");
  return { script };
}

describe("mermaid lazy loader", () => {
  it("injects the fingerprinted mermaid bundle when a diagram block is present", () => {
    const { script } = runLoader(true, "igf/mermaid.abcdef12.js");
    expect(script).toBeTruthy();
    expect(script.src).toBe("igf/mermaid.abcdef12.js");
  });

  it("does NOT fetch the mermaid bundle when no diagram block is present", () => {
    const { script } = runLoader(false, "igf/mermaid.abcdef12.js");
    expect(script).toBeUndefined();
  });

  it("falls back to the stable un-hashed path when no data-attribute is present", () => {
    const { script } = runLoader(true, null);
    expect(script.src).toBe("igf/mermaid.js");
  });
});
