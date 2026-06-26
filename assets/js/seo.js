// ============================================================
// KICKSY NEPAL — SEO.JS
// Dynamic meta tag updates for product/shop pages
// ============================================================

const SEO = (() => {
  function setMeta(name, content) {
    let el = document.querySelector(`meta[name="${name}"]`);
    if (!el) { el = document.createElement("meta"); el.setAttribute("name", name); document.head.appendChild(el); }
    el.setAttribute("content", content);
  }
  function setOG(prop, content) {
    let el = document.querySelector(`meta[property="${prop}"]`);
    if (!el) { el = document.createElement("meta"); el.setAttribute("property", prop); document.head.appendChild(el); }
    el.setAttribute("content", content);
  }
  function setCanonical(url) {
    let el = document.querySelector('link[rel="canonical"]');
    if (!el) { el = document.createElement("link"); el.setAttribute("rel", "canonical"); document.head.appendChild(el); }
    el.setAttribute("href", url);
  }
  function setLdJson(id, schema) {
    let el = document.getElementById(id);
    if (!el) { el = document.createElement("script"); el.id = id; el.type = "application/ld+json"; document.head.appendChild(el); }
    el.textContent = JSON.stringify(schema);
  }

  // Converts an ImageKit image URL to a crawler-safe JPEG.
  // Strips any existing ?updatedAt / ?tr params and appends
  // ?tr=f-jpg,w-1200,h-1200,fo-auto so crawlers always get a
  // properly sized JPEG rather than a WebP that many bots reject.
  // Non-ImageKit URLs are returned unchanged.
  function buildCrawlerImageUrl(imageUrl) {
    if (!imageUrl) return imageUrl;
    try {
      const u = new URL(imageUrl);
      if (u.hostname.includes("imagekit.io")) {
        // Remove all existing query params, add clean transform params
        return `${u.origin}${u.pathname}?tr=f-jpg,w-1200,h-1200,fo-auto`;
      }
    } catch {}
    return imageUrl;
  }

  function updateForProduct(product) {
    if (!product) return;
    const title = `${product.name} — ${product.brand} | Kicksy Nepal`;
    const desc  = product.shortDescription || product.description || CONFIG.SEO.defaultDescription;
    const url   = `${CONFIG.SITE_URL}/product/${encodeURIComponent(product.id)}`;

    document.title = title;
    setMeta("description", desc);

    // Twitter / X
    setMeta("twitter:card",        "summary_large_image");
    setMeta("twitter:site",        "@kicksynp");
    setMeta("twitter:title",       title);
    setMeta("twitter:description", desc);

    // Open Graph — used by WhatsApp, Facebook, LinkedIn, Messenger, Telegram
    setOG("og:site_name",   "Kicksy Nepal");
    setOG("og:type",        "product");
    setOG("og:title",       title);
    setOG("og:description", desc);
    setOG("og:url",         url);

    if (product.image1) {
      // Social crawlers (especially WhatsApp) require a publicly
      // accessible JPEG or PNG — they often reject WebP. ImageKit
      // serves WebP by default, so we append ?tr=f-jpg,w-1200,h-1200
      // to force a square JPEG at a known size. This only affects the
      // og:image URL used by crawlers; the page gallery still uses the
      // original WebP URL for fast loading.
      const crawlerImage = buildCrawlerImageUrl(product.image1);
      setOG("og:image",            crawlerImage);
      setOG("og:image:secure_url", crawlerImage);
      setOG("og:image:type",       "image/jpeg");
      setOG("og:image:width",      "1200");
      setOG("og:image:height",     "1200");
      setOG("og:image:alt",        `${product.name} by ${product.brand}`);
      setMeta("twitter:image",     crawlerImage);
      setMeta("twitter:image:alt", `${product.name} by ${product.brand}`);
    }

    setCanonical(url);

    // Breadcrumb schema: Home > Shop/Leather Goods > Category > Product
    const isLeather = product.productType === "leather";
    const categoryUrl = isLeather
      ? `${CONFIG.SITE_URL}/leather?category=${encodeURIComponent(product.category)}`
      : `${CONFIG.SITE_URL}/shop?brand=${encodeURIComponent(product.brand)}`;

    setLdJson("breadcrumbSchema", {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home",  "item": `${CONFIG.SITE_URL}/` },
        { "@type": "ListItem", "position": 2, "name": isLeather ? "Leather Goods" : "Shop", "item": isLeather ? `${CONFIG.SITE_URL}/leather` : `${CONFIG.SITE_URL}/shop` },
        { "@type": "ListItem", "position": 3, "name": isLeather ? product.category : product.brand, "item": categoryUrl },
        { "@type": "ListItem", "position": 4, "name": product.name, "item": `${CONFIG.SITE_URL}/product/${encodeURIComponent(product.id)}` }
      ]
    });
  }

  function updateForShop(query) {
    const title = query ? `"${query}" Shoes | Kicksy Nepal` : "Shop All Shoes | Kicksy Nepal";
    document.title = title;
    setOG("og:title", title);
    setCanonical(`${CONFIG.SITE_URL}/shop`);
  }

  function updateForLeather(query) {
    const title = query ? `"${query}" Leather Goods | Kicksy Nepal` : "Leather Goods | Kicksy Nepal";
    document.title = title;
    setOG("og:title", title);
    setCanonical(`${CONFIG.SITE_URL}/leather`);
  }

  return { updateForProduct, updateForShop, updateForLeather, setLdJson };
})();
