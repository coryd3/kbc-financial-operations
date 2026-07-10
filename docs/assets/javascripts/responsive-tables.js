(function () {
  "use strict";

  function makeButton(label, mode, selected) {
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset.mode = mode;
    button.setAttribute("aria-pressed", selected ? "true" : "false");
    return button;
  }

  function enhanceTable(table) {
    if (table.dataset.responsiveMatrix === "true") return;

    var headers = Array.from(table.querySelectorAll("thead th")).map(function (cell) {
      return cell.textContent.trim();
    });
    if (headers.length < 6) return;

    table.dataset.responsiveMatrix = "true";
    table.classList.add("docs-matrix-table");
    table.querySelectorAll("tbody tr").forEach(function (row) {
      Array.from(row.cells).forEach(function (cell, index) {
        cell.dataset.label = headers[index] || "Detail";
      });
    });

    var tableArea = table.parentElement;
    if (!tableArea || !tableArea.classList.contains("md-typeset__scrollwrap")) {
      tableArea = document.createElement("div");
      tableArea.className = "matrix-table-area";
      table.parentNode.insertBefore(tableArea, table);
      tableArea.appendChild(table);
    }

    var controls = document.createElement("div");
    controls.className = "matrix-table-controls";
    controls.setAttribute("aria-label", "Table display mode");
    controls.appendChild(makeButton("Readable", "readable", true));
    controls.appendChild(makeButton("Table", "table", false));
    tableArea.parentNode.insertBefore(controls, tableArea);
    tableArea.classList.add("matrix-table-readable");

    controls.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-mode]");
      if (!button) return;
      var readable = button.dataset.mode === "readable";
      tableArea.classList.toggle("matrix-table-readable", readable);
      controls.querySelectorAll("button").forEach(function (candidate) {
        candidate.setAttribute(
          "aria-pressed",
          candidate.dataset.mode === button.dataset.mode ? "true" : "false"
        );
      });
    });
  }

  function enhanceWideTables() {
    document.querySelectorAll(".md-typeset table").forEach(enhanceTable);
  }

  if (window.document$ && typeof window.document$.subscribe === "function") {
    window.document$.subscribe(enhanceWideTables);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enhanceWideTables);
  } else {
    enhanceWideTables();
  }
})();
