import { resolveToken } from "./token-resolver";
import { isSolanaAddress } from "./token-types";
import { contractFromRequest } from "./card-shared";
import { loadArtworkFile } from "./card-artwork";

/** Same-origin artwork proxy so browser colour sampling is never blocked by CORS. */
export async function renderArtResponse(ca: string, request?: Request): Promise<Response> {
  if (request) ca = contractFromRequest(request, ca);
  if (!isSolanaAddress(ca)) return new Response("Invalid contract address", { status: 400 });
  try {
    const token = await resolveToken(ca);
    const image = await loadArtworkFile(token.imageCandidates);
    return new Response(image.body, {
      headers: {
        "Content-Type": image.type,
        "Cache-Control": "public, max-age=300, s-maxage=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new Response("Artwork unavailable", { status: 404 });
  }
}
