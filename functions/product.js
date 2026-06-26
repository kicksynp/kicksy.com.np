// Redirect legacy /product?id=xxx links to the new clean URL /product/xxx
// This ensures old shared links still work after the URL format change.
export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  // If there's an id param, redirect to the clean URL permanently
  if (id) {
    return Response.redirect(
      `https://kicksy.com.np/product/${encodeURIComponent(id)}`,
      301,
    );
  }

  // No id — serve product.html as-is
  return next();
}
