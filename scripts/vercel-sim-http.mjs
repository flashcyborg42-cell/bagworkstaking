import { createServer, request as httpRequest } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { extname, join } from "node:path";
import { pathToFileURL } from "node:url";

const ca = "HpYdUftXwEaG7jekkjFvFLWeJ5dfqaFvtDHoRC6jd99s";
const root = process.cwd();
const stakeMod = await import(pathToFileURL(join(root, "api/stake/[ca].js")).href);
const ogMod = await import(pathToFileURL(join(root, "api/og/[ca].js")).href);
const stake = stakeMod.default;
const og = ogMod.default;
if (typeof stake !== "function" || typeof og !== "function") {
  throw new Error("ESM default export is not a function");
}

const types = { ".png": "image/png", ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".wasm": "application/wasm", ".ico": "image/x-icon" };

function staticFile(urlPath) {
  const rel = urlPath.replace(/^\//, "") || "index.html";
  const file = join(root, "dist-static", rel);
  if (!existsSync(file)) return null;
  return { body: readFileSync(file), type: types[extname(file)] || "application/octet-stream" };
}

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1:8798");
  req.headers.host = req.headers.host || "bagwork-staking.vercel.app";
  if (url.pathname.startsWith("/stake/") || url.pathname.startsWith("/api/stake/")) {
    Promise.resolve(stake(req, res)).catch((error) => {
      res.statusCode = 500;
      res.end(String(error && error.stack ? error.stack : error));
    });
    return;
  }
  if (url.pathname.startsWith("/api/public/og/") || url.pathname.startsWith("/api/og/")) {
    Promise.resolve(og(req, res)).catch((error) => {
      res.statusCode = 500;
      res.end(String(error && error.stack ? error.stack : error));
    });
    return;
  }
  const file = staticFile(url.pathname);
  if (file) {
    res.setHeader("Content-Type", file.type);
    res.end(file.body);
    return;
  }
  res.statusCode = 404;
  res.end("not found");
});

await new Promise((resolve) => server.listen(8798, "127.0.0.1", resolve));

const failures = [];
async function check(label, path, expect) {
  const res = await fetch("http://127.0.0.1:8798" + path, { headers: { "user-agent": "WhatsApp/2.0", host: "bagwork-staking.vercel.app" }, redirect: "manual" });
  const buf = Buffer.from(await res.arrayBuffer());
  const text = buf.toString("utf8");
  const row = {
    label,
    status: res.status,
    type: res.headers.get("content-type"),
    len: buf.length,
    variant: res.headers.get("x-card-variant"),
    ogImage: /property="og:image" content="([^"]+)"/.exec(text)?.[1] || "",
    title: /property="og:title" content="([^"]+)"/.exec(text)?.[1] || "",
    png: buf[0] === 0x89 && buf[1] === 0x50,
  };
  console.log(JSON.stringify(row));
  if (expect.html) {
    if (res.status !== 200) failures.push(label + " not 200");
    if (!row.ogImage.startsWith("https://")) failures.push(label + " og:image is not absolute https: " + row.ogImage);
    if (!row.title.includes("GIN-CHAN")) failures.push(label + " missing GIN-CHAN title");
  }
  if (expect.png) {
    if (res.status !== 200 || !row.png) failures.push(label + " not png 200");
  }
  return row;
}

const stakeRow = await check("stake", `/stake/${ca}?v=3`, { html: true });
await check("api-stake", `/api/stake/${ca}?v=3`, { html: true });
await check("og", `/api/public/og/${ca}?v=3`, { png: true });
await check("api-og", `/api/og/${ca}?v=2`, { png: true });

if (stakeRow.ogImage) {
  const imagePath = new URL(stakeRow.ogImage).pathname + new URL(stakeRow.ogImage).search;
  await check("og-from-meta", imagePath, { png: true });
}

const share = await fetch("http://127.0.0.1:8798/share-card.png");
console.log(JSON.stringify({ label: "share-card", status: share.status, type: share.headers.get("content-type"), len: Number(share.headers.get("content-length") || 0) }));
if (!share.ok) failures.push("share-card missing");

server.close();
if (failures.length) {
  console.error("FAILURES:\n" + failures.join("\n"));
  process.exit(1);
}
console.log("FULL_HTTP_SIM_OK");
