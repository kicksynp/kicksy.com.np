// ============================================================
// KICKSY NEPAL — LEATHER.JS
// Leather Goods page: category filtering, sorting, search,
// pagination. Mirrors shop.js but filters to productType
// "leather" and uses category-based (not brand-based) chips.
// ============================================================

const Leather = (() => {
  let allProducts = [];
  let filteredProducts = [];
  let currentPage = 1;
  const PER_PAGE = CONFIG.PRODUCTS_PER_PAGE;

  // ── State ──────────────────────────────────────────────────
  const state = {
    search:    "",
    categories:[],
    colors:    [],
    priceMin:  0,
    priceMax:  Infinity,
    available: false,
    sort:      "featured",
  };

  // ── DOM refs ───────────────────────────────────────────────
  const $  = id => document.getElementById(id);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  const grid          = $("leatherGrid");
  const resultCount   = $("leatherResultCount");
  const activeFilters = $("leatherActiveFilters");
  const pagination    = $("leatherPagination");

  const sortSelects   = $$("#leatherSortSelect, #leatherSortSelectMobile");
  const searchInput   = $("leatherSearch");

  const categoryFilterContainers = $$(".js-leather-category-filters");
  const colorFilterContainers    = $$(".js-leather-color-filters");

  const priceMinInputs = $$(".js-leather-price-min");
  const priceMaxInputs = $$(".js-leather-price-max");
  const availToggles   = $$(".js-leather-avail-toggle");
  const clearBtns      = $$(".js-leather-clear-filters");

  // Mobile filter drawer
  const filterOverlay  = $("leatherFilterOverlay");
  const filterOpenBtn  = $("leatherFilterOpenBtn");
  const filterCloseBtn = $("leatherFilterCloseBtn");
  const filterApplyBtn = $("leatherFilterApplyBtn");

  // Category showcase (hero grid) — rendered dynamically once products
  // are fetched, so we query it fresh after render rather than at
  // module-load time (it doesn't exist yet at that point).
  const categoryShowcase = $("leatherCategoryShowcase");
  let categoryCards = [];

  // ── Init ───────────────────────────────────────────────────
  async function init() {
    readURLParams();
    renderFilterSkeletons();
    if (grid) grid.innerHTML = window.KicksyUtils.buildSkeleton(8);

    try {
      allProducts = await API.fetchLeatherProducts();
    } catch {
      // API.fetchLeatherProducts already has its own internal fallback;
      // this is an extra safety net in case the function itself throws.
      // Normalise sample data shape (sizes/colors as arrays, stockMap).
      allProducts = SAMPLE_LEATHER_PRODUCTS.map(p => ({
        ...p,
        productType: "leather",
        sizes:  String(p.sizes  || "").split(",").map(s => s.trim()).filter(Boolean),
        colors: String(p.colors || "").split(",").map(c => c.trim()).filter(Boolean),
        stockMap: (() => { try { return JSON.parse(p.stockJson || "{}"); } catch { return {}; } })(),
      }));
    }

    buildFilterOptions();
    renderCategoryShowcase();
    applyFilters();
    bindEvents();
    syncUIFromState();
    highlightCategoryCards();
  }

  // ── Render category showcase (text-only, from live product data) ──
  function renderCategoryShowcase() {
    if (!categoryShowcase) return;

    const categories = [...new Set(allProducts.map(p => p.category).filter(Boolean))].sort();

    if (categories.length === 0) {
      categoryShowcase.innerHTML = "";
      return;
    }

    categoryShowcase.innerHTML = categories.map(c => `
      <div class="category-card js-category-card" data-category="${escAttr(c)}" aria-label="Shop ${esc(c)}" role="button" tabindex="0">
        <span class="category-card-label">${esc(c)}</span>
      </div>
    `).join("");

    // Re-query now that the cards actually exist in the DOM, and bind
    // their click/keyboard handlers (module-load-time querying would
    // have found nothing, since this container was empty until now).
    categoryCards = $$(".js-category-card");
    bindCategoryCardEvents();
  }

  // ── Read URL params ────────────────────────────────────────
  function readURLParams() {
    const p = new URLSearchParams(window.location.search);
    if (p.get("q"))        state.search = p.get("q");
    if (p.get("category")) state.categories = p.get("category").split(",").map(s => s.trim()).filter(Boolean);
    if (p.get("color"))    state.colors = p.get("color").split(",").map(s => s.trim()).filter(Boolean);
    if (p.get("sort"))     state.sort   = p.get("sort");
    if (p.get("avail"))    state.available = p.get("avail") === "true";

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

    $$(".filter-chip[data-category]").forEach(c => {
      const active = state.categories.includes(c.dataset.category);
      c.classList.toggle("active", active);
      c.setAttribute("aria-pressed", active);
    });
    $$(".filter-chip[data-leathercolor]").forEach(c => {
      const active = state.colors.includes(c.dataset.leathercolor);
      c.classList.toggle("active", active);
      c.setAttribute("aria-pressed", active);
    });
  }

  // ── Build dynamic filter options ───────────────────────────
  function buildFilterOptions() {
    // Categories
    const categories = [...new Set(allProducts.map(p => p.category).filter(Boolean))].sort();
    const categoryHTML = categories.map(c => `
      <button class="filter-chip leather-filter-chip ${state.categories.includes(c) ? "active" : ""}" data-category="${escAttr(c)}" aria-pressed="${state.categories.includes(c)}">${esc(c)}</button>
    `).join("");
    categoryFilterContainers.forEach(el => { el.innerHTML = categoryHTML; });

    // Colors
    const colors = [...new Set(allProducts.flatMap(p => p.colors || []))].sort();
    const colorHTML = colors.map(c => `
      <button class="filter-chip leather-filter-chip ${state.colors.includes(c) ? "active" : ""}" data-leathercolor="${escAttr(c)}" aria-pressed="${state.colors.includes(c)}">${esc(c)}</button>
    `).join("");
    colorFilterContainers.forEach(el => { el.innerHTML = colorHTML; });
  }

  function renderFilterSkeletons() {
    const skeletonHTML = Array(6).fill(0).map(() => `<div class="skeleton" style="width:80px;height:30px;border-radius:999px"></div>`).join("");
    [...categoryFilterContainers, ...colorFilterContainers].forEach(el => {
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

    // Categories
    if (state.categories.length) {
      result = result.filter(p => state.categories.includes(p.category));
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
    highlightCategoryCards();

    if (typeof SEO !== "undefined") SEO.updateForLeather(state.search);
  }

  function discountPercent(price, sale) {
    if (!price || !sale || sale >= price) return 0;
    return Math.round(((price - sale) / price) * 100);
  }

  // ── Render products ────────────────────────────────────────
  function renderProducts() {
    if (!grid) return;
    const start = (currentPage - 1) * PER_PAGE;
    const page  = filteredProducts.slice(start, start + PER_PAGE);

    if (resultCount) resultCount.textContent = `${filteredProducts.length} product${filteredProducts.length !== 1 ? "s" : ""}`;

    if (filteredProducts.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <p class="empty-icon">👜</p>
          <h3 class="empty-title">No products found</h3>
          <p class="empty-desc">Try adjusting your filters or search term.</p>
          <button class="btn btn-ghost" onclick="Leather.clearAllFilters()">Clear Filters</button>
        </div>`;
      if (pagination) pagination.innerHTML = "";
      return;
    }

    grid.innerHTML = page.map(window.KicksyUtils.buildProductCard).join("");
    renderPagination();

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

    let html = `<button class="page-btn" onclick="Leather.goPage(${currentPage - 1})" ${currentPage === 1 ? "disabled" : ""} aria-label="Previous page">&#8592;</button>`;
    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || Math.abs(i - currentPage) <= 2) {
        html += `<button class="page-btn ${i === currentPage ? "active" : ""}" onclick="Leather.goPage(${i})" aria-label="Page ${i}" aria-current="${i === currentPage ? "page" : "false"}">${i}</button>`;
      } else if (Math.abs(i - currentPage) === 3) {
        html += `<span style="padding:0 4px;color:var(--secondary)">…</span>`;
      }
    }
    html += `<button class="page-btn" onclick="Leather.goPage(${currentPage + 1})" ${currentPage === total ? "disabled" : ""} aria-label="Next page">&#8594;</button>`;
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
    state.categories.forEach(c => chips.push({ label: c, clear: () => { state.categories = state.categories.filter(x => x !== c); } }));
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
    state.search = ""; state.categories = []; state.colors = [];
    state.priceMin = 0; state.priceMax = Infinity; state.available = false;
    if (searchInput) searchInput.value = "";
    syncUIFromState();
    applyFilters();
  }

  // ── Update URL ─────────────────────────────────────────────
  function updateURL() {
    const p = new URLSearchParams();
    if (state.search)              p.set("q",        state.search);
    if (state.categories.length)   p.set("category", state.categories.join(","));
    if (state.colors.length)       p.set("color",    state.colors.join(","));
    if (state.priceMin > 0)        p.set("min",      state.priceMin);
    if (state.priceMax < Infinity) p.set("max",      state.priceMax);
    if (state.available)           p.set("avail",    "true");
    if (state.sort !== "featured") p.set("sort",     state.sort);
    const qs = p.toString();
    history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }

  // ── Bind category showcase card events (called after each render) ──
  function bindCategoryCardEvents() {
    categoryCards.forEach(card => {
      card.addEventListener("click", () => {
        const cat = card.dataset.category;
        if (state.categories.length === 1 && state.categories[0] === cat) {
          state.categories = []; // toggle off
        } else {
          state.categories = [cat];
        }
        syncUIFromState();
        applyFilters();
        document.getElementById("leatherShopAnchor")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      card.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); card.click(); }
      });
    });
  }

  // ── Highlight active category showcase cards ───────────────
  function highlightCategoryCards() {
    categoryCards.forEach(card => {
      const cat = card.dataset.category;
      card.classList.toggle("active", state.categories.length === 1 && state.categories[0] === cat);
    });
  }

  // ── Bind events ────────────────────────────────────────────
  function bindEvents() {
    // Search
    let searchTimer;
    searchInput?.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { state.search = searchInput.value.trim(); applyFilters(); }, 350);
    });

    // Sort
    sortSelects.forEach(sel => {
      sel.addEventListener("change", () => {
        state.sort = sel.value;
        sortSelects.forEach(other => { if (other !== sel) other.value = sel.value; });
        applyFilters();
      });
    });

    // Availability toggles
    availToggles.forEach(toggle => {
      toggle.addEventListener("change", () => {
        state.available = toggle.checked;
        availToggles.forEach(other => { if (other !== toggle) other.checked = toggle.checked; });
        applyFilters();
      });
    });

    // Price range
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

    // Clear filters
    clearBtns.forEach(btn => btn.addEventListener("click", clearAllFilters));

    // Category & color chips (delegated)
    [...categoryFilterContainers, ...colorFilterContainers].forEach(container => {
      container.addEventListener("click", e => {
        const chip = e.target.closest(".filter-chip");
        if (!chip) return;

        if (chip.dataset.category) {
          const c = chip.dataset.category;
          state.categories = state.categories.includes(c) ? state.categories.filter(x => x !== c) : [...state.categories, c];
        } else if (chip.dataset.leathercolor) {
          const c = chip.dataset.leathercolor;
          state.colors = state.colors.includes(c) ? state.colors.filter(x => x !== c) : [...state.colors, c];
        }

        syncUIFromState();
        applyFilters();
      });
    });

    // Mobile filter drawer
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

// ── Boot on leather page ───────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("leatherGrid")) Leather.init();
});
