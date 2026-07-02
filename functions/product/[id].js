const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzu3uYx0kod5wzwmM3IDq7KyrGKGifucd3GEUiaM0yV0JpCBxUPmgvWY_NoplHwyqe-hg/exec";

const SITE_URL       = "https://kicksy.com.np";
const SITE_NAME      = "Kicksy Nepal";
const FALLBACK_IMAGE = `${SITE_URL}/assets/images/og-image.png`;
const FALLBACK_DESC  =
  "Shop premium quality sneakers and handcrafted leather goods online in Nepal. Nationwide delivery. Easy WhatsApp ordering.";

// ── View counter ──────────────────────────────────────────────
// KV binding: VIEWS_KV  (Cloudflare Pages → Settings → Functions → KV bindings)
// Key format: view:<product-id>   Value: integer as string e.g. "142"

async function incrementView(env, id) {
  if (!env || !env.VIEWS_KV) return;
  try {
    const key     = `view:${id}`;
    const current = await env.VIEWS_KV.get(key);
    const next    = (parseInt(current || "0", 10) + 1).toString();
    await env.VIEWS_KV.put(key, next);
  } catch {}
}

async function getViewCount(env, id) {
  if (!env || !env.VIEWS_KV) return 0;
  try {
    const val = await env.VIEWS_KV.get(`view:${id}`);
    return parseInt(val || "0", 10);
  } catch { return 0; }
}

// ── Product data ──────────────────────────────────────────────

async function fetchProduct(id) {
  const url = `${GOOGLE_SCRIPT_URL}?action=product&id=${encodeURIComponent(id)}`;
  const res = await fetch(url, { cf: { cacheTtl: 300, cacheEverything: true } });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = await res.json();
  if (!json || !json.success || !json.data) throw new Error("Product not found");
  return json.data;
}

function getField(product, ...keys) {
  for (const key of keys) {
    const val = product[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return "";
}

function toAbsoluteImageUrl(imageUrl) {
  if (!imageUrl) return FALLBACK_IMAGE;
  try {
    const u = new URL(imageUrl, SITE_URL);
    if (u.hostname.includes("imagekit.io")) {
      u.search = "?tr=f-jpg,w-1200,h-1200,fo-auto,q-90";
    }
    return u.toString();
  } catch { return FALLBACK_IMAGE; }
}

async function fetchProductHtml(request, env) {
  const assetUrl     = new URL("/product.html", request.url).toString();
  const assetRequest = new Request(assetUrl, { method: "GET" });
  if (env && env.ASSETS) return env.ASSETS.fetch(assetRequest);
  return fetch(assetRequest);
}

function rewriteMeta(assetRes, id, product) {
  const name         = getField(product, "name", "productName", "title");
  const brand        = getField(product, "brand", "Brand", "category");
  const description  = getField(product, "shortDescription", "description") || FALLBACK_DESC;
  const image        = toAbsoluteImageUrl(getField(product, "image1", "image", "mainImage", "ogImage"));
  const canonicalUrl = `${SITE_URL}/product/${encodeURIComponent(id)}`;
  const title        = brand ? `${name} — ${brand} | ${SITE_NAME}` : `${name} | ${SITE_NAME}`;
  const imageAlt     = brand ? `${name} by ${brand}` : name;

  return new HTMLRewriter()
    .on("title", { element(el) { el.setInnerContent(title); } })
    .on('link[rel="canonical"]', { element(el) { el.setAttribute("href", canonicalUrl); } })
    .on("meta", {
      element(el) {
        const n = el.getAttribute("name")     || "";
        const p = el.getAttribute("property") || "";
        if (n === "description")         { el.setAttribute("content", description);           return; }
        if (n === "twitter:card")        { el.setAttribute("content", "summary_large_image"); return; }
        if (n === "twitter:title")       { el.setAttribute("content", title);                 return; }
        if (n === "twitter:description") { el.setAttribute("content", description);           return; }
        if (n === "twitter:image")       { el.setAttribute("content", image);                 return; }
        if (n === "twitter:image:alt")   { el.setAttribute("content", imageAlt);              return; }
        if (p === "og:title")            { el.setAttribute("content", title);                 return; }
        if (p === "og:description")      { el.setAttribute("content", description);           return; }
        if (p === "og:url")              { el.setAttribute("content", canonicalUrl);          return; }
        if (p === "og:type")             { el.setAttribute("content", "product");             return; }
        if (p === "og:image")            { el.setAttribute("content", image);                 return; }
        if (p === "og:image:secure_url") { el.setAttribute("content", image);                 return; }
        if (p === "og:image:alt")        { el.setAttribute("content", imageAlt);              return; }
        if (p === "og:image:type")       { el.setAttribute("content", "image/jpeg");          return; }
        if (p === "og:image:width")      { el.setAttribute("content", "1200");                return; }
        if (p === "og:image:height")     { el.setAttribute("content", "1200");                return; }
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

export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const id  = params.id;

  if (!id) return Response.redirect(`${SITE_URL}/shop`, 302);

  // ── /product/[id]/views — read-only JSON endpoint ────────────
  // Called by product.js to fetch the current count after page load.
  // Returns: { views: 142 }
  if (url.pathname.endsWith("/views")) {
    const count = await getViewCount(env, id);
    return new Response(JSON.stringify({ views: count }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // ── Regular product page request ─────────────────────────────
  // Increment counter fire-and-forget — never blocks page response.
  context.waitUntil(incrementView(env, id));

  const [assetResult, productResult] = await Promise.allSettled([
    fetchProductHtml(request, env),
    fetchProduct(id),
  ]);

  if (assetResult.status !== "fulfilled" || !assetResult.value.ok) {
    return new Response("Not found", { status: 404 });
  }

  const assetRes = assetResult.value;
  if (productResult.status !== "fulfilled") return assetRes;

  return rewriteMeta(assetRes, id, productResult.value);
}
