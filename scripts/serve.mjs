import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("out");
const headersFile = await readFile(resolve(root, "_headers"), "utf8");
const csp = headersFile.match(/^\s+Content-Security-Policy: (.+)$/m)?.[1];
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".wasm": "application/wasm",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".xml": "application/xml",
  ".txt": "text/plain",
  ".woff2": "font/woff2",
};
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    let path = resolve(root, "." + pathname);
    if (path !== root && !path.startsWith(root + sep)) {
      res.writeHead(403);
      return res.end();
    }
    if ((await stat(path)).isDirectory()) path = resolve(path, "index.html");
    res.setHeader(
      "Content-Type",
      mime[extname(path)] || "application/octet-stream",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (csp) res.setHeader("Content-Security-Policy", csp);
    res.end(await readFile(path));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(Number(process.env.PORT || 3000), "127.0.0.1", () =>
  console.log(
    "InstaScope preview: http://127.0.0.1:" + (process.env.PORT || 3000),
  ),
);
