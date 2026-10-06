import { createRequire } from "node:module";
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(fileURLToPath(new URL(".", import.meta.url)));
const ca = "HpYdUftXwEaG7jekkjFvFLWeJ5dfqaFvtDHoRC6jd99s";
const host = "bagwork-staking.vercel.app";
const failures = [];
const requireApi = createRequire(join(root, "api/package.json"));

function fail(message) {
  failures.push(message);
  console.error("FAIL", message);
}

function esbuild(entry, outfile, extra = []) {
  const result = spawnSync(
    "npx",
    ["--yes", "esbuild", entry, "--bundle", "--platform=node", "--target=node22", `--outfile=${outfile}`, "--legal-comments=none", ...extra],
    { stdio: "inherit", shell: true, cwd: root },
  );
  if (result.status !== 0) throw new Error(`esbuild failed for ${entry}`);
}

function mockReq(url) {
  return {
    url,
    method: "GET",
    headers: {
      host,
      "x-forwarded-host": host,
      "x-forwarded-proto": "https",
      "user-agent": "WhatsApp/2.0",
    },
  };
}

function mockRes() {
  const headers = {};
  let body;
  let ended = false;
  return {
    statusCode: 200,
    headers,
    setHeader(name, value) {
      headers[String(name).toLowerCase()] = value;
    },
    end(chunk) {
      ended = true;
      body = chunk;
    },
    get body() {
      return body;
    },
    get ended() {
      return ended;
    },
  };
}

function png(buf) {
  return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
}

function summarize(label, res) {
  const buf = Buffer.isBuffer(res.body) ? res.body : Buffer.from(res.body ?? []);
  const text = buf.toString("utf8");
  const row = {
    label,
    status: res.statusCode,
    type: res.headers["content-type"] || "",
    variant: res.headers["x-card-variant"] || "",
    len: buf.length,
    ended: res.ended,
    hasOg: text.includes("og:image"),
    ogImage: /property="og:image" content="([^"]+)"/.exec(text)?.[1] || "",
    title: /property="og:title" content="([^"]+)"/.exec(text)?.[1] || "",
    png: png(buf),
  };
  console.log(JSON.stringify(row));
  return row;
}

async function invokeCjs(label, file, url, expect) {
  const loaded = requireApi(file);
  if (typeof loaded !== "function") {
    fail(`${label}: require() exported ${typeof loaded} keys=${loaded && typeof loaded === "object" ? Object.keys(loaded) : []}`);
    return;
  }
  const req = mockReq(url);
  const res = mockRes();
  const returned = await loaded(req, res);
  if (!res.ended) fail(`${label}: Vercel Node launcher never got res.end()`);
  if (returned && typeof returned.arrayBuffer === "function" && !res.ended) fail(`${label}: returned Web Response without ending Node res`);
  const row = summarize(label, res);
  if (expect.html) {
    if (row.status !== 200) fail(`${label} status ${row.status}`);
    if (!row.ogImage.startsWith("https://")) fail(`${label} og:image is not absolute https (${row.ogImage})`);
    if (!row.ogImage.includes(host)) fail(`${label} og:image host is ${row.ogImage}`);
    if (!row.title.includes("GIN-CHAN")) fail(`${label} missing GIN-CHAN title`);
  }
  if (expect.png) {
    if (row.status !== 200 || !row.png || row.len < 1000) fail(`${label} not a real PNG`);
  }
}

async function invokeFetch(label, fn, url, expect) {
  const request = new Request(url, { headers: { "user-agent": "WhatsApp/2.0" } });
  const response = await fn(request);
  const buf = Buffer.from(await response.arrayBuffer());
  const text = buf.toString("utf8");
  const row = {
    label,
    status: response.status,
    type: response.headers.get("content-type") || "",
    variant: response.headers.get("x-card-variant") || "",
    len: buf.length,
    ogImage: /property="og:image" content="([^"]+)"/.exec(text)?.[1] || "",
    title: /property="og:title" content="([^"]+)"/.exec(text)?.[1] || "",
    png: png(buf),
  };
  console.log(JSON.stringify(row));
  if (expect.html) {
    if (row.status !== 200) fail(`${label} status ${row.status}`);
    if (!row.ogImage.startsWith("https://")) fail(`${label} og:image is not absolute https (${row.ogImage})`);
    if (!row.title.includes("GIN-CHAN")) fail(`${label} missing GIN-CHAN title`);
  }
  if (expect.png) {
    if (row.status !== 200 || !row.png || row.len < 1000) fail(`${label} not a real PNG`);
  }
  return row;
}

