#!/usr/bin/env node
/**
 * Kicksy Nepal — local clean-URL preview server
 * ------------------------------------------------
 * Plain `python -m http.server` or a bare Express static server does
 * NOT understand clean URLs (e.g. /about) — it only knows about real
 * files on disk (about.html), which is exactly why you saw
 * "Cannot GET /about" or a plain 404 when clicking nav links locally.
 *
 * This script mimics Cloudflare Pages' actual production behavior:
 *   - /about        -> serves about.html
 *   - /about.html   -> serves about.html (so old bookmarks still work)
 *   - /             -> serves index.html
 *   - missing files -> serves 404.html (with a real 404 status code)
 *
 * No npm install required — uses only Node's built-in `http` and
 * `fs` modules.
 *
 * Usage:
 *   node serve.js
 *   (then open http://localhost:8080)
 *
 * Optional: change the port via PORT=3000 node serve.js
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
};

function send(res, status, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  res.writeHead(status, { "Content-Type": contentType });
  fs.createReadStream(filePath).pipe(res);
}

function notFound(res) {
  const notFoundPath = path.join(ROOT, "404.html");
  if (fs.existsSync(notFoundPath)) {
    send(res, 404, notFoundPath);
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Not Found");
  }
}

const server = http.createServer((req, res) => {
  // Strip query string and decode the path
  const urlPath = decodeURIComponent(req.url.split("?")[0]);

  // Block any attempt to escape the project root
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(ROOT, safePath);

  // 1. Root → index.html
  if (urlPath === "/" || urlPath === "") {
    filePath = path.join(ROOT, "index.html");
  }

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      // Exact file exists (covers real assets, and *.html requests too)
      return send(res, 200, filePath);
    }

    // 2. Clean URL: try appending .html (e.g. /about -> about.html)
    const withHtml = filePath + ".html";
    fs.stat(withHtml, (err2, stats2) => {
      if (!err2 && stats2.isFile()) {
        return send(res, 200, withHtml);
      }

      // 3. Dynamic product route: /product/[id] -> serve product.html
      //    Mimics the Cloudflare Pages Function at functions/product/[id].js
      const productMatch = urlPath.match(/^\/product\/(.+)$/);
      if (productMatch) {
        const productHtml = path.join(ROOT, "product.html");
        fs.stat(productHtml, (err3, stats3) => {
          if (!err3 && stats3.isFile()) {
            const id = decodeURIComponent(productMatch[1]);
            fs.readFile(productHtml, "utf8", (err4, html) => {
              if (err4) return send(res, 200, productHtml);
              // product.html uses relative paths (./assets/...) which
              // break when served at /product/KL-1001 because the browser
              // resolves them as /product/assets/... (404).
              // Rewrite all relative asset refs to absolute paths.
              const fixed = html
                .replace(/(['"])\.\//g, "$1/")
                .replace(
                  "</body>",
                  `<script>window.__PRODUCT_ID__ = ${JSON.stringify(id)};</script>\n</body>`
                );
              res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
              res.end(fixed);
            });
          } else {
            notFound(res);
          }
        });
        return;
      }

      // 4. Nothing matched — serve the custom 404 page
      notFound(res);
    });
  });
});

server.listen(PORT, () => {
  console.log(`Kicksy Nepal preview server running at http://localhost:${PORT}`);
  console.log(`Clean URLs are supported here exactly as they will be in production (Cloudflare Pages).`);
});
