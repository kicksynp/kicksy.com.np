// ============================================================
// KICKSY NEPAL — SHOP.JS
// Product listing, filtering, sorting, search, pagination
// Handles BOTH the desktop sidebar filters AND the mobile
// filter drawer (separate DOM elements, kept in sync).
// ============================================================

const Shop = (() => {
  let allProducts = [];
  let filteredProducts = [];
  let currentPage = 1;
  const PER_PAGE = CONFIG.PRODUCTS_PER_PAGE;

  // ── State ──────────────────────────────────────────────────
  const state = {
    search:    "",
    brands:    [],
    sizes:     [],
    colors:    [],
    priceMin:  0,
    priceMax:  Infinity,
    available: false,
    sort:      "featured",
  };

  // ── DOM refs ───────────────────────────────────────────────
  const $  = id => document.getElementById(id);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  const grid          = $("productsGrid");
  const resultCount   = $("resultCount");
  const activeFilters = $("activeFilters");
  const pagination    = $("pagination");

  // Sort selects: desktop sidebar + mobile topbar (both should stay in sync)
  const sortSelects   = $$("#sortSelect, #sortSelectMobile");

  // Search input (desktop sidebar only — mobile uses header search overlay)
  const searchInput   = $("shopSearch");

  // Filter option containers — both sidebar (.js-*-filters) and drawer (.js-*-filters)
  const brandFilterContainers = $$(".js-brand-filters");
  const sizeFilterContainers  = $$(".js-size-filters");
  const colorFilterContainers = $$(".js-color-filters");

  // Price range inputs — sidebar + drawer pairs
  const priceMinInputs = $$(".js-price-min");
  const priceMaxInputs = $$(".js-price-max");

  // Availability toggles — sidebar + drawer pairs
  const availToggles = $$(".js-avail-toggle");

  // Clear filters buttons — sidebar + drawer pairs
  const clearBtns = $$(".js-clear-filters");

  // Mobile filter drawer controls
  const filterOverlay  = $("filterOverlay");
  const filterOpenBtn  = $("filterOpenBtn");
  const filterCloseBtn = $("filterCloseBtn");
  const filterApplyBtn = $("filterApplyBtn");

  // ── Init ───────────────────────────────────────────────────
  async function init() {
    readURLParams();
    renderFilterSkeletons();
    grid.innerHTML = window.KicksyUtils.buildSkeleton(8);

    try {
      allProducts = await API.fetchProducts();
    } catch {
      // API.fetchProducts already has its own internal fallback;
      // this is an extra safety net in case the function itself throws.
      allProducts = SAMPLE_PRODUCTS.map(p => ({
        ...p,
        productType: "shoe",
        sizes:  String(p.sizes  || "").split(",").map(s => s.trim()).filter(Boolean),
        colors: String(p.colors || "").split(",").map(c => c.trim()).filter(Boolean),
        stockMap: (() => { try { return JSON.parse(p.stockJson || "{}"); } catch { return {}; } })(),
      }));
    }

    buildFilterOptions();
    applyFilters();
    bindEvents();
    syncUIFromState();
  }

  // ── Read URL params ────────────────────────────────────────
  function readURLParams() {
    const p = new URLSearchParams(window.location.search);
    if (p.get("q"))      state.search = p.get("q");
    if (p.get("brand"))  state.brands = p.get("brand").split(",").map(s => s.trim()).filter(Boolean);
    if (p.get("size"))   state.sizes  = p.get("size").split(",").map(s => s.trim()).filter(Boolean);
    if (p.get("color"))  state.colors = p.get("color").split(",").map(s => s.trim()).filter(Boolean);
    if (p.get("sort"))   state.sort   = p.get("sort");
    if (p.get("avail"))  state.available = p.get("avail") === "true";

    const min = Number(p.get("min"));
    const max = Number(p.get("max"));
    if (p.get("min") && !isNaN(min) && min > 0) state.priceMin = min;
    if (p.get("max") && !isNaN(max) && max > 0) state.priceMax = max;
  }

  // ── Sync UI from state ─────────────────────────────────────
  function syncUIFromState() {
    if (searchInput) searchInput.value = state.search;

    sortSelects.forEach(el => { el.value = state.sort; });
    availToggles.forEach(el => { el.checked = state.available; });
    priceMinInputs.forEach(el => { el.value = state.priceMin > 0 ? state.priceMin : ""; });
    priceMaxInputs.forEach(el => { el.value = state.priceMax < Infinity ? state.priceMax : ""; });

    $$(".filter-chip[data-brand]").forEach(c => {
      const active = state.brands.includes(c.dataset.brand);
      c.classList.toggle("active", active);
      c.setAttribute("aria-pressed", active);
    });
    $$(".filter-chip[data-size]").forEach(c => {
      const active = state.sizes.includes(c.dataset.size);
      c.classList.toggle("active", active);
      c.setAttribute("aria-pressed", active);
    });
    $$(".filter-chip[data-color]").forEach(c => {
      const active = state.colors.includes(c.dataset.color);
      c.classList.toggle("active", active);
      c.setAttribute("aria-pressed", active);
    });
  }

  // ── Build dynamic filter options (renders into BOTH sidebar & drawer) ──
  function buildFilterOptions() {
    // Brands
    const brands = [...new Set(allProducts.map(p => p.brand))].sort();
    const brandHTML = brands.map(b => `
      <button class="filter-chip ${state.brands.includes(b) ? "active" : ""}" data-brand="${escAttr(b)}" aria-pressed="${state.brands.includes(b)}">${esc(b)}</button>
    `).join("");
    brandFilterContainers.forEach(el => { el.innerHTML = brandHTML; });

    // Sizes
    const sizes = [...new Set(allProducts.flatMap(p => p.sizes || []))].sort((a, b) => Number(a) - Number(b));
    const sizeHTML = sizes.map(s => `
      <button class="filter-chip ${state.sizes.includes(s) ? "active" : ""}" data-size="${escAttr(s)}" aria-pressed="${state.sizes.includes(s)}">${esc(s)}</button>
    `).join("");
    sizeFilterContainers.forEach(el => { el.innerHTML = sizeHTML; });

    // Colors
    const colors = [...new Set(allProducts.flatMap(p => p.colors || []))].sort();
    const colorHTML = colors.map(c => `
      <button class="filter-chip ${state.colors.includes(c) ? "active" : ""}" data-color="${escAttr(c)}" aria-pressed="${state.colors.includes(c)}">${esc(c)}</button>
    `).join("");
    colorFilterContainers.forEach(el => { el.innerHTML = colorHTML; });
  }

  function renderFilterSkeletons() {
    const skeletonHTML = Array(6).fill(0).map(() => `<div class="skeleton" style="width:70px;height:30px;border-radius:999px"></div>`).join("");
    [...brandFilterContainers, ...sizeFilterContainers, ...colorFilterContainers].forEach(el => {
      el.innerHTML = skeletonHTML;
    });
  }

  function esc(str) { return window.KicksyUtils.sanitize(String(str)); }
  function escAttr(str) { return String(str).replace(/"/g, "&quot;"); }

  // ── Filter & sort logic ────────────────────────────────────
  function applyFilters() {
    let result = [...allProducts];

    // Search
    if (state.search) {
      const q = state.search.toLowerCase();
      result = result.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.tags?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      );
    }

    // Brands
    if (state.brands.length) {
      result = result.filter(p => state.brands.includes(p.brand));
    }

    // Sizes
    if (state.sizes.length) {
      result = result.filter(p => p.sizes?.some(s => state.sizes.includes(s)));
    }

    // Colors
    if (state.colors.length) {
      result = result.filter(p => p.colors?.some(c => state.colors.includes(c)));
    }

    // Price
    result = result.filter(p => {
      const price = p.salePrice || p.price;
      return price >= state.priceMin && (state.priceMax === Infinity || price <= state.priceMax);
    });

    // Availability
    if (state.available) {
      result = result.filter(p => p.available);
    }

    // Sort
    result.sort((a, b) => {
      switch (state.sort) {
        case "price_asc":  return (a.salePrice||a.price) - (b.salePrice||b.price);
        case "price_desc": return (b.salePrice||b.price) - (a.salePrice||a.price);
        case "newest":     return new Date(b.createdAt||0) - new Date(a.createdAt||0);
        case "bestseller": return (b.bestSeller ? 1 : 0) - (a.bestSeller ? 1 : 0);
        case "discount": {
          const da = discountPercent(a.price, a.salePrice);
          const db = discountPercent(b.price, b.salePrice);
          return db - da;
        }
        default: return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
      }
    });

    filteredProducts = result;
    currentPage = 1;
    renderProducts();
    renderActiveFilters();
    updateURL();

    if (typeof SEO !== "undefined") SEO.updateForShop(state.search);
  }

  function discountPercent(price, sale) {
    if (!price || !sale || sale >= price) return 0;
    return Math.round(((price - sale) / price) * 100);
  }

  // ── Render products ────────────────────────────────────────
  function renderProducts() {
    const start = (currentPage - 1) * PER_PAGE;
    const page  = filteredProducts.slice(start, start + PER_PAGE);

    if (resultCount) resultCount.textContent = `${filteredProducts.length} product${filteredProducts.length !== 1 ? "s" : ""}`;

    if (filteredProducts.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <p class="empty-icon">🔍</p>
          <h3 class="empty-title">No products found</h3>
          <p class="empty-desc">Try adjusting your filters or search term.</p>
          <button class="btn btn-ghost" onclick="Shop.clearAllFilters()">Clear Filters</button>
        </div>`;
      if (pagination) pagination.innerHTML = "";
      return;
    }

    grid.innerHTML = page.map(window.KicksyUtils.buildProductCard).join("");
    renderPagination();

    // Animate cards in
    grid.querySelectorAll(".product-card").forEach((card, i) => {
      card.style.animationDelay = `${i * 50}ms`;
      card.classList.add("fade-in");
    });
  }

  // ── Pagination ─────────────────────────────────────────────
  function renderPagination() {
    if (!pagination) return;
    const total = Math.ceil(filteredProducts.length / PER_PAGE);
    if (total <= 1) { pagination.innerHTML = ""; return; }

    let html = `<button class="page-btn" onclick="Shop.goPage(${currentPage - 1})" ${currentPage === 1 ? "disabled" : ""} aria-label="Previous page">&#8592;</button>`;
    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || Math.abs(i - currentPage) <= 2) {
        html += `<button class="page-btn ${i === currentPage ? "active" : ""}" onclick="Shop.goPage(${i})" aria-label="Page ${i}" aria-current="${i === currentPage ? "page" : "false"}">${i}</button>`;
      } else if (Math.abs(i - currentPage) === 3) {
        html += `<span style="padding:0 4px;color:var(--secondary)">…</span>`;
      }
    }
    html += `<button class="page-btn" onclick="Shop.goPage(${currentPage + 1})" ${currentPage === total ? "disabled" : ""} aria-label="Next page">&#8594;</button>`;
    pagination.innerHTML = html;
  }

  function goPage(n) {
    const total = Math.ceil(filteredProducts.length / PER_PAGE);
    if (n < 1 || n > total) return;
    currentPage = n;
    renderProducts();
    grid.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ── Active filter chips ────────────────────────────────────
  function renderActiveFilters() {
    if (!activeFilters) return;
    const chips = [];

    if (state.search) chips.push({ label: `Search: "${state.search}"`, clear: () => { state.search = ""; if (searchInput) searchInput.value = ""; } });
    state.brands.forEach(b => chips.push({ label: b, clear: () => { state.brands = state.brands.filter(x => x !== b); } }));
    state.sizes.forEach(s  => chips.push({ label: `Size ${s}`, clear: () => { state.sizes = state.sizes.filter(x => x !== s); } }));
    state.colors.forEach(c => chips.push({ label: c, clear: () => { state.colors = state.colors.filter(x => x !== c); } }));
    if (state.priceMin > 0) chips.push({ label: `Min Rs.${state.priceMin.toLocaleString()}`, clear: () => { state.priceMin = 0; } });
    if (state.priceMax < Infinity) chips.push({ label: `Max Rs.${state.priceMax.toLocaleString()}`, clear: () => { state.priceMax = Infinity; } });
    if (state.available) chips.push({ label: "In Stock Only", clear: () => { state.available = false; } });

    if (chips.length === 0) {
      activeFilters.innerHTML = "";
      clearBtns.forEach(b => { b.style.display = "none"; });
      return;
    }
    clearBtns.forEach(b => { b.style.display = ""; });

    activeFilters.innerHTML = chips.map((chip, i) => `
      <span class="active-filter-chip">
        ${esc(chip.label)}
        <button aria-label="Remove filter" data-chip="${i}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </span>`).join("");

    activeFilters.querySelectorAll("button[data-chip]").forEach(btn => {
      btn.addEventListener("click", () => {
        chips[Number(btn.dataset.chip)].clear();
        syncUIFromState();
        applyFilters();
      });
    });
  }

  // ── Clear all filters ──────────────────────────────────────
  function clearAllFilters() {
    state.search = ""; state.brands = []; state.sizes = []; state.colors = [];
    state.priceMin = 0; state.priceMax = Infinity; state.available = false;
    if (searchInput) searchInput.value = "";
    syncUIFromState();
    applyFilters();
  }

  // ── Update URL ─────────────────────────────────────────────
  function updateURL() {
    const p = new URLSearchParams();
    if (state.search)             p.set("q",     state.search);
    if (state.brands.length)      p.set("brand", state.brands.join(","));
    if (state.sizes.length)       p.set("size",  state.sizes.join(","));
    if (state.colors.length)      p.set("color", state.colors.join(","));
    if (state.priceMin > 0)       p.set("min",   state.priceMin);
    if (state.priceMax < Infinity)p.set("max",   state.priceMax);
    if (state.available)          p.set("avail", "true");
    if (state.sort !== "featured")p.set("sort",  state.sort);
    const qs = p.toString();
    history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }

  // ── Bind events ────────────────────────────────────────────
  function bindEvents() {
    // Search (desktop sidebar)
    let searchTimer;
    searchInput?.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { state.search = searchInput.value.trim(); applyFilters(); }, 350);
    });

    // Sort — both selects kept in sync
    sortSelects.forEach(sel => {
      sel.addEventListener("change", () => {
        state.sort = sel.value;
        sortSelects.forEach(other => { if (other !== sel) other.value = sel.value; });
        applyFilters();
      });
    });

    // Availability toggles — both kept in sync
    availToggles.forEach(toggle => {
      toggle.addEventListener("change", () => {
        state.available = toggle.checked;
        availToggles.forEach(other => { if (other !== toggle) other.checked = toggle.checked; });
        applyFilters();
      });
    });

    // Price range — both sidebar + drawer pairs kept in sync
    function bindPriceInputs(inputs, key) {
      inputs.forEach(input => {
        input.addEventListener("change", () => {
          const val = Number(input.value) || (key === "priceMax" ? Infinity : 0);
          state[key] = val;
          inputs.forEach(other => { if (other !== input) other.value = input.value; });
          applyFilters();
        });
      });
    }
    bindPriceInputs(priceMinInputs, "priceMin");
    bindPriceInputs(priceMaxInputs, "priceMax");

    // Clear filters — both buttons
    clearBtns.forEach(btn => btn.addEventListener("click", clearAllFilters));

    // Filter chips (delegated on each container — sidebar + drawer)
    [...brandFilterContainers, ...sizeFilterContainers, ...colorFilterContainers].forEach(container => {
      container.addEventListener("click", e => {
        const chip = e.target.closest(".filter-chip");
        if (!chip) return;

        if (chip.dataset.brand) {
          const b = chip.dataset.brand;
          state.brands = state.brands.includes(b) ? state.brands.filter(x => x !== b) : [...state.brands, b];
        } else if (chip.dataset.size) {
          const s = chip.dataset.size;
          state.sizes = state.sizes.includes(s) ? state.sizes.filter(x => x !== s) : [...state.sizes, s];
        } else if (chip.dataset.color) {
          const c = chip.dataset.color;
          state.colors = state.colors.includes(c) ? state.colors.filter(x => x !== c) : [...state.colors, c];
        }

        syncUIFromState(); // re-applies .active class to ALL matching chips (sidebar + drawer)
        applyFilters();
      });
    });

    // Mobile filter drawer open/close
    filterOpenBtn?.addEventListener("click", () => {
      filterOverlay?.classList.add("open");
      document.body.style.overflow = "hidden";
    });
    function closeFilterDrawer() {
      filterOverlay?.classList.remove("open");
      document.body.style.overflow = "";
    }
    filterCloseBtn?.addEventListener("click", closeFilterDrawer);
    filterApplyBtn?.addEventListener("click", closeFilterDrawer);
    filterOverlay?.querySelector(".filter-overlay-bg")?.addEventListener("click", closeFilterDrawer);
  }

  return { init, goPage, clearAllFilters };
})();

// ── Boot on shop page ──────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("productsGrid")) Shop.init();
});