function requiredFiles() {
  const files = [
    "api/card-stake/[ca].js",
    "api/card-og/[ca].js",
    "api/card-art/[ca].js",
    "server/vercel/stake.ts",
    "server/vercel/og.ts",
    "server/vercel/art.ts",
    "api/package.json",
    ".vercelignore",
    ".github/workflows/unconflict-api.yml",
    "scripts/skip-if-api-conflict.mjs",
    "dist-static/index.html",
    "dist-static/share-card.png",
    "dist-static/cards/v2.png",
    "dist-static/cards/v3.png",
    "dist-static/wasm/resvg.wasm",
    "wasm/resvg.wasm",
    "src/lib/vendor/resvg-wasm/index_bg.wasm",
    "netlify/functions/stake.ts",
    "netlify/functions/og.ts",
    "functions/stake/[ca].ts",
    "functions/api/public/og/[ca].ts",
  ];
  for (const file of files) {
    if (!existsSync(join(root, file))) fail(`missing ${file}`);
  }
  for (const leftover of [
    "api/stake/[ca].ts",
    "api/og/[ca].ts",
    "api/art/[ca].ts",
    "api/stake/[ca].js",
    "api/og/[ca].js",
    "api/art/[ca].js",
  ]) {
    if (existsSync(join(root, leftover))) fail(`${leftover} must not ship beside the .js function`);
  }
  const ignore = readFileSync(join(root, ".vercelignore"), "utf8");
  if (!ignore.includes("api/**/*.ts")) fail(".vercelignore does not hide leftover api TypeScript");
  const apiPkg = JSON.parse(readFileSync(join(root, "api/package.json"), "utf8"));
  if (apiPkg.type !== "commonjs") fail('api/package.json must be "type": "commonjs"');
}

requiredFiles();

console.log("\n== Vercel CJS require() launcher ==");
await invokeCjs("vercel-cjs-stake", join(root, "api/card-stake/[ca].js"), `/stake/${ca}?v=3`, { html: true });
await invokeCjs("vercel-cjs-og", join(root, "api/card-og/[ca].js"), `/api/public/og/${ca}?v=2`, { png: true });

console.log("\n== Vercel HTTP Host rewrite ==");
const stakeHandler = requireApi(join(root, "api/card-stake/[ca].js"));
const ogHandler = requireApi(join(root, "api/card-og/[ca].js"));
const server = createServer((req, res) => {
  req.headers.host = host;
  req.headers["x-forwarded-host"] = host;
  req.headers["x-forwarded-proto"] = "https";
  const url = new URL(req.url || "/", `https://${host}`);
  const fn = url.pathname.includes("/og/") || url.pathname.includes("/card-og/") ? ogHandler : stakeHandler;
  Promise.resolve(fn(req, res)).catch((error) => {
    res.statusCode = 500;
    res.end(String(error && error.stack ? error.stack : error));
  });
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;

async function httpCheck(label, path, expect) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    headers: { "user-agent": "WhatsApp/2.0" },
    redirect: "manual",
  });
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
    png: png(buf),
  };
  console.log(JSON.stringify(row));
  if (expect.html) {
    if (row.status !== 200) fail(`${label} status ${row.status}`);
    if (row.ogImage !== `https://${host}/api/public/og/${ca}?v=3`) fail(`${label} unexpected og:image ${row.ogImage}`);
    if (!row.title.includes("GIN-CHAN")) fail(`${label} missing GIN-CHAN`);
  }
  if (expect.png && (row.status !== 200 || !row.png || row.len < 1000)) fail(`${label} not a real PNG`);
  return row;
}

const stakeRow = await httpCheck("http-stake", `/stake/${ca}?v=3`, { html: true });
await httpCheck("http-og", `/api/public/og/${ca}?v=2`, { png: true });
if (stakeRow.ogImage) {
  const imagePath = new URL(stakeRow.ogImage).pathname + new URL(stakeRow.ogImage).search;
  await httpCheck("http-og-from-meta", imagePath, { png: true });
}
server.close();

console.log("\n== Netlify lambda + fetch handlers ==");
const netlifyDir = mkdtempSync(join(tmpdir(), "bagwork-netlify-"));
esbuild(join(root, "netlify/functions/og.ts"), join(netlifyDir, "og.cjs"), ["--format=cjs"]);
esbuild(join(root, "netlify/functions/stake.ts"), join(netlifyDir, "stake.mjs"), ["--format=esm"]);
const netlifyOg = requireApi(join(netlifyDir, "og.cjs"));
if (typeof netlifyOg.handler !== "function") fail("netlify og missing handler export");
const netlifyOgResult = await netlifyOg.handler({
  rawUrl: `https://bagwork-staking.netlify.app/api/public/og/${ca}?v=3`,
  path: `/api/public/og/${ca}`,
  rawQuery: "v=3",
  httpMethod: "GET",
  headers: { host: "bagwork-staking.netlify.app", "user-agent": "WhatsApp/2.0" },
  queryStringParameters: { v: "3", ca },
});
const netlifyOgBody = netlifyOgResult.isBase64Encoded
  ? Buffer.from(netlifyOgResult.body, "base64")
  : Buffer.from(netlifyOgResult.body ?? "");
