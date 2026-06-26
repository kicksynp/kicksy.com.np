// ============================================================
// KICKSY NEPAL — PAGE LOADER (Favicon Version)
// Context-aware, animated transition loader.
// ============================================================

(function () {
  "use strict";

  // ── Context mapping ─────────────────────────────────────────
  // Reads a destination href and returns the icon context key.
  function getContext(href) {
    if (!href) return "brand";
    const path = href.toLowerCase();

    // Explicit leather paths
    if (path.includes("/leather") || path.startsWith("leather"))
      return "leather";

    // Product pages: check for a "type=leather" URL param or ID string
    if (path.includes("/product") || path.startsWith("product")) {
      try {
        const url = new URL(href, location.origin);
        const type = url.searchParams.get("type");
        if (type === "leather") return "leather";
      } catch {}
      return "shoe";
    }

    // General shop = shoes
    if (path.includes("/shop") || path.startsWith("shop")) return "shoe";

    return "brand";
  }

  // ── Theme colours ───────────────────────────────────────────
  const THEMES = {
    shoe: { bg: "#0d0d0d", accent: "#B58A5A", ring: "rgba(181,138,90,0.35)" },
    leather: {
      bg: "#1c0f08",
      accent: "#C8935A",
      ring: "rgba(200,147,90,0.35)",
    },
    brand: { bg: "#0d0d0d", accent: "#B58A5A", ring: "rgba(181,138,90,0.25)" },
  };

  const LABELS = {
    shoe: "Loading Collection…",
    leather: "Loading Leather Goods…",
    brand: "Loading…",
  };

  // ── Loader DOM ───────────────────────────────────────────────
  // Injected into <body> on first use and reused.
  let overlay = null;
  let iconEl = null;
  let labelEl = null;

  function buildOverlay() {
    overlay = document.createElement("div");
    overlay.id = "kicksyPageLoader";
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    overlay.setAttribute("aria-label", "Loading page");
    overlay.innerHTML = `
      <div class="kpl-inner">
        <div class="kpl-icon-wrap" id="kplIconWrap">
          <div class="kpl-icon" id="kplIcon"></div>
          <div class="kpl-ring"></div>
        </div>
        <p class="kpl-label" id="kplLabel">Loading…</p>
        <div class="kpl-bar-wrap">
          <div class="kpl-bar" id="kplBar"></div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    iconEl = overlay.querySelector("#kplIcon");
    labelEl = overlay.querySelector("#kplLabel");
  }

  // ── Apply theme ─────────────────────────────────────────────
  function applyTheme(context) {
    if (!overlay) return;
    const theme = THEMES[context] || THEMES.brand;

    overlay.style.setProperty("--kpl-bg", theme.bg);
    overlay.style.setProperty("--kpl-accent", theme.accent);
    overlay.style.setProperty("--kpl-ring", theme.ring);

    // Determine the correct favicon path based on context
    const iconPath =
      context === "leather"
        ? "/assets/favicon-leather/favicon.svg"
        : "/assets/favicon/favicon.svg";

    // Inject the favicon image
    iconEl.innerHTML = `<img src="${iconPath}" alt="Kicksy Logo" class="kpl-favicon" />`;

    labelEl.textContent = LABELS[context] || "Loading…";
    overlay.dataset.context = context;
  }

  // ── Show / hide ─────────────────────────────────────────────
  function show(context) {
    if (!overlay) buildOverlay();
    applyTheme(context);

    overlay.style.display = "flex";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => overlay.classList.add("kpl-visible"));
    });
  }

  function hide() {
    if (!overlay) return;
    overlay.classList.remove("kpl-visible");
    overlay.classList.add("kpl-hiding");

    overlay.addEventListener(
      "transitionend",
      () => {
        overlay.classList.remove("kpl-hiding");
        overlay.style.display = "none";
      },
      { once: true },
    );
  }

  // ── Intercept navigation clicks ─────────────────────────────
  function interceptLinks() {
    document.body.addEventListener("click", (e) => {
      const anchor = e.target.closest("a[href]");
      if (!anchor) return;

      const href = anchor.getAttribute("href");

      // Skip non-navigational links
      if (
        !href ||
        href.startsWith("http") ||
        href.startsWith("//") ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:") ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey
      )
        return;

      const destPath = new URL(href, location.origin).pathname;
      const currPath = location.pathname;
      if (destPath === currPath) return;

      const context = getContext(href);
      sessionStorage.setItem("kpl_context", context);
      show(context);
    });
  }

  // ── Safety net: hide on popstate ─────────────
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) hide();
  });

  // ── Entry point ─────────────────────────────────────────────
  function init() {
    buildOverlay();

    const context = sessionStorage.getItem("kpl_context");
    if (context) {
      applyTheme(context);
      overlay.style.display = "flex";
      overlay.classList.add("kpl-visible");
      sessionStorage.removeItem("kpl_context");
    }

    interceptLinks();

    const hideWhenReady = () => {
      if (document.readyState === "complete") {
        setTimeout(hide, 120);
      } else {
        window.addEventListener("load", () => setTimeout(hide, 120), {
          once: true,
        });
      }
    };
    hideWhenReady();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
