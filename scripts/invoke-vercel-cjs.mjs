import { createRequire } from "node:module";

const require = createRequire(new URL("../api/package.json", import.meta.url));
const ca = "HpYdUftXwEaG7jekkjFvFLWeJ5dfqaFvtDHoRC6jd99s";

async function run(label, file, url) {
  const handler = require(file);
  const fn = typeof handler === "function" ? handler : handler.default;
  console.log(label, "exportType", typeof handler, "keys", handler && typeof handler === "object" ? Object.keys(handler) : []);
  const headers = {};
  let body;
  const res = {
    statusCode: 200,
    setHeader(name, value) {
      headers[String(name).toLowerCase()] = value;
    },
    end(chunk) {
      body = chunk;
    },
  };
  await fn(
    {
      url,
      method: "GET",
      headers: { host: "bagwork-staking.vercel.app", "user-agent": "WhatsApp/2.0" },
    },
    res,
  );
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body ?? "");
  const text = buf.toString("utf8");
  const title = /property="og:title" content="([^"]+)"/.exec(text)?.[1];
  console.log(
    JSON.stringify({
      label,
      status: res.statusCode,
      type: headers["content-type"],
      variant: headers["x-card-variant"],
      len: buf.length,
      hasOg: text.includes("og:image"),
      title,
    }),
  );
}

await run("stake", "./stake/[ca].js", `/api/stake/${ca}?v=3`);
await run("og", "./og/[ca].js", `/api/og/${ca}?v=2`);
