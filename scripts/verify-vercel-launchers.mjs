import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { createServer } from "node:http";

const ca = "HpYdUftXwEaG7jekkjFvFLWeJ5dfqaFvtDHoRC6jd99s";
const out = join(tmpdir(), "bagwork-vercel-verify");
mkdirSync(out, { recursive: true });
const failures = [];

function esbuild(entry, outfile, format) {
  const result = spawnSync(
    "npx",
    ["--yes", "esbuild", entry, "--bundle", "--platform=node", `--format=${format}`, "--target=node22", `--outfile=${outfile}`, "--legal-comments=none"],
    { stdio: "inherit", shell: true },
  );
  if (result.status !== 0) throw new Error(`esbuild ${format} failed for ${entry}`);
}

function mockReq(url) {
  return {
    url,
    method: "GET",
    headers: { host: "bagwork-staking.vercel.app", "user-agent": "WhatsApp/2.0" },
  };
}

function mockRes() {
  const headers = {};
  let body;
  return {
    statusCode: 200,
    headers,
    setHeader(name, value) {
      headers[String(name).toLowerCase()] = value;
    },
    end(chunk) {
      body = chunk;
    },
    get body() {
      return body;
    },
  };
}

function summarize(label, res) {
  const buf = Buffer.isBuffer(res.body) ? res.body : Buffer.from(res.body ?? "");
  const text = buf.toString("utf8");
  const row = {
    label,
    status: res.statusCode,
    type: res.headers["content-type"] || "",
    variant: res.headers["x-card-variant"] || "",
    len: buf.length,
    hasOg: text.includes("og:image"),
    png: buf[0] === 0x89 && buf[1] === 0x50,
    title: /property="og:title" content="([^"]+)"/.exec(text)?.[1] || "",
  };
  console.log(JSON.stringify(row));
  if (res.statusCode >= 500) failures.push(label + " status " + res.statusCode);
  if (label.includes("stake") && !row.hasOg) failures.push(label + " missing og:image");
  if (label.includes("og") && !row.png) failures.push(label + " not a png");
  return row;
}

async function invokeEsm(label, file, url) {
  const mod = await import(pathToFileURL(file).href + `?t=${Date.now()}`);
  const handler = typeof mod.default === "function" ? mod.default : mod;
  if (typeof handler !== "function") {
    failures.push(`${label}: export is ${typeof handler}`);
    return;
  }
  const req = mockReq(url);
  const res = mockRes();
  const returned = await handler(req, res);
  if (returned && typeof returned.arrayBuffer === "function" && res.body == null) {
    failures.push(`${label}: returned Web Response without res.end`);
  }
  summarize(label, res);
}

esbuild("api/stake/[ca].ts", join(out, "stake.mjs"), "esm");
esbuild("api/og/[ca].ts", join(out, "og.mjs"), "esm");

await invokeEsm("esm-compile-stake", join(out, "stake.mjs"), `/api/stake/${ca}?v=3`);
await invokeEsm("esm-compile-og", join(out, "og.mjs"), `/api/og/${ca}?v=2`);

const serverMod = await import(pathToFileURL(join(out, "stake.mjs")).href);
const serverFn = serverMod.default;
const server = createServer((req, res) => {
  Promise.resolve(serverFn(req, res)).catch((error) => {
    res.statusCode = 500;
    res.end(String(error && error.stack ? error.stack : error));
  });
});
await new Promise((resolve) => server.listen(8799, "127.0.0.1", resolve));

const httpRes = await fetch(`http://127.0.0.1:8799/api/stake/${ca}?v=3`, { headers: { "user-agent": "WhatsApp/2.0" } });
const httpBuf = Buffer.from(await httpRes.arrayBuffer());
const httpText = httpBuf.toString("utf8");
console.log(
  JSON.stringify({
    label: "http-stake",
    status: httpRes.status,
    type: httpRes.headers.get("content-type"),
    len: httpBuf.length,
    hasOg: httpText.includes('property="og:image"'),
    title: /property="og:title" content="([^"]+)"/.exec(httpText)?.[1] || "",
  }),
);
if (!httpRes.ok || !httpText.includes("og:image")) failures.push("http-stake failed");
server.close();

if (failures.length) {
  console.error("FAILURES:\n" + failures.join("\n"));
  process.exit(1);
}
console.log("ALL_VERCEL_SIM_OK");
