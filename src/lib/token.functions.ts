import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { resolveToken } from "./token-resolver";

export const getTokenByAddress = createServerFn({ method: "GET" })
  .validator((input) => z.object({ ca: z.string().trim().min(32).max(44) }).parse(input))
  .handler(({ data }) => resolveToken(data.ca));

// Meta tags must point at whichever domain is serving the page.
export const getRequestOrigin = createServerFn({ method: "GET" }).handler(async () => {
  const { getRequestUrl } = await import("@tanstack/react-start/server");
  return new URL(getRequestUrl()).origin;
});
