import { createRequire } from "node:module";
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, relative, sep } from "node:path";

const root = process.cwd();
const dist = join(root, "dist-static");
const port = Number(process.env.PORT || 4173);
const requireApi = createRequire(join(root, "api/package.json"));
const og = requireApi("./card-og/[ca].js");
const art = requireApi("./card-art/[ca].js");

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
  ".json": "application/json",
};

function inside(base, target) {
  const rel = relative(base, target);
  return rel && !rel.startsWith("..") && !normalize(rel).startsWith(`..${sep}`);
}

function staticFile(urlPath) {
  const rel = decodeURIComponent(urlPath.split("?")[0]).replace(/^\//, "") || "index.html";
  const file = join(dist, rel);
  if (!inside(dist, file) || !existsSync(file) || !statSync(file).isFile()) return null;
  return { body: readFileSync(file), type: types[extname(file)] || "application/octet-stream" };
}

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
  req.headers.host = req.headers.host || `127.0.0.1:${port}`;
  req.headers["x-forwarded-proto"] = "http";

  if (url.pathname.startsWith("/api/public/og/") || url.pathname.startsWith("/api/og/")) {
    Promise.resolve(og(req, res)).catch((error) => {
      res.statusCode = 500;
      res.end(String(error?.stack || error));
    });
    return;
  }
  if (url.pathname.startsWith("/api/public/art/") || url.pathname.startsWith("/api/art/")) {
    Promise.resolve(art(req, res)).catch((error) => {
      res.statusCode = 500;
      res.end(String(error?.stack || error));
    });
    return;
  }

  const file = staticFile(url.pathname) || staticFile("/index.html");
  if (file) {
    res.setHeader("Content-Type", file.type);
    res.end(file.body);
    return;
  }
  res.statusCode = 404;
  res.end("not found");
});

server.listen(port, "127.0.0.1", () => {
  console.log(`PREVIEW http://127.0.0.1:${port}/`);
});
