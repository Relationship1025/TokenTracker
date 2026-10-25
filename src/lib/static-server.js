const fsPromises = require("node:fs/promises");
const path = require("node:path");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

/**
 * Serve a static file from baseDir. Returns true if served, false otherwise.
 * For SPA: caller should fall back to index.html when this returns false.
 */
async function serveStaticFile(baseDir, pathname, res) {
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(baseDir, safePath);

  // prevent directory traversal
  if (!filePath.startsWith(baseDir)) return false;

  let handle;
  try {
    handle = await fsPromises.open(filePath, "r");
    const stat = await handle.stat();
    if (!stat.isFile()) return false;

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    // Vite emits content-hashed filenames under /assets/, so those can be
    // cached immutably. Everything else — SPA entry HTML above all — must
    // revalidate: an index.html cached for a year keeps pointing at the
    // previous build's chunk hashes after a dashboard rebuild.
    const isHashedAsset = pathname.startsWith("/assets/");
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": stat.size,
      "Cache-Control": isHashedAsset
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    });

    const stream = handle.createReadStream();
    handle = null; // The stream owns and closes this descriptor.
    stream.on("error", (error) => res.destroy(error));
    res.on("close", () => stream.destroy());
    stream.pipe(res);
    return true;
  } catch (_e) {
    return false;
  } finally {
    if (handle) await handle.close();
  }
}

module.exports = { serveStaticFile };
