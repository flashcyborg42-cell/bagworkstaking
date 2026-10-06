import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const ca = "HpYdUftXwEaG7jekkjFvFLWeJ5dfqaFvtDHoRC6jd99s";
const ua = { "user-agent": "WhatsApp/2.0" };

async function vercelOg() {
  const mod = await import(pathToFileURL(process.env.VERCEL_OG).href);
  const handler = mod.default;
  const req = new Request(`https://bagwork-stakings.vercel.app/api/og/${ca}?v=2`, { headers: ua });
  const res = await handler(req);
  const buf = Buffer.from(await res.arrayBuffer());
  console.log("vercel-og", res.status, res.headers.get("content-type"), res.headers.get("x-card-variant"), buf.length, buf.subarray(0, 4));
}

async function vercelStake() {
  const mod = await import(pathToFileURL(process.env.VERCEL_STAKE).href);
  const handler = mod.default;
  const req = new Request(`https://bagwork-stakings.vercel.app/stake/${ca}?v=3`, { headers: ua });
  const res = await handler(req);
  const text = await res.text();
  const image = /property="og:image" content="([^"]+)"/.exec(text)?.[1];
  console.log("vercel-stake", res.status, Boolean(image), image, text.includes("$GIN-CHAN") || text.includes("GIN"));
}

async function netlifyOg() {
  const require = createRequire(import.meta.url);
  const mod = require(process.env.NETLIFY_OG);
  const handler = mod.handler;
  const result = await handler({
    rawUrl: `https://bagwork-staking.netlify.app/api/public/og/${ca}?v=3`,
    path: `/api/public/og/${ca}`,
    rawQuery: "v=3",
    httpMethod: "GET",
    headers: { host: "bagwork-staking.netlify.app", "user-agent": "WhatsApp/2.0" },
    queryStringParameters: { v: "3", ca },
  });
  const body = result.isBase64Encoded ? Buffer.from(result.body, "base64") : Buffer.from(result.body);
  console.log("netlify-og", result.statusCode, result.headers?.["content-type"] || result.headers?.["Content-Type"], result.isBase64Encoded, body.length, body.subarray(0, 4));
}

async function netlifyStake() {
  const mod = await import(pathToFileURL(process.env.NETLIFY_STAKE).href);
  const handler = mod.default;
  const req = new Request(`https://bagwork-staking.netlify.app/stake/${ca}?v=2`, { headers: ua });
  const res = await handler(req);
  const text = await res.text();
  const image = /property="og:image" content="([^"]+)"/.exec(text)?.[1];
  console.log("netlify-stake", res.status, Boolean(image), image);
}

const job = process.argv[2];
if (job === "vercel-og") await vercelOg();
else if (job === "vercel-stake") await vercelStake();
else if (job === "netlify-og") await netlifyOg();
else if (job === "netlify-stake") await netlifyStake();
else throw new Error(`unknown job ${job}`);
