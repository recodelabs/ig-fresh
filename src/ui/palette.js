// ⌘K command palette: fuzzy quick-switcher over all artifacts + pages.
// Loads igf/palette-index.json lazily on first open; fuzzy match via vendored Fuse.js.
(function () {
  "use strict";
  var overlay = document.querySelector("[data-palette]");
  var input = document.querySelector("[data-palette-input]");
  var results = document.querySelector("[data-palette-results]");
  if (!overlay || !input || !results) return;

  var fuse = null;
  var items = [];
  var selected = 0;
  var KIND_LABELS = {
    profile: "Profiles", extension: "Extensions", logical: "Logical Models",
    valueset: "Value Sets", codesystem: "Code Systems", conceptmap: "Concept Maps",
    questionnaire: "Questionnaires", measure: "Measures", capability: "Capability Statements",
    operation: "Operations", example: "Examples", other: "Artifacts", page: "Pages",
  };

  function open() {
    overlay.hidden = false;
    input.value = "";
    render([]);
    input.focus();
    if (!fuse) load();
  }
  function close() {
    overlay.hidden = true;
  }
  function load() {
    Promise.all([
      fetch("igf/palette-index.json").then(function (r) { return r.json(); }),
      import("./fuse.min.mjs"),
    ]).then(function (loaded) {
      items = loaded[0].items;
      var Fuse = loaded[1].default;
      fuse = new Fuse(items, {
        keys: [
          { name: "title", weight: 2 },
          { name: "id", weight: 1.5 },
          { name: "desc", weight: 0.6 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
      });
      if (input.value) render(search(input.value));
    }).catch(function () {
      results.innerHTML = '<div class="palette-empty">Search index unavailable — try the <a href="ig-search.html">full-text search</a>. (Serving over HTTP is required for search.)</div>';
    });
  }
  function search(q) {
    if (!fuse || !q.trim()) return [];
    return fuse.search(q.trim(), { limit: 24 }).map(function (r) { return r.item; });
  }
  function render(list) {
    selected = 0;
    if (!input.value.trim()) {
      results.innerHTML = '<div class="palette-empty">Type to search ' +
        (items.length || "…") + " artifacts and pages</div>";
      return;
    }
    if (!list.length) {
      results.innerHTML = '<div class="palette-empty">No matches.</div>';
      return;
    }
    var html = "";
    var lastKind = null;
    list.forEach(function (item, i) {
      if (item.kind !== lastKind) {
        html += '<div class="palette-group">' + (KIND_LABELS[item.kind] || item.kind) + "</div>";
        lastKind = item.kind;
      }
      html +=
        '<a class="palette-item kind-' + item.kind + '" role="option" data-i="' + i + '"' +
        (i === 0 ? ' aria-selected="true"' : "") +
        ' href="' + item.href + '">' +
        '<span class="kind-dot"></span><span>' + escapeHtml(item.title) + "</span>" +
        (item.desc ? "<small>" + escapeHtml(item.desc) + "</small>" : "") +
        "</a>";
    });
    results.innerHTML = html;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function move(delta) {
    var opts = results.querySelectorAll(".palette-item");
    if (!opts.length) return;
    selected = (selected + delta + opts.length) % opts.length;
    opts.forEach(function (o, i) { o.setAttribute("aria-selected", String(i === selected)); });
    opts[selected].scrollIntoView({ block: "nearest" });
  }

  document.querySelectorAll("[data-palette-open]").forEach(function (btn) {
    btn.addEventListener("click", open);
  });
  document.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      overlay.hidden ? open() : close();
    } else if (e.key === "Escape" && !overlay.hidden) {
      close();
    }
  });
  overlay.addEventListener("mousedown", function (e) {
    if (e.target === overlay) close();
  });
  input.addEventListener("input", function () { render(search(input.value)); });
  input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Enter") {
      var opt = results.querySelectorAll(".palette-item")[selected];
      if (opt) window.location.href = opt.getAttribute("href");
    }
  });
})();
