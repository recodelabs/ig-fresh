// ig-fresh client islands: theme, drawer, collapsibles, tabs, tree, filters, copy.
// Plain JS, no framework. Everything degrades: content is server-rendered.
(function () {
  "use strict";

  // --- theme -----------------------------------------------------------
  document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var dark = document.documentElement.classList.toggle("dark");
      try { localStorage.setItem("igf-theme", dark ? "dark" : "light"); } catch (e) {}
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
        if (hit && kindOk) { row.removeAttribute("data-hidden"); shown++; }
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
