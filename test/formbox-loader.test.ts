import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// The shipped, un-bundled client script that carries the lazy formbox loader.
const SITE_JS = fs.readFileSync(fileURLToPath(new URL("../src/ui/site.js", import.meta.url)), "utf8");

/**
 * Run site.js against a minimal DOM stub containing one questionnaire-preview
 * host and a site.js <script> tag whose data-attributes advertise the given
 * formbox URLs. Returns the <link> and <script> elements the loader created, so
 * we can assert the loader fetched exactly the URLs the page handed it.
 */
function runLoader(formboxAttrs: { js?: string; css?: string } | null) {
  const created: any[] = [];

  const host = {
    getAttribute: (n: string) => (n === "data-questionnaire-src" ? "Questionnaire-x.json" : null),
    querySelector: () => ({}),
    set innerHTML(_: string) {},
  };

  const scriptTag = formboxAttrs
    ? {
        getAttribute: (n: string) =>
          n === "data-formbox-js" ? (formboxAttrs.js ?? null)
          : n === "data-formbox-css" ? (formboxAttrs.css ?? null)
          : null,
      }
    : null;

  const documentStub = {
    querySelectorAll: (sel: string) => (sel === "[data-questionnaire-preview]" ? [host] : []),
    querySelector: (sel: string) => (sel === "script[data-formbox-js]" ? scriptTag : null),
    getElementById: () => null,
    createElement: (tag: string) => {
      const el: any = { tagName: tag };
      created.push(el);
      return el;
    },
    documentElement: { classList: { toggle: () => false, add: () => {} } },
    head: { appendChild: () => {} },
    body: { appendChild: () => {} },
  };

  const windowStub: any = {}; // no igfMountQuestionnaire → loader proceeds to inject
  const fetchStub = () => Promise.resolve({ json: () => Promise.resolve({}) });
  const localStorageStub = { getItem: () => null, setItem: () => {} };

  // eslint-disable-next-line no-new-func
  const fn = new Function(
    "document", "window", "localStorage", "setInterval", "clearInterval", "fetch",
    SITE_JS,
  );
  fn(documentStub, windowStub, localStorageStub, setInterval, clearInterval, fetchStub);

  const link = created.find((e) => e.tagName === "link");
  const script = created.find((e) => e.tagName === "script");
  return { link, script };
}

describe("formbox lazy loader", () => {
  it("loads the fingerprinted formbox URLs advertised on the site.js script tag", () => {
    const { link, script } = runLoader({
      js: "igf/formbox.dddddddd.js",
      css: "igf/formbox.eeeeeeee.css",
    });
    expect(script.src).toBe("igf/formbox.dddddddd.js");
    expect(link.rel).toBe("stylesheet");
    expect(link.href).toBe("igf/formbox.eeeeeeee.css");
  });

  it("falls back to stable un-hashed paths when no data-attributes are present", () => {
    const { link, script } = runLoader(null);
    expect(script.src).toBe("igf/formbox.js");
    expect(link.href).toBe("igf/formbox.css");
  });
});
