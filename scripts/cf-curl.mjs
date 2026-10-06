const ca = "HpYdUftXwEaG7jekkjFvFLWeJ5dfqaFvtDHoRC6jd99s";
const base = "http://127.0.0.1:8788";
const ua = { "user-agent": "WhatsApp/2.0" };

async function dump(label, url) {
  const res = await fetch(url, { headers: ua });
  const buf = Buffer.from(await res.arrayBuffer());
  const headers = {};
  for (const [k, v] of res.headers) headers[k] = v;
  const text = headers["content-type"]?.includes("html") ? buf.toString("utf8") : "";
  const image = /property="og:image" content="([^"]+)"/.exec(text)?.[1];
  const title = /property="og:title" content="([^"]+)"/.exec(text)?.[1];
  console.log(JSON.stringify({
    label,
    status: res.status,
    type: headers["content-type"],
    variant: headers["x-card-variant"],
    error: headers["x-card-error"],
    len: buf.length,
    magic: [...buf.subarray(0, 4)],
    title,
    image,
  }));
}

await dump("stake", `${base}/stake/${ca}?v=3`);
await dump("og-v2", `${base}/api/public/og/${ca}?v=2`);
await dump("og-v3", `${base}/api/public/og/${ca}?v=3`);
await dump("v34", `${base}/stake/${ca}?v34`);
