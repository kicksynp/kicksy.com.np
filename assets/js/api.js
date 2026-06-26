// ============================================================
// KICKSY NEPAL — API LAYER
// Communicates with Google Apps Script Web App
// Falls back to SAMPLE_PRODUCTS if API is unavailable
// ============================================================

const API = (() => {
  // ── Cache-busting: ?refresh=1 or ?nocache=1 clears cached product
  // data on page load. Useful when testing sheet changes — otherwise
  // a previously-cached (possibly fallback/sample) response can stick
  // around for up to CACHE_TTL (5 min).
  (function maybeBustCache() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has("refresh") || params.has("nocache")) {
        ["products", "leatherProducts", "testimonials", "offers"].forEach(k => {
          localStorage.removeItem(`kicksy_${k}`);
        });
      }
    } catch {}
  })();

  // ── Cache helpers ──────────────────────────────────────────
  const CACHE = {
    get(key) {
      try {
        const item = localStorage.getItem(`kicksy_${key}`);
        if (!item) return null;
        const { data, ts } = JSON.parse(item);
        if (Date.now() - ts > CONFIG.CACHE_TTL) { localStorage.removeItem(`kicksy_${key}`); return null; }
        return data;
      } catch { return null; }
    },
    set(key, data) {
      try { localStorage.setItem(`kicksy_${key}`, JSON.stringify({ data, ts: Date.now() })); } catch {}
    },
    clear(key) {
      try { localStorage.removeItem(`kicksy_${key}`); } catch {}
    }
  };

  // ── Fetch with timeout ─────────────────────────────────────
  async function fetchWithTimeout(url, options = {}, timeout = 10000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return res;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }

  // ── GET request ───────────────────────────────────────────
  async function get(action, params = {}) {
    const url = new URL(CONFIG.GOOGLE_SCRIPT_URL);
    url.searchParams.set("action", action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetchWithTimeout(url.toString());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // ── POST request ──────────────────────────────────────────
  async function post(action, body = {}) {
    const payload = { action, ...body };
    const res = await fetchWithTimeout(CONFIG.GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // ── Formspree (email notification + primary submission channel) ──
  // Google Apps Script Web Apps don't reliably support CORS for POST
  // requests with a JSON body, so Formspree is treated as the
  // authoritative result for order/contact submissions — it's a
  // dedicated form-handling service that supports CORS correctly.
  // Returns true/false so callers can use it as the success signal.
  async function postToFormspree(formType, data = {}) {
    if (!CONFIG.FORMSPREE_ENDPOINT) return false;
    try {
      // "_subject" is a Formspree special field — sets the email's
      // subject line so order vs. contact-message notifications are
      // easy to tell apart in your inbox at a glance.
      const subject = formType === "Order"
        ? `🛍️ New Order — ${data.productName || "Kicksy Nepal"}`
        : `✉️ New Contact Message — Kicksy Nepal`;

      const res = await fetchWithTimeout(CONFIG.FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ formType, _subject: subject, ...data }),
      }, 10000);

      return res.ok;
    } catch (err) {
      console.warn("Formspree submission failed:", err.message);
      return false;
    }
  }

  // ── Normalise product data ─────────────────────────────────
  function normaliseProduct(p = {}) {
    return {
      ...p,
      id:          String(p.id || "").trim(),
      name:        String(p.name || "").trim(),
      brand:       String(p.brand || "").trim(),
      category:    String(p.category || "").trim(),
      tags:        String(p.tags || "").trim(),
      image1:      String(p.image1 || "").trim(),
      image2:      String(p.image2 || "").trim(),
      image3:      String(p.image3 || "").trim(),
      image4:      String(p.image4 || "").trim(),
      image5:      String(p.image5 || "").trim(),
      price:       Number(p.price)      || 0,
      salePrice:   Number(p.salePrice)  || Number(p.price) || 0,
      costPrice:   undefined, // never expose
      profit:      undefined,
      productType: String(p.productType || "shoe").toLowerCase().trim(),
      rating:      Number(p.rating)     || 5,
      reviewCount: Number(p.reviewCount)|| 0,
      available:   parseAvailable(p.available),
      featured:    parseBoolean(p.featured),
      bestSeller:  parseBoolean(p.bestSeller),
      dailyPick:   parseBoolean(p.dailyPick),
      newArrival:  parseBoolean(p.newArrival),
      customizable: parseBoolean(p.customizable),
      sizes:       parseList(p.sizes),
      colors:      parseList(p.colors),
      stockMap:    parseStockJson(p.stockJson),
    };
  }

  function parseList(value) {
    if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
    if (value === null || value === undefined || value === "") return [];
    return String(value).split(",").map(v => v.trim()).filter(Boolean);
  }

  function parseBoolean(v) {
    if (typeof v === "boolean") return v;
    if (typeof v === "string")  return v.trim().toLowerCase() === "true";
    return Boolean(v);
  }

  // `available` defaults to TRUE when the cell is blank — matches the
  // server's lenient isAvailable() check, so a product that the server
  // included (because it left `available` empty) doesn't then get
  // mislabeled "Out of Stock" / filtered out client-side.
  // `featured`/`bestSeller`/`dailyPick`/`newArrival` remain strict
  // (blank = false) since those are opt-in flags.
  function parseAvailable(v) {
    if (v === "" || v === null || v === undefined) return true;
    return parseBoolean(v);
  }

  function parseStockJson(json) {
    if (!json) return {};
    try { return typeof json === "string" ? JSON.parse(json) : json; }
    catch { return {}; }
  }

  // ── Compute total stock across all colors/sizes ────────────
  function computeStock(product) {
    const map = product.stockMap || {};
    let total = 0;
    Object.values(map).forEach(sizes => {
      Object.values(sizes).forEach(qty => { total += Number(qty) || 0; });
    });
    return total;
  }

  // ── Public API ─────────────────────────────────────────────

  async function fetchProducts() {
    const cached = CACHE.get("products");
    if (cached) return cached.map(normaliseProduct);

    try {
      const json = await get("products");
      if (json.success && Array.isArray(json.data)) {
        const products = json.data.map(normaliseProduct);
        CACHE.set("products", products);
        return products;
      }
      throw new Error(json.message || "Invalid response");
    } catch (err) {
      console.warn("API unavailable, using sample products:", err.message);
      const fallback = SAMPLE_PRODUCTS.map(normaliseProduct);
      CACHE.set("products", fallback);
      return fallback;
    }
  }

  // ── Leather Goods (separate sheet tab, separate cache) ──────
  async function fetchLeatherProducts() {
    const cached = CACHE.get("leatherProducts");
    if (cached) return cached.map(normaliseProduct);

    try {
      const json = await get("leatherProducts");
      if (json.success && Array.isArray(json.data)) {
        if (json.data.length === 0) {
          console.warn(
            "Kicksy: 'LeatherProducts' tab returned 0 available rows.\n" +
            "Check: (1) the tab is named exactly 'LeatherProducts', " +
            "(2) it has an 'id' column with values, " +
            "(3) the 'available' column isn't set to FALSE for your rows.\n" +
            "Tip: open <YOUR_APPS_SCRIPT_URL>?action=debug in a browser to inspect what the script sees."
          );
        }
        const products = json.data.map(normaliseProduct);
        CACHE.set("leatherProducts", products);
        return products;
      }
      throw new Error(json.message || "Invalid response");
    } catch (err) {
      console.warn(
        "Kicksy: could not load LeatherProducts from the API — using sample placeholder data instead.\n" +
        "Reason: " + err.message + "\n" +
        "If you've added items to the 'LeatherProducts' tab and they're not appearing, " +
        "make sure the Apps Script has been redeployed (Deploy → Manage deployments → Edit → New version) " +
        "since it needs the 'leatherProducts' action to exist."
      );
      const fallback = SAMPLE_LEATHER_PRODUCTS.map(normaliseProduct);
      CACHE.set("leatherProducts", fallback);
      return fallback;
    }
  }

  async function fetchProduct(id) {
    // Try from cache first — check both shoe and leather product caches
    const shoeCached = CACHE.get("products");
    if (shoeCached) {
      const found = shoeCached.find(p => p.id === id);
      if (found) return normaliseProduct(found);
    }
    const leatherCached = CACHE.get("leatherProducts");
    if (leatherCached) {
      const found = leatherCached.find(p => p.id === id);
      if (found) return normaliseProduct(found);
    }

    try {
      const json = await get("product", { id });
      if (json.success && json.data) return normaliseProduct(json.data);
      throw new Error("Not found");
    } catch {
      // Fallback to sample (shoes + leather goods)
      const p = [...SAMPLE_PRODUCTS, ...SAMPLE_LEATHER_PRODUCTS].find(p => p.id === id);
      return p ? normaliseProduct(p) : null;
    }
  }

  async function fetchTestimonials() {
    const cached = CACHE.get("testimonials");
    if (cached) return cached;

    try {
      const json = await get("testimonials");
      if (json.success && Array.isArray(json.data)) {
        CACHE.set("testimonials", json.data);
        return json.data;
      }
      throw new Error("Invalid response");
    } catch {
      CACHE.set("testimonials", SAMPLE_TESTIMONIALS);
      return SAMPLE_TESTIMONIALS;
    }
  }

  async function fetchOffers() {
    const cached = CACHE.get("offers");
    if (cached) return cached;

    try {
      const json = await get("offers");
      if (json.success && Array.isArray(json.data)) {
        CACHE.set("offers", json.data);
        return json.data;
      }
      throw new Error("Invalid response");
    } catch {
      CACHE.set("offers", SAMPLE_OFFERS);
      return SAMPLE_OFFERS;
    }
  }

  async function fetchSiteSettings() {
    try {
      const json = await get("siteSettings");
      if (json.success && json.data) return json.data;
      return {};
    } catch {
      return {};
    }
  }

  async function createOrder(orderData) {
    // Apps Script Web Apps don't reliably support CORS preflight for
    // POST requests with a JSON content-type — the browser blocks the
    // response even when the script itself runs fine, so this call
    // can throw even on a "successful" submission. Treat it as
    // best-effort: log to Sheets when possible, but never let it
    // block or fail the customer-facing result.
    const sheetsPromise = post("createOrder", orderData).catch(err => {
      console.warn("Sheets order logging failed (likely a CORS limitation of Apps Script Web Apps) — Formspree is the source of truth for this submission:", err.message);
      return null;
    });

    const formspreeOk = await postToFormspree("Order", orderData);
    sheetsPromise; // fire-and-forget; intentionally not awaited further

    if (formspreeOk) return { success: true };
    return { success: false, message: "Failed to submit. Please try WhatsApp." };
  }

  async function createMessage(messageData) {
    const sheetsPromise = post("createMessage", messageData).catch(err => {
      console.warn("Sheets message logging failed (likely a CORS limitation of Apps Script Web Apps) — Formspree is the source of truth for this submission:", err.message);
      return null;
    });

    const formspreeOk = await postToFormspree("Contact Message", messageData);
    sheetsPromise;

    if (formspreeOk) return { success: true };
    return { success: false, message: "Failed to send message. Please try WhatsApp." };
  }

  return {
    fetchProducts,
    fetchLeatherProducts,
    fetchProduct,
    fetchTestimonials,
    fetchOffers,
    fetchSiteSettings,
    createOrder,
    createMessage,
    computeStock,
    CACHE,
  };
})();
