import { renderCardResponse } from "../src/lib/card-png.ts";
import { renderStakeHtmlResponse } from "../src/lib/card-html.ts";
import { requestedVersion, hasExplicitVersion } from "../src/lib/card-shared.ts";

const ca = "HpYdUftXwEaG7jekkjFvFLWeJ5dfqaFvtDHoRC6jd99s";
const origin = "https://bagwork-staking.netlify.app";

const v34 = new URL(origin + "/stake/" + ca + "?v34");
const v23 = new URL(origin + "/stake/" + ca + "?v23");
console.log("pin", requestedVersion(v34), hasExplicitVersion(v34), requestedVersion(v23), hasExplicitVersion(v23));

const og = await renderCardResponse(new Request(origin + "/api/public/og/" + ca + "?v=2"), ca);
const bytes = Buffer.from(await og.arrayBuffer());
console.log("og", og.status, og.headers.get("content-type"), og.headers.get("x-card-variant"), bytes.length, bytes.subarray(0, 4));

const html = await renderStakeHtmlResponse(
  new Request(origin + "/stake/" + ca + "?v34", { headers: { "user-agent": "WhatsApp/2.0" } }),
  ca,
);
const text = await html.text();
const image = /property="og:image" content="([^"]+)"/.exec(text)?.[1];
console.log("html", html.status, Boolean(image), image, text.includes("og:image:type"));
