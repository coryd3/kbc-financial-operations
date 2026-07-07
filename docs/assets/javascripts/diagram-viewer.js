(function () {
  var modal;
  var modalBody;
  var modalTitle;
  var activeContent;
  var scale = 1;

  function ready(callback) {
    if (window.document$ && typeof window.document$.subscribe === "function") {
      window.document$.subscribe(function () {
        window.setTimeout(callback, 500);
      });
    } else if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        window.setTimeout(callback, 500);
      });
    } else {
      window.setTimeout(callback, 500);
    }
  }

  function ensureModal() {
    if (modal) return;

    modal = document.createElement("div");
    modal.className = "diagram-viewer";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = [
      '<div class="diagram-viewer__backdrop" data-diagram-close></div>',
      '<div class="diagram-viewer__panel" role="dialog" aria-modal="true" aria-labelledby="diagram-viewer-title">',
      '  <div class="diagram-viewer__header">',
      '    <h2 id="diagram-viewer-title">Diagram</h2>',
      '    <div class="diagram-viewer__controls" aria-label="Diagram controls">',
      '      <button type="button" data-diagram-zoom-out title="Zoom out">-</button>',
      '      <button type="button" data-diagram-reset title="Reset zoom">Reset</button>',
      '      <button type="button" data-diagram-zoom-in title="Zoom in">+</button>',
      '      <button type="button" data-diagram-close title="Close">Close</button>',
      "    </div>",
      "  </div>",
      '  <div class="diagram-viewer__body"></div>',
      "</div>",
    ].join("");

    document.body.appendChild(modal);
    modalBody = modal.querySelector(".diagram-viewer__body");
    modalTitle = modal.querySelector("#diagram-viewer-title");

    modal.querySelectorAll("[data-diagram-close]").forEach(function (button) {
      button.addEventListener("click", closeModal);
    });
    modal.querySelector("[data-diagram-zoom-in]").addEventListener("click", function () {
      setScale(scale + 0.2);
    });
    modal.querySelector("[data-diagram-zoom-out]").addEventListener("click", function () {
      setScale(scale - 0.2);
    });
    modal.querySelector("[data-diagram-reset]").addEventListener("click", function () {
      setScale(1);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && modal.classList.contains("diagram-viewer--open")) {
        closeModal();
      }
    });
  }

  function setScale(value) {
    scale = Math.max(0.4, Math.min(3, value));
    if (activeContent) {
      activeContent.style.transform = "scale(" + scale + ")";
    }
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove("diagram-viewer--open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("diagram-viewer-open");
    modalBody.innerHTML = "";
    activeContent = null;
    scale = 1;
  }

  function openDiagram(diagram) {
    ensureModal();

    var title = findNearestHeading(diagram) || "Diagram";
    var svg = diagram.querySelector("svg");
    var clone = svg ? svg.cloneNode(true) : diagram.cloneNode(true);

    clone.removeAttribute("id");
    clone.classList.add("diagram-viewer__content");
    clone.style.maxWidth = "none";
    clone.style.height = "auto";
    clone.style.transformOrigin = "top center";

    modalTitle.textContent = title;
    modalBody.innerHTML = "";
    modalBody.appendChild(clone);
    activeContent = clone;
    setScale(1.25);

    modal.classList.add("diagram-viewer--open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("diagram-viewer-open");
  }

  function findNearestHeading(element) {
    var article = element.closest(".md-content__inner") || document;
    var headings = Array.prototype.slice.call(
      article.querySelectorAll("h1, h2, h3, h4")
    );

    var title = "";
    headings.forEach(function (heading) {
      if (
        heading.compareDocumentPosition(element) &
        Node.DOCUMENT_POSITION_FOLLOWING
      ) {
        title = heading.textContent.replace(/\u00b6/g, "").trim();
      }
    });
    return title;
  }

  function addDiagramControls() {
    ensureModal();

    document.querySelectorAll(".md-typeset .mermaid").forEach(function (diagram) {
      if (diagram.dataset.diagramViewerAttached === "true") return;
      if (
        diagram.previousElementSibling &&
        diagram.previousElementSibling.classList.contains("diagram-inline-actions")
      ) {
        diagram.dataset.diagramViewerAttached = "true";
        return;
      }

      diagram.dataset.diagramViewerAttached = "true";
      diagram.classList.add("diagram-viewer-source");

      var actions = document.createElement("div");
      actions.className = "diagram-inline-actions";

      var button = document.createElement("button");
      button.type = "button";
      button.className = "diagram-enlarge-button";
      button.textContent = "Enlarge diagram";
      button.setAttribute("aria-label", "Enlarge diagram");
      button.addEventListener("click", function () {
        openDiagram(diagram);
      });

      actions.appendChild(button);
      diagram.parentNode.insertBefore(actions, diagram);
    });
  }

  ready(addDiagramControls);
  window.setTimeout(addDiagramControls, 1200);
})();
