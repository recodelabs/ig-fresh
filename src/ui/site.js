// ig-topcoat client islands: theme, drawer, collapsibles, tabs, tree, filters, copy.
// Plain JS, no framework. Everything degrades: content is server-rendered.
(function () {
  "use strict";

  // --- theme -----------------------------------------------------------
  document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var dark = document.documentElement.classList.toggle("dark");
      try { localStorage.setItem("igf-theme", dark ? "dark" : "light"); } catch (e) {}
      // Re-theme any rendered mermaid diagrams to match the new surface.
      if (window.igfRenderMermaid) window.igfRenderMermaid(dark);
    });
  });

  // --- mobile drawer -----------------------------------------------------
  var sidebar = document.getElementById("sidebar");
  var backdrop = document.querySelector("[data-backdrop]");
  function closeDrawer() {
    if (sidebar) sidebar.classList.remove("is-open");
    if (backdrop) backdrop.hidden = true;
  }
  document.querySelectorAll("[data-drawer]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (!sidebar) return;
      var open = sidebar.classList.toggle("is-open");
      if (backdrop) backdrop.hidden = !open;
    });
  });
  if (backdrop) backdrop.addEventListener("click", closeDrawer);

  // --- generic collapsibles (sidebar groups) -----------------------------
  document.querySelectorAll("[data-collapse]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var target = document.getElementById(btn.getAttribute("data-collapse"));
      if (!target) return;
      var expanded = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!expanded));
      target.hidden = expanded;
    });
  });

  // --- tabs ---------------------------------------------------------------
  document.querySelectorAll("[data-tabs]").forEach(function (tabs) {
    var buttons = tabs.querySelectorAll(":scope > .tab-list > [data-tab]");
    var panels = tabs.querySelectorAll(":scope > [data-panel]");
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        buttons.forEach(function (b) { b.setAttribute("aria-selected", String(b === btn)); });
        panels.forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== btn.getAttribute("data-tab"); });
      });
    });
  });

  // --- element tree: collapse + diff/snapshot view ------------------------
  document.querySelectorAll("[data-tree]").forEach(function (tree) {
    // collapse: hide all rows whose data-parent chain includes a collapsed id
    tree.querySelectorAll("[data-node-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-node-toggle");
        var expanded = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!expanded));
        tree.querySelectorAll('[data-ancestors]').forEach(function (row) {
          var anc = row.getAttribute("data-ancestors").split("|");
          if (anc.indexOf(id) === -1) return;
          if (expanded) {
            row.setAttribute("data-hidden", "");
          } else {
            // only reveal if no OTHER ancestor is still collapsed
            var blocked = anc.some(function (aid) {
              if (aid === id) return false;
              var t = tree.querySelector('[data-node-toggle="' + CSS.escape(aid) + '"]');
              return t && t.getAttribute("aria-expanded") === "false";
            });
            if (!blocked) row.removeAttribute("data-hidden");
          }
        });
      });
    });
    // view switch buttons live outside in the tab bar via data-tree-view
  });
  document.querySelectorAll("[data-tree-view]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var tree = document.getElementById(btn.getAttribute("data-tree-view"));
      if (!tree) return;
      tree.setAttribute("data-view", btn.getAttribute("data-view"));
      var group = btn.closest(".tab-list") || document;
      group.querySelectorAll("[data-tree-view]").forEach(function (b) {
        b.setAttribute("aria-selected", String(b === btn));
      });
    });
  });

  // --- text filter (concept tables, artifact index) ------------------------
  document.querySelectorAll("[data-filter]").forEach(function (input) {
    var scope = document.getElementById(input.getAttribute("data-filter"));
    if (!scope) return;
    var rows = scope.querySelectorAll("[data-filter-text]");
    var counter = document.querySelector('[data-filter-count="' + input.getAttribute("data-filter") + '"]');
    function apply() {
      var q = input.value.trim().toLowerCase();
      var shown = 0;
      rows.forEach(function (row) {
        var hit = !q || row.getAttribute("data-filter-text").indexOf(q) !== -1;
        var kindOk = row.getAttribute("data-kind-hidden") !== "1";
        var tagOk = row.getAttribute("data-tag-hidden") !== "1";
        if (hit && kindOk && tagOk) { row.removeAttribute("data-hidden"); shown++; }
        else row.setAttribute("data-hidden", "");
      });
      if (counter) counter.textContent = String(shown);
    }
    input.addEventListener("input", apply);
    input.apply = apply;
  });

  // --- kind filter chips (artifacts index) ---------------------------------
  var chips = document.querySelectorAll("[data-kind-chip]");
  if (chips.length) {
    var activeKinds = {};
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var kind = chip.getAttribute("data-kind-chip");
        var on = chip.getAttribute("aria-pressed") !== "true";
        chip.setAttribute("aria-pressed", String(on));
        activeKinds[kind] = on;
        var any = Object.keys(activeKinds).some(function (k) { return activeKinds[k]; });
        document.querySelectorAll("[data-filter-text]").forEach(function (row) {
          var ok = !any || activeKinds[row.getAttribute("data-kind")];
          row.setAttribute("data-kind-hidden", ok ? "0" : "1");
        });
        var input = document.querySelector("[data-filter]");
        if (input && input.apply) input.apply();
        else document.querySelectorAll("[data-filter-text]").forEach(function (row) {
          if (row.getAttribute("data-kind-hidden") === "1") row.setAttribute("data-hidden", "");
          else row.removeAttribute("data-hidden");
        });
      });
    });
  }

  // --- project-tag filter chips (artifacts index) --------------------------
  // Single-select: "All" (data-tag-chip="") clears; a tag chip shows only rows
  // carrying that tag code. Composes with kind chips + text filter via apply().
  var tagChips = document.querySelectorAll("[data-tag-chip]");
  if (tagChips.length) {
    tagChips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var tag = chip.getAttribute("data-tag-chip");
        tagChips.forEach(function (c) { c.setAttribute("aria-pressed", String(c === chip)); });
        document.querySelectorAll("[data-filter-text]").forEach(function (row) {
          // data-tags is a JSON array of tag codes (codes may contain any character)
          var rowTags = [];
          try { rowTags = JSON.parse(row.getAttribute("data-tags") || "[]"); } catch (e) {}
          var ok = !tag || rowTags.indexOf(tag) !== -1;
          row.setAttribute("data-tag-hidden", ok ? "0" : "1");
        });
        var input = document.querySelector("[data-filter]");
        if (input && input.apply) input.apply();
        else document.querySelectorAll("[data-filter-text]").forEach(function (row) {
          if (row.getAttribute("data-tag-hidden") === "1") row.setAttribute("data-hidden", "");
          else row.removeAttribute("data-hidden");
        });
      });
    });
  }

  // --- questionnaire page: tabs + lazy formbox preview -----------------------
  document.querySelectorAll("[data-q-tab]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var name = btn.getAttribute("data-q-tab");
      document.querySelectorAll("[data-q-tab]").forEach(function (b) {
        b.setAttribute("aria-selected", String(b === btn));
      });
      document.querySelectorAll("[data-q-panel]").forEach(function (p) {
        p.hidden = p.getAttribute("data-q-panel") !== name;
      });
    });
  });

  // Content-fingerprinted URLs for the lazily-loaded formbox island are emitted
  // by the page onto the site.js <script> tag (data-formbox-js / data-formbox-css)
  // so this file never hard-codes a hash and stays byte-stable across deploys.
  // Falls back to the stable un-hashed paths if the attributes are absent.
  function formboxAssets() {
    var el = document.querySelector("script[data-formbox-js]");
    return {
      js: (el && el.getAttribute("data-formbox-js")) || "igf/formbox.js",
      css: (el && el.getAttribute("data-formbox-css")) || "igf/formbox.css",
    };
  }

  var formboxLoading = false;
  function loadFormbox() {
    return new Promise(function (resolve, reject) {
      if (window.igfMountQuestionnaire) return resolve();
      if (formboxLoading) {
        var iv = setInterval(function () {
          if (window.igfMountQuestionnaire) { clearInterval(iv); resolve(); }
        }, 60);
        return;
      }
      formboxLoading = true;
      var urls = formboxAssets();
      var css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = urls.css;
      document.head.appendChild(css);
      var s = document.createElement("script");
      s.src = urls.js;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("Failed to load form renderer")); };
      document.body.appendChild(s);
    });
  }

  document.querySelectorAll("[data-questionnaire-preview]").forEach(function (host) {
    var src = host.getAttribute("data-questionnaire-src");
    Promise.all([loadFormbox(), fetch(src).then(function (r) { return r.json(); })])
      .then(function (res) {
        // Build-time-resolved options for IG-local answerValueSet canonicals
        // (emitted by the questionnaire page when applicable).
        var opts = {};
        var vsEl = document.getElementById("igf-vs-options");
        if (vsEl) {
          try { opts.localValueSets = JSON.parse(vsEl.textContent); } catch (e) {}
        }
        host.innerHTML = '<div class="q-preview-surface"></div>';
        window.igfMountQuestionnaire(host.querySelector(".q-preview-surface"), res[1], opts);
      })
      .catch(function (e) {
        host.innerHTML =
          '<div class="q-preview-error">Could not render the interactive form (' +
          (e && e.message ? e.message : "error") +
          "). The Item structure and JSON tabs still work.</div>";
      });
  });

  // --- lazy mermaid diagram renderer ----------------------------------------
  // Narrative pages that author a ```mermaid fence carry one or more
  // <pre class="mermaid" data-mermaid-src="…"> blocks (rewritten at build time by
  // extractNarrative). Load the mermaid bundle ONLY when such a block exists, so
  // diagram-free pages fetch nothing. The hashed bundle URL is advertised on the
  // site.js <script> tag (data-mermaid-js), like the formbox handoff.
  if (document.querySelector("[data-mermaid-src]")) {
    var mEl = document.querySelector("script[data-mermaid-js]");
    var mSrc = (mEl && mEl.getAttribute("data-mermaid-js")) || "igf/mermaid.js";
    var ms = document.createElement("script");
    ms.src = mSrc;
    ms.onload = function () {
      if (window.igfRenderMermaid) {
        window.igfRenderMermaid(document.documentElement.classList.contains("dark"));
      }
    };
    document.body.appendChild(ms);
  }

  // --- copy buttons ---------------------------------------------------------
  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      navigator.clipboard.writeText(btn.getAttribute("data-copy")).then(function () {
        btn.classList.add("copied");
        setTimeout(function () { btn.classList.remove("copied"); }, 1400);
      });
    });
  });
})();
