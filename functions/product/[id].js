const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzu3uYx0kod5wzwmM3IDq7KyrGKGifucd3GEUiaM0yV0JpCBxUPmgvWY_NoplHwyqe-hg/exec";

const SITE_URL = "https://kicksy.com.np";
const SITE_NAME = "Kicksy Nepal";
const FALLBACK_IMAGE = `${SITE_URL}/assets/images/og-image.png`;
const FALLBACK_DESC =
  "Shop premium quality sneakers and handcrafted leather goods online in Nepal. Nationwide delivery. Easy WhatsApp ordering.";

async function fetchProduct(id) {
  const url = `${GOOGLE_SCRIPT_URL}?action=product&id=${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    cf: { cacheTtl: 300, cacheEverything: true },
  });

  if (!res.ok) throw new Error(`API ${res.status}`);

  const json = await res.json();
  if (!json || !json.success || !json.data) throw new Error("Product not found");

  return json.data;
}

function firstValue(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length) return value[0];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value !== undefined && value !== null && !Array.isArray(value)) return value;
  }
  return "";
}

function getProductName(product) {
  return String(
    firstValue(product.name, product.productName, product.title, product.Name, product["Product Name"]),
  );
}

function getProductBrand(product) {
  return String(firstValue(product.brand, product.Brand, product.category, product.Category));
}

function getProductDescription(product) {
  return String(
    firstValue(
      product.shortDescription,
      product.description,
      product.ShortDescription,
      product.Description,
      product.details,
      FALLBACK_DESC,
    ),
  );
}

function getProductImage1(product) {
  return String(
    firstValue(
      product.image1,
      product.Image1,
      product.image,
      product.Image,
      product.mainImage,
      product.MainImage,
      product.ogImage,
      product.images,
      FALLBACK_IMAGE,
    ),
  );
}

function toAbsoluteImageUrl(imageUrl) {
  if (!imageUrl) return FALLBACK_IMAGE;

  try {
    const u = new URL(imageUrl, SITE_URL);

    // For ImageKit-hosted product images, force a crawler-friendly JPG square.
    // WhatsApp/Facebook/Twitter prefer absolute, public, non-login image URLs.
    if (u.hostname.includes("imagekit.io")) {
      u.search = "?tr=f-jpg,w-1200,h-1200,fo-auto,q-90";
    }

    return u.toString();
  } catch {
    return FALLBACK_IMAGE;
  }
}

function rewriteMeta(assetRes, id, product) {
  const productName = getProductName(product) || "Product";
  const brand = getProductBrand(product);
  const canonicalUrl = `${SITE_URL}/product/${encodeURIComponent(id)}`;
  const title = brand
    ? `${productName} — ${brand} | ${SITE_NAME}`
    : `${productName} | ${SITE_NAME}`;
  const description = getProductDescription(product);
  const image = toAbsoluteImageUrl(getProductImage1(product));
  const imageAlt = brand ? `${productName} by ${brand}` : productName;

  const rewriter = new HTMLRewriter()
    .on("title", {
      element(el) {
        el.setInnerContent(title);
      },
    })
    .on('link[rel="canonical"]', {
      element(el) {
        el.setAttribute("href", canonicalUrl);
      },
    })
    .on("meta", {
      element(el) {
        const name = el.getAttribute("name") || "";
        const property = el.getAttribute("property") || "";

        if (name === "description") el.setAttribute("content", description);
        if (name === "twitter:card") el.setAttribute("content", "summary_large_image");
        if (name === "twitter:title") el.setAttribute("content", title);
        if (name === "twitter:description") el.setAttribute("content", description);
        if (name === "twitter:image") el.setAttribute("content", image);
        if (name === "twitter:image:alt") el.setAttribute("content", imageAlt);

        if (property === "og:title") el.setAttribute("content", title);
        if (property === "og:description") el.setAttribute("content", description);
        if (property === "og:url") el.setAttribute("content", canonicalUrl);
        if (property === "og:type") el.setAttribute("content", "product");
        if (property === "og:image") el.setAttribute("content", image);
        if (property === "og:image:url") el.setAttribute("content", image);
        if (property === "og:image:secure_url") el.setAttribute("content", image);
        if (property === "og:image:alt") el.setAttribute("content", imageAlt);
        if (property === "og:image:type") el.setAttribute("content", "image/jpeg");
        if (property === "og:image:width") el.setAttribute("content", "1200");
        if (property === "og:image:height") el.setAttribute("content", "1200");
      },
    })
    .on("head", {
      element(el) {
        // Add these in case product.html does not already contain them.
        el.append(
          `\n<meta property="og:image:url" content="${image}">\n` +
            `<meta property="product:brand" content="${brand}">\n`,
          { html: true },
        );
      },
    })
    .on("body", {
      element(el) {
        el.append(
          `<script>window.__PRODUCT_ID__ = ${JSON.stringify(id)};</script>`,
          { html: true },
        );
      },
    });

  const response = rewriter.transform(assetRes);
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "public, max-age=300, s-maxage=300");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const id = params.id;

  if (!id) return Response.redirect(`${SITE_URL}/shop`, 302);

  const assetRequest = new Request(new URL("/product.html", request.url), {
    method: "GET",
  });

  const [assetRes, productResult] = await Promise.allSettled([
    env.ASSETS.fetch(assetRequest),
    fetchProduct(id),
  ]);

  if (assetRes.status !== "fulfilled" || !assetRes.value.ok) {
    return new Response("Product template not found", { status: 404 });
  }

  // If product lookup fails, serve the page so users still see the client-side product.
  // But OG image will only be product-specific when this function can fetch the product data.
  if (productResult.status !== "fulfilled") {
    return assetRes.value;
  }

  return rewriteMeta(assetRes.value, id, productResult.value);
}
