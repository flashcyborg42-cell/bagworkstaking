import { writeFileSync } from "node:fs";
import { renderCardResponse } from "../src/lib/card-render.ts";
import { renderStakeHtmlResponse } from "../src/lib/card-html.ts";

const ca = "HpYdUftXwEaG7jekkjFvFLWeJ5dfqaFvtDHoRC6jd99s";
const origin = "http://127.0.0.1:4174";

async function run(version) {
  const request = new Request(`${origin}/api/public/og/${ca}?v=${version}`);
  const started = Date.now();
  const response = await renderCardResponse(request, ca);
  const bytes = Buffer.from(await response.arrayBuffer());
  writeFileSync(`samples/live-v${version}.png`, bytes);
  console.log(
    `og v${version}`,
    response.status,
    response.headers.get("content-type"),
    response.headers.get("x-card-variant"),
    bytes.length,
    `${Date.now() - started}ms`,
  );
}

await run(2);
await run(3);

const htmlResponse = await renderStakeHtmlResponse(
  new Request(`${origin}/stake/${ca}?v3`, { headers: { "user-agent": "Discordbot/2.0" } }),
  ca,
);
const html = await htmlResponse.text();
const image = html.match(/property="og:image" content="([^"]+)"/)?.[1] ?? "";
console.log("stake", htmlResponse.status, htmlResponse.headers.get("cache-control"));
console.log("og:image", image);
console.log(image.includes("/api/public/og/") && html.includes("twitter:card") ? "meta-ok" : "meta-missing");
