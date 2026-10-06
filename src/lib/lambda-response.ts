/** Turn a Web Response into a Netlify/Lambda classic payload (binary-safe). */
export type LambdaEvent = {
  rawUrl?: string;
  path?: string;
  rawQuery?: string;
  httpMethod?: string;
  headers?: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined> | null;
};

export function eventToRequest(event: LambdaEvent): Request {
  const headers = event.headers ?? {};
  const host = headers["host"] ?? headers["Host"] ?? "localhost";
  const proto = headers["x-forwarded-proto"] ?? "https";
  const query =
    event.rawQuery ||
    new URLSearchParams(
      Object.entries(event.queryStringParameters ?? {}).filter((entry): entry is [string, string] => Boolean(entry[1])),
    ).toString();
  const original =
    headers["x-original-url"] ||
    headers["x-forwarded-url"] ||
    headers["x-forwarded-uri"] ||
    headers["x-rewrite-url"];
  const url =
    event.rawUrl ||
    (original && original.startsWith("http")
      ? original
      : original
        ? `${proto}://${host}${original}`
        : `${proto}://${host}${event.path ?? "/"}${query ? `?${query}` : ""}`);
  const requestHeaders = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (value) requestHeaders.set(key, value);
  }
  return new Request(url, { method: event.httpMethod ?? "GET", headers: requestHeaders });
}

export async function lambdaResponse(response: Response) {
  const buf = Buffer.from(await response.arrayBuffer());
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "transfer-encoding") return;
    headers[key] = value;
  });
  const binary = !/^text\/|^application\/(json|javascript|xml)/i.test(headers["content-type"] ?? headers["Content-Type"] ?? "");
  return {
    statusCode: response.status,
    headers,
    body: binary ? buf.toString("base64") : buf.toString("utf8"),
    isBase64Encoded: binary,
  };
}