console.log(
  JSON.stringify({
    label: "netlify-og",
    status: netlifyOgResult.statusCode,
    type: netlifyOgResult.headers?.["content-type"] || netlifyOgResult.headers?.["Content-Type"],
    base64: netlifyOgResult.isBase64Encoded,
    len: netlifyOgBody.length,
    png: png(netlifyOgBody),
  }),
);
if (netlifyOgResult.statusCode !== 200 || !netlifyOgResult.isBase64Encoded || !png(netlifyOgBody) || netlifyOgBody.length < 1000) {
  fail("netlify-og did not return a base64 PNG");
}

const netlifyStake = await import(pathToFileURL(join(netlifyDir, "stake.mjs")).href);
await invokeFetch(
  "netlify-stake-fetch",
  netlifyStake.default,
  `https://bagwork-staking.netlify.app/stake/${ca}?v=2`,
  { html: true },
);
if (typeof netlifyStake.handler !== "function") fail("netlify stake missing classic handler export");
const netlifyStakeLambda = await netlifyStake.handler({
  rawUrl: `https://bagwork-staking.netlify.app/.netlify/functions/stake?ca=${ca}&v=3`,
  path: "/.netlify/functions/stake",
  rawQuery: `ca=${ca}&v=3`,
  httpMethod: "GET",
  headers: { host: "bagwork-staking.netlify.app", "user-agent": "WhatsApp/2.0" },
  queryStringParameters: { ca, v: "3" },
});
const netlifyStakeHtml = netlifyStakeLambda.isBase64Encoded
  ? Buffer.from(netlifyStakeLambda.body, "base64").toString("utf8")
  : String(netlifyStakeLambda.body ?? "");
const netlifyStakeImage = /property="og:image" content="([^"]+)"/.exec(netlifyStakeHtml)?.[1] || "";
console.log(JSON.stringify({ label: "netlify-stake-lambda", status: netlifyStakeLambda.statusCode, ogImage: netlifyStakeImage }));
if (netlifyStakeLambda.statusCode !== 200 || !netlifyStakeImage.startsWith("https://") || !netlifyStakeHtml.includes("GIN-CHAN")) {
  fail("netlify-stake-lambda missing absolute OG HTML");
}

console.log("\n== Cloudflare Pages functions ==");
const cfDir = mkdtempSync(join(tmpdir(), "bagwork-cf-"));
esbuild(join(root, "functions/stake/[ca].ts"), join(cfDir, "stake.mjs"), ["--format=esm"]);
esbuild(join(root, "functions/api/public/og/[ca].ts"), join(cfDir, "og.mjs"), [
  "--format=esm",
  "--loader:.wasm=binary",
  "--external:cloudflare:*",
]);
const cfStake = await import(pathToFileURL(join(cfDir, "stake.mjs")).href);
const cfOg = await import(pathToFileURL(join(cfDir, "og.mjs")).href);
const cfStakeRes = await cfStake.onRequestGet({
  request: new Request(`https://bagwork.pages.dev/stake/${ca}?v=3`, { headers: { "user-agent": "WhatsApp/2.0" } }),
  params: { ca },
});
const cfStakeBuf = Buffer.from(await cfStakeRes.arrayBuffer());
const cfStakeText = cfStakeBuf.toString("utf8");
const cfImage = /property="og:image" content="([^"]+)"/.exec(cfStakeText)?.[1] || "";
console.log(JSON.stringify({ label: "cf-stake", status: cfStakeRes.status, ogImage: cfImage, title: /property="og:title" content="([^"]+)"/.exec(cfStakeText)?.[1] || "" }));
if (cfStakeRes.status !== 200 || !cfImage.startsWith("https://") || !cfStakeText.includes("GIN-CHAN")) fail("cf-stake missing absolute OG HTML");

const cfOgRes = await cfOg.onRequestGet({
  request: new Request(`https://bagwork.pages.dev/api/public/og/${ca}?v=2`, { headers: { "user-agent": "WhatsApp/2.0" } }),
  params: { ca },
});
const cfOgBuf = Buffer.from(await cfOgRes.arrayBuffer());
console.log(JSON.stringify({ label: "cf-og", status: cfOgRes.status, type: cfOgRes.headers.get("content-type"), variant: cfOgRes.headers.get("x-card-variant"), len: cfOgBuf.length, png: png(cfOgBuf) }));
if (cfOgRes.status !== 200 || !png(cfOgBuf) || cfOgBuf.length < 1000) fail("cf-og not a real PNG");

console.log("\n== Homepage share card ==");
const share = readFileSync(join(root, "dist-static/share-card.png"));
console.log(JSON.stringify({ label: "dist-share-card", len: share.length, png: png(share) }));
if (!png(share) || share.length < 1000) fail("dist-static/share-card.png is not a PNG");

if (process.env.VERCEL_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL) {
  const html = readFileSync(join(root, "dist-static/index.html"), "utf8");
  if (html.includes('content="/share-card.png"')) fail("Vercel homepage still has a relative og:image");
}

if (failures.length) {
  console.error("\nFAILURES:\n" + failures.join("\n"));
  process.exit(1);
}
console.log("\nALL_HOSTS_OK");
