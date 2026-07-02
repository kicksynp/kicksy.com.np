// ============================================================
// KICKSY NEPAL — PRODUCT.JS
// Product detail page: gallery, selectors, stock, ordering
// ============================================================

const ProductPage = (() => {
  let product = null;
  let selectedColor = "";
  let selectedSize = "";

  // ── Dynamic favicon (shoes vs leather context) ──────────────
  // product.html is a single shared template for both product types,
  // so unlike shop.html/leather.html (which set their favicon
  // statically in <head>), this page must swap the <link rel="icon">
  // tags at runtime once the product's productType is known.
  function setFavicon(isLeather) {
    const icons = isLeather
      ? {
          svg: "/assets/favicon-leather/favicon.svg",
          png32: "/assets/favicon-leather/favicon-96x96.png",
          png16: "/assets/favicon-leather/favicon-96x96.png",
        }
      : {
          svg: "/assets/favicon/favicon.svg",
          png32: "/assets/favicon/favicon-96x96.png",
          png16: "/assets/favicon/favicon-96x96.png",
        };

    const setLink = (rel, sizes, href) => {
      let link = document.querySelector(
        sizes
          ? `link[rel="${rel}"][sizes="${sizes}"]`
          : `link[rel="${rel}"][type="image/svg+xml"]`,
      );
      if (!link) {
        link = document.createElement("link");
        link.rel = rel;
        if (sizes) link.sizes = sizes;
        else link.type = "image/svg+xml";
        document.head.appendChild(link);
      }
      link.href = href;
    };

    setLink("icon", null, icons.svg);
    setLink("icon", "32x32", icons.png32);
    setLink("icon", "16x16", icons.png16);
  }

  // ── Boot ───────────────────────────────────────────────────
  async function init() {
    // 1. Injected by Cloudflare edge function / serve.js for clean URLs
    // 2. ?id= query param (legacy / direct links)
    // 3. Last path segment e.g. /product/nike-air-force-1 (extra fallback)
    const params = new URLSearchParams(window.location.search);
    const pathSegments = window.location.pathname.split("/").filter(Boolean);
    const id =
      window.__PRODUCT_ID__ ||
      params.get("id") ||
      (pathSegments[0] === "product" && pathSegments[1]
        ? decodeURIComponent(pathSegments[1])
        : null);

    if (!id) {
      window.location.href = "/shop";
      return;
    }

    showSkeleton();

    product = await API.fetchProduct(id);
    if (!product) {
      document.getElementById("productMain").innerHTML = `
        <div class="empty-state" style="padding:var(--sp-20) var(--sp-5)">
          <p class="empty-icon">🔍</p>
          <h2 class="empty-title">Product not found</h2>
          <p class="empty-desc">This product may no longer be available.</p>
          <div class="wa-actions" style="justify-content:center">
            <a href="/shop" class="btn btn-primary">Browse Shoes</a>
            <a href="/leather" class="btn btn-ghost">Browse Leather Goods</a>
          </div>
        </div>`;
      return;
    }

    renderProduct();
    loadRelated();
    updateSEO();
    loadViewCount(id);
  }

  // ── Skeleton ───────────────────────────────────────────────
  function showSkeleton() {
    const main = document.getElementById("productMain");
    if (!main) return;
    main.innerHTML = `
      <div class="product-detail-grid">
        <div>
          <div class="skeleton" style="aspect-ratio:1/1;border-radius:var(--radius-lg)"></div>
          <div style="display:flex;gap:8px;margin-top:12px">
            ${Array(4).fill(`<div class="skeleton" style="width:64px;height:64px;border-radius:8px;flex-shrink:0"></div>`).join("")}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:16px">
          ${[80, 60, 45, 100, 70, 80].map((w) => `<div class="skeleton skeleton-text" style="width:${w}%"></div>`).join("")}
        </div>
      </div>`;
  }

  // ── Render full product ────────────────────────────────────
  function renderProduct() {
    const main = document.getElementById("productMain");
    if (!main || !product) return;

    selectedColor = product.colors?.[0] || "";
    selectedSize = "";

    const discount = discountPercent(product.price, product.salePrice);
    const images = [
      product.image1,
      product.image2,
      product.image3,
      product.image4,
      product.image5,
    ].filter(Boolean);
    const isLeather = product.productType === "leather";

    // Switch favicon to match the brand context of the product being
    // viewed — shoes.html/leather.html set this statically in their own
    // <head>, but product.html is one shared template for both product
    // types, so it must be done at runtime once we know productType.
    setFavicon(isLeather);

    // Update breadcrumb — link/label adapts to product type so a leather
    // product's breadcrumb correctly points back to leather.html instead
    // of the shoe-only shop.html
    const bc = document.getElementById("breadcrumbProduct");
    if (bc) bc.textContent = product.name;

    const bcCategory = document.getElementById("breadcrumbCategory");
    if (bcCategory) {
      bcCategory.textContent = isLeather ? "Leather Goods" : "Shop";
      bcCategory.setAttribute("href", isLeather ? "/leather" : "/shop");
    }

    const backLink = document.getElementById("backToShopLink");
    if (backLink) {
      backLink.textContent = isLeather
        ? "← Back to Leather Goods"
        : "← Back to Shop";
      backLink.setAttribute("href", isLeather ? "/leather" : "/shop");
    }

    // ── Badges (Best Seller / Daily Pick / New / Customizable / Sale) ──
    const badges = [];
    if (product.bestSeller)
      badges.push(`<span class="badge badge-bestseller">Best Seller</span>`);
    if (product.dailyPick)
      badges.push(`<span class="badge badge-daily">Daily Pick</span>`);
    if (product.newArrival)
      badges.push(`<span class="badge badge-new">New</span>`);
    if (product.customizable)
      badges.push(`<span class="badge badge-customizable">Customizable</span>`);
    if (discount >= 10)
      badges.push(`<span class="badge badge-sale">${discount}% OFF</span>`);

    // ── Quality / sourcing note (adapts by product type) ──────────
    const qualityInfoHTML = isLeather
      ? `<div class="quality-info-box">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
          <div>
            <strong>Note:</strong> Colors in the picture may differ slightly due to lighting conditions and screen settings. Each piece is crafted from genuine leather, so natural grain and texture can vary subtly between items.
          </div>
        </div>`
      : `<div class="quality-info-box">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <div>
            <strong>Premium Master Copy</strong> — crafted to closely match the original design and quality, ready to ship now.
            Want a 100% original/authentic pair instead? <a href="https://wa.me/9779763374989" target="_blank" rel="noopener">Pre-order on WhatsApp</a>.
          </div>
        </div>`;

    // ── Size selector helper text (adapts by product type) ─────────
    const sizeHelperHTML = isLeather
      ? product.customizable
        ? `<p style="margin-top:8px;font-size:.75rem;color:var(--secondary)">Strikethrough = unavailable for selected color. Need a different size? <a href="https://wa.me/9779763374989" target="_blank" rel="noopener" style="color:var(--leather-accent);font-weight:600">Ask about custom sizing on WhatsApp</a>.</p>`
        : `<p style="margin-top:8px;font-size:.75rem;color:var(--secondary)">Strikethrough = unavailable for selected color.</p>`
      : `<p style="margin-top:8px;font-size:.75rem;color:var(--secondary)">Sizes shown in EU. Strikethrough = unavailable for selected color.</p>`;

    // ── "About this item" heading (adapts by product type) ──────────
    const aboutHeading = isLeather ? "About this piece" : "About this shoe";

    // ── Stock check (same logic as product cards) ───────────────────
    const hasStockMap =
      product.stockMap && Object.keys(product.stockMap).length > 0;
    const inStockOverall = !product.available
      ? false
      : hasStockMap
        ? API.computeStock(product) > 0
        : true;
    const needsPreOrder = !inStockOverall;

    // Pre-compute share URLs outside the template literal so special
    // characters in product.name / product.brand (apostrophes, accents,
    // ampersands, etc.) cannot break the innerHTML string assignment.
    const shareProductUrl = `${CONFIG.SITE_URL}/product/${encodeURIComponent(product.id)}`;
    const shareWaText = encodeURIComponent(
      `Check out the ${product.name} (${product.brand}) on Kicksy Nepal — ${shareProductUrl}`,
    );
    const shareMessengerUrl = encodeURIComponent(shareProductUrl);
    const sharePinUrl       = encodeURIComponent(shareProductUrl);
    const sharePinDesc      = encodeURIComponent(`${product.name} by ${product.brand} — shop on Kicksy Nepal`);
    const sharePinImage     = encodeURIComponent(product.image1 || "");

    main.innerHTML = `
    <div class="product-detail-grid">
      <!-- Gallery -->
      <div class="product-gallery">
        <div class="gallery-main" id="galleryMain" onclick="ProductPage.openLightbox()" role="button" aria-label="View full image" tabindex="0">
          ${badges.length ? `<div class="product-detail-badges">${badges.join("")}</div>` : ""}
          ${
            images[0]
              ? `<img class="gallery-main-img" id="mainImg" src="${esc(images[0])}" alt="${esc(product.name)}" loading="eager" decoding="async">`
              : `<div class="img-placeholder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center">${window.KicksyUtils.shoeIcon()}</div>`
          }
        </div>
        ${
          images.length > 1
            ? `
        <div class="gallery-thumbs" role="list" aria-label="Product images">
          ${images
            .map(
              (img, i) => `
            <button class="gallery-thumb ${i === 0 ? "active" : ""}"
              onclick="ProductPage.switchImage('${esc(img)}', this)"
              role="listitem"
              aria-label="View image ${i + 1}"
              aria-pressed="${i === 0}">
              <img src="${esc(img)}" alt="${esc(product.name)} view ${i + 1}" loading="lazy" decoding="async">
            </button>`,
            )
            .join("")}
        </div>`
            : ""
        }
      </div>

      <!-- Info panel -->
      <div class="product-info">
        <p class="product-detail-brand">${esc(product.brand)}</p>
        <h1 class="product-detail-name">${esc(product.name)}</h1>

        <div class="product-detail-prices">
          <span class="product-detail-sale">${formatPrice(product.salePrice)}</span>
          ${product.price > product.salePrice ? `<span class="product-detail-old">${formatPrice(product.price)}</span>` : ""}
          ${discount >= 5 ? `<span class="product-detail-discount">${discount}% OFF</span>` : ""}
        </div>

        <div>
          ${starsHTML(product.rating)} <span style="font-size:.8rem;color:var(--secondary);margin-left:6px">(${product.reviewCount} reviews)</span><span class="product-view-sep" aria-hidden="true"> • </span><span class="product-view-count" id="productViewCount" aria-label="View count"></span>
        </div>

        ${product.shortDescription ? `<p class="product-description">${esc(product.shortDescription)}</p>` : ""}

        <!-- Color selector -->
        ${
          product.colors?.length
            ? `
        <div>
          <p class="selector-label">Color <span id="selectedColorLabel">${esc(selectedColor)}</span></p>
          <div class="color-options" role="radiogroup" aria-label="Select color" id="colorOptions">
            ${product.colors
              .map(
                (c) => `
              <button class="color-btn ${c === selectedColor ? "active" : ""}"
                onclick="ProductPage.selectColor('${esc(c)}')"
                aria-pressed="${c === selectedColor}"
                data-color="${esc(c)}">${esc(c)}</button>`,
              )
              .join("")}
          </div>
        </div>`
            : ""
        }

        <!-- Size selector -->
        ${
          product.sizes?.length
            ? `
        <div>
          <p class="selector-label">Size <span id="selectedSizeLabel">— Select —</span></p>
          <div class="size-options" role="radiogroup" aria-label="Select size" id="sizeOptions">
            ${product.sizes
              .map(
                (s) => `
              <button class="size-btn" onclick="ProductPage.selectSize('${esc(s)}')" aria-pressed="false" data-size="${esc(s)}">${esc(s)}</button>`,
              )
              .join("")}
          </div>
          ${sizeHelperHTML}
        </div>`
            : ""
        }

        <!-- Stock status -->
        <div class="stock-status" id="stockStatus">
          ${stockStatusHTML("unknown")}
        </div>

        <!-- Delivery info -->
        <div class="delivery-info">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"/></svg>
          <div>
            <strong>Delivery:</strong> ${esc(product.deliveryInfo || CONFIG.DELIVERY_TEXT)}
          </div>
        </div>

        <!-- Quality / sourcing note -->
        ${qualityInfoHTML}

        <!-- Description -->
        ${
          product.description
            ? `
        <div>
          <h3 style="font-weight:600;font-size:.95rem;margin-bottom:8px">${aboutHeading}</h3>
          <p class="product-description">${esc(product.description)}</p>
        </div>`
            : ""
        }

        <!-- Share strip -->
        <div class="product-share" id="productShare" aria-label="Share this product">
          <span class="product-share-label">Share:</span>
          <div class="product-share-btns">
            <a class="product-share-btn product-share-wa"
               href="https://wa.me/?text=${shareWaText}"
               target="_blank" rel="noopener noreferrer"
               aria-label="Share on WhatsApp">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              <span>WhatsApp</span>
            </a>
            <a class="product-share-btn product-share-messenger"
               href="https://www.facebook.com/dialog/send?link=${shareMessengerUrl}&app_id=291494419107518&redirect_uri=${shareMessengerUrl}"
               target="_blank" rel="noopener noreferrer"
               aria-label="Share on Messenger">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.477 2 2 6.145 2 11.259c0 2.822 1.38 5.34 3.545 7.003V21l3.33-1.836c.89.247 1.832.38 2.81.38 5.523 0 10-4.144 10-9.259C22 6.145 17.523 2 12 2zm1.008 12.456l-2.548-2.718-4.976 2.718 5.476-5.812 2.61 2.718 4.914-2.718-5.476 5.812z"/></svg>
              <span>Messenger</span>
            </a>
            <a class="product-share-btn product-share-pin"
               href="https://pinterest.com/pin/create/button/?url=${sharePinUrl}&media=${sharePinImage}&description=${sharePinDesc}"
               target="_blank" rel="noopener noreferrer"
               aria-label="Share on Pinterest">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.236 2.636 7.855 6.356 9.312-.088-.791-.167-2.005.035-2.868.181-.78 1.172-4.97 1.172-4.97s-.299-.598-.299-1.482c0-1.388.806-2.428 1.808-2.428.852 0 1.265.64 1.265 1.408 0 .858-.546 2.141-.828 3.33-.236.995.499 1.806 1.476 1.806 1.771 0 3.133-1.867 3.133-4.562 0-2.387-1.715-4.057-4.163-4.057-2.836 0-4.5 2.127-4.5 4.326 0 .856.33 1.775.741 2.276a.3.3 0 01.069.286c-.076.313-.244.995-.277 1.134-.044.183-.146.222-.337.134-1.249-.581-2.03-2.407-2.03-3.874 0-3.154 2.292-6.052 6.608-6.052 3.469 0 6.165 2.473 6.165 5.776 0 3.447-2.173 6.22-5.19 6.22-1.013 0-1.967-.527-2.292-1.148l-.623 2.378c-.226.869-.835 1.958-1.244 2.621.937.29 1.931.446 2.962.446 5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
              <span>Pinterest</span>
            </a>
            <button class="product-share-btn product-share-copy" onclick="ProductPage.copyLink()" aria-label="Copy product link">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              <span id="copyLinkLabel">Copy link</span>
            </button>
          </div>
        </div>

        <!-- Order actions (desktop) -->
        <div class="product-actions" id="productActions">
          <button class="btn ${needsPreOrder ? "btn-preorder" : "btn-whatsapp"} btn-lg" id="waOrderBtn" onclick="ProductPage.openWhatsApp()">
            ${needsPreOrder ? "" : window.KicksyUtils.whatsappIcon(22)} ${needsPreOrder ? "Pre-Order via WhatsApp" : "Order via WhatsApp"}
          </button>
          <button class="btn btn-ghost btn-lg" onclick="document.getElementById('orderFormSection').scrollIntoView({behavior:'smooth'})">
            Fill Order Form
          </button>
        </div>

        ${
          needsPreOrder
            ? `
        <p style="font-size:.75rem;color:var(--secondary)">📦 This item is currently out of stock — place a pre-order and we'll notify you as soon as it's back, typically within a few days.</p>`
            : ""
        }

        ${
          product.colors?.length || product.sizes?.length
            ? `
        <p style="font-size:.75rem;color:var(--secondary)">💡 Tip: Select your ${[product.colors?.length && "color", product.sizes?.length && "size"].filter(Boolean).join(" and ")} first for the best WhatsApp message.</p>`
            : ""
        }
      </div>
    </div>`;

    updateSizeAvailability();
    updateStockStatus();

    // BUGFIX: sync hidden order-form fields (productId, name, brand, price,
    // size, color) — previously never called, so order submissions had
    // no product context.
    if (typeof Forms !== "undefined")
      Forms.syncProductFields(product, selectedSize, selectedColor);

    // Sticky CTA bar (mobile)
    const stickyBar = document.getElementById("stickyCta");
    if (stickyBar) {
      stickyBar.innerHTML = `
        <button class="btn btn-ghost" onclick="document.getElementById('orderFormSection').scrollIntoView({behavior:'smooth'})">Order Form</button>
        <button class="btn ${needsPreOrder ? "btn-preorder" : "btn-whatsapp"}" onclick="ProductPage.openWhatsApp()">${needsPreOrder ? "" : window.KicksyUtils.whatsappIcon(18)} ${needsPreOrder ? "Pre-Order" : "WhatsApp Order"}</button>`;
    }
  }

  // ── Gallery ────────────────────────────────────────────────
  function switchImage(src, thumbEl) {
    const main = document.getElementById("mainImg");
    if (main) {
      main.style.opacity = "0";
      main.style.transform = "scale(1.03)";
      setTimeout(() => {
        main.src = src;
        main.style.opacity = "1";
        main.style.transform = "";
      }, 180);
    }
    document.querySelectorAll(".gallery-thumb").forEach((t) => {
      t.classList.remove("active");
      t.setAttribute("aria-pressed", "false");
    });
    if (thumbEl) {
      thumbEl.classList.add("active");
      thumbEl.setAttribute("aria-pressed", "true");
    }
  }

  // ── Lightbox (tap-to-zoom on mobile, also works on desktop) ─
  function openLightbox() {
    const mainImg = document.getElementById("mainImg");
    if (!mainImg) return;

    // Create overlay if not already in DOM
    let overlay = document.getElementById("imgLightbox");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "imgLightbox";
      overlay.className = "img-lightbox-overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-label", "Product image zoom");
      overlay.innerHTML = `
        <button class="img-lightbox-close" id="imgLightboxClose" aria-label="Close image">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <img class="img-lightbox-img" id="imgLightboxImg" src="" alt="Product image">`;
      document.body.appendChild(overlay);

      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeLightbox();
      });
      document
        .getElementById("imgLightboxClose")
        .addEventListener("click", closeLightbox);
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeLightbox();
      });
    }

    document.getElementById("imgLightboxImg").src = mainImg.src;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => overlay.classList.add("open"));
  }

  function closeLightbox() {
    const overlay = document.getElementById("imgLightbox");
    if (!overlay) return;
    overlay.classList.remove("open");
    document.body.style.overflow = "";
  }

  // ── Color selection ────────────────────────────────────────
  function selectColor(color) {
    selectedColor = color;
    document.getElementById("selectedColorLabel").textContent = color;
    document.querySelectorAll(".color-btn").forEach((btn) => {
      const active = btn.dataset.color === color;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", active);
    });
    updateSizeAvailability();

    // BUGFIX: if the currently selected size is unavailable for the new
    // color, clear the size selection so the user can't order an
    // out-of-stock combination.
    if (selectedSize) {
      const stockMap = product?.stockMap || {};
      const colorStock = stockMap[selectedColor] || {};
      const qty = colorStock[selectedSize];
      if (qty !== undefined && Number(qty) === 0) {
        selectedSize = "";
        const label = document.getElementById("selectedSizeLabel");
        if (label) label.textContent = "— Select —";
        document.querySelectorAll(".size-btn").forEach((btn) => {
          btn.classList.remove("active");
          btn.setAttribute("aria-pressed", "false");
        });
      }
    }

    updateStockStatus();
    if (typeof Forms !== "undefined")
      Forms.syncProductFields(product, selectedSize, selectedColor);
  }

  // ── Size selection ─────────────────────────────────────────
  function selectSize(size) {
    selectedSize = size;
    document.getElementById("selectedSizeLabel").textContent = size;
    document.querySelectorAll(".size-btn").forEach((btn) => {
      const active = btn.dataset.size === size;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", active);
    });
    updateStockStatus();
    if (typeof Forms !== "undefined")
      Forms.syncProductFields(product, selectedSize, selectedColor);
  }

  // ── Update size availability for current color ─────────────
  function updateSizeAvailability() {
    const stockMap = product?.stockMap || {};
    const colorStock = stockMap[selectedColor] || {};

    document.querySelectorAll(".size-btn").forEach((btn) => {
      const s = btn.dataset.size;
      const qty = colorStock[s];
      const unavailable = qty !== undefined && Number(qty) === 0;
      btn.classList.toggle("unavailable", unavailable);
      btn.disabled = unavailable;
      btn.title = unavailable ? "Unavailable in this color" : "";
    });
  }

  // ── Stock status display ───────────────────────────────────
  function updateStockStatus() {
    const el = document.getElementById("stockStatus");
    if (!el) return;

    if (!product.available) {
      el.innerHTML = stockStatusHTML("out");
      return;
    }

    if (!selectedColor && !selectedSize) {
      const total = API.computeStock(product);
      const hasStockMap =
        product.stockMap && Object.keys(product.stockMap).length > 0;

      if (!hasStockMap) {
        // No per-color/size stock tracked (e.g. leather goods) — trust `available` flag only
        el.innerHTML = stockStatusHTML(product.available ? "in" : "out");
        return;
      }

      el.innerHTML = stockStatusHTML(
        total > 5 ? "in" : total > 0 ? "low" : "out",
        total,
      );
      return;
    }

    const stockMap = product.stockMap || {};
    const colorStock = stockMap[selectedColor] || {};
    const qty = selectedSize ? Number(colorStock[selectedSize]) || 0 : null;

    if (qty === null) {
      el.innerHTML = stockStatusHTML("in");
    } else if (qty > 5) {
      el.innerHTML = stockStatusHTML("in", qty);
    } else if (qty > 0) {
      el.innerHTML = stockStatusHTML("low", qty);
    } else {
      el.innerHTML = stockStatusHTML("out");
    }
  }

  function stockStatusHTML(type, qty) {
    const labels = {
      in: "In Stock",
      low: `Only ${qty} left`,
      out: "Pre-Order — currently unavailable",
      unknown: "Check availability",
    };
    const dotClass = type === "in" ? "in" : type === "low" ? "low" : "out";
    return `<span class="stock-dot ${dotClass}"></span><span style="font-size:.875rem;font-weight:500">${labels[type]}</span>`;
  }

  // ── WhatsApp order ─────────────────────────────────────────
  function openWhatsApp(customer = {}) {
    if (!product) return;
    const size = selectedSize || "Not selected";
    const color = selectedColor || "Not selected";
    const url = CONFIG.getWhatsAppURL(product, size, color, customer);

    // Also log whatsapp open
    API.createOrder({
      productId: product.id,
      productName: product.name,
      brand: product.brand,
      selectedSize: size,
      selectedColor: color,
      price: product.salePrice,
      ...customer,
      whatsappOpened: true,
      status: "New",
    }).catch(() => {});

    window.open(url, "_blank", "noopener,noreferrer");
  }

  // ── View count ─────────────────────────────────────────────
  // Fetches the current view count from the Cloudflare KV edge endpoint
  // and displays it inline with the rating row. Runs after renderProduct()
  // so the #productViewCount element already exists in the DOM.
  // Falls back silently if the endpoint is unavailable (local dev, etc.)
  async function loadViewCount(id) {
    const el = document.getElementById("productViewCount");
    if (!el) return;
    try {
      const res = await fetch(`/product/${encodeURIComponent(id)}/views`);
      if (!res.ok) throw new Error("no data");
      const { views } = await res.json();
      if (!views && views !== 0) throw new Error("empty");
      const formatted = views >= 1000
        ? `${(views / 1000).toFixed(1).replace(/\.0$/, "")}k`
        : String(views);
      el.textContent = `${formatted} views`;
    } catch {
      // Hide the separator too if count unavailable
      const sep = document.querySelector(".product-view-sep");
      if (sep) sep.style.display = "none";
      el.style.display = "none";
    }
  }

  // ── Related products ───────────────────────────────────────
  async function loadRelated() {
    const grid = document.getElementById("relatedGrid");
    if (!grid) return;

    try {
      const isLeather = product.productType === "leather";
      const all = isLeather
        ? await API.fetchLeatherProducts()
        : await API.fetchProducts();
      const related = all
        .filter(
          (p) =>
            p.id !== product.id &&
            (p.brand === product.brand || p.category === product.category),
        )
        .slice(0, 4);
      if (related.length === 0) {
        document.getElementById("relatedSection")?.remove();
        return;
      }

      // Update "Related Products" heading for leather goods context
      if (isLeather) {
        const heading = document.querySelector(
          "#relatedSection .section-title",
        );
        if (heading) heading.textContent = "You May Also Like";
      }

      grid.innerHTML = related
        .map(window.KicksyUtils.buildProductCard)
        .join("");
      grid.querySelectorAll(".product-card").forEach((card, i) => {
        card.style.animationDelay = `${i * 60}ms`;
        card.classList.add("fade-in");
      });
    } catch {
      document.getElementById("relatedSection")?.remove();
    }
  }

  // ── SEO update ─────────────────────────────────────────────
  function updateSEO() {
    if (!product) return;

    // Delegate meta/OG/Twitter/canonical/breadcrumb updates to seo.js
    if (typeof SEO !== "undefined") {
      SEO.updateForProduct(product);
    } else {
      // Fallback if seo.js failed to load
      document.title = `${product.name} — ${product.brand} | Kicksy Nepal`;
      document
        .querySelector('meta[name="description"]')
        ?.setAttribute(
          "content",
          product.shortDescription ||
            product.description ||
            CONFIG.SEO.defaultDescription,
        );
      document
        .querySelector('meta[property="og:title"]')
        ?.setAttribute("content", document.title);
      if (product.image1)
        document
          .querySelector('meta[property="og:image"]')
          ?.setAttribute("content", product.image1);
    }

    // JSON-LD Product schema (specific to this page, not in seo.js)
    // Google requires: name, image, description, offers.price,
    // offers.priceCurrency, offers.availability for rich results.
    // itemCondition distinguishes master-copies clearly to prevent
    // misleading users who expect brand-new authentic products.
    const priceValidUntil = new Date();
    priceValidUntil.setFullYear(priceValidUntil.getFullYear() + 1);

    const schema = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      sku: product.sku || product.id,
      brand: { "@type": "Brand", name: product.brand },
      description: product.description || product.shortDescription,
      image: [
        product.image1,
        product.image2,
        product.image3,
        product.image4,
        product.image5,
      ].filter(Boolean),
      offers: {
        "@type": "Offer",
        url: `${CONFIG.SITE_URL}/product/${encodeURIComponent(product.id)}`,
        price: product.salePrice || product.price,
        priceCurrency: "NPR",
        priceValidUntil: priceValidUntil.toISOString().split("T")[0],
        availability: product.available
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
        itemCondition: "https://schema.org/NewCondition",
        seller: {
          "@type": "Organization",
          name: "Kicksy Nepal",
          url: "https://kicksy.com.np",
        },
        shippingDetails: {
          "@type": "OfferShippingDetails",
          shippingDestination: {
            "@type": "DefinedRegion",
            addressCountry: "NP",
          },
          deliveryTime: {
            "@type": "ShippingDeliveryTime",
            handlingTime: {
              "@type": "QuantitativeValue",
              minValue: 1,
              maxValue: 2,
              unitCode: "DAY",
            },
            transitTime: {
              "@type": "QuantitativeValue",
              minValue: 1,
              maxValue: 7,
              unitCode: "DAY",
            },
          },
        },
      },
    };
    if (product.reviewCount > 0) {
      schema.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: product.rating,
        reviewCount: product.reviewCount,
        bestRating: 5,
        worstRating: 1,
      };
    }

    const existing = document.getElementById("productSchema");
    if (existing) existing.textContent = JSON.stringify(schema);
    else {
      const s = document.createElement("script");
      s.id = "productSchema";
      s.type = "application/ld+json";
      s.textContent = JSON.stringify(schema);
      document.head.appendChild(s);
    }
  }

  // ── Share / copy link ──────────────────────────────────────
  // copyLink() is called by the "Copy link" share button.
  // It uses the modern Clipboard API with a textarea fallback for
  // older browsers, and gives a brief visual confirmation by
  // swapping the button label for 2 seconds.
  function copyLink() {
    if (!product) return;
    const url = `${CONFIG.SITE_URL}/product/${encodeURIComponent(product.id)}`;
    const label = document.getElementById("copyLinkLabel");

    function confirm() {
      if (label) {
        label.textContent = "Copied!";
        setTimeout(() => {
          label.textContent = "Copy link";
        }, 2000);
      }
      window.KicksyUtils?.Toast?.show("Link copied to clipboard!", "success");
    }

    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(confirm)
        .catch(() => {
          fallbackCopy(url);
          confirm();
        });
    } else {
      fallbackCopy(url);
      confirm();
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand("copy");
    } catch {}
    document.body.removeChild(ta);
  }

  // ── Helpers ────────────────────────────────────────────────
  function esc(str) {
    return window.KicksyUtils.sanitize(String(str || ""));
  }
  function formatPrice(n) {
    return window.KicksyUtils.formatPrice(n);
  }
  function starsHTML(r) {
    return window.KicksyUtils.starsHTML(r);
  }
  function discountPercent(p, s) {
    return window.KicksyUtils.discountPercent(p, s);
  }

  return {
    init,
    switchImage,
    openLightbox,
    closeLightbox,
    selectColor,
    selectSize,
    openWhatsApp,
    copyLink,
  };
})();

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("productMain")) ProductPage.init();
});
