import { renderArtResponse } from "../../src/lib/card-art";
import { contractFromRequest } from "../../src/lib/card-shared";
import { eventToRequest, lambdaResponse, type LambdaEvent } from "../../src/lib/lambda-response";

export const handler = async (event: LambdaEvent) => {
  try {
    const request = eventToRequest(event);
    const response = await renderArtResponse(contractFromRequest(request), request);
    return await lambdaResponse(response);
  } catch {
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain" },
      body: "Artwork unavailable",
    };
  }
};
