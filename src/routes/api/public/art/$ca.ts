import { createFileRoute } from "@tanstack/react-router";
import { resolveToken } from "../../../../lib/token-resolver";
import { isSolanaAddress } from "../../../../lib/token-types";

const acceptedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export const Route = createFileRoute("/api/public/art/$ca")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!isSolanaAddress(params.ca)) return new Response("Invalid contract address", { status: 400 });

        try {
          const token = await resolveToken(params.ca);
          const attempts = token.imageCandidates
            .filter((candidate) => candidate.startsWith("https://"))
            .map(async (candidate) => {
              const response = await fetch(candidate, {
                headers: { Accept: "image/avif,image/webp,image/png,image/jpeg" },
                signal: AbortSignal.timeout(3000),
              });
              const contentType = response.headers.get("content-type")?.split(";")[0] ?? "";
              if (!response.ok || !acceptedTypes.has(contentType)) throw new Error("Artwork unavailable");
              return { bytes: await response.arrayBuffer(), contentType };
            });
          const settled = await Promise.allSettled(attempts);
          const image = settled.find((result) => result.status === "fulfilled");
          if (!image || image.status !== "fulfilled") throw new Error("Artwork unavailable");

          return new Response(image.value.bytes, {
            headers: {
              "Content-Type": image.value.contentType,
              "Cache-Control": "public, max-age=300, s-maxage=3600",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch {
          const fallback = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#11131b"/><circle cx="256" cy="256" r="190" fill="hsl(155 86% 62%)"/><path d="M183 350V162h92c54 0 89 27 89 70 0 27-14 47-38 58l54 60h-81l-39-48h-8v48h-69zm69-105h19c19 0 29-8 29-23 0-14-10-22-29-22h-19v45z" fill="#090a0f"/></svg>`;
          return new Response(fallback, {
            headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=300" },
          });
        }
      },
    },
  },
});