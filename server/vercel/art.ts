import { nodeApiHandler, pathContract } from "../../src/lib/node-handler";
import { renderArtResponse } from "../../src/lib/card-art";

export default nodeApiHandler(
  (request) => renderArtResponse(pathContract(request), request),
  () => new Response("Artwork unavailable", { status: 404 }),
);
