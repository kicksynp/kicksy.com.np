const SITE_URL = "https://kicksy.com.np";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  // Legacy links like /product?id=abc should become /product/abc.
  // Use 302 while testing so old 301 cache does not lock the wrong behavior.
  if (id) {
    return Response.redirect(
      `${SITE_URL}/product/${encodeURIComponent(id)}`,
      302,
    );
  }

  // /product without an id should still show product.html or redirect to shop.
  const assetRequest = new Request(new URL("/product.html", request.url), {
    method: "GET",
  });

  return env.ASSETS.fetch(assetRequest);
}
