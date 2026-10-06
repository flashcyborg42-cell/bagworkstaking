type HeaderBag = {
  get?: (name: string) => string | null;
  forEach?: (cb: (value: string, key: string) => void) => void;
} & Record<string, string | string[] | undefined>;

type NodeReq = {
  url?: string;
  method?: string;
  headers?: HeaderBag;
};

type NodeRes = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (chunk?: unknown) => void;
};

function copyHeaders(raw: HeaderBag | undefined, headers: Headers) {
  if (!raw) return;
  if (typeof raw.forEach === "function") {
    raw.forEach((value, key) => headers.set(key, value));
    return;
  }
  for (const [key, value] of Object.entries(raw)) {
    if (value == null || key === "get" || key === "forEach") continue;
    headers.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
}

function headerValue(headers: Headers, name: string) {
  return (headers.get(name) ?? "").split(",")[0]?.trim() ?? "";
}

export function publicOrigin(request: Request) {
  const url = new URL(request.url);
  const host = headerValue(request.headers, "x-forwarded-host") || headerValue(request.headers, "host") || url.host;
  const local = /^(localhost|127\.0\.0\.1)(:|$)/i.test(host);
  const proto = local
    ? headerValue(request.headers, "x-forwarded-proto") || url.protocol.replace(":", "") || "http"
    : "https";
  return `${proto}://${host}`;
}

export function nodeToRequest(req: NodeReq): Request {
  const headers = new Headers();
  copyHeaders(req.headers, headers);
  const host = headerValue(headers, "x-forwarded-host") || headerValue(headers, "host") || "localhost";
  const local = /^(localhost|127\.0\.0\.1)(:|$)/i.test(host);
  const proto = local ? headerValue(headers, "x-forwarded-proto") || "https" : "https";
  const path = req.url ?? "/";
  const url = path.startsWith("http") ? path : `${proto}://${host}${path}`;
  return new Request(url, { method: req.method ?? "GET", headers });
}

export async function sendNodeResponse(res: NodeRes, response: Response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "transfer-encoding") return;
    res.setHeader(key, value);
  });
  res.end(Buffer.from(await response.arrayBuffer()));
}

export function isNodeResponse(res: unknown): res is NodeRes {
  return Boolean(res && typeof res === "object" && "setHeader" in res && "end" in res);
}

export function asRequest(req: Request | NodeReq): Request {
  try {
    if (typeof Request !== "undefined" && req instanceof Request) return req;
  } catch {
    /* different Request realm */
  }
  return nodeToRequest(req as NodeReq);
}

export function pathContract(request: Request) {
  const url = new URL(request.url);
  const hinted = url.searchParams.get("ca") ?? "";
  if (hinted) return decodeURIComponent(hinted);
  return decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? "");
}

export function fallbackShareHtml(request: Request | undefined) {
  const origin = request ? publicOrigin(request) : "";
  const image = origin ? `${origin}/share-card.png` : "/share-card.png";
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"/><meta name="twitter:card" content="summary_large_image"/><meta property="og:image" content="${image}"/><meta property="og:image:secure_url" content="${image}"/></head><body>Bagwork</body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

/**
 * Vercel Node invokes (req, res) and crashes if res is never ended.
 * Edge / fetch-style hosts only pass a Request and expect a Response back.
 */
export function nodeApiHandler(
  render: (request: Request) => Promise<Response>,
  fallback: (request: Request | undefined) => Response,
) {
  return async function handler(req: unknown, res: unknown) {
    let request: Request | undefined;
    try {
      request = asRequest(req as Request);
      const response = await render(request);
      if (isNodeResponse(res)) {
        await sendNodeResponse(res, response);
        return;
      }
      return response;
    } catch {
      const response = fallback(request);
      if (isNodeResponse(res)) {
        try {
          await sendNodeResponse(res, response);
        } catch {
          res.statusCode = 500;
          res.end("Bagwork");
        }
        return;
      }
      return response;
    }
  };
}
