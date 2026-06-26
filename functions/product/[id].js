const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzu3uYx0kod5wzwmM3IDq7KyrGKGifucd3GEUiaM0yV0JpCBxUPmgvWY_NoplHwyqe-hg/exec";
const SITE_URL      = "https://kicksy.com.np";
const SITE_NAME     = "Kicksy Nepal";
const FALLBACK_IMAGE = `${SITE_URL}/assets/images/og-image.png`;
const FALLBACK_DESC =
  "Shop premium quality sneakers and handcrafted leather goods online in Nepal. Nationwide delivery. Easy WhatsApp ordering.";

async function fetchProduct(id) {
  const url = `${GOOGLE_SCRIPT_URL}?action=product&id=${encodeURIComponent(id)}`;
  const res = await fetch(url, { cf: { cacheTtl: 300, cacheEverything: true } });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = await res.json();
  if (!json.success || !json.data) throw new Error("Not found");
  return json.data;
}

function buildCrawlerImageUrl(imageUrl) {
  if (!imageUrl) return FALLBACK_IMAGE;
  try {
    const u = new URL(imageUrl);
    if (u.hostname.includes("imagekit.io")) {
      return `${u.origin}${u.pathname}?tr=f-jpg,w-1200,h-1200,fo-auto`;
    }
  } catch {}
  return imageUrl;
}

export async function onRequest(context) {
  const { request, next, params } = context;
  const id = params.id;

  if (!id) return Response.redirect(`${SITE_URL}/shop`, 302);

  // Rewrite the request URL to /product.html so Cloudflare Pages
  // serves the static HTML asset via next(). This is the correct
  // way to fetch a static asset from within a Pages Function —
  // ASSETS.fetch() requires a Service Binding which needs extra
  // Cloudflare dashboard configuration; next() with a rewritten
  // URL works out of the box with zero configuration.
  const rewrittenRequest = new Request(
    new URL("/product.html", request.url).toString(),
    { method: "GET", headers: { "Accept": "text/html" } }
  );

  const [assetRes, product] = await Promise.all([
    next(rewrittenRequest),
    fetchProduct(id).catch(() => null),
  ]);

  // If asset fetch failed or product not found, still serve the HTML
  // so the page works — product.js will load the product via JS.
  if (!product) return assetRes;

  const contentType = assetRes.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return assetRes;

  const canonicalUrl = `${SITE_URL}/product/${encodeURIComponent(id)}`;
  const title        = `${product.name} — ${product.brand} | ${SITE_NAME}`;
  const description  = product.shortDescription || product.description || FALLBACK_DESC;
  const image        = buildCrawlerImageUrl(product.image1);
  const imageAlt     = `${product.name} by ${product.brand}`;

  return new HTMLRewriter()
    .on("title", {
      element(el) { el.setInnerContent(title); }
    })
    .on('link[rel="canonical"]', {
      element(el) { el.setAttribute("href", canonicalUrl); }
    })
    .on("meta", {
      element(el) {
        const name     = el.getAttribute("name")     || "";
        const property = el.getAttribute("property") || "";

        if (name === "description")             { el.setAttribute("content", description);           return; }
        if (name === "twitter:card")            { el.setAttribute("content", "summary_large_image"); return; }
        if (name === "twitter:title")           { el.setAttribute("content", title);                 return; }
        if (name === "twitter:description")     { el.setAttribute("content", description);           return; }
        if (name === "twitter:image")           { el.setAttribute("content", image);                 return; }
        if (name === "twitter:image:alt")       { el.setAttribute("content", imageAlt);              return; }
        if (property === "og:title")            { el.setAttribute("content", title);                 return; }
        if (property === "og:description")      { el.setAttribute("content", description);           return; }
        if (property === "og:url")              { el.setAttribute("content", canonicalUrl);          return; }
        if (property === "og:type")             { el.setAttribute("content", "product");             return; }
        if (property === "og:image")            { el.setAttribute("content", image);                 return; }
        if (property === "og:image:secure_url") { el.setAttribute("content", image);                 return; }
        if (property === "og:image:alt")        { el.setAttribute("content", imageAlt);              return; }
        if (property === "og:image:type")       { el.setAttribute("content", "image/jpeg");          return; }
        if (property === "og:image:width")      { el.setAttribute("content", "1200");                return; }
        if (property === "og:image:height")     { el.setAttribute("content", "1200");                return; }
      }
    })
    .on("body", {
      element(el) {
        el.append(
          `<script>window.__PRODUCT_ID__ = ${JSON.stringify(id)};</script>`,
          { html: true }
        );
      }
    })
    .transform(assetRes);
}
