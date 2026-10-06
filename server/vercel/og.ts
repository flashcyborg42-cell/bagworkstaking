import { nodeApiHandler, pathContract, publicOrigin } from "../../src/lib/node-handler";
import { renderCardResponse } from "../../src/lib/card-png";

export default nodeApiHandler(
  (request) => renderCardResponse(request, pathContract(request)),
  (request) => {
    const origin = request ? publicOrigin(request) : "";
    const location = origin ? `${origin}/share-card.png` : "/share-card.png";
    return new Response(null, { status: 302, headers: { Location: location } });
  },
);
