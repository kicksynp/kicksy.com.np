// ============================================================
// KICKSY NEPAL — MAIN.JS
// Navigation, homepage, mobile menu, global utilities
// ============================================================

// ── Toast notifications ────────────────────────────────────
const Toast = (() => {
  let container;

  function getContainer() {
    if (!container) {
      container = document.createElement("div");
      container.className = "toast-container";
      document.body.appendChild(container);
    }
    return container;
  }

  function show(message, type = "success", duration = 4000) {
    const c = getContainer();
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        ${type === "success"
          ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>'
          : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>'}
      </svg>
      <span>${sanitize(message)}</span>`;
    c.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  return { show };
})();

// ── Sanitize text ──────────────────────────────────────────
function sanitize(str) {
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML;
}

// ── Format currency ────────────────────────────────────────
function formatPrice(amount) {
  return `${CONFIG.CURRENCY} ${Number(amount).toLocaleString("en-NP")}`;
}

// ── Calculate discount % ───────────────────────────────────
function discountPercent(original, sale) {
  if (!original || !sale || sale >= original) return 0;
  return Math.round(((original - sale) / original) * 100);
}

// ── Generate star HTML ─────────────────────────────────────
function starsHTML(rating) {
  const full  = Math.floor(rating);
  const empty = 5 - full;
  return `<span class="stars" aria-label="${rating} out of 5 stars">
    ${"★".repeat(full).split("").map(s => `<span class="star">${s}</span>`).join("")}
    ${"★".repeat(empty).split("").map(s => `<span class="star empty">${s}</span>`).join("")}
  </span>`;
}

// ── Product card builder ───────────────────────────────────
function buildProductCard(product) {
  const discount = discountPercent(product.price, product.salePrice);
  const sizes = Array.isArray(product.sizes)
    ? product.sizes
    : (product.sizes === null || product.sizes === undefined || product.sizes === ""
      ? []
      : String(product.sizes).split(",").map(s => s.trim()).filter(Boolean));
  const sizesPreview = sizes.slice(0, 4).join(", ");
  const img = product.image1 || "";

  // ── Stock check: needsPreOrder when there's no stock left ──
  // Mirrors the same lenient logic used on the product detail page:
  // products without per-color/size stock tracking (most leather
  // goods) trust the `available` flag only; products that DO track
  // stock need actual qty > 0 in at least one color/size.
  const hasStockMap = product.stockMap && Object.keys(product.stockMap).length > 0;
  const inStock = !product.available ? false : (hasStockMap ? (API.computeStock(product) > 0) : true);
  const needsPreOrder = !inStock;

  const badges = [];
  if (product.bestSeller) badges.push(`<span class="badge badge-bestseller">Best Seller</span>`);
  if (product.dailyPick)  badges.push(`<span class="badge badge-daily">Daily Pick</span>`);
  if (product.newArrival) badges.push(`<span class="badge badge-new">New</span>`);
  if (product.customizable) badges.push(`<span class="badge badge-customizable">Customizable</span>`);
  if (discount >= 10)     badges.push(`<span class="badge badge-sale">${discount}% OFF</span>`);
  if (needsPreOrder)      badges.push(`<span class="badge badge-preorder">Pre-Order</span>`);

  const waParams = `/product/${encodeURIComponent(product.id)}`;
  const ctaLabel = needsPreOrder ? "Pre-Order" : "Shop Now";

  return `
  <article class="product-card" role="article" aria-label="${sanitize(product.name)}">
    <a href="${waParams}" class="product-card-img-wrap" aria-label="View ${sanitize(product.name)}">
      ${img
        ? `<img class="product-card-img" src="${sanitize(img)}" alt="${sanitize(product.name)} by ${sanitize(product.brand)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\"img-placeholder\\" style=\\"width:100%;height:100%\\">${shoeIcon()}</div>'">`
        : `<div class="img-placeholder" style="width:100%;height:100%">${shoeIcon()}</div>`}
      <div class="product-card-badges">${badges.join("")}</div>
    </a>
    <div class="product-card-body">
      <p class="product-brand">${sanitize(product.brand)}</p>
      <h3 class="product-name"><a href="${waParams}">${sanitize(product.name)}</a></h3>
      <div class="product-price-row">
        <span class="product-sale-price">${formatPrice(product.salePrice)}</span>
        ${product.price > product.salePrice ? `<span class="product-old-price">${formatPrice(product.price)}</span>` : ""}
        ${discount >= 5 ? `<span class="product-discount">-${discount}%</span>` : ""}
      </div>
      ${sizesPreview ? `<div class="product-sizes">${sizes.slice(0,5).map(s => `<span class="product-size-chip">${sanitize(s)}</span>`).join("")}</div>` : ""}
    </div>
    <div class="product-card-footer">
      <a href="${waParams}" class="btn ${needsPreOrder ? "btn-preorder" : "btn-primary"} product-card-cta" aria-label="${needsPreOrder ? "Pre-order" : "Shop"} ${sanitize(product.name)}">
        ${ctaLabel}
      </a>
    </div>
  </article>`;
}

function shoeIcon() {
  return `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 38c0-4 3-7 7-7h4l6-10h12l4 6 8 2c4 1 6 4 6 8v2H8v-1z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function whatsappIcon(size = 20) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;
}

// ── Skeleton builder ───────────────────────────────────────
function buildSkeleton(count = 4) {
  return Array(count).fill(0).map(() => `<div class="skeleton skeleton-card"></div>`).join("");
}

// ── Site settings (from the "Sitesettings" Google Sheet tab) ───
// Any element with data-site-setting="someKey" gets its text content
// (or href, if it's a link whose value looks like a URL/contact
// target) replaced with the matching value from the sheet, once
// fetched. If the sheet is empty, unreachable, or a particular key
// is missing, the element is left completely untouched — so the
// hardcoded fallback text already in the HTML is always what's
// shown unless a real override exists. This makes the integration
// fully optional and non-breaking: pages work identically whether
// or not the Sitesettings tab has been set up yet.
async function initSiteSettings() {
  const targets = document.querySelectorAll("[data-site-setting]");
  if (targets.length === 0) return; // nothing to do on this page

  try {
    const settings = await API.fetchSiteSettings();
    if (!settings || Object.keys(settings).length === 0) return;

    targets.forEach(el => {
      const key = el.dataset.siteSetting;
      const value = settings[key];
      if (value === undefined || value === null || value === "") return;

      if (el.tagName === "A") {
        // For links, update the visible text but only rewrite href
        // if an explicit data-site-setting-href attribute opts in
        // (avoids accidentally pointing a styled button at a bare
        // phone number string typed into the sheet by mistake)
        el.textContent = value;
        if (el.dataset.siteSettingHref === "true") {
          if (key.toLowerCase().includes("phone") || key.toLowerCase().includes("whatsapp")) {
            el.href = `https://wa.me/${String(value).replace(/[^\d]/g, "")}`;
          } else if (key.toLowerCase().includes("email")) {
            el.href = `mailto:${value}`;
          }
        }
      } else {
        el.textContent = value;
      }
    });
  } catch {
    // Fetch failed entirely — leave all hardcoded fallback content as-is
  }
}

// ── Header behavior ────────────────────────────────────────
function initHeader() {
  const header = document.querySelector(".site-header");
  const hamburger = document.getElementById("hamburger");
  const mobileNav  = document.getElementById("mobileNav");
  const mobileNavOverlay = document.querySelector(".mobile-nav-overlay");
  const searchToggle = document.querySelectorAll(".search-toggle");
  const searchOverlay = document.getElementById("searchOverlay");
  const searchInput   = document.getElementById("searchInput");
  const searchClose   = document.getElementById("searchClose");

  // ── Header scroll behavior: shadow on scroll + hide on scroll down ──
  if (header) {
    let lastY = Math.max(window.scrollY, 0);
    let ticking = false;
    const HIDE_THRESHOLD = 8;   // ignore tiny scroll jitters
    const REVEAL_NEAR_TOP = 80; // always show header near top of page

    function onScroll() {
      const currentY = Math.max(window.scrollY, 0);
      const delta = currentY - lastY;

      // Shadow/blur once user scrolls past the very top
      header.classList.toggle("scrolled", currentY > 4);

      // Don't hide header while mobile nav or search overlay is open
      const navOpen = mobileNav?.classList.contains("open");
      const searchOpen = searchOverlay?.classList.contains("open");

      if (!navOpen && !searchOpen) {
        if (currentY <= REVEAL_NEAR_TOP) {
          header.classList.remove("nav-hidden");
        } else if (delta > HIDE_THRESHOLD) {
          header.classList.add("nav-hidden");     // scrolling down
        } else if (delta < -HIDE_THRESHOLD) {
          header.classList.remove("nav-hidden");  // scrolling up
        }
      }

      lastY = currentY;
      ticking = false;
    }

    // Run once on load (handles page loaded mid-scroll, e.g. back navigation)
    onScroll();

    window.addEventListener("scroll", () => {
      if (!ticking) {
        requestAnimationFrame(onScroll);
        ticking = true;
      }
    }, { passive: true });
  }

  // Hamburger / mobile nav
  const mobileNavCloseBtn = document.getElementById("mobileNavClose");

  if (hamburger && mobileNav) {
    hamburger.addEventListener("click", () => {
      const open = hamburger.classList.toggle("open");
      mobileNav.classList.toggle("open", open);
      document.body.style.overflow = open ? "hidden" : "";
      hamburger.setAttribute("aria-expanded", open);
      mobileNav.setAttribute("aria-hidden", !open);
    });
    mobileNavOverlay?.addEventListener("click", closeMobileNav);
    mobileNavCloseBtn?.addEventListener("click", closeMobileNav);

    // Close nav when a link is tapped
    document.querySelectorAll(".mobile-nav-links a").forEach(link => {
      link.addEventListener("click", closeMobileNav);
    });
  }

  function closeMobileNav() {
    hamburger?.classList.remove("open");
    mobileNav?.classList.remove("open");
    document.body.style.overflow = "";
    hamburger?.setAttribute("aria-expanded", "false");
    mobileNav?.setAttribute("aria-hidden", "true");
  }

  // Search overlay
  searchToggle.forEach(btn => {
    btn.addEventListener("click", () => {
      if (searchOverlay) {
        searchOverlay.classList.add("open");
        setTimeout(() => searchInput?.focus(), 100);
      }
    });
  });
  searchClose?.addEventListener("click", () => searchOverlay?.classList.remove("open"));
  searchOverlay?.addEventListener("click", e => { if (e.target === searchOverlay) searchOverlay.classList.remove("open"); });
  searchInput?.addEventListener("keydown", e => {
    if (e.key === "Enter" && searchInput.value.trim()) {
      const currentPage = window.location.pathname.split("/").pop().replace(/\.html$/, "") || "index";
      const target = currentPage === "leather" ? "/leather" : "/shop";
      window.location.href = `${target}?q=${encodeURIComponent(searchInput.value.trim())}`;
    }
    if (e.key === "Escape") searchOverlay?.classList.remove("open");
  });

  // Active nav link — normalizes both the current URL and each nav
  // link's href by stripping ".html" and trailing slashes, so this
  // works whether the site is served with clean URLs (production,
  // e.g. Cloudflare Pages auto-strips .html) or opened as a raw
  // .html file locally during development.
  const normalizePath = (p) => {
    let s = (p || "").split("?")[0].split("#")[0];
    s = s.replace(/\.html$/, "").replace(/\/$/, "");
    return s === "" || s === "/" ? "index" : s.split("/").pop();
  };
  const current = normalizePath(window.location.pathname);
  document.querySelectorAll(".site-nav a, .mobile-nav-links a").forEach(link => {
    const href = link.getAttribute("href");
    if (normalizePath(href) === current) {
      link.classList.add("active");
    }
  });
}

// ── Homepage: hero ─────────────────────────────────────────
function initHero() {
  // Optionally animate hero elements
  const heroContent = document.querySelector(".hero-text");
  if (heroContent) heroContent.classList.add("fade-in");
}

// ── Homepage: offer/coupon banner ─────────────────────────
async function initOfferBanner() {
  const banner = document.getElementById("couponBanner");
  const track  = document.getElementById("couponTrack");
  if (!banner || !track) return;

  const dismissed = sessionStorage.getItem("kicksy_banner_dismissed");
  if (dismissed) { banner.style.display = "none"; return; }

  try {
    const offers = await API.fetchOffers();
    const active = offers
      .filter(o => o.active)
      .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));

    if (active.length > 0) {
      // Combine every active offer into one continuous marquee string,
      // separated by a bullet, rather than only ever showing the first
      // match — so adding more active rows in the Offers sheet
      // actually makes them all appear.
      const text = active
        .map(o => `🎉 ${o.title} — ${o.description}`)
        .join("    •    ");
      banner.style.display = "";
      buildSeamlessMarquee(track, text);
    }
  } catch { /* silent */ }

  banner.querySelector(".coupon-close")?.addEventListener("click", () => {
    banner.style.display = "none";
    sessionStorage.setItem("kicksy_banner_dismissed", "1");
  });
}

// ── Build a truly seamless, gap-free marquee ────────────────
// The old fixed "two copies + translateX(-50%)" approach only stays
// gap-free if the two copies together are wider than the visible
// banner — for short offer text (or a banner on a wide monitor) the
// track ran out of content before the loop point, leaving a blank
// stretch followed by a sudden jump/reappearance. This version
// measures the actual rendered width of one copy, then repeats it
// as many times as needed to comfortably exceed the viewport, and
// drives the animation with a CSS variable holding the EXACT
// distance of one copy (in px) — so the loop point always lines up
// pixel-perfectly with where a repeat begins, regardless of how long
// the combined offer text is or how wide the screen is.
function buildSeamlessMarquee(track, text) {
  track.style.animation = "none"; // pause while we measure/rebuild
  track.innerHTML = `<span class="coupon-text">${sanitize(text)}</span>`;

  // Measure one copy's rendered width (including its own right padding,
  // since that padding is what creates the gap between repeats)
  const singleWidth = track.firstElementChild.getBoundingClientRect().width;
  const viewportWidth = window.innerWidth;

  // Repeat enough times to cover at least 2x the viewport width, so
  // there's always a full extra screen's worth of content queued up
  // behind whatever is currently visible — guarantees no gap can ever
  // appear, on any screen size or text length.
  const copiesNeeded = Math.max(2, Math.ceil((viewportWidth * 2) / singleWidth) + 1);
  track.innerHTML = Array(copiesNeeded)
    .fill(`<span class="coupon-text">${sanitize(text)}</span>`)
    .join("");

  track.style.setProperty("--marquee-distance", `${singleWidth}px`);
  // Re-enable the animation now that sizing is correct
  track.style.animation = "";
}

// ── Homepage: best sellers ─────────────────────────────────
async function initBestSellers() {
  const grid = document.getElementById("bestSellersGrid");
  if (!grid) return;
  grid.innerHTML = buildSkeleton(4);

  try {
    const products = await API.fetchProducts();
    const best = products.filter(p => p.bestSeller && p.available).slice(0, 8);
    if (best.length === 0) {
      grid.innerHTML = `<div class="empty-state"><p class="empty-icon">👟</p><p class="empty-title">Coming soon</p></div>`;
      return;
    }
    grid.innerHTML = best.map(buildProductCard).join("");
    grid.querySelectorAll(".product-card").forEach((card, i) => {
      card.style.animationDelay = `${i * 60}ms`;
      card.classList.add("fade-in");
    });
  } catch {
    grid.innerHTML = `<div class="empty-state"><p class="empty-desc">Could not load products. <a href="/shop">Browse all →</a></p></div>`;
  }
}

// ── Homepage: daily picks ──────────────────────────────────
async function initDailyPicks() {
  const grid = document.getElementById("dailyPicksGrid");
  if (!grid) return;
  grid.innerHTML = buildSkeleton(4);

  try {
    const products = await API.fetchProducts();
    const picks = products.filter(p => p.dailyPick && p.available).slice(0, 4);
    if (picks.length === 0) { grid.closest(".daily-picks")?.remove(); return; }

    grid.innerHTML = picks.map(p => {
      const img = p.image1 || "";
      return `
      <a href="/product/${encodeURIComponent(p.id)}" class="daily-pick-card" aria-label="${sanitize(p.name)}">
        <div class="daily-pick-img-wrap">
          ${img ? `<img class="daily-pick-img" src="${sanitize(img)}" alt="${sanitize(p.name)}" loading="lazy">` : `<div class="img-placeholder" style="width:100%;height:100%">${shoeIcon()}</div>`}
        </div>
        <div class="daily-pick-body">
          <p class="product-brand">${sanitize(p.brand)}</p>
          <p class="daily-pick-name">${sanitize(p.name)}</p>
          <p class="daily-pick-price">${formatPrice(p.salePrice)}</p>
        </div>
      </a>`;
    }).join("");
    grid.querySelectorAll(".daily-pick-card").forEach((card, i) => {
      card.style.animationDelay = `${i * 60}ms`;
      card.classList.add("fade-in");
    });
  } catch {
    grid.closest(".daily-picks")?.remove();
  }
}

// ── Homepage: testimonials ─────────────────────────────────
async function initTestimonials() {
  const grid = document.getElementById("testimonialsGrid");
  if (!grid) return;
  grid.innerHTML = buildSkeleton(3);

  try {
    const testimonials = await API.fetchTestimonials();
    const active = testimonials.filter(t => t.active !== false).slice(0, 6);
    if (active.length === 0) { grid.closest(".testimonials")?.style?.setProperty("display","none"); return; }

    grid.innerHTML = active.map(t => {
      const initial = (t.customerName || "?").charAt(0).toUpperCase();
      return `
      <div class="testimonial-card">
        <div class="testimonial-stars">${starsHTML(t.rating || 5)}</div>
        <p class="testimonial-text">"${sanitize(t.review)}"</p>
        <div class="testimonial-author">
          <div class="testimonial-avatar" aria-hidden="true">${initial}</div>
          <div>
            <p class="testimonial-name">${sanitize(t.customerName)}</p>
            <p class="testimonial-product">${sanitize(t.productName || "")}</p>
          </div>
        </div>
      </div>`;
    }).join("");
  } catch {
    grid.closest(".testimonials")?.remove();
  }
}

// ── Homepage: brands ───────────────────────────────────────
// Derives the brand list from ACTUAL shoe products returned by the
// backend (Google Sheet), rather than a hardcoded list — so brands
// that aren't currently stocked never appear as dead-end chips.
async function initBrandsSection() {
  const section = document.getElementById("brandsSection");
  const grid = document.getElementById("brandsGrid");
  if (!grid) return;

  try {
    const products = await API.fetchProducts(); // shoes only
    const counts = {};
    products.forEach(p => {
      const brand = (p.brand || "").trim();
      if (!brand) return;
      counts[brand] = (counts[brand] || 0) + 1;
    });

    const brands = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

    if (brands.length === 0) {
      // Empty state: hide the whole section cleanly rather than
      // showing an empty grid with a dangling heading.
      if (section) section.style.display = "none";
      return;
    }

    if (section) section.style.display = "";
    grid.innerHTML = brands.map(b => `
      <a href="/shop?brand=${encodeURIComponent(b)}" class="brand-chip" aria-label="Shop ${sanitize(b)}">${sanitize(b)}</a>
    `).join("");
  } catch {
    if (section) section.style.display = "none";
  }
}

// ── FAQ accordion ──────────────────────────────────────────
function initFaq() {
  document.querySelectorAll(".faq-item").forEach(item => {
    const btn = item.querySelector(".faq-q");
    btn?.addEventListener("click", () => {
      const open = item.classList.toggle("open");
      btn.setAttribute("aria-expanded", open);
    });
  });
}

// ── Scroll-reveal animations ───────────────────────────────
function initScrollReveal() {
  const targets = document.querySelectorAll(".reveal, .reveal-stagger");
  if (!targets.length) return;

  if (!("IntersectionObserver" in window)) {
    targets.forEach(el => el.classList.add("in-view"));
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });

  targets.forEach(el => observer.observe(el));
}

// Re-run reveal for dynamically injected content (product grids etc.)
function revealNewContent(container) {
  if (!container) return;
  const targets = container.querySelectorAll(".reveal, .reveal-stagger");
  if (!("IntersectionObserver" in window)) {
    targets.forEach(el => el.classList.add("in-view"));
    return;
  }
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });
  targets.forEach(el => observer.observe(el));
}

// ── Page init ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initHeader();
  initFaq();
  initScrollReveal();
  initSiteSettings();

  // Normalizes the path the same way regardless of whether the site is
  // served with clean URLs (production) or as raw .html files (local dev)
  const page = window.location.pathname.split("/").pop().replace(/\.html$/, "") || "index";

  if (page === "index") {
    initHero();
    initOfferBanner();
    initBestSellers();
    initDailyPicks();
    initBrandsSection();
    initTestimonials();
  }
});

// ── Expose utilities globally ──────────────────────────────
window.KicksyUtils = { sanitize, formatPrice, discountPercent, starsHTML, buildProductCard, buildSkeleton, shoeIcon, whatsappIcon, Toast, revealNewContent };
