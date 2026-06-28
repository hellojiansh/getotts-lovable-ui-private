(function () {
  function setupSeoReadMore() {
    document.querySelectorAll(".seo-readmore").forEach(function (panel) {
      if (panel.dataset.seoReadmoreReady === "true") return;
      panel.dataset.seoReadmoreReady = "true";

      var inner = panel.querySelector(".seo-readmore-inner");
      if (!inner) {
        inner = document.createElement("div");
        inner.className = "seo-readmore-inner";
        while (panel.firstChild) {
          inner.appendChild(panel.firstChild);
        }
        panel.appendChild(inner);
      }

      var button = document.createElement("button");
      button.type = "button";
      button.className = "seo-readmore-toggle";
      button.textContent = "Read more";
      button.addEventListener("click", function () {
        var open = panel.classList.toggle("is-expanded");
        button.textContent = open ? "Show less" : "Read more";
      });
      panel.appendChild(button);

      window.requestAnimationFrame(function () {
        if (inner.scrollHeight <= inner.clientHeight + 4) {
          panel.classList.add("is-expanded", "seo-readmore-short");
          button.hidden = true;
        }
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupSeoReadMore);
  } else {
    setupSeoReadMore();
  }
})();
